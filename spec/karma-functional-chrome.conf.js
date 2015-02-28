// Karma configuration
module.exports = function(config) {
    "use strict";

    config.set({
        // base path, that will be used to resolve files and exclude
        basePath: '',

        frameworks: ['mocha'],

        // list of files / patterns to load in the browser
        files: [
          '../node_modules/chai/chai.js',
          '../node_modules/sinon/pkg/sinon.js',
          '../node_modules/async/lib/async.js',
          '../respoke.min.js',
          '../respoke-stats.min.js',
          'util/config.js',
          'util/mock_module.js', // Must be loaded after loglevel.js b/c of `module` check.
          '../../../../collective/lib/seeds_data.js',
          '../../../../collective/assets/js/jquery.js',
          '../../../../collective/spec/util/api_client.js',
          '../../../../collective/spec/util/fixture.js',
          'functional/*.spec.js'
        ],

        // test results reporter to use
        // possible values: 'dots', 'progress', 'junit'
        reporters: ['spec','junit'],
        junitReporter: {
            outputFile: 'build/functional-test-results.xml'
        },

        hostname: 'localhost',
        proxyValidateSSL: false,
        proxies: {
            '/': 'https://localhost/'
        },

        urlRoot: '__karma__',

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

        // Start these browsers, currently available:
        browsers: ['ChromeAutoaccept'],
        customLaunchers: {
            ChromeAutoaccept: {
                base: 'Chrome',
                flags: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
            }
        },

        // The build machines are _really_ slow
        browserNoActivityTimeout: 60000,

        // If browser does not capture in given timeout [ms], kill it
        captureTimeout: 60000
    });
};
