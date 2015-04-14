'use strict';

var sharedConfig = require('./karma-discovery.conf.js');

// Karma chrome discovery configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        browsers: ['ChromeAutoaccept'],
        customLaunchers: {
            ChromeAutoaccept: {
                base: 'Chrome',
                flags: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        }
    });
};
