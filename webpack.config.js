'use strict';

module.exports = {
    entry: "./index.js",
    output: {
        filename: "build/respoke.js",
        // name of the library to export
        library: "respoke",
        // include Universal Module Definition wrapper so library can be used as
        // a CommonJS library, AMD library, or a browser global
        libraryTarget: "umd"
    },
    node: {
        // disable bundling process shim that would otherwise be detected as needed from Q library
        process: false,
        setImmediate: false
    },
    plugins: [],
    // required b/c of https://github.com/webpack/grunt-webpack/issues/43
    module: {}
};
