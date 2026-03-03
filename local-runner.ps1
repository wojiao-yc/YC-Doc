param(
  [int]$Port = 8787,
  [string]$Token = "change-me",
  [string]$DefaultCwd = ""
)

$prefix = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

$script:Sessions = [hashtable]::Synchronized(@{})

Write-Host "Local Runner listening on $prefix"
Write-Host "Token = $Token"
Write-Host "Press Ctrl+C to stop."

function Write-Json($ctx, $status, $obj) {
  $json = ($obj | ConvertTo-Json -Depth 8)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.AddHeader("Access-Control-Allow-Origin", "*")
  $ctx.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  $ctx.Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

function Read-JsonBody($req) {
  $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
  $body = $reader.ReadToEnd()
  $reader.Close()
  if ([string]::IsNullOrWhiteSpace($body)) {
    return @{}
  }
  return ($body | ConvertFrom-Json)
}

function Resolve-ShellTarget($name) {
  $lower = [string]$name
  $lower = $lower.ToLowerInvariant()
  $tryList = @()
  $mode = ""

  switch ($lower) {
    "pwsh" {
      $tryList = @("pwsh.exe", "pwsh", "powershell.exe", "powershell", "cmd.exe")
      $mode = "pwsh"
      break
    }
    "powershell" {
      $tryList = @("powershell.exe", "powershell", "pwsh.exe", "pwsh", "cmd.exe")
      $mode = "pwsh"
      break
    }
    "bash" {
      $tryList = @("bash.exe", "bash")
      $mode = "bash"
      break
    }
    "cmd" {
      $tryList = @("cmd.exe", "cmd")
      $mode = "cmd"
      break
    }
    default {
      throw "bad_shell: $name"
    }
  }

  foreach ($candidate in $tryList) {
    $found = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($found) {
      if ($mode -eq "pwsh" -and $candidate -like "cmd*") {
        return @{ FileName = $found.Source; Mode = "cmd"; Requested = $lower; Resolved = $candidate }
      }
      return @{ FileName = $found.Source; Mode = $mode; Requested = $lower; Resolved = $candidate }
    }
  }

  throw "shell_not_found: $name"
}

function Add-SessionChunk($sessionId, $stream, $data) {
  if ([string]::IsNullOrWhiteSpace($sessionId)) { return }
  $session = $script:Sessions[$sessionId]
  if (-not $session) { return }

  [System.Threading.Monitor]::Enter($session.SyncRoot)
  try {
    $chunk = @{
      seq = [int]$session.NextSeq
      stream = [string]$stream
      data = [string]$data
      ts = [DateTimeOffset]::UtcNow.ToString("o")
    }
    $session.NextSeq = [int]$session.NextSeq + 1
    [void]$session.Chunks.Add($chunk)

    if ($session.Chunks.Count -gt 4000) {
      $drop = $session.Chunks.Count - 3200
      for ($i = 0; $i -lt $drop; $i++) {
        $session.Chunks.RemoveAt(0)
      }
    }
  } finally {
    [System.Threading.Monitor]::Exit($session.SyncRoot)
  }
}

function Get-SessionKind($session) {
  if (-not $session) { return "" }
  if ($session -is [System.Collections.IDictionary]) {
    try {
      if ($session.Contains("Kind")) {
        return [string]$session["Kind"]
      }
    } catch {}
  }
  try {
    return [string]$session.Kind
  } catch {}
  return ""
}

function New-SessionBase($id, $shellResolved, $mode, $cwd) {
  return [ordered]@{
    Id = $id
    Kind = ""
    Shell = $shellResolved
    Mode = $mode
    Cwd = $cwd
    CreatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    Closed = $false
    ExitCode = $null
    NextSeq = 1
    Chunks = (New-Object System.Collections.ArrayList)
    SyncRoot = (New-Object object)
  }
}

function Create-PowerShellRunspaceSession($target, $cwd) {
  $id = [Guid]::NewGuid().ToString("N")
  $rs = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace()
  $rs.Open()

  if (-not [string]::IsNullOrWhiteSpace($cwd)) {
    $initPs = [System.Management.Automation.PowerShell]::Create()
    $initPs.Runspace = $rs
    [void]$initPs.AddCommand("Set-Location").AddParameter("LiteralPath", $cwd)
    [void]$initPs.Invoke()
    $initPs.Dispose()
  }

  $session = New-SessionBase $id $target.Resolved $target.Mode $cwd
  $session.Kind = "runspace"
  $session.Runspace = $rs
  $script:Sessions[$id] = $session

  Add-SessionChunk $id "meta" ("[session] created " + $target.Resolved + " (runspace)" + [Environment]::NewLine)

  return @{
    sessionId = $id
    shell = $target.Resolved
    mode = $target.Mode
    cwd = $cwd
    cursor = 0
    createdAt = $session.CreatedAt
  }
}

function Create-ProcessSession($target, $cwd) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $target.FileName
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  if (-not [string]::IsNullOrWhiteSpace($cwd)) {
    $psi.WorkingDirectory = $cwd
  }

  if ($target.Mode -eq "bash") {
    $psi.Arguments = "-i"
  } elseif ($target.Mode -eq "cmd") {
    $psi.Arguments = "/Q /K"
  } else {
    $loopScript = '$ProgressPreference = "SilentlyContinue"; $ErrorActionPreference = "Continue"; while(($line=[Console]::In.ReadLine()) -ne $null){ if([string]::IsNullOrWhiteSpace($line)){ continue }; try { Invoke-Expression $line } catch { Write-Error $_ } }'
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($loopScript)
    $enc = [Convert]::ToBase64String($bytes)
    $psi.Arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $enc"
  }

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $proc.EnableRaisingEvents = $true
  [void]$proc.Start()

  $id = [Guid]::NewGuid().ToString("N")
  $session = New-SessionBase $id $target.Resolved $target.Mode $cwd
  $session.Kind = "process"
  $session.Process = $proc

  $script:Sessions[$id] = $session
  Add-SessionChunk $id "meta" ("[session] created " + $target.Resolved + [Environment]::NewLine)

  return @{
    sessionId = $id
    shell = $target.Resolved
    mode = $target.Mode
    cwd = $cwd
    cursor = 0
    createdAt = $session.CreatedAt
  }
}

