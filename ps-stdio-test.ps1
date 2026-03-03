param(
  [string]$ArgsToUse = "-NoLogo -NoProfile -NoExit",
  [switch]$CloseInput
)

$ErrorActionPreference = "Stop"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = $ArgsToUse
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
$p.EnableRaisingEvents = $true

$chunks = New-Object System.Collections.ArrayList
$sync = New-Object object

$outHandler = [System.Diagnostics.DataReceivedEventHandler]{
  param($sender, $event)
  if ($null -ne $event.Data) {
    [System.Threading.Monitor]::Enter($sync)
    try { [void]$chunks.Add("[out] " + $event.Data) } finally { [System.Threading.Monitor]::Exit($sync) }
  }
}
$errHandler = [System.Diagnostics.DataReceivedEventHandler]{
  param($sender, $event)
  if ($null -ne $event.Data) {
    [System.Threading.Monitor]::Enter($sync)
    try { [void]$chunks.Add("[err] " + $event.Data) } finally { [System.Threading.Monitor]::Exit($sync) }
  }
}

[void]$p.Start()
$p.add_OutputDataReceived($outHandler)
$p.add_ErrorDataReceived($errHandler)
$p.BeginOutputReadLine()
$p.BeginErrorReadLine()

$p.StandardInput.WriteLine("Write-Output hello")
$p.StandardInput.WriteLine("Get-Location")
if ($CloseInput) {
  $p.StandardInput.Close()
  $p.WaitForExit(2000) | Out-Null
}
Start-Sleep -Milliseconds 900

[System.Threading.Monitor]::Enter($sync)
try {
  if ($chunks.Count -eq 0) {
    Write-Output "<no output>"
  } else {
    $chunks | ForEach-Object { Write-Output $_ }
  }
} finally {
  [System.Threading.Monitor]::Exit($sync)
}

try { $p.StandardInput.WriteLine("exit") } catch {}
Start-Sleep -Milliseconds 200
if (-not $p.HasExited) {
  try { $p.Kill() } catch {}
}
