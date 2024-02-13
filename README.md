# Blazor.WebAssembly.SingleSpa

Proof of concept around enabling the integration of Blazor WASM applications as micro frontends
targeting single-spa. This integration comprises two packages:

* Blazor.WebAssembly.SingleSpa &ndash; NuGet package that defines an alternate Blazor WebAssembly
  *start script* that allows a WASM application to be used as a micro-frontend in a single-spa
  web application.
* blazor-wasm-single-spa &ndash; NPM package that defines a `singleSpaBlazor` helper function for
  defining the lifecycle hooks single-spa expects each micro-frontend to provide for bootstrapping,
  mounting, and unmounting.

## Applicable Versions

The Blazor.WebAssembly.SingleSpa NuGet package provides experimental support for projects targeting
the versions of .NET listed in the table below. Each entry in the table specifies the exact tagged
version of ASP.NET Core from which the assets were built.

Target Framework Version | ASP.NET Core Version
-------------------------|---------------------
.NET 8                   | 8.0.1

For a given target framework version, the Blazor.WebAssembly.SingleSpa package _may_ work for
previous minor/patch releases. However, no guarantees are given.

## Usage

In general, installing the Blazor.WebAssembly.SingleSpa NuGet package in your Blazor WebAssembly
client project is sufficient for getting the modified Blazor startup script:

```powershell
dotnet add package Blazor.WebAssembly.SingleSpa
```