function Create-InteractiveSession($shell, $cwd) {
  if ([string]::IsNullOrWhiteSpace($shell)) { $shell = "powershell" }
  if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = $DefaultCwd }

  if (-not [string]::IsNullOrWhiteSpace($cwd)) {
    if (-not (Test-Path -Path $cwd -PathType Container)) {
      throw "cwd_not_found: $cwd"
    }
  }

  $target = Resolve-ShellTarget $shell
  if ($target.Mode -eq "pwsh") {
    return (Create-PowerShellRunspaceSession $target $cwd)
  }
  return (Create-ProcessSession $target $cwd)
}

function Terminate-Session($sessionId, $reason = "terminated") {
  $session = $script:Sessions[$sessionId]
  if (-not $session) { return $false }

  $kind = Get-SessionKind $session
  if ($kind -eq "process") {
    try { $session.Process.CancelOutputRead() } catch {}
    try { $session.Process.CancelErrorRead() } catch {}
    try { $session.Process.StandardInput.Close() } catch {}

    if (-not $session.Process.HasExited) {
      try { $session.Process.Kill($true) } catch {
        try { $session.Process.Kill() } catch {}
      }
    }
  } elseif ($kind -eq "runspace") {
    try { $session.Runspace.Close() } catch {}
    try { $session.Runspace.Dispose() } catch {}
  } else {
    # best effort for unknown type
    if ($session.PSObject.Properties.Name -contains "Process") {
      try { $session.Process.Kill() } catch {}
    }
  }

  $session.Closed = $true
  Add-SessionChunk $sessionId "meta" ("[session] " + $reason + [Environment]::NewLine)
  $script:Sessions.Remove($sessionId) | Out-Null
  return $true
}

