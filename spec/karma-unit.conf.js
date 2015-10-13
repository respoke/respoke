'use strict';

var sharedConfig = require('./karma.conf');

// Karma shared unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        files: [
            { pattern: '../build/*.map', included: false },
            '../build/respoke.min.js',
            '../build/respoke-stats.min.js',
            'util/mockSignalingChannel.js',
            'unit/*.spec.js'
        ],

        junitReporter: {
            outputFile: '../build/unit-test-results.xml'
        }
    });
};
