param(
    [Parameter(Position = 0)]
    [ValidateSet("install", "update", "dump", "run", "uninstall", "paths", "help")]
    [string]$Command = "install",

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProfileName = if ($env:ORVEN_DSH_PROFILE) { $env:ORVEN_DSH_PROFILE } else { "orven-test" }
$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$PackRoot = if ($env:ORVEN_PACK_ROOT) {
    $env:ORVEN_PACK_ROOT
} elseif ($env:XDG_CACHE_HOME) {
    Join-Path $env:XDG_CACHE_HOME "orven-dsh-local"
} else {
    Join-Path $HOME ".cache\orven-dsh-local"
}

$PackDir = Join-Path $PackRoot "packages"

$DshHome = if ($env:DSH_HOME) {
    $env:DSH_HOME
} else {
    Join-Path $HOME ".dsh"
}

$ProfileDir = Join-Path (Join-Path $DshHome "profiles") $ProfileName
$WorkspaceFile = Join-Path $ProfileDir "pnpm-workspace.yaml"

$BeginMarker = "# >>> orven-local core override"
$EndMarker = "# <<< orven-local core override"

function Fail([string]$Message) {
    throw $Message
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "missing required command: $Name"
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    & $FilePath @Arguments | Out-Host

    if ($LASTEXITCODE -ne 0) {
        Fail "$FilePath exited with code $LASTEXITCODE"
    }
}

function Show-Usage {
@"
Usage:
  .\scripts\orven-local.ps1 install
  .\scripts\orven-local.ps1 update
  .\scripts\orven-local.ps1 dump
  .\scripts\orven-local.ps1 run [prompt...]
  .\scripts\orven-local.ps1 uninstall
  .\scripts\orven-local.ps1 paths

Environment:
  ORVEN_DSH_PROFILE   DSH profile name     (default: orven-test)
  ORVEN_PACK_ROOT     Packed artifact root (default: ~/.cache/orven-dsh-local)
  ORVEN_FULL_CHECK=1  Run full checks/distribution verification before install
  DSH_HOME            DSH home             (default: ~/.dsh)

The script never fetches, resets, or switches Git branches.
It always tests the working tree that contains this script.
"@
}

function Build-And-Pack {
    Write-Host "==> Using Orven checkout: $RootDir"

    Write-Host "==> Installing workspace dependencies"
    Invoke-Native pnpm --dir $RootDir install --no-frozen-lockfile

    if ($env:ORVEN_FULL_CHECK -eq "1") {
        Write-Host "==> Running full checks"
        Invoke-Native pnpm --dir $RootDir check

        Write-Host "==> Verifying distributable packages"
        Invoke-Native pnpm --dir $RootDir distribution:check
    }
    else {
        Write-Host "==> Building current checkout"
        Invoke-Native pnpm --dir $RootDir build
    }

    if (Test-Path $PackDir) {
        Remove-Item $PackDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $PackDir -Force | Out-Null

    Write-Host "==> Packing @orven/core"
    Invoke-Native pnpm --dir (Join-Path $RootDir "packages\core") pack --pack-destination $PackDir

    Write-Host "==> Packing @orven/plugin-dsh"
    Invoke-Native pnpm --dir (Join-Path $RootDir "packages\plugin-dsh") pack --pack-destination $PackDir

    $Core = Get-ChildItem $PackDir -Filter "orven-core-*.tgz" | Select-Object -First 1
    $Plugin = Get-ChildItem $PackDir -Filter "orven-plugin-dsh-*.tgz" | Select-Object -First 1

    if (-not $Core) { Fail "core tarball was not produced" }
    if (-not $Plugin) { Fail "plugin tarball was not produced" }

    return @{
        Core = $Core.FullName
        Plugin = $Plugin.FullName
    }
}

function Remove-ManagedOverride {
    if (-not (Test-Path $WorkspaceFile)) {
        return
    }

    $Lines = Get-Content $WorkspaceFile
    $Output = New-Object System.Collections.Generic.List[string]
    $Skipping = $false

    foreach ($Line in $Lines) {
        if ($Line -eq $BeginMarker) {
            $Skipping = $true
            continue
        }
        if ($Line -eq $EndMarker) {
            $Skipping = $false
            continue
        }
        if (-not $Skipping) {
            $Output.Add($Line)
        }
    }

    Set-Content -Path $WorkspaceFile -Value $Output -Encoding utf8
}

function Write-CoreOverride([string]$CoreTgz) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null

    if (-not (Test-Path $WorkspaceFile)) {
        New-Item -ItemType File -Path $WorkspaceFile -Force | Out-Null
    }

    Remove-ManagedOverride
    $Current = Get-Content $WorkspaceFile -Raw

    if ($Current -match "(?m)^\s*overrides:\s*$") {
        Fail "$WorkspaceFile already has an unmanaged overrides section. Use the dedicated profile or add @orven/core manually."
    }

    $YamlPath = $CoreTgz.Replace("\", "/").Replace("'", "''")

    Add-Content -Path $WorkspaceFile -Encoding utf8 -Value @"

$BeginMarker
overrides:
  '@orven/core': 'file:$YamlPath'
$EndMarker
"@
}

function Install-Local {
    $Packages = Build-And-Pack

    Write-Host "==> Initializing DSH profile and installing @orven/core"
    Invoke-Native dsh plugin --profile $ProfileName add $Packages.Core

    Write-Host "==> Pinning plugin dependency to local packed @orven/core"
    Write-CoreOverride $Packages.Core

    Write-Host "==> Installing @orven/plugin-dsh"
    Invoke-Native dsh plugin --profile $ProfileName add $Packages.Plugin

    Write-Host ""
    Write-Host "==> Installed current checkout"
    Write-Host "profile : $ProfileName"
    Write-Host "repo    : $RootDir"
    Write-Host "core    : $($Packages.Core)"
    Write-Host "plugin  : $($Packages.Plugin)"
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  .\scripts\orven-local.ps1 dump"
    Write-Host '  .\scripts\orven-local.ps1 run "hello"'
}

function Dump-Config {
    Invoke-Native dsh --profile $ProfileName --dump-config
}

function Run-Dsh {
    if ($null -eq $RemainingArgs -or $RemainingArgs.Count -eq 0) {
        & dsh --profile $ProfileName
    }
    else {
        & dsh --profile $ProfileName @RemainingArgs
    }

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

function Uninstall-Local {
    Write-Host "==> Removing Orven from DSH profile: $ProfileName"
    & dsh plugin --profile $ProfileName remove '@orven/plugin-dsh' '@orven/core'

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "DSH package removal returned exit code $LASTEXITCODE; continuing cleanup."
    }

    Remove-ManagedOverride
    Write-Host "==> Done"
}

function Show-Paths {
    Write-Host "repo:       $RootDir"
    Write-Host "packages:   $PackDir"
    Write-Host "dsh home:   $DshHome"
    Write-Host "profile:    $ProfileDir"
    Write-Host "workspace:  $WorkspaceFile"
}

Require-Command pnpm
Require-Command dsh

switch ($Command) {
    "install"   { Install-Local }
    "update"    { Install-Local }
    "dump"      { Dump-Config }
    "run"       { Run-Dsh }
    "uninstall" { Uninstall-Local }
    "paths"     { Show-Paths }
    "help"      { Show-Usage }
}
