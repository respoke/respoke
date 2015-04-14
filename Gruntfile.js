"use strict";
var respokeStyle = require('respoke-style');

module.exports = function (grunt) {
    var saucerSection;
    var webhookService;
    var jsHintFiles = ['**/*.js'];
    if (grunt.option('file')) {
        jsHintFiles = [grunt.option('file').split(' ')];
    }

    function killSaucerSection() {
        if (saucerSection) {
            saucerSection.kill();
            saucerSection = null;
        }
    }

    function killWebhookService() {
        if (webhookService) {
            webhookService.kill();
            webhookService = null;
        }
    }

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        env: {
            test: {
                NODE_ENV: 'test',
                API_TESTS: 'true',
                CLEAR_DB: 'true'
            }
        },
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
        stratos: {
            liftSails: true,
            sailsDir: '../../../collective/',
            sailsPort: 3001
        },
        saucerSection: {
            dir: '../../../saucer-section',
            port: 3000
        },
        webhookService: {
            dir: '../../../webhook-service'
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
                singleRun: false,
                configFile: './spec/karma-discovery-chrome.conf.js'
            },
            discoveryFirefox: {
                singleRun: false,
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
                    jsHintFiles
                ]
            },
            ci: {
                options: {
                    reporter: require('jshint-junit-reporter'),
                    reporterOutput: 'build/jshint-output.xml',
                    jshintrc: '.jshintrc'
                },
                src: [
                    jsHintFiles
                ]
            }
        },

        // Generating Documentation
        jsdoxy: {
            options: {
                jsonOutput: '.docs/jsdoxy-output.json',
                outputPrivate: false,
                template: './docs.jade'
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
                    "respoke/presentable.js",
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
    grunt.loadNpmTasks('grunt-stratos');
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

    grunt.registerTask('dist', [
        'webpack',
        'uglify:respoke-stats'
    ]);

    grunt.registerTask('default', 'karma:devOrig');

    grunt.registerTask('unit', 'Run unit specs', [
        'dist',
        'karma:unitChrome',
        'karma:unitFirefox'
    ]);

    grunt.registerTask('start-webhook-service', 'Start webhook-service', function () {
        if (!grunt.file.isDir(grunt.config('webhookService.dir'))) {
            throw grunt.util.error('webhook-service dir not available.  Please setup webhook-service.');
        }
        process.on('exit', function () {
            //ensure webhook-service child process is dead
            killWebhookService();
        });
        webhookService = grunt.util.spawn({
            cmd: 'node',
            args: ['app.js'],
            opts: {
                cwd: grunt.config('webhookService.dir')
            }
        });
    });

    grunt.registerTask('stop-webhook-service', 'Stop webhook-service', function () {
        killWebhookService();
    });

    grunt.registerTask('start-saucer-section', 'Start saucer-section', function () {
        process.env.CONNECT_PORT = grunt.config('saucerSection.port');
        if (!grunt.file.isDir(grunt.config('saucerSection.dir'))) {
            throw grunt.util.error('saucer-section dir not available.  Please setup saucer-section.');
        }
        process.on('exit', function () {
            //ensure saucer-section child process is dead
            killSaucerSection();
        });
        saucerSection = grunt.util.spawn({
            grunt: true,
            args: ['default'],
            opts: {
                cwd: grunt.config('saucerSection.dir')
            }
        });
    });

    grunt.registerTask('stop-saucer-section', 'Start saucer-section', function () {
        killSaucerSection();
    });

    grunt.registerTask('discoveryChrome', 'Run discovery specs', [
        'dist',
        'karma:discoveryChrome'
    ]);

    grunt.registerTask('discoveryFirefox', 'Run discovery specs', [
        'dist',
        'karma:discoveryFirefox'
    ]);

    grunt.registerTask('functional', 'Run client-side functional tests', [
        'env:test',
        'karma:functionalChrome'
    ]);

    grunt.registerTask('lint', 'run jshint', ['jshint:pretty']);
    grunt.registerTask('ci', 'Run all tests', [
        'jshint:ci',
        'env:test',
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
