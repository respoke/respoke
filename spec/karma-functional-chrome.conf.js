'use strict';

var sharedConfig = require('./karma-functional.conf');

// Karma chrome configuration
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
