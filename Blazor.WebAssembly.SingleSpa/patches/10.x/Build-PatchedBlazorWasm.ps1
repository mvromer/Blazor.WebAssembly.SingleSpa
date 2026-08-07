[CmdletBinding()]
param(
  [Parameter(HelpMessage = "If set, then resulting JS will not be minified. Useful for viewing build output.")]
  [switch] $DisableMinify,

  [Parameter(HelpMessage = "If set, then patches adding single-spa support will not be applied. Can be used to produce unminified versions of the Blazor startup script.")]
  [switch] $SkipSingleSpaPatch
)

$ErrorActionPreference = "Stop"

$patchDir = Split-Path -Path $PSCommandPath -Parent
$buildRootDir = Resolve-Path "$patchDir/../.."
$nugetPackageBuildDir = Join-Path `
  $buildRootDir `
  "src" `
  "Blazor.WebAssembly.SingleSpa" `
  "build" `
  "net10.0"

function Assert-LastExitCode {
  if ($LASTEXITCODE -ne 0) {
    throw "Last command failed. Exiting build."
  }
}

Write-Host -ForegroundColor Yellow "Applying ASP.NET Core patches"
Push-Location $buildRootDir/src/validated/aspnetcore/10.x
git clean -xdff

if (-not $SkipSingleSpaPatch) {
  git apply $patchDir/aspnetcore.patch
  Assert-LastExitCode
}

if ($DisableMinify) {
  git apply $patchDir/aspnetcore-unset-minify.patch
  Assert-LastExitCode
}

Write-Host -ForegroundColor Yellow "Restoring dependencies"
npm ci
Assert-LastExitCode

Write-Host -ForegroundColor Yellow "Building JavaScript projects"
npm run build
Assert-LastExitCode

Copy-Item -Path src/Components/Web.JS/dist/Release/blazor.webassembly.js -Destination $nugetPackageBuildDir

Pop-Location
