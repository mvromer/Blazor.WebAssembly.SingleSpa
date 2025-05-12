# Maintainer Notes

Mostly a cheat sheet that can be referenced when doing maintenance tasks like updating the version
of ASP.NET Core used for building the modified Blazor assets.

## Cloning and initializing repository

Since this project uses submodules, it's important to initialize those after cloning. This can be in
one of two ways. First, if you are cloning for the first time, you can clone and initialize all
submodules in one shot:

```sh
git clone --recurse-submodules https://github.com/mvromer/Blazor.WebAssembly.SingleSpa.git
```

However, initializing all submodules (which typically correspond to different tags of the ASP.NET
Core repository) can take a while. If you do not need all submodules, you can be more selective
about which ones you initialize:

```sh
git clone https://github.com/mvromer/Blazor.WebAssembly.SingleSpa.git
git submodule update --init --recursive src/aspnetcore/N.x
```

This will clone the repository and initialize the submodule containing the ASP.NET Core repository
tagged at version `N.x` where `N` is the major version.

## Updating supported ASP.NET Core version

This is for updating the specific version of ASP.NET Core targeted when building the modified Blazor
assets *for a particular major version of ASP.NET Core*. For example, suppose you want to update the
targeted version of ASP.NET Core 7.x, run the following:

```sh
# Navigate to the version-specific submodule
cd Blazor.WebAssembly.SingleSpa/src/aspnetcore/7.x

# Clear out any local changes
git restore .

# Fetch latest tags and checkout the desired version from aspnetcore repository, e.g., v7.0.15
git fetch
git checkout --recurse-submodules v7.0.15

# Stage the submodule update and commit
cd ../../../..
git add Blazor.WebAssembly.SingleSpa/src/aspnetcore/7.x
git commit -m "Update supported ASP.NET Core 7.x version to 7.0.15"
```
