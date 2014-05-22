"use strict";

module.exports = function(grunt) {
    var brightstreamFiles = [
        'util/socket.io.js',
        'util/q.js',
        'util/loglevel.js',
        'util/adapter.js',
        'brightstream.js',
        'brightstream/event.js',
        'brightstream/client.js',
        'brightstream/endpoints.js',
        'brightstream/signalingChannel.js',
        'brightstream/call.js',
        'brightstream/directConnection.js',
        'brightstream/peerConnection.js',
        'brightstream/localMedia.js'
    ];

    var brightstreamMediaStatsFiles = [
        'brightstream/mediaStats.js'
    ];

    grunt.initConfig({
        uglify: {
            brightstream: {
                options: {
                    compress: true,
                    sourceMap: true
                },
                files: {
                    'brightstream.min.js': brightstreamFiles
                }
            },
            'brightstream-stats': {
                options: {
                    compress: true,
                    sourceMap: true
                },
                files: {
                    'brightstream-stats.min.js': brightstreamMediaStatsFiles
                }
            },
            'brightstream-beautify': {
                options: {
                    beautify: true,
                    mangle: false
                },
                files: {
                    'brightstream.combine.js': brightstreamFiles
                }
            },
            'brightstream-beautify-stats': {
                options: {
                    beautify: true,
                    mangle: false
                },
                files: {
                    'brightstream-stats.combine.js': brightstreamMediaStatsFiles
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
                    {expand: true, cwd: '.', src: ['brightstream*.min.js'], action: 'upload'},
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
    grunt.task.registerTask('dist', ['uglify:brightstream', 'uglify:brightstream-stats']);
    grunt.task.registerTask('combine', ['uglify:brightstream-beautify', 'uglify:brightstream-beautify-stats']);

    grunt.registerTask('default', 'karma:devOrig');
    grunt.registerTask('unit:client', 'Run client Unit tests', ['karma:devOrig', 'karma:devMin']);

    grunt.registerTask('unit', 'Run unit specs on bamboo', [
        'uglify',
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
