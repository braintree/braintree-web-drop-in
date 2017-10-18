'use strict';

var daDKKeys = Object.keys(require('../src/translations/da_DK'));
var enUSTranslations = require('../src/translations/en_US');
var enUSKeys = Object.keys(enUSTranslations);

var missingTranslations = [];

enUSKeys.forEach(function (key) {
  if (daDKKeys.indexOf(key) === -1) {
    missingTranslations.push(`"${key} = "${enUSTranslations[key]}"`);
  }
});

console.log('Missing the following translations:');
missingTranslations.forEach(function (translation) {
  console.log(translation);
});
