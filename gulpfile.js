'use strict';

/* globals __dirname */

var browserify = require('browserify');
var brfs = require('./gulp/brfs');
var c = require('ansi-colors');
var cleanCSS = require('gulp-clean-css');
var del = require('del');
var fs = require('fs');
var gulp = require('gulp');
var log = require('fancy-log');
var path = require('path');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var less = require('gulp-less');
var size = require('gulp-size');
var source = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var uglify = require('gulp-uglify');
var spawn = require('child_process').spawn;
var connect = require('connect');
var serveStatic = require('serve-static');
var mkdirp = require('mkdirp');
var autoprefixer = require('gulp-autoprefixer');

var VERSION = require('./package.json').version.toString();

var DIST_PATH = 'dist/web/dropin/' + VERSION;
var GH_PAGES_PATH = 'dist/gh-pages';
var NPM_PATH = 'dist/npm';

var series = gulp.series;
var parallel = gulp.parallel;
var src = gulp.src;
var dest = gulp.dest;
var watch = gulp.watch;
var task = gulp.task;

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
      main: './src/less/main.less',
      watch: 'src/less/**/*.less',
      output: 'dropin.css',
      min: 'dropin.min.css'
    },
    html: {
      watch: 'src/html/**/*.html'
    },
    demoApp: './test/app/*'
  },
  jsdoc: {
    watch: 'jsdoc/*',
    readme: 'jsdoc/Home.md'
  },
  dist: {
    js: DIST_PATH + '/js',
    css: DIST_PATH + '/css',
    jsdoc: GH_PAGES_PATH + '/docs/'
  },
  server: {
    assetsPath: 'dist',
    ghPagesPath: GH_PAGES_PATH,
    port: process.env.PORT || 4567
  }
};

function jsNotMin() {
  return browserify(config.src.js.main, {standalone: 'braintree.dropin'})
    .bundle()
    .pipe(source(config.src.js.output))
    .pipe(replace('@DOT_MIN', ''))
    .pipe(streamify(size()))
    .pipe(dest(config.dist.js));
}

function jsMin() {
  return browserify(config.src.js.main, {standalone: 'braintree.dropin'})
    .bundle()
    .pipe(source(config.src.js.output))
    .pipe(replace('@DOT_MIN', '.min'))
    .pipe(streamify(uglify()))
    .pipe(streamify(size()))
    .pipe(rename(config.src.js.min))
    .pipe(dest(config.dist.js));
}

jsNotMin.displayName = 'build:js:notmin';
jsMin.displayName = 'build:js:min';

function buildCss() {
  var lessOptions = {};

  return src(config.src.css.main)
    .pipe(less(lessOptions))
    .pipe(autoprefixer())
    .pipe(rename(config.src.css.output))
    .pipe(dest(config.dist.css))
    .pipe(cleanCSS())
    .pipe(rename(config.src.css.min))
    .pipe(dest(config.dist.css));
}

buildCss.displayName = 'build:css';

function linkLatest(done) {
  fs.symlink(VERSION, 'dist/web/dropin/dev', done);
}

linkLatest.displayName = 'build:link-latest';

function npmStats() {
  return src([
    './CHANGELOG.md',
    './LICENSE',
    './README.md'
  ]).pipe(dest(NPM_PATH));
}

function npmCss() {
  return src(path.join(config.dist.css, 'dropin.css'))
    .pipe(dest(NPM_PATH));
}

function npmPackage(done) {
  var pkg = Object.assign({}, require('./package.json'));

  delete pkg.browserify;
  delete pkg.private;
  pkg.main = 'index.js';
  pkg.browser = './dist/browser/dropin.js';

  mkdirp.sync(NPM_PATH);

  fs.writeFile(path.join(NPM_PATH, 'package.json'), JSON.stringify(pkg, null, 2), done);
}

function npmSrc() {
  return src('src/**/*.js')
    .pipe(replace('@DOT_MIN', ''))
    .pipe(replace('__VERSION__', VERSION))
    .pipe(brfs())
    .pipe(dest(NPM_PATH));
}

