'use strict';

var fs = require('fs');
var expect = require('chai').expect;

var englishTranslation = require('../../src/translations/en_US');
var englishTranslationKeys = Object.keys(englishTranslation);

var locales = fs.readdirSync('./src/translations').filter(function (fileName) {
  if (fileName.indexOf('.js') === -1) {
    return false;
  }

  if (fileName === 'index.js' || fileName === 'en_US.js') {
    return false;
  }

  return true;
}).map(function (fileName) {
  return fileName.substring(0, fileName.length - 3); // remove .js ending
});

describe('translations', function () {
  locales.forEach(function (key) {
    xit(key + ' locale has a key for each english translation', function () {
      var translation = require('../../src/translations/' + key);
      var translationKeys = Object.keys(translation);

      expect(translationKeys.length).to.equal(englishTranslationKeys.length);

      englishTranslationKeys.forEach(function (translationkey) {
        expect(translation[translationKey]).be.a('string');
      });
    });
  });
});
