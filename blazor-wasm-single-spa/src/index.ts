import type { AppProps, LifeCycleFn } from 'single-spa';

// NOTE: Ideally we would be able to use the types Microsoft defines for things like the Blazor
// runtime object and the .NET host builder. However, Microsoft doesn't expose them in an easily
// consumable package. Thus, in a lot of cases these types are declared as any.

// Utility type for getting the parameter type from a function that takes a single parameter.
type Parameter<T extends (arg: any) => any> = T extends (arg: infer U) => any ? U : never;

// App extensions allow other third-party or shared libraries hook into a Blazor micro-frontend's
// lifecycle hooks at specific points. Extensions can be used for, e.g., importing and initializing
// other assets. They can also be used to restore and clear DOM state as needed when the Blazor
// micro-frontend mounts and unmounts, respectively.
export type BlazorWebAssemblyAppExtension<ExtraProps = {}> = {
  stylePaths?: string[];
  additionalImportPaths?: string[];

  beforeBlazorStart?: (
    assetBaseUrl: URL,
    props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
  ) => void | Promise<void>;

  afterBlazorRestore?: (
    blazor: any,
    props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
  ) => void | Promise<void>;

  afterBlazorClear?: (
    blazor: any,
    props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
  ) => void | Promise<void>;
};

// The options for configuring a Blazor WebAssembly micro-frontend's lifecycle hooks.
export type BlazorWebAssemblyOptions<ExtraProps = {}> = {
  appTagName: string;
  stylePaths?: string[];
  additionalImportPaths?: string[];
  beforeBlazorStart?: (assetBaseUrl: URL) => void | Promise<void>;
  afterBlazorRestore?: (blazor: any) => void | Promise<void>;
  afterBlazorClear?: (blazor: any) => void | Promise<void>;
  assetBaseUrl?: URL;
  navigationBaseUrl?: URL;
  configureRuntime?: (
    dotnetHostBuilder: any,
    props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
  ) => void;
  injectRefreshScript?: boolean;
  appExtensions?: BlazorWebAssemblyAppExtension<ExtraProps>[];

  // This is a common way other single-spa framework helpers allow for customizing the DOM element
  // onto which the micro-frontend is mounted.
  domElementGetter?: (props: AppProps) => HTMLElement;
};

// State that must be retained across the lifecycle of the Blazor micro-frontend. It must be
// allocated for each micro-frontend that creates its lifecycle hooks with singleSpaBlazor.
export type BlazorWebAssemblyAppState = {
  // This is a template that gets built from the given BlazorWebAssemblyOptions. It will be used to
  // render the Blazor application onto the DOM each time it is mounted.
  appTemplate: HTMLTemplateElement;

  // Reference to the Blazor runtime object used to manage the Blazor WebAssembly application and
  // its associated .NET browser runtime.
  blazor: any;

  // The original caches.open function that we replace with a custom implementation that applies a
  // discriminator to the cache name. This is necessary to ensure that each Blazor micro-frontend
  // has its own cache, which Blazor typically only names after the page's base URL.
  originalCachesOpen: (cacheName: string) => Promise<Cache>;
};

// These are props we know how to handle if they are present in the props passed by single-spa into
// our lifecycle hooks. ExtraProps are any additional props that the Blazor micro-frontend expects
// to define and use.
type BlazorWebAssemblyProps<ExtraProps = {}> = ExtraProps & {
  assetBaseUrl?: URL;
  navigationBaseUrl?: URL;
  domElement?: HTMLElement;
  domElementGetter?: (props: AppProps) => HTMLElement;
};

// The type of a lifecycle hook we produce with singleSpaBlazor.
type BlazorWebAssemblyLifeCycleFn<ExtraProps> = LifeCycleFn<BlazorWebAssemblyProps<ExtraProps>>;

// The type of the props parameter passed to the lifecycle hooks produced with singleSpaBlazor.
type BlazorWebAssemblyLifeCycleProps<ExtraProps> = Parameter<
  BlazorWebAssemblyLifeCycleFn<ExtraProps>
>;

// The set of lifecycle hooks and lifecycle state we produce with singleSpaBlazor.
type BlazorWebAssemblyLifeCycles<ExtraProps> = {
  bootstrap: BlazorWebAssemblyLifeCycleFn<ExtraProps>;
  mount: BlazorWebAssemblyLifeCycleFn<ExtraProps>;
  unmount: BlazorWebAssemblyLifeCycleFn<ExtraProps>;
};

