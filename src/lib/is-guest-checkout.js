'use strict';

var atob = require('./polyfill').atob;
var isTokenizationKey = require('./is-tokenization-key');

module.exports = function (authorization) {
  var authorizationFingerprint;

  if (!isTokenizationKey(authorization)) {
    authorizationFingerprint = JSON.parse(atob(authorization)).authorizationFingerprint;
    return !authorizationFingerprint || authorizationFingerprint.indexOf('customer_id=') === -1;
  }
  return true;
};
