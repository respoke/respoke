'use strict';
var _ = require('lodash');
var webpack = require('webpack');
var baseConfig = require('./webpack.config');
var config = _.assign({}, baseConfig);

config.output.filename = 'build/respoke.min.js';
config.output.sourceMapFilename = 'build/respoke.min.map';
config.devtool = 'source-map';

config.plugins.push(new webpack.BannerPlugin(
    'Copyright (c) 2014, Digium, Inc. All Rights Reserved. MIT Licensed.' +
    'For details and documentation visit https://www.respoke.io'
));
// run the bundle through UglifyJS2
config.plugins.push(new webpack.optimize.UglifyJsPlugin({
    mangle: false,
    compress: false
}));

module.exports = config;
