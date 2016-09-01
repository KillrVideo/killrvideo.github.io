# killrvideo.github.io
[![Build Status](https://travis-ci.org/KillrVideo/killrvideo.github.io.svg?branch=source)](https://travis-ci.org/KillrVideo/killrvideo.github.io)

The source for generating the static site content at killrvideo.github.io. Like any 
GitHub Pages org site, the published content can be found in the `master` branch.

## Contributing

The static site is generated using Node and `npm` tasks, so you'll need to have both
of those installed first. Once you've cloned the repository, you'll want to do:

```
> npm install
```

To make sure you have all the latest dependencies installed. You can then run any of
the `npm` scripts defined in the `package.json` file to execute build tasks. The most
common one when developing locally is:

```
> npm run watch
```

Which will do a clean, a build, and then start a development server on port `3000`. It
will watch for changes to source files and recompile as necessary.

## Releases

Builds and releases of the static site are done automatically by Travis CI using the 
`travis.sh` script in the root of the repository. All changes pushed to this `source`
branch are automatically built and then if successful, the build output is merged into
the `master` branch and then pushed to GitHub for deployment by GitHub Pages.