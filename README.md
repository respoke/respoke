# Respoke.js

Browser/Client Library for [Respoke](https://www.respoke.io). Use this library in a JavaScript web
app to add individual and group messaging, contact discovery, and voice and video calling to web
apps.

## Usage

    npm install respoke

then

    require('respoke');

Or grab a release from the CDN:

* [Latest respoke.min.js](https://cdn.respoke.io/respoke.min.js)
* [Latest respoke-stats.min.js](https://cdn.respoke.io/respoke-stats.min.js)
* [List](https://cdn.respoke.io/list.html)

## Documentation

The documentation for this library resides
[on the Respoke website](https://docs.respoke.io/js-library/respoke.html). Also check out the
[quickstart guide](https://docs.respoke.io/) and other tutorials.

## Development Dependencies

We welcome [discussion on our community](http://community.respoke.io/) and contributions from the
community. To get started contributing back, you'll need to clone this repo and run the following
commands.

```
brew install node
# or
# apt-get install nodejs
npm install -g grunt
npm install
```

## Tests

Tests currently cannot run outside of our internal development infrastructure.

### Compilation
Respoke.js uses CommonJS to manage its dependencies, and the [Webpack](http://webpack.github.io/)
module bundler to bundle the library. To create the bundled and minified library suitable for
distribution, you can run

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

If you want the watch task to rebuild faster, you can comment out the uglify plugin in
`webpack.config.js` for the duration of your development.

### Code Compliance

This project uses jshint.  The configuration for jshint can be found in the repo at `.jshintrc` and `.jshintignore`.

```
npm run jshint
```

Point your editor to `.jscsrc` to follow the project's
[JavaScript Code Style (JSCS)](https://github.com/jscs-dev/node-jscs) rules.

```
npm run jscs
```

### Known Issues

```bash
$  npm install

npm ERR! git fetch -a origin (ssh://git@stash.digium.com:7999/stratos/grunt-stratos.git) Permission denied (publickey).
npm ERR! git fetch -a origin (ssh://git@stash.digium.com:7999/stratos/grunt-stratos.git) fatal: Could not read from remote repository.
npm ERR! git fetch -a origin (ssh://git@stash.digium.com:7999/stratos/grunt-stratos.git)
npm ERR! git fetch -a origin (ssh://git@stash.digium.com:7999/stratos/grunt-stratos.git) Please make sure you have the correct access rights
npm ERR! git fetch -a origin (ssh://git@stash.digium.com:7999/stratos/grunt-stratos.git) and the repository exists.
npm WARN optional dep failed, continuing grunt-stratos@git+ssh://git@stash.digium.com:7999/stratos/grunt-stratos.git
```

This can be ignored and will be fixed by the Respoke dev team soon.

# License

Respoke.js is licensed under the [MIT license](LICENSE).
