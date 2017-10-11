'use strict';

var fs = require('fs');
var keyToReplace = process.argv[2];
var replacementKey = process.argv[3];
var filesToIgnore = [
  'en_US.js',
  'index.js'
];

fs.readdirSync('./src/translations').forEach(function (filename) {
  var path = `./src/translations/${filename}`;

  if (filesToIgnore.indexOf(filename) !== -1) {
    return;
  }

  fs.readFile(path, 'utf8', function (err, data) {
    if (err) { console.log(err); }
    var result = data.replace(RegExp(keyToReplace, 'g'), replacementKey);

    fs.writeFile(path, result, 'utf8', function (err) {
      if (err) { console.log(err); }
    });
  });
});
