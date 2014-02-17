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
          'brightstream.min.js': ['util/socket.io.js', 'util/sails.io.js', 'util/q.js', 'util/loglevel.js', 'util/adapter.js', 'brightstream.js', 'brightstream/event.js', 'brightstream/client.js', 'brightstream/identity.js', 'brightstream/endpoints.js', 'brightstream/signalingChannel.js', 'brightstream/call.js']
        }
      }
    }
  });


  grunt.loadNpmTasks('grunt-contrib-uglify');

};
