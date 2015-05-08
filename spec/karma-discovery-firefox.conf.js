'use strict';

var sharedConfig = require('./karma-discovery.conf.js');

// Karma chrome discovery configuration
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
