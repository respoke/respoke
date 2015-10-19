'use strict';

var sharedConfig = require('./karma-unit-dev.conf');

// Karma chrome unit configuration
module.exports = function (config) {
    sharedConfig(config);

    config.set({
        browsers: ['Chrome_DevTools_Saved_Prefs'],
        customLaunchers: {
            // this keeps the dev tools in the same state when using Debug mode (singleRun: false)
            Chrome_DevTools_Saved_Prefs: {
                base: 'Chrome',
                flags: ['--user-data-dir=./.chrome_dev_user']
            }
        }
    });
};
