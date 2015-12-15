# Respoke.js

Browser/Client Library for [Respoke](https://www.respoke.io). Use this library in a JavaScript web
app to add individual and group messaging, contact discovery, and voice and video calling to web
apps.

## Usage

### NPM

```bash
npm install respoke
```

then

```javascript
require('respoke');
```

### CDN

Grab a release from the CDN:

* [Latest respoke.min.js](https://cdn.respoke.io/respoke.min.js)
* [Latest respoke-stats.min.js](https://cdn.respoke.io/respoke-stats.min.js)
* [List](https://cdn.respoke.io/list.html)

### Prebuilt / Bower

```bash
bower install --save respoke
```

Prebuilt and minified versions of respoke.js can be found at [github.com/respoke/respoke-dist](https://github.com/respoke/respoke-dist).


## Documentation

The documentation for this library resides
[on the Respoke website](https://docs.respoke.io/js-library/respoke.html). Also check out the
[quickstart guide](https://docs.respoke.io/) and other tutorials.

## Development Dependencies

We welcome [discussion on our community](http://community.respoke.io/) and contributions from the
community. To get started contributing back, you'll need to clone this repo and run the following
commands.

```bash
brew install node
# or
# apt-get install nodejs
npm install -g grunt
npm install
```

## Tests

There are two different types of tests within transporter.

 1. Unit tests. These run locally and have no dependencies on external systems.
 2. Functional tests. These require an account with Respoke in order to run

### Unit tests

These can be run simply using grunt.

```bash
grunt unit
```

### Functional tests

In order to run the functional tests, go to https://respoke.io and sign up for an account, and
create an application. You then configure `spec/test-config.json` with your account and application
credentials.

```json
{
    "appId": "",
    "appSecret": "",
    "username": "",
    "password": ""
}
```

## Compilation
Respoke.js uses CommonJS to manage its dependencies, and the [Webpack](http://webpack.github.io/)
module bundler to bundle the library. To create the bundled and minified library suitable for
distribution, you can run

```bash
grunt dist
```

or

```bash
webpack && npm run build-stats
```

If you want to have the source files watched and built automatically when changes are made, run

```bash
webpack --watch
```

If you want the watch task to rebuild faster, you can comment out the uglify plugin in
`webpack.config.js` for the duration of your development.

### Code Compliance

This project uses jshint.  The configuration for jshint can be found in the repo at `.jshintrc` and `.jshintignore`.

```bash
npm run jshint
```

Point your editor to `.jscsrc` to follow the project's
[JavaScript Code Style (JSCS)](https://github.com/jscs-dev/node-jscs) rules.

```bash
npm run jscs
```

# License

Respoke.js is licensed under the [MIT license](LICENSE).
