'use strict';

var sharedConfig = require('./karma-functional.conf');

// Karma firefox configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        browsers: ['FirefoxAutoaccept'],
        customLaunchers: {
            FirefoxAutoaccept: {
                base: 'Firefox',
                prefs: {
                    'media.navigator.permission.disabled': true
                }
            }
        }
    });
};
