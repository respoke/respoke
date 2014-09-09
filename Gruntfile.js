"use strict";

module.exports = function (grunt) {
    var saucerSection;
    var webhookService;

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
                CLEAR_DB: 'true'
            }
        },
        uglify: {
            'respoke-stats': {
                options: {
                    compress: true,
                    sourceMap: true,
                    sourceMapIncludeSources: true,
                    banner: '/*! Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software. */'
                },
                files: {
                    'respoke-stats.min.js': 'plugins/respoke-stats/respoke-stats.js'
                }
            }
        },
        webpack: {
            all: require('./webpack.config')
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
            unit: {
                singleRun: true,
                configFile: './karma-unit.conf.js'
            },
            functional: {
                singleRun: true,
                configFile: './karma-functional.conf.js'
            }
        },
        watch: {
            scripts: {
                files: ['respoke/**/*.js','plugins/**/*.js'],
                tasks: ['dist']
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

    grunt.registerTask('dist', [
        'webpack',
        'uglify:respoke-stats'
    ]);

    grunt.registerTask('default', 'karma:devOrig');

    grunt.registerTask('unit', 'Run unit specs', [
        'dist',
        'karma:unit'
    ]);

    grunt.registerTask('start-webhook-service', 'Start webhook-service', function () {
        if (!grunt.file.isDir(grunt.config('webhookService.dir'))) {
            throw grunt.util.error('webhook-service dir not available.  Please setup webhook-service.');
        }
        process.on('exit', function() {
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
        process.on('exit', function() {
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

    grunt.registerTask('functional', 'Run client-side functional tests', [
        'dist',
        'env:test',
        'start-saucer-section',
        'start-webhook-service',
        'liftSails',
        'karma:functional',
        'lowerSails',
        'stop-saucer-section',
        'stop-webhook-service'
    ]);

    grunt.registerTask('ci', 'Run all tests', [
        'dist',
        'env:test',
        'start-saucer-section',
        'start-webhook-service',
        'liftSails',
        'karma:unit',
        'karma:functional',
        'lowerSails',
        'stop-saucer-section',
        'stop-webhook-service'
    ]);
};
