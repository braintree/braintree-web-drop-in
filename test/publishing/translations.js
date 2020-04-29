
var fs = require('fs');
var expect = require('chai').expect;

var translations = require('../../src/translations');
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
    it(key + ' locale has a key for each english translation', function () {
      var translation = require('../../src/translations/' + key);
      var translationKeys = Object.keys(translation);

      englishTranslationKeys.forEach(function (translationKey) {
        expect(translation[translationKey]).be.a('string');
      });

      expect(translationKeys.length).toBe(englishTranslationKeys.length);
    });
  });

  it('each 2 character alias corresponds to a translation object', function () {
    Object.keys(translations.twoCharacterLocaleAliases).forEach(function (key) {
      expect(translations.twoCharacterLocaleAliases[key]).to.be.an('object');
    });
  });

  it('fiveCharacterLocales do not clobber twoCharacterLocalAliases', function () {
    expect(Object.keys(translations.translations).length).to.eq(
      Object.keys(translations.twoCharacterLocaleAliases).length +
      Object.keys(translations.fiveCharacterLocales).length
    );
  });
});
