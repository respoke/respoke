/*global module:false*/
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

    // Project configuration.
    grunt.initConfig({
        uglify: {
            brightstream: {
                options: {
                    compress: true,
                    //mangle: true,
                    sourceMap: true
                },
                files: {
                    'brightstream.min.js': brightstreamFiles
                }
            },
            'brightstream-stats': {
                options: {
                    compress: true,
                    /*mangle: {
                        except: [
                            'brightstream', 'RTCPeerConnection', 'createPeerConnection', 'getUserMedia',
                            'attachMediaStream', 'reattachMediaStream', 'webrtcDetectedBrowser',
                            'webrtcDetectedVersion', 'Q'
                        ],
                    },*/
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
        }
    });


    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-aws-s3');


    grunt.task.registerTask('s3', ['aws_s3']);
    grunt.task.registerTask('dist', ['uglify:brightstream', 'uglify:brightstream-stats']);
    grunt.task.registerTask('combine', ['uglify:brightstream-beautify', 'uglify:brightstream-beautify-stats']);
};
