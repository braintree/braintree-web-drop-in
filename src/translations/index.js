/* eslint-disable camelcase */
'use strict';

var assign = require('../lib/assign').assign;

var fiveCharacterLocales = {
  da_DK: require('./da_DK'),
  de_DE: require('./de_DE'),
  en_US: require('./en_US'),
  en_AU: require('./en_AU'),
  en_GB: require('./en_GB'),
  es_ES: require('./es_ES'),
  fr_CA: require('./fr_CA'),
  fr_FR: require('./fr_FR'),
  id_ID: require('./id_ID'),
  it_IT: require('./it_IT'),
  ja_JP: require('./ja_JP'),
  ko_KR: require('./ko_KR'),
  nl_NL: require('./nl_NL'),
  no_NO: require('./no_NO'),
  pl_PL: require('./pl_PL'),
  pt_BR: require('./pt_BR'),
  pt_PT: require('./pt_PT'),
  ru_RU: require('./ru_RU'),
  sv_SE: require('./sv_SE'),
  th_TH: require('./th_TH'),
  zh_CN: require('./zh_CN'),
  zh_HK: require('./zh_HK'),
  zh_TW: require('./zh_TW')
};

var twoCharacterLocaleAliases = {
  da: fiveCharacterLocales.da_DK,
  de: fiveCharacterLocales.de_DE,
  en: fiveCharacterLocales.en_US,
  es: fiveCharacterLocales.es_ES,
  fr: fiveCharacterLocales.fr_FR,
  id: fiveCharacterLocales.id_ID,
  it: fiveCharacterLocales.it_IT,
  ja: fiveCharacterLocales.ja_JP,
  ko: fiveCharacterLocales.ko_KR,
  nl: fiveCharacterLocales.nl_NL,
  no: fiveCharacterLocales.no_NO,
  pl: fiveCharacterLocales.pl_PL,
  pt: fiveCharacterLocales.pt_PT,
  ru: fiveCharacterLocales.ru_RU,
  sv: fiveCharacterLocales.sv_SE,
  th: fiveCharacterLocales.th_TH,
  zh: fiveCharacterLocales.zh_CN
};

module.exports = {
  twoCharacterLocaleAliases: twoCharacterLocaleAliases,
  fiveCharacterLocales: fiveCharacterLocales,
  translations: assign({}, twoCharacterLocaleAliases, fiveCharacterLocales)
};
/* eslint-enable camelcase */
