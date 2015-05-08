'use strict';

var sharedConfig = require('./karma.conf');

// Karma shared functional configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        files: [
            'functional/index.js'
        ],

        preprocessors: {
            'functional/index.js': ['webpack', 'sourcemap']
        },

        junitReporter: {
            outputFile: '../build/functional-test-results.xml'
        },

        // The build machines are _really_ slow
        browserNoActivityTimeout: 60000
    });
};
