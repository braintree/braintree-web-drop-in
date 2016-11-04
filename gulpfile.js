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
var spawn = require('child_process').spawn;
var connect = require('connect');
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
  jsdoc: {
    watch: 'jsdoc/*',
    readme: 'jsdoc/Home.md'
  },
  dist: {
    js: DIST_PATH + '/js',
    css: DIST_PATH + '/css',
    jsdoc: DIST_PATH + '/jsdoc'
  },
  server: {
    assetsPath: 'dist',
    demoPath: 'test/app',
    port: 4567
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
  ['build:js', 'build:css', 'build:jsdoc'],
  'build:link-latest',
  done);
});

function jsdoc(options, done) {
  var args = ['jsdoc', 'src'];

  options = options || {};

  if (options.access) args.splice(1, 0, '-a', options.access);
  if (options.configure) args.splice(1, 0, '-c', options.configure);
  if (options.debug === true) args.splice(1, 0, '--debug');
  if (options.destination) args.splice(1, 0, '-d', options.destination);
  if (options.encoding) args.splice(1, 0, '-e', options.encoding);
  if (options.help === true) args.splice(1, 0, '-h');
  if (options.match) args.splice(1, 0, '--match', options.match);
  if (options.nocolor === true) args.splice(1, 0, '--nocolor');
  if (options.private === true) args.splice(1, 0, '-p');
  if (options.package) args.splice(1, 0, '-P', options.package);
  if (options.pedantic === true) args.splice(1, 0, '--pedantic');
  if (options.query) args.splice(1, 0, '-q', options.query);
  if (options.recurse === true) args.splice(1, 0, '-r');
  if (options.readme) args.splice(1, 0, '-R', options.readme);
  if (options.template) args.splice(1, 0, '-t', options.template);
  if (options.test === true) args.splice(1, 0, '-T');
  if (options.tutorials) args.splice(1, 0, '-u', options.tutorials);
  if (options.version === true) args.splice(1, 0, '-v');
  if (options.verbose === true) args.splice(1, 0, '--verbose');
  if (options.explain === true) args.splice(1, 0, '-X');

  spawn('bash', ['-c', args.join(' ')], {
    stdio: ['ignore', 1, 2]
  }).on('exit', function (code) {
    if (code === 0) {
      done();
    } else {
      done(code);
    }
  });
}

gulp.task('build:jsdoc', function (done) {
  jsdoc({
    configure: 'jsdoc/conf.json',
    destination: config.dist.jsdoc,
    recurse: true,
    readme: config.jsdoc.readme,
    template: 'node_modules/jsdoc-template'
  }, done);
});

gulp.task('demoapp', function () {
  connect()
    .use(serveStatic(path.join(__dirname, config.server.demoPath)))
    .use(serveStatic(path.join(__dirname, config.server.assetsPath)))
    .listen(config.server.port, function () {
      gutil.log(gutil.colors.magenta('Demo app'), 'started on port', gutil.colors.yellow(config.server.port));
    });
});

gulp.task('development', [
  'build',
  'watch',
  'demoapp'
]);

gulp.task('watch', function () {
  gulp.watch([config.src.js.watch, config.src.html.watch], ['build:js']);
  gulp.watch([config.src.css.watch], ['build:css']);
  gulp.watch([config.src.js.watch, config.jsdoc.watch], ['jsdoc']);
});

gulp.task('watch:integration', ['watch']);
