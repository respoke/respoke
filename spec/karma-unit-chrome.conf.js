'use strict';

var sharedConfig = require('./karma-unit.conf');

// Karma chrome unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        browsers: ['Chrome']
    });
};
