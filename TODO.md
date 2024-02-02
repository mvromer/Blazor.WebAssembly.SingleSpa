Things that need to be done:

* Gather:
  * Asset base URL
    * Renamed from resource base URL
    * Use "asset" because that's what's used in the .NET browser runtime
  * Navigation base URL
  * Set asset base URL as the import base URL
    * This is a new API and functionality exposed in Microsoft.JSInterop.JS
* Patch `caches.open` to adjust .NET resource cache
* Configure custom loadBootResource that will use asset base URL
  * NOTE: This is not in modified blazor.webassembly.js but rather in single-spa helper provided by
    Blazor.WebAssembly.SingleSpa

Known globals:

* DotNet
* Blazor
* Module
