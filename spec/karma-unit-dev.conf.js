'use strict';

var sharedConfig = require('./karma.conf');

// Karma shared unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        files: [
            '../build/respoke.js',
            '../build/respoke-stats.js',
            'util/mockSignalingChannel.js',
            'unit/*.spec.js'
        ],

        junitReporter: {
            outputFile: '../build/unit-test-results.xml'
        },

        //singleRun: false
    });
};
