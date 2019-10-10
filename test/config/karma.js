'use strict';

module.exports = function (config) {
  config.set({
    basePath: '../',
    frameworks: ['browserify', 'mocha'],
    plugins: [
      'karma-browserify',
      'karma-phantomjs-launcher',
      'karma-mocha',
      'karma-mocha-reporter'
    ],
    browsers: ['PhantomJS'],
    port: 7357,
    reporters: ['mocha'],
    preprocessors: {
      '**/*.js': ['browserify']
    },
    browserify: {
      extensions: ['.js', '.json'],
      transform: require('../../package.json').browserify.transform,
      ignore: [],
      watch: true,
      debug: true,
      noParse: []
    },
    files: [
      '../node_modules/es6-shim/es6-shim.js',
      '**/*.js'
    ],
    exclude: [
      '**/*.swp',
      '**/publishing/*.js',
      '**/integration/*.js'
    ]
  });
};
