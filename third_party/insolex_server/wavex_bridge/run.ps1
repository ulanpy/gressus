param(
  # Prepare the executable and runtime DLLs, then exit. Used once after an
  # update; the watchdog must never compile while a bridge may be running.
  [switch]$BuildOnly,
  # Rebuild even when a complete prepared runtime already exists.
  [switch]$ForceRebuild
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  throw "Run PowerShell as Administrator (driver access)."
}

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $PSScriptRoot "bin"
$outExe = Join-Path $outDir "wavex-bridge.exe"

$deps = Join-Path $root "WaveX_SDK_1.17.5_2025_08_05\example\WaveX_1_17_5_Example\Dependencies"
$exampleBin = Join-Path $root "WaveX_SDK_1.17.5_2025_08_05\example\WaveX_1_17_5_Example\WaveX.Example\bin\Debug"
$toolsBin = "C:\Program Files\Cometa S.r.l\EMGandMotionTools"

# EMG & Motion Tools 8.15.13 ships patched WaveX 1.17.5 assemblies with
# additional InsoleX initialization support. Prefer the exact runtime used by
# the working application; fall back to the standalone SDK when it is absent.
$waveRuntime = $deps
$niRuntime = $exampleBin
$runtimeConfig = Join-Path $exampleBin "WaveX.Example.exe.config"
if ((Test-Path (Join-Path $toolsBin "EMGandMotionTools.exe")) -and
    (Test-Path (Join-Path $toolsBin "WaveX.dll")) -and
    (Test-Path (Join-Path $toolsBin "WaveX.Common.dll")) -and
    (Test-Path (Join-Path $toolsBin "WaveX.Sys.dll"))) {
  $waveRuntime = $toolsBin
  $niRuntime = $toolsBin
  $runtimeConfig = Join-Path $toolsBin "EMGandMotionTools.exe.config"
  Write-Host "Using WaveX runtime from installed EMG & Motion Tools." -ForegroundColor Cyan
} else {
  Write-Host "EMG & Motion Tools runtime not found; using standalone SDK DLLs." -ForegroundColor Yellow
}

$refs = @(
  (Join-Path $waveRuntime "CyUSB.DLL"),
  (Join-Path $waveRuntime "PicoBlue.DaqSys.dll"),
  (Join-Path $waveRuntime "WaveX.dll"),
  (Join-Path $waveRuntime "WaveX.Common.dll"),
  (Join-Path $waveRuntime "WaveX.Sys.dll"),

  # WaveX.Sys tries to load NI-DAQmx at startup even if you don't use analog.
  # The SDK example ships the required assemblies in its bin folder.
  (Join-Path $niRuntime "NationalInstruments.Common.dll"),
  (Join-Path $niRuntime "NationalInstruments.DAQmx.dll")
)

$runtimeExtras = @(
  (Join-Path $exampleBin "Windows.winmd"),
  (Join-Path $exampleBin "WaxeX.ASys.dll"),
  (Join-Path $exampleBin "WaveX.Sys.dll.config"),
  (Join-Path $exampleBin "WaveX.Example.exe.config")
)

foreach ($r in $refs) {
  if (-not (Test-Path $r)) { throw "Missing dependency: $r" }
}
foreach ($x in $runtimeExtras) {
  if (-not (Test-Path $x)) { throw "Missing runtime file: $x" }
}

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (-not (Test-Path $csc)) { throw "csc.exe not found (need .NET Framework 4.x)" }

New-Item -ItemType Directory -Force $outDir | Out-Null

$requiredOutputFiles = @($outExe) +
  ($refs | ForEach-Object { Join-Path $outDir (Split-Path -Leaf $_) }) +
  @(
    (Join-Path $outDir "Windows.winmd"),
    (Join-Path $outDir "WaxeX.ASys.dll"),
    (Join-Path $outDir "WaveX.Sys.dll.config"),
    (Join-Path $outDir "wavex-bridge.exe.config")
  )
$needsBuild = $ForceRebuild -or ($null -ne ($requiredOutputFiles | Where-Object { -not (Test-Path $_) } | Select-Object -First 1))

if ($needsBuild) {
  Write-Host "Compiling wavex-bridge..." -ForegroundColor Cyan
  & $csc /nologo /optimize /unsafe- /platform:x64 /target:exe `
    /out:$outExe `
    /langversion:5 `
    ($refs | ForEach-Object { "/reference:$($_)" }) `
    (Join-Path $PSScriptRoot "Program.cs")

  if ($LASTEXITCODE -ne 0) {
    throw "Compile failed (csc exit code $LASTEXITCODE); existing wavex-bridge.exe was not replaced."
  }

  if (-not (Test-Path $outExe)) {
    throw "Compile failed, exe was not created: $outExe"
  }

  foreach ($r in $refs) {
    Copy-Item -Force $r $outDir
  }

  # Copy runtime extras that the example ships with.
  Copy-Item -Force (Join-Path $exampleBin "Windows.winmd") $outDir
  Copy-Item -Force (Join-Path $exampleBin "WaxeX.ASys.dll") $outDir
  Copy-Item -Force (Join-Path $exampleBin "WaveX.Sys.dll.config") $outDir
  Copy-Item -Force $runtimeConfig (Join-Path $outDir "wavex-bridge.exe.config")
} else {
  Write-Host "Using prepared wavex-bridge runtime." -ForegroundColor Cyan
}

if ($BuildOnly) {
  Write-Host "wavex-bridge build is ready: $outExe" -ForegroundColor Green
  exit 0
}

Write-Host "Running wavex-bridge (Ctrl+C to stop)..." -ForegroundColor Cyan
if ($args -contains "--rf-start") {
  Write-Host "RF-start mode: enables RF insoles and performs the required wake-up memory recording." -ForegroundColor Yellow
} else {
  Write-Host "Read-only relay: the saved receiver/sensor configuration will not be changed." -ForegroundColor Green
}
Write-Host "Close EMG & Motion Tools and WaveX.Example.exe before running bridge." -ForegroundColor Yellow
Write-Host 'Example local libvirt VM: .\run.ps1 --tcp 192.168.122.1 9100' -ForegroundColor DarkGray
& $outExe @args
