/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    uglify: {
      my_target: {
        options: {
          mangle: false,
          compress: false,
          beautify: true
        },
        files: {
          'webrtc.min.js': ['util/socket.io.js', 'util/sails.io.js', 'util/q.js', 'util/loglevel.js', 'util/adapter.js', 'webrtc.js', 'webrtc/event.js', 'webrtc/client.js', 'webrtc/identity.js', 'webrtc/endpoints.js', 'webrtc/signaling.js', 'webrtc/media.js']
        }
      }
    }
  });


  grunt.loadNpmTasks('grunt-contrib-uglify');

};
