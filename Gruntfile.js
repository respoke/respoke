"use strict";
var respokeStyle = require('respoke-style');

module.exports = function (grunt) {
    var lintFiles = ['**/*.js'];
    if (grunt.option('file')) {
        lintFiles = [grunt.option('file').split(' ')];
    }

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            'respoke-stats': {
                options: {
                    compress: true,
                    sourceMap: true,
                    sourceMapIncludeSources: true,
                    banner: '/*! Copyright (c) 2014, Digium, Inc. All Rights Reserved. MIT Licensed. For all details and documentation: https://www.respoke.io */'
                },
                files: {
                    'respoke-stats.min.js': 'plugins/respoke-stats/respoke-stats.js'
                }
            }
        },
        webpack: {
            all: require('./webpack.dist')
        },
        mochaTest: {
            unit: {
                options: {
                    reporter: 'mocha-bamboo-reporter'
                },
                src: [
                    './spec/functional/*.spec.js'
                ]
            }
        },
        karma: {
            unitChrome: {
                singleRun: true,
                configFile: './spec/karma-unit-chrome.conf.js'
            },
            unitFirefox: {
                singleRun: true,
                configFile: './spec/karma-unit-firefox.conf.js'
            },
            functionalChrome: {
                singleRun: true,
                configFile: './spec/karma-functional-chrome.conf.js'
            },
            functionalFirefox: {
                singleRun: true,
                configFile: './spec/karma-functional-firefox.conf.js'
            },
            discoveryChrome: {
                singleRun: true,
                configFile: './spec/karma-discovery-chrome.conf.js'
            },
            discoveryFirefox: {
                singleRun: true,
                configFile: './spec/karma-discovery-firefox.conf.js'
            }
        },
        watch: {
            scripts: {
                files: ['respoke/**/*.js', 'plugins/**/*.js'],
                tasks: ['dist']
            },
            docs: {
                files: ['respoke/**/*.js', 'plugins/**/*.js', 'docs.scss', 'docs.jade'],
                tasks: ['docs']
            }
        },

        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            pretty: {
                src: [
                    lintFiles
                ]
            },
            ci: {
                options: {
                    reporter: require('jshint-junit-reporter'),
                    reporterOutput: 'build/jshint-output.xml',
                    jshintrc: '.jshintrc'
                },
                src: [
                    lintFiles
                ]
            }
        },

        jscs: {
            pretty: {
                src: [
                    lintFiles
                ]
            },
            ci: {
                options: {
                    reporter: 'junit',
                    reporterOutput: 'build/jscs-output.xml'
                },
                src: [
                    lintFiles
                ]
            }
        },

        // Generating Documentation
        jsdoxy: {
            options: {
                jsonOutput: '.docs/jsdoxy-output.json',
                outputPrivate: false,
                template: './docs.jade',
                flatten: true
            },
            files: {
                src: [
                    "respoke/call.js",
                    "respoke/client.js",
                    "respoke/connection.js",
                    "respoke/directConnection.js",
                    "respoke/endpoint.js",
                    "respoke/event.js",
                    "respoke/group.js",
                    "respoke/localMedia.js",
                    "respoke/remoteMedia.js",
                    "respoke/respoke.js",
                    "plugins/respoke-stats/respoke-stats.js"
                ],
                dest: '.docs/site/'
            }
        },
        copy: {
            'docs-shared-assets': {
                cwd: respokeStyle.paths.assets,
                expand: true,
                src: '**/*',
                dest: '.docs/site/'
            }
        },
        clean: {
            'pre-docs': {
                files: {
                    src: ['.docs/']
                }
            }
        },
        sass: {
            docs: {
                options: {
                    includePaths: respokeStyle.includeStylePaths()
                },
                files: {
                    '.docs/site/css/docs.css': 'docs.scss'
                }
            }
        },
        'http-server': {
            docs: {
                // the server root directory
                root: '.docs/site/',
                port: 2007,
                host: "0.0.0.0",
                showDir: true,
                autoIndex: true,

                // server default file extension
                // ext: "html",

                // run in parallel with other tasks
                runInBackground: true

            }

        }
    });

    grunt.loadNpmTasks('grunt-webpack');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-env');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-http-server');
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('jsdoxy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks("grunt-jscs");

    grunt.registerTask('dist', [
        'webpack',
        'uglify:respoke-stats'
    ]);

    grunt.registerTask('default', 'karma:devOrig');

    grunt.registerTask('unit', 'Run unit specs', [
        'karma:unitChrome',
        'karma:unitFirefox'
    ]);

    grunt.registerTask('discovery', 'Run discovery specs', [
        'karma:discoveryChrome',
        'karma:discoveryFirefox'
    ]);

    grunt.registerTask('discovery:chrome', 'Run discovery specs for Chrome', [
        'karma:discoveryChrome'
    ]);

    grunt.registerTask('discovery:firefox', 'Run discovery specs for Firefox', [
        'karma:discoveryFirefox'
    ]);

    grunt.registerTask('functional', 'Run client-side functional tests', [
        'karma:functionalChrome',
        'karma:functionalFirefox'
    ]);

    grunt.registerTask('functional:chrome', 'Run client-side functional tests in Chrome', [
        'karma:functionalChrome'
    ]);

    grunt.registerTask('functional:firefox', 'Run client-side functional tests in Firefox', [
        'karma:functionalFirefox'
    ]);

    grunt.registerTask('lint', 'run jshint', ['jshint:pretty', 'jscs:pretty']);
    grunt.registerTask('ci', 'Run all tests', [
        'jshint:ci',
        'jscs:ci',
        'karma:unitChrome',
        'karma:unitFirefox',
        'karma:functionalChrome',
        'karma:functionalFirefox'
    ]);

    grunt.registerTask('docs', 'Build the documentation HTML pages', [
        'clean:pre-docs',
        'jsdoxy',
        'copy:docs-shared-assets',
        'sass:docs'
    ]);
    grunt.registerTask('docs-server', 'Build, watch, rebuild, and serve the docs', [
        'docs',
        'http-server:docs',
        'watch:docs'
    ]);
};
