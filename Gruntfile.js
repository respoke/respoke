"use strict";

module.exports = function(grunt) {

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
                    sourceMapIncludeSources: true
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
            sailsPort: 2001
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
            continuous: {
                configFile: './karma-lib-orig.conf.js',
                browsers: ['Chrome'],
                singleRun: true,
                reporters: ['junit']
            },
            unit: {
                singleRun: true,
                configFile: './karma-unit.conf.js'
            },
            functional: {
                singleRun: true,
                configFile: './karma-functional.conf.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-webpack');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-stratos');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-aws-s3');
    grunt.loadNpmTasks('grunt-env');

    grunt.registerTask('s3', ['aws_s3']);

    grunt.registerTask('dist', [
        'webpack',
        'uglify:respoke-stats'
    ]);

    grunt.registerTask('default', 'karma:devOrig');

    grunt.registerTask('unit', 'Run unit specs', [
        'dist',
        'karma:unit'
    ]);

    grunt.registerTask('functional', 'Run client-side functional tests', [
        'dist',
        'env:test',
        'liftSails',
        'karma:functional',
        'lowerSails'
    ]);

    grunt.registerTask('ci', 'Run all tests', [
        'dist',
        'env:test',
        'liftSails',
        'karma:unit',
        'karma:functional',
        'lowerSails'
    ]);
};
