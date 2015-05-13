var webpack = require('webpack');
var config = require('./webpack.config');

config.plugins.push(new webpack.BannerPlugin(
    'Copyright (c) 2014, Digium, Inc. All Rights Reserved. MIT Licensed.' +
    'For details and documentation visit https://www.respoke.io'
));
// run the bundle through UglifyJS2
config.plugins.push(new webpack.optimize.UglifyJsPlugin());

module.exports = config;