export default function singleSpaBlazor<ExtraProps>(
  blazorOptions: BlazorWebAssemblyOptions<ExtraProps>
): BlazorWebAssemblyLifeCycles<ExtraProps> {
  if (typeof blazorOptions !== 'object') {
    throw new Error(`single-spa-blazor-wasm requires a configuration object`);
  }

  if (!blazorOptions.appTagName) {
    throw new Error(`single-spa-blazor-wasm must be given customElementTagName`);
  }

  if (blazorOptions.domElementGetter && typeof blazorOptions.domElementGetter !== 'function') {
    throw new Error(`single-spa-blazor-wasm domElementGetter must be a function`);
  }

  // TypeScript cannot infer the type of Function.prototype.bind when the partially applied
  // arguments are of a generic type. Thus, we need to explicitly specify the type parameters for
  // bind, which turns out there are four in total.
  //
  // The first is the type of the this object, which we don't care about. We set the context of the
  // bound function to null.
  //
  // The second is the type of the arguments that we are partially applying to the bound function.
  // In this case, it's the BlazorWebAssemblyOptions.
  //
  // The third is the type of the arguments that will be passed to our bound function. In this case,
  // its the set of props passed by single-spa.
  //
  // The final is the return type of the bound function.
  type LifeCycleHelperFn = (
    o: BlazorWebAssemblyOptions<ExtraProps>,
    a: BlazorWebAssemblyAppState,
    p: BlazorWebAssemblyLifeCycleProps<ExtraProps>
  ) => ReturnType<BlazorWebAssemblyLifeCycleFn<ExtraProps>>;

  type This = null;
  type HelperParameters = Parameters<LifeCycleHelperFn>;
  type Options = [HelperParameters[0], HelperParameters[1]];
  type Props = [HelperParameters[2]];
  type Result = ReturnType<LifeCycleHelperFn>;

  const appState: BlazorWebAssemblyAppState = {
    appTemplate: document.createElement('template'),
    blazor: undefined,
    originalCachesOpen: () => {
      throw new Error('Original caches.open has not been stored yet.');
    },
  };

  return {
    bootstrap: bootstrap.bind<This, Options, Props, Result>(null, blazorOptions, appState),
    mount: mount.bind<This, Options, Props, Result>(null, blazorOptions, appState),
    unmount: unmount.bind<This, Options, Props, Result>(null, blazorOptions, appState),
  };
}

//
// The actual single-spa lifecycle callbacks.
//

// NOTE: We don't do any bootstrapping. Ideally we would load the .NET and Blazor runtimes here, but
// the Blazor startup scripts couple the loading of the runtimes with the actual start and execution
// of them. This causes any global .NET and Blazor runtime objects to be overwritten.
//
// This is particularly relevant if we have a Blazor micro-frontend currently on the page that is
// unmounting and another one that wants to bootstrap and mount. In this case, we need to make sure
// all Razor components from the first one are fully removed from the page and disposed before the
// second one tries to boot and load its version of the .NET runtime and Blazor. Otherwise, you may
// have the first micro-frontend calling into the runtime of the second micro-frontend, which will
// create a slew of runtime errors.
//
// Since single-spa will let a micro-frontend bootstrap concurrently with another one that is
// unmounting, bootstrap would not be an safe place to load the second Blazor micro-frontend's
// runtime. Instead, we do that in the mount lifecycle hook because single-spa will ensure that all
// unmount lifecycle hooks are resolved before any mount lifecycle hooks are called.
function bootstrap<ExtraProps>(
  _blazorOptions: BlazorWebAssemblyOptions<ExtraProps>,
  _blazorAppState: BlazorWebAssemblyAppState,
  _props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
): ReturnType<BlazorWebAssemblyLifeCycleFn<ExtraProps>> {
  return Promise.resolve();
}

