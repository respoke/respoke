'use strict';

// Karma shared configuration
module.exports = function (config) {
    config.set({
        // base path, that will be used to resolve files and exclude
        basePath: '',

        frameworks: ['mocha', 'dirty-chai', 'chai-sinon'],

        plugins: [
            require('karma-mocha'),
            require('karma-chai'),
            require('karma-dirty-chai'),
            require('karma-chai-sinon'),
            require('karma-junit-reporter'),
            require('karma-spec-reporter'),
            require('karma-chrome-launcher'),
            require('karma-firefox-launcher')
        ],

        // test results reporter to use
        // possible values: 'dots', 'progress', 'junit'
        reporters: ['spec', 'junit'],

        hostname: 'localhost',
        proxyValidateSSL: false,
        proxies: {
            '/': 'https://localhost/'
        },

        urlRoot: '/__karma__/',

        // web server port
        port: 9876,

        // cli runner port
        runnerPort: 9100,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
        logLevel: config.LOG_INFO,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,

        // If browser does not capture in given timeout [ms], kill it
        captureTimeout: 60000,

        // the test suite should run through a single time. Set to 'false' to allow debugging
        singleRun: true
    });
};
