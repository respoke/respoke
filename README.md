# transporter

Client Side Library for connecting to the Respoke API.

## Dependencies

This project utilises the power of [Grunt](http://gruntjs.com) and [Node.js](http://nodejs.org/)

You'll need to install [Node.js](http://nodejs.org/download/) and then [grunt](http://gruntjs.com)

Once you have Node and grunt, install the dependencies via `npm`

```
npm install
```

## Tests
Tests currently require the library to be checked out in a specific hierarchy relative to the collective project:

```
collective/
mercury/
  javascript/
    transporter/
```

As you can see from this hierarchy, the best way to ensure the tests work is to check out the transporter project inside the javascript directory of the mercury project. Then, to run unit tests:

```
grunt unit
```

to run functional tests:
```
grunt functional
```

### Compilation
Transporter uses CommonJS to manage its dependencies, and the [Webpack](http://webpack.github.io/) module bundler to bundle the library. To create the bundled and minified library suitable for distribution, you can run

```
grunt dist
```

or

```
webpack && npm run build-stats
```

If you want to have the source files watched and built automatically when changes are made, run

```
webpack --watch
```

If you want the watch task to rebuild faster, you can comment out the uglify plugin in `webpack.config.js` for the duration of your development.

### Code Compliance

This project uses jshint.  The configuration for jshint can be found in the repo at `.jshintrc` and `.jshintignore`.

```
jshint
```

There is a pre commit hook in `githooks` which will run `jshint` global binary against all javascript files in the project that are not included in the `.jshintignore`. Please copy this file into your .git/hooks directory so that it runs before each commit. This will stop you commiting bad code which is against the [coding standards](http://wiki.digium.internal/wiki/display/MERCURY/Coding+Conventions).
