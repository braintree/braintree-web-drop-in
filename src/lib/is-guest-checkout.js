'use strict';

var atob = require('./polyfill').atob;

function isTokenizationKey(str) {
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9_]+$/.test(str);
}

module.exports = function (authorization) {
  var authorizationFingerprint;

  if (!isTokenizationKey(authorization)) {
    authorizationFingerprint = JSON.parse(atob(authorization)).authorizationFingerprint;
    return !authorizationFingerprint || authorizationFingerprint.indexOf('customer_id=') === -1;
  }
  return true;
};