The modified startup script (`blazor.webassembly.js`) augments the `window.Blazor` object created by
the Blazor runtime to expose additional APIs that make it possible to mount and unmount a Blazor
WASM application onto and from the DOM. However, to fully integrate and enable within a single-spa
web application, the Blazor WASM micro-frontend must also supply three lifecycle hooks single-spa
expects to import. These hooks are
[bootstrap](https://single-spa.js.org/docs/building-applications#bootstrap),
[mount](https://single-spa.js.org/docs/building-applications#mount), and
[unmount](https://single-spa.js.org/docs/building-applications#unmount).

As a convenience, the blazor-wasm-single-spa NPM package exports a helper function for defining
these lifecycle hooks. The helper is modeled after many of the
[official single-spa framework helpers](https://single-spa.js.org/docs/ecosystem) available for many
popular JavaScript frameworks.

To use it, define a script inside your Blazor WASM application's `wwwroot` folder, e.g.,
`lifecycles.js`. Inside it, you could do the following to export the necessary lifecycle hooks:

```javascript
import singleSpaBlazor from 'blazor-wasm-single-spa';

export const { bootstrap, mount, unmount } = singleSpaBlazor({
  // This is the name of a custom element that, when added to the DOM, will trigger
  // Blazor to render your application's main app component. This custom element is
  // registered in your Blazor WASM's application by calling the following:
  //
  // builder.RootComponents.RegisterCustomElement<App>("my-blazor-app");
  //
  // For more information, read here:
  // https://learn.microsoft.com/en-us/aspnet/core/blazor/components/js-spa-frameworks?view=aspnetcore-8.0#blazor-webassembly-registration
  //
  appTagName: 'my-blazor-app',

  // Base URL from which assets (JS, CSS, .NET WASM, etc. files) for your Blazor
  // web application will be fetched. This is typically the URL that is hosting your
  // Blazor WASM micro-frontend. The URL must end in a trailing slash.
  //
  // NOTE: In .NET 8, some of the resource fetching code that previously lived in
  // the Blazor WASM startup script now lives in the .NET browser runtime. This
  // makes it hard to ensure the correct credential option is set for fetch calls
  // made by the runtime. In some cases it will set the fetch credentials option
  // to 'include', and in other cases it will set it to 'same-origin'.
  //
  // If your Blazor WASM micro-frontend is hosted at an origin that requires
  // credentials (e.g., auth cookies), then you may run into CORS issues depending
  // on how you have configured the Access-Control-Allow-Origin response header
  // and/or if the .NET browser runtime's fetch requests do not include the
  // necessary credentials by default.
  //
  // In the latter case, it may be possible to override the resource loading
  // behavior by supplying a custom loadBootResource function. However, this
  // scenario has not been explicitly tested.
  //
  // A more robust solution, especially in the context of an enterprise application,
  // would be to serve the single-spa application and your micro-frontends through a
  // reverse proxy hosted on the same domain. This would help ensure that all
  // requests from the browser for micro-frontend assets appear to be same-origin,
  // thus circumventing potential CORS issues.
  assetBaseUrl: new URL('https://mysite.com/apps/my-blazor-app/'),

  // Client-side base URL the configure on the Blazor WASM application's navigation
  // manager. This will be the base URL the navigation manager uses for internal
  // routing decisions.
  //
  // Typically, you would set this to the base URL single-spa uses to decide if your
  // micro-frontend should be active or not. For example, if single-spa is
  // configured to activate your Blazor WASM application when the client-side URL
  // starts with https://mysite.com/blazor-app/, then that same URL is set on the
  // navigationBaseUrl property.
  navigationBaseUrl: new URL('https://mysite.com/blazor-app/'),

  // Optional paths to additional stylesheets to include when the Blazor WASM
  // micro-frontend is mounted by single-spa. These paths are relative to the asset
  // base URL. For each path given, a link tag referencing the stylesheet is
  // rendered before the Blazor WASM app's custom element.
  stylePaths: ['css/app.css', 'MyBlazorApp.Client.styles.css'],

  // Optional additional paths to JavaScript modules that will be dynamically
  // imported before the .NET browser runtime and Blazor WASM application are
  // started. These paths are relative to the asset base URL.
  additionalImportPaths: ['my-js-interop.js'],

  // Optional callback called before the .NET browser runtime and Blazor WASM
  // application are started. This receives the asset base URL as its argument. Can
  // return a promise or nothing.
  beforeBlazorStart: (assetBaseUrl) => { },

  // Following the first mount, this optional callback is called after the Blazor
  // WASM application's global state (e.g., window.Blazor, window.DotNet, etc.) is
  // restored on the DOM just before single-spa mounts it. This receives the Blazor
  // object as its argument. Can return a promise or nothing.
  afterBlazorRestore: (blazor) => { },

  // Optional callback called after the Blazor WASM application has been removed
  // from the DOM, its components have been disposed, and its global state (e.g.,
  // window.Blazor, window.DotNet, etc.) cleared from the window object. This
  // receives the Blazor object as its argument. Can return a promise or nothing.
  afterBlazorClear: (blazor) => { },

  // Optional callback that allows additional configuration of the .NET WebAssembly
  // host. Receives the DotnetHostBuilder and the set of props passed by single-spa
  // to the Blazor WASM micro-frontend's mount lifecycle hook. Returns nothing.
  configureRuntime: (dotnet, props) => {
    dotnet.withEnvironmentVariables({
        MY_CONFIG_VALUE: 42,
    });
  },

  // Optional value that, when true, will render a script tag that injects the
  // ASP.NET Core browser refresh script. This script is required to have .NET
  // hot reload work correctly.
  injectRefreshScript: false,

  // Optional set of "app extensions" that can be used to provide micro-frontend
  // support for additional Blazor WASM components (e.g., MudBlazor). Each app
  // extension is an object that defines the following optional properties:
  //
  // * stylePaths
  // * additionalImportPaths
  // * beforeBlazorStart
  // * afterBlazorRestore
  // * afterBlazorClear
  //
  // These properties are defined the same as those previously mentioned.
  appExtensions: [],
});
```

As part of this proof of concept, I have put together a simple web app built on single-spa that
incorporates both [Lit-based](https://lit.dev/) and Blazor-based micro-frontends. See here:
[blazing-lit-mfe-demo](https://github.com/mvromer/blazing-lit-mfe-demo)

## Building Blazor.WebAssembly.SingleSpa from source

The following assumes you are working from the `Blazor.WebAssembly.SingleSpa` directory.

This repository is structured around the following idea: for a given major version `N` of ASP.NET
Core, a submodule named `aspnetcore/N.x` is located at `src/aspnetcore/N.x`. Each submodule is
configured to pull a version tag from the `dotnet/aspnetcore` repository matching the specified
major version number, e.g., `src/aspnetcore/8.x` pulls the commit of `dotnet/aspnetcore` tagged with
`v8.0.1`.

Within this project's `patches` directory are a corresponding set of patches and scripts, one for
each major version of ASP.NET Core that has been tested. The `Build-PatchedBlazorWasm.ps1` script in
each versioned directory will apply the patch located alongside it to the corresponding version of
the ASP.NET Core repository and build the necessary components to produce a set of patched Blazor
WebAssembly assets, such as the `blazor.webassembly.js` startup script.

The final Blazor assets are then copied to the appropriate location within the
`src/Blazor.WebAssembly.SingleSpa` project so that when the final NuGet is built the assets are in
the correct package location.

### Installing prerequisites

Building this package requires .NET SDK 8+, Node.js 16.9+, Yarn 1, and PowerShell 7+.

#### .NET SDK 8+

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
