# Blazor.WebAssembly.SingleSpa

Proof of concept around enabling the integration of Blazor WASM applications as micro frontends
targeting single-spa

## Applicable Versions

The Blazor.WebAssembly.SingleSpa NuGet package contains support for projects targeting both .NET 6
and .NET 7. Specifically, the assets for each target framework version were built from the following
specific versions of ASP.NET Core:

Target Framework Version | ASP.NET Core Version
-------------------------|---------------------
.NET 6                   | 6.0.16
.NET 7                   | 7.0.5

For a given target framework version, this package _may_ work for previous minor/patch releases.
However, no guarantees are given.

## Usage

Install from nuget.

## Building from source

This repository is structured around the following idea: for a given version of ASP.NET Core, a
submodule is located at `src/aspnetcore/<version>`, Each submodule is configured to pull the
corresponding version tag from the `dotnet/aspnetcore` repository, e.g., `src/aspnetcore/6.0.3`
pulls the commit of `dotnet/aspnetcore` tagged with `v6.0.3`.

Within this project's `patches` directory are a corresponding set of patches and scripts, one for
each version of ASP.NET Core that has been tested. The `Build-PatchedBlazorWasm.ps1` script in each
versioned directory will apply the patch located alongside it to the corresponding version of the
ASP.NET Core repository and build the necessary components to produce a patched Blazor WASM startup
(i.e., `blazor.webassembly.js` for .NET 6 and .NET 7; this seems to be changing in .NET 8).

The final Blazor WASM startup script is then copied to the appropriate location within the
`src/Blazor.WebAssembly.SingleSpa` project so that when the final NuGet is built the startup script
is in the correct package location.

### Installing prerequisites

Building this package requires .NET SDK 7+, Node.js 16.9+, Yarn 1, and PowerShell 7+.

#### .NET SDK 7+

Download from [here](https://dotnet.microsoft.com/en-us/download).

#### Node.js

Installing Node can vary based on things like your operating system and your preferred workflow.
On Windows, I prefer to use [nvm-windows](https://github.com/coreybutler/nvm-windows), and on Mac
and Linux, I use [nvm](https://github.com/nvm-sh/nvm). Your mileage may vary. You just need to make
sure it is at least Node.js 16.9 or greater (LTS versions preferred).

#### Yarn 1

After Node is installed, install Yarn 1 globally:

```powershell
npm install -g yarn
```

#### PowerShell

All the build and patch scripts are written in PowerShell for cross-platform support. Download it
from [here](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell?view=powershell-7.3).

### Patching ASP.NET Core

To patch a version of ASP.NET Core's Blazor WASM startup script, run the
`patches/<version>/Build-PatchedBlazorWasm.ps1` script.

> :rocket: By default, the resulting script is minified. If you want to produce an unminified
> version for reading and/or debugging purposes, pass the `-DisableMinify` switch to the script.

### Building Blazor.WebAssembly.SingleSpa

From the `src/Blazor.WebAssembly.SingleSpa` directory, run `dotnet pack -c Release`. This will
produce the final Blazor.WebAssembly.SingleSpa NuGet package.