function Read-Session($sessionId, $cursor, $limit) {
  $session = $script:Sessions[$sessionId]
  if (-not $session) {
    throw "session_not_found"
  }

  if ($limit -lt 1) { $limit = 1 }
  if ($limit -gt 500) { $limit = 500 }
  if ($cursor -lt 0) { $cursor = 0 }

  $result = New-Object System.Collections.ArrayList
  $newCursor = [int]$cursor

  [System.Threading.Monitor]::Enter($session.SyncRoot)
  try {
    foreach ($chunk in $session.Chunks) {
      if ([int]$chunk.seq -le $cursor) { continue }
      [void]$result.Add($chunk)
      $newCursor = [int]$chunk.seq
      if ($result.Count -ge $limit) { break }
    }
  } finally {
    [System.Threading.Monitor]::Exit($session.SyncRoot)
  }

  $alive = $false
  $kind = Get-SessionKind $session
  if ($kind -eq "process") {
    $alive = (-not $session.Closed) -and (-not $session.Process.HasExited)
  } else {
    $alive = (-not $session.Closed)
  }
  return @{
    sessionId = $sessionId
    alive = $alive
    exitCode = $session.ExitCode
    cursor = $newCursor
    chunks = @($result)
  }
}

function Write-Session($sessionId, $userInput) {
  $session = $script:Sessions[$sessionId]
  if (-not $session) { throw "session_not_found" }
  $kind = Get-SessionKind $session

  if ($kind -eq "runspace") {
    if ($session.Closed) { throw "session_closed" }
    $cmd = [string]$userInput
    if ([string]::IsNullOrWhiteSpace($cmd)) {
      return @{ ok = $true }
    }

    $ps = [System.Management.Automation.PowerShell]::Create()
    $ps.Runspace = $session.Runspace
    [void]$ps.AddScript($cmd, $false)

    try {
      $result = $ps.Invoke()
      if ($result -and $result.Count -gt 0) {
        $stdoutText = ($result | Out-String -Width 4096)
        if (-not [string]::IsNullOrWhiteSpace($stdoutText)) {
          Add-SessionChunk $sessionId "stdout" $stdoutText
        }
      }

      foreach ($err in $ps.Streams.Error) {
        Add-SessionChunk $sessionId "stderr" (($err.ToString()) + [Environment]::NewLine)
      }
      foreach ($warn in $ps.Streams.Warning) {
        Add-SessionChunk $sessionId "stderr" (($warn.Message) + [Environment]::NewLine)
      }

      # Sync cwd so prompt in UI can be derived consistently later if needed.
      $cwdPs = [System.Management.Automation.PowerShell]::Create()
      $cwdPs.Runspace = $session.Runspace
      [void]$cwdPs.AddCommand("Get-Location")
      $cwdObj = $cwdPs.Invoke()
      if ($cwdObj -and $cwdObj.Count -gt 0) {
        $pathProp = $cwdObj[0].PSObject.Properties["Path"]
        if ($pathProp -and $pathProp.Value) {
          $session.Cwd = [string]$pathProp.Value
        }
      }
      $cwdPs.Dispose()
    } catch {
      Add-SessionChunk $sessionId "stderr" ("$($_.Exception.Message)" + [Environment]::NewLine)
    } finally {
      $ps.Dispose()
    }

    return @{
      ok = $true
    }
  }

  if ($session.Closed -or $session.Process.HasExited) { throw "session_closed" }
  $session.Process.StandardInput.Write([string]$userInput)
  $session.Process.StandardInput.Flush()
  return @{ ok = $true }
}

