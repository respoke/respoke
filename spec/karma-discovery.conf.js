'use strict';

var sharedConfig = require('./karma.conf.js');

// Karma chrome discovery configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        files: [
            'discovery/index.js'
        ],

        preprocessors: {
            'discovery/index.js': ['webpack', 'sourcemap']
        },

        reporters: ['spec'],

        // The build machines are _really_ slow
        browserNoActivityTimeout: 60000
    });
};
