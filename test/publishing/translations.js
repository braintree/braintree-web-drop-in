const fs = require('fs');
const translations = require('../../src/translations');
const englishTranslation = require('../../src/translations/en_US');
const englishTranslationKeys = Object.keys(englishTranslation);

const locales = fs.readdirSync('./src/translations').filter(fileName => {
  if (fileName.indexOf('.js') === -1) {
    return false;
  }

  return !(fileName === 'index.js' || fileName === 'en_US.js');
}).map(fileName => fileName.substring(0, fileName.length - 3)); // remove .js ending

describe('translations', () => {
  it.each(locales)('%s locale has a key for each english translation', key => {
    const translation = require(`../../src/translations/${key}`);
    const translationKeys = Object.keys(translation);

    englishTranslationKeys.forEach(translationKey => {
      expect(typeof translation[translationKey]).toBe('string');
    });

    expect(translationKeys.length).toBe(englishTranslationKeys.length);
  });

  it.each(Object.keys(translations.twoCharacterLocaleAliases))('alias %s corresponds to a translation object', key => {
    expect(translations.twoCharacterLocaleAliases[key]).toBeInstanceOf(Object);
  });

  it('fiveCharacterLocales do not clobber twoCharacterLocalAliases', () => {
    expect(Object.keys(translations.translations).length).toBe(Object.keys(translations.twoCharacterLocaleAliases).length +
      Object.keys(translations.fiveCharacterLocales).length);
  });
});