function npmBrowser() {
  var browserPath = NPM_PATH + '/dist/browser/';

  mkdirp.sync(browserPath);

  return src(path.join(
    'dist/web/dropin', VERSION, 'js/dropin.js'
  ))
    .pipe(dest(browserPath));
}

npmStats.displayName = 'build:npm:statics';
npmCss.displayName = 'build:npm:css';
npmPackage.displayName = 'build:npm:package.json';
npmSrc.displayName = 'build:npm:src';
npmBrowser.displayName = 'build:npm:browser';

function clean() {
  return del(['./dist']);
}

function build() {
  return series(
    clean,
    parallel(
      jsNotMin, jsMin, buildCss,
      ghPagesBuild()
    ),
    parallel(npmCss, npmStats, npmPackage, npmSrc, npmBrowser),
    linkLatest
  );
}

function _replaceVersionInFile(filename) {
  var updatedFile = fs.readFileSync(filename, 'utf-8').replace(/@VERSION/g, VERSION);

  fs.writeFileSync(filename, updatedFile, 'utf-8');
}

function jsdoc(options, done) {
  var args = ['jsdoc', 'src'];
  var command = 'bash';
  var commandOption = '-c';
  var platform = process.platform;

  if (platform !== 'darwin' && platform.indexOf('win') >= 0) {
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
      _replaceVersionInFile(path.join('dist/gh-pages/docs', VERSION, 'index.html'));

      done();
    } else {
      done(code);
    }
  });
}

function ghPagesBuild() {
  return series(demoAppApple, demoApp, generateJsdoc, parallel(jsdocStatistics, linkJsdoc));
}

function generateJsdoc(done) {
  jsdoc({
    configure: 'jsdoc/conf.json',
    destination: config.dist.jsdoc + VERSION,
    recurse: true,
    readme: config.jsdoc.readme,
    template: 'node_modules/jsdoc-template'
  }, done);
}

function jsdocStatistics() {
  return src('jsdoc/index.html').pipe(dest(config.dist.jsdoc));
}

function linkJsdoc(done) {
  var link = config.dist.jsdoc + 'current';

  if (fs.existsSync(link)) {
    del.sync(link);
  }

  fs.symlink(VERSION, config.dist.jsdoc + 'current', done);
}

generateJsdoc.displayName = 'jsdoc:generate';
jsdocStatistics.displayName = 'jsdoc:statics';
linkJsdoc.displayName = 'jsdoc:link-current';

function demoAppApple() {
  var wellknown = GH_PAGES_PATH + '/.well-known/';

  mkdirp.sync(wellknown);

  return src([
    './test/app/.well-known/*'
  ]).pipe(dest(wellknown));
}

function demoApp() {
  return src([
    config.src.demoApp
  ]).pipe(dest(GH_PAGES_PATH));
}

demoAppApple.displayName = 'build:demoapp:apple-domain-association';
demoApp.displayName = 'build:demoapp';

function ghPagesServer() {
  connect()
    .use(serveStatic(path.join(__dirname, config.server.ghPagesPath)))
    .use(serveStatic(path.join(__dirname, config.server.assetsPath)))
    .listen(config.server.port, function () {
      log(c.magenta('Demo app and JSDocs'), 'started at', c.yellow('http://localhost:' + config.server.port));
    });
}

ghPagesServer.displayName = 'gh-pages';

function triggerWatchers() {
  watch([config.src.js.watch, config.src.html.watch], parallel(jsNotMin, jsMin));
  watch([config.src.css.watch], task(buildCss));
  watch([config.src.js.watch, config.jsdoc.watch], task(ghPagesServer));
  watch([config.src.demoApp], task(demoApp));
}

triggerWatchers.displayName = 'watch';

exports.build = build();
exports.ghPages = ghPagesBuild();
exports.ghPages.displayName = 'build:gh-pages';
exports.development = parallel(build(), triggerWatchers, ghPagesServer);
