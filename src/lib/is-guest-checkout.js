'use strict';

var atob = require('./polyfill').atob;

module.exports = function (client) {
  var authorizationFingerprint;
  var configuration = client.getConfiguration();

  if (configuration.authorizationType !== 'TOKENIZATION_KEY') {
    authorizationFingerprint = JSON.parse(atob(configuration.authorization)).authorizationFingerprint;

    return !authorizationFingerprint || authorizationFingerprint.indexOf('customer_id=') === -1;
  }

  return true;
};
