'use strict';

var sharedConfig = require('./karma.conf');

// Karma shared unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        junitReporter: {
            outputFile: '../build/unit-test-results.xml'
        }
    });
};
