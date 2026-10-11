<#
.SYNOPSIS
  Build Video Hub App and install it over the current installation (Windows only).

.DESCRIPTION
  1. builds the app and the installer            (skip with -SkipBuild)
  2. closes the running app, letting it save the hub
  3. runs the installer silently                 (Windows asks once for administrator rights)
  4. checks the installed files match the build
  5. starts the app again                        (skip with -NoStart)

.EXAMPLE
  npm run deploy

.EXAMPLE
  npm run deploy -- -SkipBuild      # install the installer that is already in the output folder

.EXAMPLE
  npm run deploy -- -WhatIf         # only show what would happen
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$SkipBuild,
  [switch]$NoStart,
  # end the app if it does not close by itself -- anything changed since the last autosave is lost
  [switch]$Force,
  [string]$OutputDir = 'release-local',
  [int]$CloseTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'

$productName = 'Video Hub App 3'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath  = Join-Path $projectRoot $OutputDir

function Write-Step([string]$message) {
  Write-Host ''
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Invoke-Native([string]$command, [string[]]$arguments) {
  & $command @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'$command $($arguments -join ' ')' failed with exit code $LASTEXITCODE"
  }
}

# Where the installer put the app: read from the uninstall entry, else the default location
function Get-InstallDir {
  $entry = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "$productName*" } |
    Select-Object -First 1
  if ($entry -and $entry.UninstallString -match '^"([^"]+)"') {
    return (Split-Path -Parent $matches[1])
  }
  return (Join-Path $env:ProgramFiles $productName)
}

function Get-AppProcesses {
  return @(Get-Process -Name $productName -ErrorAction SilentlyContinue)
}

# ----------------------------------------------------------------------------------------------------------------------
# 1. build

if (-not $SkipBuild) {
  Write-Step 'Building the app'
  if ($PSCmdlet.ShouldProcess($projectRoot, 'npm run build:prod, then electron-builder (nsis)')) {
    Push-Location $projectRoot
    try {
      Invoke-Native 'npm.cmd' @('run', 'build:prod')
      Invoke-Native 'npx.cmd' @('electron-builder', 'build', '--win', 'nsis', "-c.directories.output=$OutputDir")
    } finally {
      Pop-Location
    }
  }
}

$installer = Get-ChildItem -Path $outputPath -Filter "$productName Setup *.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer) {
  if ($WhatIfPreference -and -not $SkipBuild) {
    Write-Host "(the installer would be built into $outputPath)"
    return
  }
  throw "No installer found in $outputPath -- run without -SkipBuild first"
}

Write-Host "Installer: $($installer.FullName)  ($($installer.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))"

# ----------------------------------------------------------------------------------------------------------------------
# 2. close the running app

$installDir = Get-InstallDir

if ((Get-AppProcesses).Count -gt 0) {
  Write-Step "Closing $productName (it saves the hub while closing)"
  if ($PSCmdlet.ShouldProcess($productName, 'close the window and wait for the app to exit')) {
    # Ask again every few seconds: the app answers the first request by saving, and older versions then
    # stay open unless their window has the focus -- once saved, the next request closes them.
    # A request that arrives while it is still saving is ignored by the app, so repeating is safe.
    $deadline = (Get-Date).AddSeconds($CloseTimeoutSeconds)
    $nextRequest = Get-Date
    while ((Get-AppProcesses).Count -gt 0 -and (Get-Date) -lt $deadline) {
      if ((Get-Date) -ge $nextRequest) {
        foreach ($process in Get-AppProcesses) {
          if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
            [void]$process.CloseMainWindow()
          }
        }
        $nextRequest = (Get-Date).AddSeconds(3)
      }
      Start-Sleep -Milliseconds 500
    }

    if ((Get-AppProcesses).Count -gt 0) {
      if (-not $Force) {
        throw "$productName is still running after $CloseTimeoutSeconds seconds. Close it yourself and run this again, or add -Force to end it (changes since the last autosave are lost)."
      }
      Write-Warning "$productName did not close -- ending it"
      Get-AppProcesses | Stop-Process -Force
    }

    # screenshot extraction that was still running would keep files of the old version locked
    $workers = @(Get-Process -Name 'ffmpeg', 'ffprobe' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($installDir, [StringComparison]::OrdinalIgnoreCase) })
    if ($workers.Count -gt 0) {
      $workers | Wait-Process -Timeout 20 -ErrorAction SilentlyContinue
      $workers | Where-Object { -not $_.HasExited } | Stop-Process -Force -ErrorAction SilentlyContinue
    }
  }
}

# ----------------------------------------------------------------------------------------------------------------------
# 3. install

Write-Step 'Installing (Windows asks for administrator rights)'
if ($PSCmdlet.ShouldProcess($installer.Name, 'run the installer silently')) {
  try {
    $setup = Start-Process -FilePath $installer.FullName -ArgumentList '/S', '/allusers' -Wait -PassThru
  } catch {
    throw "The installer did not run (administrator prompt declined?): $($_.Exception.Message)"
  }
  if ($setup.ExitCode -ne 0) {
    throw "The installer failed with exit code $($setup.ExitCode)"
  }
}

# ----------------------------------------------------------------------------------------------------------------------
# 4. check what is installed is what was built

$installDir   = Get-InstallDir
$builtAsar     = Join-Path $outputPath 'win-unpacked\resources\app.asar'
$installedAsar = Join-Path $installDir 'resources\app.asar'

if (-not $WhatIfPreference) {
  if (-not (Test-Path $installedAsar)) {
    throw "Nothing found at $installedAsar after installing"
  }
  if (Test-Path $builtAsar) {
    if ((Get-FileHash $builtAsar).Hash -ne (Get-FileHash $installedAsar).Hash) {
      throw "The installed app in $installDir is not the build from $outputPath"
    }
    Write-Host "Installed build verified: $installDir" -ForegroundColor Green
  } else {
    Write-Host "Installed to $installDir (no unpacked build next to the installer to compare with)"
  }
}

# ----------------------------------------------------------------------------------------------------------------------
# 5. start

if (-not $NoStart) {
  Write-Step "Starting $productName"
  if ($PSCmdlet.ShouldProcess($productName, 'start')) {
    Start-Process -FilePath (Join-Path $installDir "$productName.exe")
  }
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
