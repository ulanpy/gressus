# Keep the WaveX bridge aligned with the Windows PnP state of the Cometa
# receiver. Intended to run as LocalSystem from Task Scheduler after validation.

[CmdletBinding()]
param(
  [string]$HostAddress = "192.168.122.1",
  [int]$Port = 9100,
  [int]$PollSeconds = 1,
  # The Cometa driver can briefly remove 01aa while it re-enumerates. Do not
  # kill a healthy bridge until absence itself is stable.
  [int]$MissingStableSeconds = 12,
  # A longer absence followed by 01aa is a real USB re-enumeration. The WaveX
  # process cannot restore its DaqSystem after that event, so recreate it.
  [int]$ReenumerationSeconds = 5
)

$ErrorActionPreference = "Stop"
$bridgeRoot = $PSScriptRoot
$runScript = Join-Path $bridgeRoot "run.ps1"
$bridgeExe = Join-Path $bridgeRoot "bin\wavex-bridge.exe"
$logDirectory = Join-Path $env:ProgramData "Gressus"
$logPath = Join-Path $logDirectory "cometa-bridge-watchdog.log"
New-Item -ItemType Directory -Force $logDirectory | Out-Null

function Write-WatchdogLog([string]$Message) {
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath $logPath -Value $line
  Write-Host $line
}

function Get-ReceiverReady {
  $device = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object {
      $_.InstanceId -match 'VID_04B4&PID_01AA' -and $_.Status -eq 'OK'
    } |
    Select-Object -First 1
  return $null -ne $device
}

function Start-Bridge([int]$Attempt) {
  $attemptPrefix = Join-Path $logDirectory ("cometa-bridge-attempt-{0:D4}" -f $Attempt)
  $stdoutPath = "$attemptPrefix.stdout.log"
  $stderrPath = "$attemptPrefix.stderr.log"
  # Do not invoke run.ps1 here: it compiles and copies DLLs. Rebuilding while
  # an earlier bridge owns CyUSB.DLL causes the exact lock race this watchdog
  # is meant to recover from.
  $process = Start-Process -FilePath $bridgeExe -ArgumentList @("--tcp", $HostAddress, $Port, "--rf-start") `
    -WorkingDirectory $bridgeRoot -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru
  return [pscustomobject]@{
    Process = $process
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
  }
}

if (-not (Test-Path $runScript)) {
  throw "Missing bridge launcher: $runScript"
}
if (-not (Test-Path $bridgeExe)) {
  throw "Missing prepared bridge executable: $bridgeExe. Run .\\run.ps1 -BuildOnly once from an Administrator PowerShell before starting this watchdog."
}

Write-WatchdogLog "Windows bridge watchdog started; waiting for VID_04B4&PID_01AA."
$bridge = $null
$attempt = 0
$missingSince = $null

while ($true) {
  $ready = Get-ReceiverReady
  $running = $null -ne $bridge -and -not $bridge.Process.HasExited

  if (-not $ready) {
    if ($null -eq $missingSince) {
      $missingSince = Get-Date
      Write-WatchdogLog "Receiver 01aa temporarily absent; requiring $MissingStableSeconds seconds of continuous absence before bridge stop."
    }
    $missingFor = ((Get-Date) - $missingSince).TotalSeconds
    if ($running -and $missingFor -ge $MissingStableSeconds) {
      Write-WatchdogLog "Receiver absent for $([math]::Floor($missingFor)) seconds; stopping bridge process $($bridge.Process.Id)."
      Stop-Process -Id $bridge.Process.Id -Force -ErrorAction SilentlyContinue
      $bridge = $null
    }
  } else {
    if ($null -ne $missingSince) {
      $missingFor = ((Get-Date) - $missingSince).TotalSeconds
      if ($running -and $missingFor -ge $ReenumerationSeconds) {
        Write-WatchdogLog "Receiver 01aa returned after $([math]::Floor($missingFor)) seconds; treating this as USB re-enumeration and restarting bridge process $($bridge.Process.Id)."
        Stop-Process -Id $bridge.Process.Id -Force -ErrorAction SilentlyContinue
        $bridge = $null
        $running = $false
      } elseif ($running) {
        Write-WatchdogLog "Receiver 01aa returned after $([math]::Floor($missingFor)) seconds; transient PnP blip, keeping bridge process."
      }
    }
    $missingSince = $null
    if (-not $running) {
      if ($null -ne $bridge) {
        $bridge.Process.Refresh()
        Write-WatchdogLog (
          "Bridge exited with code $($bridge.Process.ExitCode); " +
          "stdout=$($bridge.StdoutPath), stderr=$($bridge.StderrPath). Retrying on the next PnP poll."
        )
      }
      $attempt++
      $bridge = Start-Bridge $attempt
      Write-WatchdogLog (
        "Starting WaveX bridge with --rf-start; process=$($bridge.Process.Id), " +
        "stdout=$($bridge.StdoutPath), stderr=$($bridge.StderrPath)."
      )
    }
  }

  Start-Sleep -Seconds $PollSeconds
}
