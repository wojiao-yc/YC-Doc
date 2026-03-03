$ErrorActionPreference = "Stop"

$runner = "d:\python\project\Simple\local-runner.ps1"
$cwd = "d:\python\project\Simple"
$port = 8790
$token = "test-token"
$base = "http://127.0.0.1:$port"

$proc = Start-Process -FilePath powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$runner`" -Port $port -Token `"$token`" -DefaultCwd `"$cwd`"" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1

try {
  $h = @{ Authorization = "Bearer $token" }

  $create = Invoke-RestMethod -Uri "$base/session/create" -Method Post -Headers $h -ContentType "application/json" -Body (@{
    shell = "powershell"
    cwd = $cwd
  } | ConvertTo-Json)

  $sid = $create.sessionId
  Write-Output "sessionId=$sid"

  Invoke-RestMethod -Uri "$base/session/write" -Method Post -Headers $h -ContentType "application/json" -Body (@{
    sessionId = $sid
    input = "Write-Output hello`r`n"
  } | ConvertTo-Json) | Out-Null

  Start-Sleep -Milliseconds 700

  $read = Invoke-RestMethod -Uri "$base/session/read" -Method Post -Headers $h -ContentType "application/json" -Body (@{
    sessionId = $sid
    cursor = 0
    limit = 100
  } | ConvertTo-Json)

  $read | ConvertTo-Json -Depth 8
}
finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
