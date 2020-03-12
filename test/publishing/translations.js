const fs = require('fs');
const translations = require('../../src/translations');
const englishTranslation = require('../../src/translations/en_US');
const englishTranslationKeys = Object.keys(englishTranslation);

const locales = fs.readdirSync('./src/translations').filter(fileName => {
  if (fileName.indexOf('.js') === -1) {
    return false;
  }

  if (fileName === 'index.js' || fileName === 'en_US.js') {
    return false;
  }

  return true;
}).map(fileName => fileName.substring(0, fileName.length - 3)); // remove .js ending

describe('translations', () => {
  locales.forEach(key => {
    it(`${key} locale has a key for each english translation`, () => {
      const translation = require(`../../src/translations/${key}`);
      const translationKeys = Object.keys(translation);

      englishTranslationKeys.forEach(translationKey => {
        expect(typeof translation[translationKey]).toBe('string');
      });

      expect(translationKeys.length).toBe(englishTranslationKeys.length);
    });
  });

  it('each 2 character alias corresponds to a translation object', () => {
    Object.keys(translations.twoCharacterLocaleAliases).forEach(key => {
      expect(translations.twoCharacterLocaleAliases[key]).toBeInstanceOf(Object);
    });
  });

  it('fiveCharacterLocales do not clobber twoCharacterLocalAliases', () => {
    expect(Object.keys(translations.translations).length).toBe(Object.keys(translations.twoCharacterLocaleAliases).length +
      Object.keys(translations.fiveCharacterLocales).length);
  });
});
