[CmdletBinding()]
param(
  [Parameter(HelpMessage = "If set, then resulting JS will not be minified. Useful for viewing build output.")]
  [switch] $DisableMinify
)

$ErrorActionPreference = "Stop"

$patchDir = Split-Path -Path $PSCommandPath -Parent
$buildRootDir = Resolve-Path "$patchDir/../.."
$nugetPackageBuildDir = Join-Path `
  $buildRootDir `
  "src" `
  "Blazor.WebAssembly.SingleSpa" `
  "build" `
  "net8.0"

function Assert-LastExitCode {
  if ($LASTEXITCODE -ne 0) {
    throw "Last command failed. Exiting build."
  }
}

Write-Host -ForegroundColor Yellow "Applying ASP.NET Core patches"
Push-Location $buildRootDir/src/aspnetcore/8.x
git restore .
git apply $patchDir/aspnetcore.patch
Assert-LastExitCode

if ($DisableMinify) {
  git apply $patchDir/aspnetcore-unset-minify.patch
  Assert-LastExitCode
}

Write-Host -ForegroundColor Yellow "Building Microsoft.JSInterop.JS"
Push-Location -Path src/JSInterop/Microsoft.JSInterop.JS/src
npm run build
Assert-LastExitCode
Pop-Location

Write-Host -ForegroundColor Yellow "Building SignalR TypeScript clients"
Push-Location -Path src/SignalR/clients/ts
npm run build
Assert-LastExitCode
Pop-Location

Write-Host -ForegroundColor Yellow "Building Web.JS"
Push-Location -Path src/Components/Web.JS
npm run build
Assert-LastExitCode
Copy-Item -Path dist/Release/blazor.webassembly.js -Destination $nugetPackageBuildDir
Pop-Location

Pop-Location
