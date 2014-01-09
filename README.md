# transporter

Client Side Library for connecting to the Digium Cloud's API / WebRTC

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

This project uses jshint

```
jshint webrtc.js webrtc/*.js
```

There is a pre commit hook in `githooks` which will run `jshint` global binary against `webrtc.js` and `webrtc/*.js`

This will stop you commiting bad code which is against the coding standards - **Where is the coding guidelines document?**

The standards for the project can be found in `.jshintrc`


