'use strict';

const { version } = require('../package.json');
const { VERSION: BT_WEB_VERSION } = require('braintree-web');

module.exports = function (str) {
  const versionRegExp = new RegExp('__VERSION__', 'g');
  const jsdocVersionRegExp = new RegExp('\\{@pkg version\\}', 'g');
  const jsdocBTVersionRegExp = new RegExp('\\{@pkg bt-web-version\\}', 'g');

  return str.replace(versionRegExp, version)
    .replace(jsdocVersionRegExp, version)
    .replace(jsdocBTVersionRegExp, BT_WEB_VERSION);
};
