"use strict";

module.exports = function(grunt) {
    var respokeFiles = [
        'util/socket.io.js',
        'util/q.js',
        'util/loglevel.js',
        'util/adapter.js',
        'respoke.js',
        'respoke/event.js',
        'respoke/client.js',
        'respoke/endpoints.js',
        'respoke/signalingChannel.js',
        'respoke/call.js',
        'respoke/directConnection.js',
        'respoke/peerConnection.js',
        'respoke/localMedia.js'
    ];

    var respokeMediaStatsFiles = [
        'respoke/mediaStats.js'
    ];

    grunt.initConfig({
        uglify: {
            respoke: {
                options: {
                    compress: true,
                    sourceMap: true,
                    sourceMapIncludeSources: true
                },
                files: {
                    'respoke.min.js': respokeFiles
                }
            },
            'respoke-stats': {
                options: {
                    compress: true,
                    sourceMap: true,
                    sourceMapIncludeSources: true
                },
                files: {
                    'respoke-stats.min.js': respokeMediaStatsFiles
                }
            },
            'respoke-beautify': {
                options: {
                    compress: false,
                    sourceMap: false,
                    beautify: true,
                    mangle: false
                },
                files: {
                    'respoke.combine.js': respokeFiles
                }
            },
            'respoke-beautify-stats': {
                options: {
                    compress: false,
                    sourceMap: false,
                    beautify: true,
                    mangle: false
                },
                files: {
                    'respoke-stats.combine.js': respokeMediaStatsFiles
                }
            }
        },
        aws_s3: {
            options: {
                uploadConcurrency: 5,
                downloadConcurrency: 5
            },
            assets: {
                options: {
                    bucket: 'stratos-assets',
                    differential: true
                },
                files: [
                    {expand: true, cwd: '.', src: ['respoke*.min.js'], action: 'upload'},
                    {expand: true, cwd: '.', src: ['*.map'], action: 'upload'}
                ]
            }
        },

        pkg: grunt.file.readJSON('package.json'),

        stratos: {
            startServer: false,
            //nodeServer: '../app.js',
            //nodeServerPort: 8081,
            liftSails: true,
            sailsDir: '../../../collective'
        },
        mochaTest: {
            unit: {
                options: {
                    reporter: 'mocha-bamboo-reporter'
                },
                src: [
                    './spec/functional/*.spec.js',
                ]
            }
        },
        karma: {
            options: {
                configFile: './karma-lib-orig.conf.js'
            },
            continuous: {
                configFile: './karma-lib-orig.conf.js',
                browsers: ['Chrome'],
                singleRun: true,
                reporters: ['junit']
            },
            devOrig: {
                singleRun: true,
                configFile: './karma-lib-orig.conf.js'
            },
            devMin: {
                singleRun: true,
                configFile: './karma-lib-min.conf.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-stratos');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-aws-s3');

    grunt.task.registerTask('s3', ['aws_s3']);
    grunt.task.registerTask('dist', ['uglify:respoke', 'uglify:respoke-stats']);
    grunt.task.registerTask('combine', ['uglify:respoke-beautify', 'uglify:respoke-beautify-stats']);

    grunt.registerTask('default', 'karma:devOrig');
    grunt.registerTask('unit:client', 'Run client Unit tests', ['karma:devOrig', 'karma:devMin']);

    grunt.registerTask('unit', 'Run unit specs on bamboo', [
        'dist',
        'karma:devOrig',
        'karma:devMin'
    ]);

    /*grunt.registerTask('start-server', 'Start a node server.', function() {
        grunt.log.writeln('Starting node server...');
        var done = this.async();
        process.env['SERVER_PORT'] = grunt.config('stratos.nodeServerPort');
        require(process.cwd() + '/' + grunt.config('stratos.nodeServer'));
        setTimeout(function () {
            done();
        }, 3000);
    });*/
};
