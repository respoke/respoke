var path = require('path');

// Karma shared configuration
module.exports = function (config) {
    'use strict';

    var respokePath = path.dirname(__dirname);

    config.set({
        // base path, that will be used to resolve files and exclude
        basePath: '',

        frameworks: ['mocha', 'chai', 'chai-sinon'],

        // list of files / patterns to load in the browser
        files: [
            'functional/index.js'
        ],

        preprocessors: {
            'functional/index.js': ['webpack', 'sourcemap']
        },

        webpack: {
            devtool: 'inline-source-map',
            resolve: {
                modulesDirectories: [
                    'node_modules'
                ],
                alias: {
                    respoke: respokePath,
                    'respoke-stats': path.join(respokePath, 'plugins', 'respoke-stats', 'respoke-stats')
                }
            },
            module: {
                loaders: [
                    {
                        test: /\.json$/,
                        loader: 'json'
                    }
                ]
            },
            // this allows us to pack the request module in respoke-admin
            externals: {
                fs: '{}',
                tls: '{}',
                net: '{}',
                console: '{}'
            }
        },

        plugins: [
            require('karma-webpack'),
            require('karma-sourcemap-loader'),
            require('karma-mocha'),
            require('karma-chai'),
            require('karma-chai-sinon'),
            require('karma-junit-reporter'),
            require('karma-spec-reporter'),
            require('karma-chrome-launcher'),
            require('karma-firefox-launcher')
        ],

        // test results reporter to use
        // possible values: 'dots', 'progress', 'junit'
        reporters: ['spec', 'junit'],
        junitReporter: {
            outputFile: '../build/functional-test-results.xml'
        },

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

        // The build machines are _really_ slow
        browserNoActivityTimeout: 60000,

        // If browser does not capture in given timeout [ms], kill it
        captureTimeout: 60000
    });
};
