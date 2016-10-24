'use strict';

/* globals __dirname */

var browserify = require('browserify');
var stringify = require('stringify');
var cleanCSS = require('gulp-clean-css');
var del = require('del');
var fs = require('fs');
var gulp = require('gulp');
var path = require('path');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var size = require('gulp-size');
var source = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var uglify = require('gulp-uglify');
var http = require('http');
var serveStatic = require('serve-static');
var finalhandler = require('finalhandler');
var gutil = require('gulp-util');
var VERSION = require('./package.json').version;

var DIST_PATH = 'dist/web/dropin/' + VERSION;

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
      main: './src/scss/main.scss',
      watch: 'src/scss/**/*.scss',
      output: 'dropin.css',
      min: 'dropin.min.css'
    },
    html: {
      watch: 'src/html/**/*.html'
    }
  },
  dist: {
    js: DIST_PATH + '/js',
    css: DIST_PATH + '/css'
  },
  serve: {
    assets: {
      name: 'Asset server',
      path: 'dist',
      port: 9000
    },
    demo: {
      name: 'Demo app',
      path: 'test/app',
      port: 4567
    }
  }
};

gulp.task('build:js', ['build:js:unmin', 'build:js:min']);

gulp.task('build:js:unmin', function () {
  return browserify(config.src.js.main, {standalone: 'braintree.dropin'})
    .transform(stringify, {
      appliesTo: { includeExtensions: ['.html'] },
      minify: false
    })
    .bundle()
    .pipe(source(config.src.js.output))
    .pipe(replace('@DOT_MIN', ''))
    .pipe(streamify(size()))
    .pipe(gulp.dest(config.dist.js))
});

gulp.task('build:js:min', function () {
  return browserify(config.src.js.main, {standalone: 'braintree.dropin'})
    .transform(stringify, {
      appliesTo: { includeExtensions: ['.html'] },
      minify: true
    })
    .bundle()
    .pipe(source(config.src.js.output))
    .pipe(replace('@DOT_MIN', '.min'))
    .pipe(streamify(uglify()))
    .pipe(streamify(size()))
    .pipe(rename(config.src.js.min))
    .pipe(gulp.dest(config.dist.js));
});

gulp.task('build:css', function () {
  var sassOptions = {};

  return gulp.src(config.src.css.main)
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(rename(config.src.css.output))
    .pipe(gulp.dest(config.dist.css))
    .pipe(cleanCSS())
    .pipe(rename(config.src.css.min))
    .pipe(gulp.dest(config.dist.css));
});

gulp.task('build:link-latest', function (done) {
  fs.symlink(VERSION, 'dist/web/dropin/dev', done);
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

function serveTask(options) {
  var serve = serveStatic(path.join(__dirname, options.path));

  return function () {
    http.createServer(function (req, res) {
      serve(req, res, finalhandler(req, res));
    }).listen(options.port, function () {
      gutil.log(gutil.colors.magenta(options.name), 'started on port', gutil.colors.yellow(options.port));
    });
  };
}

gulp.task('serve:assets', serveTask(config.serve.assets));
gulp.task('serve:demo', serveTask(config.serve.demo));

gulp.task('development', [
  'build',
  'watch',
  'serve:assets',
  'serve:demo'
]);

gulp.task('watch', function () {
  gulp.watch([config.src.js.watch, config.src.html.watch], ['build:js']);
  gulp.watch([config.src.css.watch], ['build:css']);
});

gulp.task('watch:integration', ['watch']);
