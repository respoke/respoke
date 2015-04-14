'use strict';

var sharedConfig = require('./karma-unit.conf');

// Karma firefox unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        browsers: ['Firefox']
    });
};
