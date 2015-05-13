'use strict';

var sharedConfig = require('./karma.conf');

// Karma shared unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        files: [
            'unit/index.js'
        ],

        preprocessors: {
            'unit/index.js': ['webpack', 'sourcemap']
        },

        junitReporter: {
            outputFile: '../build/unit-test-results.xml'
        }
    });
};
