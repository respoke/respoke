var webpack = require('webpack');

module.exports = {
    entry: "./index.js",
    output: {
        filename: "respoke.min.js",
        sourceMapFilename: "respoke.min.map",
        // name of the library to export
        library: "respoke",
        // include Universal Module Definition wrapper so library can be used as
        // a CommonJS library, AMD library, or a browser global
        libraryTarget: "umd"
    },
    node: {
        // disable bundling process shim that would otherwise be detected as needed from Q library
        process: false
    },
    devtool: "source-map",
    plugins: [
        // run the bundle through UglifyJS2
        new webpack.optimize.UglifyJsPlugin(),
        new webpack.BannerPlugin('Copyright (c) 2014, Digium, Inc. All Rights Reserved. MIT Licensed. For details and documentation visit https://www.respoke.io')
    ]
};
