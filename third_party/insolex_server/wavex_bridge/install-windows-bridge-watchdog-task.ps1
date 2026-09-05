# Run from an elevated PowerShell after windows-bridge-watchdog.ps1 has been
# manually validated. Creates an at-startup LocalSystem task with no GUI.

$ErrorActionPreference = "Stop"
$taskName = "Gressus Cometa Bridge Watchdog"
$watchdog = Join-Path $PSScriptRoot "windows-bridge-watchdog.ps1"
if (-not (Test-Path $watchdog)) { throw "Missing watchdog: $watchdog" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (
  "-NoProfile -ExecutionPolicy Bypass -File `"$watchdog`""
)
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed and started: $taskName"