// On the first mount, the Blazor micro-frontend will fetch and import its Blazor startup script.
// As a side effect, the .NET and Blazor runtime objects will be written to the window. Then, the
// Blazor runtime and application are started. This will fetch the micro-frontend's assets and load
// them in the browser.
//
// This also installs an interceptor for the caches.open function. The .NET browser runtime uses
// this to open a named cache for caching .NET assets. Unfortunately, the name of the cache is not
// configurable and is based (currently) on the page's base URL, which isn't always unique enough,
// especially in the case of micro-frontends. The original caches.open function is saved so that it
// be restored when the micro-frontend is unmounted.
//
// Once loaded and started, the Blazor micro-frontend will be mounted to the DOM.
async function mount<ExtraProps>(
  blazorOptions: BlazorWebAssemblyOptions<ExtraProps>,
  blazorAppState: BlazorWebAssemblyAppState,
  props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
): ReturnType<BlazorWebAssemblyLifeCycleFn<ExtraProps>> {
  const { name: appName } = props;
  const extensions = getExtensions(blazorOptions);

  const assetBaseUrl =
    props.assetBaseUrl || blazorOptions.assetBaseUrl || new URL(document.baseURI);

  const navigationBaseUrl =
    props.navigationBaseUrl || blazorOptions.navigationBaseUrl || new URL(document.baseURI);

  // Install an interceptor for caches.open so that we can apply a discriminator to the named
  // cache the .NET browser runtime will user for caching .NET assets.
  blazorAppState.originalCachesOpen = globalThis.caches.open;
  globalThis.caches.open = function (cacheName) {
    return blazorAppState.originalCachesOpen.call(globalThis.caches, `${cacheName}-${appName}`);
  };

  if (blazorAppState.blazor === undefined) {
    // On first mount, import the Blazor runtime for the Blazor micro-frontend. Capture the Blazor
    // runtime reference from the window after it has been imported.
    await import(new URL('_framework/blazor.webassembly.js', assetBaseUrl).href);
    // @ts-expect-error (ts7015) - We don't have a better type than any for the Blazor object.
    blazorAppState.blazor = window['Blazor'];

    // Import any additional scripts that need to be loaded before the Blazor runtime and
    // application are started.
    await Promise.all(
      extensions.flatMap((extension) =>
        !extension.additionalImportPaths
          ? Promise.resolve()
          : extension.additionalImportPaths.map((path) => import(new URL(path, assetBaseUrl).href))
      )
    );

    // Run any before start callbacks that have been defined.
    for (const extension of extensions) {
      if (extension.beforeBlazorStart) {
        await Promise.resolve(extension.beforeBlazorStart(assetBaseUrl, props));
      }
    }

    // Produce the template content used to mount the application.
    const styleElements = extensions.flatMap((extension) =>
      !extension.stylePaths
        ? []
        : extension.stylePaths.map((stylePath) => {
            const styleElement = document.createElement('link');
            styleElement.rel = 'stylesheet';
            styleElement.href = new URL(stylePath, assetBaseUrl).href;
            return styleElement;
          })
    );

    blazorAppState.appTemplate.content.append(
      ...styleElements,
      document.createElement(blazorOptions.appTagName)
    );

    if (blazorOptions.injectRefreshScript) {
      // If debugging is enabled, then we need to inject the ASP.NET Core browser refresh script.
      const browserRefreshScript = document.createElement('script');
      browserRefreshScript.src = new URL(
        '_framework/aspnetcore-browser-refresh.js',
        assetBaseUrl
      ).href;
      blazorAppState.appTemplate.content.append(browserRefreshScript);
    }

    // Start the Blazor runtime and its application.
    await blazorAppState.blazor.start({
      // NOTE: These are critical for integration. They control how Blazor will resolve relative and
      // absolute URL paths for assets and navigation. Without them, Blazor will tend to resolve
      // these relative to the page's base URL, which is not what we want in the case of a Blazor
      // micro-frontend.
      assetBaseUrl,
      navigationBaseUrl,

      // Define a custom boot resource loader that will apply the module base URL to any URL paths
      // (relative or absolute) the .NET loader tries resolve.
      loadBootResource: function (
        _type: unknown,
        _name: string,
        defaultUrl: string,
        _integrity: string,
        _behavior: unknown
      ) {
        return new URL(defaultUrl, assetBaseUrl).href;
      },

      // Additional configuration of the .NET host used to run the Blazor application.
      configureRuntime: (dotnet: any) => {
        if (blazorOptions.configureRuntime) {
          blazorOptions.configureRuntime(dotnet, props);
        }
      },
    });
  } else {
    // After the first mount, restore global Blazor state on the window and ensure Blazor's DOM
    // listeners are reconnected and ready.
    blazorAppState.blazor.restoreGlobalState();
    blazorAppState.blazor.ensureDomListenersReady();

    // Run any after restore callbacks that have been defined.
    for (const appExtension of extensions) {
      if (appExtension.afterBlazorRestore) {
        await Promise.resolve(appExtension.afterBlazorRestore(blazorAppState.blazor, props));
      }
    }
  }

  // Force the Blazor navigation manager to resync with the page's current URL before mounting the
  // application.
  blazorAppState.blazor.navigateTo(document.location.href, {
    replaceHistoryEntry: true,
    forceLoad: false,
  });

  // Mount the Blazor application on the DOM. This depends on Blazor's ability to register a custom
  // element with the browser's custom elements registry. When the custom element is connected to
  // the DOM, that will trigger Blazor to add the application's root component (typically called
  // App) onto the page.
  //
  // NOTE: This will require configuration on a per micro-frontend basis. Things like the name of
  // the custom element's tag, any scripts or styles that need to be loaded, etc.
  const domElementGetter = chooseDomElementGetter(blazorOptions, props);
  const mountPoint = domElementGetter(props);
  if (mountPoint) {
    mountPoint.replaceChildren(blazorAppState.appTemplate.content.cloneNode(true));
  }
}

