/*global module:false*/
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        uglify: {
            brightstream: {
                options: {
                    compress: true,
                    sourceMap: true
                },
                files: {
                    'brightstream.min.js': [
                        'util/socket.io.js',
                        'util/q.js',
                        'util/loglevel.js',
                        'util/adapter.js',
                        'brightstream.js',
                        'brightstream/event.js',
                        'brightstream/client.js',
                        'brightstream/identity.js',
                        'brightstream/endpoints.js',
                        'brightstream/signalingChannel.js',
                        'brightstream/call.js',
                        'brightstream/directConnection.js'
                        'brightstream/peerConnection.js'
                    ]
                }
            },
            'brightstream-stats': {
                options: {
                    compress: true,
                    sourceMap: true
                },
                files: {
                    'brightstream-stats.min.js': [
                        'brightstream/mediastats.js'
                    ]
                }
            }
        }
    });


    grunt.loadNpmTasks('grunt-contrib-uglify');

};
