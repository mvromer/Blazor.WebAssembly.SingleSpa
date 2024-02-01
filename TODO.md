Things that need to be done:

* Gather:
  * Asset base URL
    * Renamed from resource base URL
    * Use "asset" because that's what's used in the .NET browser runtime
  * Navigation base URL
  * Set asset base URL as the import base URL
    * This is a new API and functionality exposed in Microsoft.JSInterop.JS
* Patch `caches.open` to adjust .NET resource cache
