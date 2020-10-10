'use strict';

const { version } = require('../package.json');
const { VERSION: BT_WEB_VERSION } = require('braintree-web');

module.exports = function (str) {
  const versionRegExp = '__VERSION__';
  const jsdocVersionRegExp = '\\{@pkg version\\}';
  const jsdocBTVersionRegExp = '\\{@pkg bt-web-version\\}';

  return str.replace(new RegExp(versionRegExp, 'g'), version)
    .replace(new RegExp(jsdocVersionRegExp, 'g'), version)
    .replace(new RegExp(jsdocBTVersionRegExp, 'g'), BT_WEB_VERSION);
};
