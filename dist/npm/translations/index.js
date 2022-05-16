/* eslint-disable camelcase */
'use strict';

var assign = require('../lib/assign').assign;

var fiveCharacterLocales = {
  ar_EG: require('./ar_EG'),
  cs_CZ: require('./cs_CZ'),
  da_DK: require('./da_DK'),
  de_DE: require('./de_DE'),
  el_GR: require('./el_GR'),
  en_AU: require('./en_AU'),
  en_GB: require('./en_GB'),
  en_IN: require('./en_IN'),
  en_US: require('./en_US'),
  es_ES: require('./es_ES'),
  es_XC: require('./es_XC'),
  fi_FI: require('./fi_FI'),
  fr_CA: require('./fr_CA'),
  fr_FR: require('./fr_FR'),
  fr_XC: require('./fr_XC'),
  he_IL: require('./he_IL'),
  hu_HU: require('./hu_HU'),
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
  sk_SK: require('./sk_SK'),
  sv_SE: require('./sv_SE'),
  th_TH: require('./th_TH'),
  zh_CN: require('./zh_CN'),
  zh_HK: require('./zh_HK'),
  zh_TW: require('./zh_TW'),
  zh_XC: require('./zh_XC')
};

var twoCharacterLocaleAliases = {
  ar: fiveCharacterLocales.ar_EG,
  cs: fiveCharacterLocales.cs_CZ,
  da: fiveCharacterLocales.da_DK,
  de: fiveCharacterLocales.de_DE,
  el: fiveCharacterLocales.el_GR,
  en: fiveCharacterLocales.en_US,
  es: fiveCharacterLocales.es_ES,
  fi: fiveCharacterLocales.fi_FI,
  fr: fiveCharacterLocales.fr_FR,
  id: fiveCharacterLocales.id_ID,
  it: fiveCharacterLocales.it_IT,
  hu: fiveCharacterLocales.hu_HU,
  ja: fiveCharacterLocales.ja_JP,
  ko: fiveCharacterLocales.ko_KR,
  nl: fiveCharacterLocales.nl_NL,
  no: fiveCharacterLocales.no_NO,
  pl: fiveCharacterLocales.pl_PL,
  pt: fiveCharacterLocales.pt_PT,
  ru: fiveCharacterLocales.ru_RU,
  sk: fiveCharacterLocales.sk_SK,
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
