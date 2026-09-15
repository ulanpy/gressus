# Run from an elevated PowerShell after windows-bridge-watchdog.ps1 has been
# manually validated. Creates an at-startup LocalSystem task with no GUI.

[CmdletBinding()]
param(
  [string]$HostAddress = "192.168.122.1",
  [int]$Port = 9100,
  [string]$EmgHostAddress = "192.168.122.1",
  [int]$EmgPort = 9101,
  # Empty is the safe default: no EMG transport until confirmed sensor slots.
  [string]$EmgSensors = ""
)

$ErrorActionPreference = "Stop"
$taskName = "Gressus Cometa Bridge Watchdog"
$watchdog = Join-Path $PSScriptRoot "windows-bridge-watchdog.ps1"
if (-not (Test-Path $watchdog)) { throw "Missing watchdog: $watchdog" }

$watchdogArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$watchdog`" -HostAddress `"$HostAddress`" -Port $Port"
if (-not [string]::IsNullOrWhiteSpace($EmgSensors)) {
  $watchdogArgs += " -EmgHostAddress `"$EmgHostAddress`" -EmgPort $EmgPort -EmgSensors `"$EmgSensors`""
}
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $watchdogArgs
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed and started: $taskName"
