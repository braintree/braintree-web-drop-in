'use strict';

/* globals __dirname */

var browserify = require('browserify');
var envify = require('gulp-envify');
var brfs = require('gulp-brfs');
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
var mkdirp = require('mkdirp');
var VERSION = require('./package.json').version;

var DIST_PATH = 'dist/web/dropin/' + VERSION;
var NPM_PATH = 'dist/npm';

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
    .bundle()
    .pipe(source(config.src.js.output))
    .pipe(replace('@DOT_MIN', ''))
    .pipe(streamify(size()))
    .pipe(gulp.dest(config.dist.js))
});

gulp.task('build:js:min', function () {
  return browserify(config.src.js.main, {standalone: 'braintree.dropin'})
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

gulp.task('build:npm:statics', function () {
  return gulp.src([
    './.gitignore',
    './CHANGELOG.md',
    './LICENSE',
    './README.md'
  ]).pipe(gulp.dest(NPM_PATH));
});

gulp.task('build:npm:package.json', function (done) {
  var pkg = Object.assign({}, require('./package.json'));

  delete pkg.browserify;
  pkg.main = 'index.js';

  mkdirp.sync(NPM_PATH);

  fs.writeFile(NPM_PATH + '/' + 'package.json', JSON.stringify(pkg, null, 2), done);
});

gulp.task('build:npm:src', function () {
  return gulp.src([
    'src/**/*.js'
  ])
  .pipe(replace('@DOT_MIN', ''))
  .pipe(envify(process.env))
  .pipe(brfs())
  .pipe(gulp.dest(NPM_PATH));
});

gulp.task('build:npm', [
  'build:npm:statics',
  'build:npm:package.json',
  'build:npm:src'
]);

gulp.task('clean', function () {
  return del(['./dist']);
});

gulp.task('build', function (done) {
  process.env.npm_package_version = VERSION;

  runSequence(
  'clean',
  ['build:js', 'build:css', 'build:jsdoc', 'build:npm'],
  'build:link-latest',
  done);
});

function jsdoc(options, done) {
  var args = ['jsdoc', 'src'];
  var command = 'bash';
  var commandOption = '-c';

  if (process.platform.indexOf('win')>=0) {
    command = 'cmd';
    commandOption = '/c';
  }

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

  spawn(command, [commandOption, args.join(' ')], {
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
  process.env.npm_package_version = VERSION;

  gulp.watch([config.src.js.watch, config.src.html.watch], ['build:js']);
  gulp.watch([config.src.css.watch], ['build:css']);
  gulp.watch([config.src.js.watch, config.jsdoc.watch], ['build:jsdoc']);
});

gulp.task('watch:integration', ['watch']);