async function unmount<ExtraProps>(
  blazorOptions: BlazorWebAssemblyOptions<ExtraProps>,
  blazorAppState: BlazorWebAssemblyAppState,
  props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
): ReturnType<BlazorWebAssemblyLifeCycleFn<ExtraProps>> {
  const extensions = getExtensions(blazorOptions);
  const domElementGetter = chooseDomElementGetter(blazorOptions, props);
  const mountPoint = domElementGetter(props);

  if (mountPoint) {
    // Disconnect the Blazor application from the DOM.
    mountPoint.replaceChildren();

    // Ensure the Blazor micro-frontend has disposed its components before proceeding. Then remove
    // any event listeners that Blazor has attached to the DOM and cleanup the global state added
    // by Blazor.
    await blazorAppState.blazor.ensureRazorComponentsDisposed();
    blazorAppState.blazor.ensureDomListenersRemoved();
    blazorAppState.blazor.clearGlobalState();

    // Run any after clear callbacks that have been defined.
    for (const extension of extensions) {
      if (extension.afterBlazorClear) {
        await Promise.resolve(extension.afterBlazorClear(blazorAppState.blazor, props));
      }
    }
  }

  // Restore the original caches.open function.
  globalThis.caches.open = blazorAppState.originalCachesOpen;
}

function getExtensions<ExtraProps>(blazorOptions: BlazorWebAssemblyOptions<ExtraProps>) {
  // NOTE: Apply the micro-frontend's hooks after any additional extensions defined on the given
  // set of Blazor WebAssembly options.
  return [
    ...(blazorOptions.appExtensions ?? []),
    {
      stylePaths: blazorOptions.stylePaths,
      additionalImportPaths: blazorOptions.additionalImportPaths,
      beforeBlazorStart: blazorOptions.beforeBlazorStart,
      afterBlazorRestore: blazorOptions.afterBlazorRestore,
      afterBlazorClear: blazorOptions.afterBlazorClear,
    },
  ];
}

// The following is a common pattern in other single-spa framework helpers for picking the DOM
// element onto which the micro-frontend is mounted.
function chooseDomElementGetter<ExtraProps>(
  blazorOptions: BlazorWebAssemblyOptions<ExtraProps>,
  props: BlazorWebAssemblyLifeCycleProps<ExtraProps>
): (props: AppProps) => HTMLElement {
  const domElementFromProps = props.domElement;

  if (domElementFromProps) {
    return () => domElementFromProps;
  } else if (props.domElementGetter) {
    return props.domElementGetter;
  } else if (blazorOptions.domElementGetter) {
    return blazorOptions.domElementGetter;
  } else {
    return defaultDomElementGetter(props);
  }
}

function defaultDomElementGetter(props: AppProps) {
  if (!props.name) {
    throw new Error(`single-spa-blazor-wasm was not given an application name as a prop`);
  }

  const htmlId = `single-spa-application:${props.name}`;

  return function defaultDomElement() {
    let domElement = document.getElementById(htmlId);

    if (!domElement) {
      domElement = document.createElement('div');
      domElement.id = htmlId;
      document.body.appendChild(domElement);
    }

    return domElement;
  };
}
