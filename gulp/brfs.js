'use strict';

var brfs = require('brfs');
var through = require('through2');
var Vinyl = require('vinyl');

module.exports = function () {
  return through.obj(function (file, enc, callback) {
    var inlined = brfs(file.path);
    var vinylInlined;

    if (file.isBuffer()) {
      inlined.end(file.contents);

      vinylInlined = new Vinyl({
        contents: inlined,
        cwd: file.cwd,
        base: file.base,
        path: file.path
      });

      this.push(vinylInlined); // eslint-disable-line no-invalid-this

      return callback();
    }

    if (file.isStream()) {
      file.contents = file.contents.pipe(inlined);
      this.push(file); // eslint-disable-line no-invalid-this

      return callback();
    }

    return callback();
  });
};
