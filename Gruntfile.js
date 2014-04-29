module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        preserveComments: 'some'
      },
      my_target: {
        files: {
          'build/<%= pkg.name %>.min.js' : ['src/<%= pkg.name %>.js', 'src/scroller.js']
        }
      }
    },
    less: {
      production: {
        options: {
          compress: true
        },
        files: {
          "build/hmm_logo.css": "src/style.less"
        }
      }
    }
  });


  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Load plugin that provides the "less" task
  grunt.loadNpmTasks('grunt-contrib-less');

  // Default task(s).
  grunt.registerTask('default', ['uglify', 'less']);

};
