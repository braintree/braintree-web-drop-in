'use strict';

var browserify = require('browserify');
var cleanCSS = require('gulp-clean-css');
var del = require('del');
var fs = require('fs');
var gulp = require('gulp');
var path = require('path');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var size = require('gulp-size');
var source = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var uglify = require('gulp-uglify');
var VERSION = require('./package.json').version;

var DIST_PATH = 'dist/web/' + VERSION;

var config = {
  namespace: 'braintree',
  src: {
    js: {
      main: './src/index.js',
      watch: 'src/**/*.js',
      output: 'dropin.js',
      min: 'dropin.min.js'
    },
    css: {
      main: './src/dropin-frame.scss',
      watch: 'src/**/*.scss',
      output: 'dropin-frame.css'
    }
  },
  dist: {
    js: DIST_PATH + '/js',
    css: DIST_PATH + '/css'
  }
};

gulp.task('build:js', function () {
  return browserify(config.src.js.main, {standalone: 'braintree.dropin'})
    .bundle()
    .pipe(source(config.src.js.output))
    .pipe(streamify(size()))
    .pipe(gulp.dest(config.dist.js))
    .pipe(streamify(uglify()))
    .pipe(streamify(size()))
    .pipe(rename(config.src.js.min))
    .pipe(gulp.dest(config.dist.js));
});

gulp.task('build:css', function () {
  var sassOptions = {};

  return gulp.src(config.src.css.main)
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(gulp.dest(config.dist.css))
});

gulp.task('build:link-latest', function (done) {
  fs.symlink(VERSION, 'dist/web/dev', done);
});

gulp.task('clean', function () {
  return del(['./dist']);
});

gulp.task('build', function (done) {
  runSequence(
  'clean',
  ['build:js', 'build:css'],
  'build:link-latest',
  done);
});

gulp.task('build:integration', ['build']);

gulp.task('watch:integration', function () {
  gulp.watch([config.src.js.watch, config.src.css.watch], ['build'])
});
