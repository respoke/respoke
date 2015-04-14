'use strict';

var sharedConfig = require('./karma.conf');

// Karma shared functional configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        junitReporter: {
            outputFile: '../build/functional-test-results.xml'
        },

        // The build machines are _really_ slow
        browserNoActivityTimeout: 60000
    });
};