function Run-OnceCommand($shell, $cmd, $cwd) {
  if ([string]::IsNullOrWhiteSpace($shell)) { $shell = "powershell" }
  if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = $DefaultCwd }
  if (-not [string]::IsNullOrWhiteSpace($cwd)) {
    if (-not (Test-Path -Path $cwd -PathType Container)) {
      throw "cwd_not_found: $cwd"
    }
  }

  $target = Resolve-ShellTarget $shell
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $target.FileName
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  if (-not [string]::IsNullOrWhiteSpace($cwd)) { $psi.WorkingDirectory = $cwd }

  if ($target.Mode -eq "bash") {
    $escaped = $cmd -replace "'", "'\\''"
    $psi.Arguments = "-lc '$escaped'"
  } elseif ($target.Mode -eq "cmd") {
    $escaped = $cmd -replace '"', '""'
    $psi.Arguments = "/d /s /c ""$escaped"""
  } else {
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($cmd)
    $enc = [Convert]::ToBase64String($bytes)
    $psi.Arguments = "-NoProfile -NonInteractive -EncodedCommand $enc"
  }

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  return @{
    stdout = $stdout
    stderr = $stderr
    code = $p.ExitCode
    shell = $target.Resolved
  }
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $req = $ctx.Request
  $path = $req.Url.AbsolutePath

  if ($req.HttpMethod -eq "OPTIONS") {
    $ctx.Response.StatusCode = 204
    $ctx.Response.AddHeader("Access-Control-Allow-Origin", "*")
    $ctx.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $ctx.Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $ctx.Response.OutputStream.Close()
    continue
  }

  if ($path -eq "/health") {
    Write-Json $ctx 200 @{
      ok = $true
      sessions = $script:Sessions.Count
      time = [DateTimeOffset]::UtcNow.ToString("o")
    }
    continue
  }

  if ($req.HttpMethod -ne "POST") {
    Write-Json $ctx 405 @{ error = "method_not_allowed" }
    continue
  }

  $auth = $req.Headers["Authorization"]
  if (-not $auth -or -not $auth.StartsWith("Bearer ")) {
    Write-Json $ctx 401 @{ error = "missing_token" }
    continue
  }
  $got = $auth.Substring(7)
  if ($got -ne $Token) {
    Write-Json $ctx 403 @{ error = "bad_token" }
    continue
  }

  try {
    $data = Read-JsonBody $req
  } catch {
    Write-Json $ctx 400 @{ error = "bad_json" }
    continue
  }

  try {
    if ($path -eq "/run") {
      $cmd = [string]$data.cmd
      $shell = [string]$data.shell
      $cwd = [string]$data.cwd
      if ([string]::IsNullOrWhiteSpace($cmd)) {
        Write-Json $ctx 400 @{ error = "empty_cmd" }
        continue
      }
      if ($shell -notin @("pwsh", "powershell", "bash", "cmd")) {
        Write-Json $ctx 400 @{ error = "bad_shell"; allowed = @("pwsh", "powershell", "bash", "cmd") }
        continue
      }
      Write-Json $ctx 200 (Run-OnceCommand $shell $cmd $cwd)
      continue
    }

    if ($path -eq "/session/create") {
      $shell = [string]$data.shell
      $cwd = [string]$data.cwd
      if ($shell -notin @("pwsh", "powershell", "bash", "cmd")) {
        Write-Json $ctx 400 @{ error = "bad_shell"; allowed = @("pwsh", "powershell", "bash", "cmd") }
        continue
      }
      Write-Json $ctx 200 (Create-InteractiveSession $shell $cwd)
      continue
    }

    if ($path -eq "/session/write") {
      $sid = [string]$data.sessionId
      $userInput = [string]$data.input
      if ([string]::IsNullOrWhiteSpace($sid)) {
        Write-Json $ctx 400 @{ error = "missing_session_id" }
        continue
      }
      Write-Json $ctx 200 (Write-Session $sid $userInput)
      continue
    }

    if ($path -eq "/session/read") {
      $sid = [string]$data.sessionId
      $cursor = 0
      $limit = 200
      if ($data.PSObject.Properties.Name -contains "cursor") {
        $cursor = [int]$data.cursor
      }
      if ($data.PSObject.Properties.Name -contains "limit") {
        $limit = [int]$data.limit
      }
      if ([string]::IsNullOrWhiteSpace($sid)) {
        Write-Json $ctx 400 @{ error = "missing_session_id" }
        continue
      }
      Write-Json $ctx 200 (Read-Session $sid $cursor $limit)
      continue
    }

    if ($path -eq "/session/terminate") {
      $sid = [string]$data.sessionId
      if ([string]::IsNullOrWhiteSpace($sid)) {
        Write-Json $ctx 400 @{ error = "missing_session_id" }
        continue
      }
      $ok = Terminate-Session $sid "terminated by client"
      if (-not $ok) {
        Write-Json $ctx 404 @{ error = "session_not_found" }
      } else {
        Write-Json $ctx 200 @{ ok = $true }
      }
      continue
    }

    Write-Json $ctx 404 @{ error = "not_found" }
  } catch {
    $msg = "$_"
    if ($msg -eq "session_not_found") {
      Write-Json $ctx 404 @{ error = "session_not_found" }
      continue
    }
    if ($msg -eq "session_closed") {
      Write-Json $ctx 410 @{ error = "session_closed" }
      continue
    }
    Write-Json $ctx 500 @{ error = "exec_failed"; detail = $msg }
  }
}
