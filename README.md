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

Tests are in the `spec` directory and are run using [mocha](http://visionmedia.github.io/mocha/). Webdriver is also used.

## Helpers

### Minification

```
grunt uglify
```

### Code Compliance

This project uses jshint.  The configuration for jshint can be found in the repo at `.jshintrc`.

```
jshint respoke.js respoke/*.js
```

There is a pre commit hook in `githooks` which will run `jshint` global binary against `respoke.js` and `respoke/*.js`
Please copy this file into your .git/hooks directory so that it runs before each commit.
This will stop you commiting bad code which is against the [coding standards](http://wiki.digium.internal/wiki/display/MERCURY/Coding+Conventions).
