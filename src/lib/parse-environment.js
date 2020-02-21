'use strict';

function _isTokenizationKey(str) {
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9_]+$/.test(str);
}

function parseEnviornment(auth) {
  if (_isTokenizationKey(auth)) {
    return auth.split('_')[0];
  }

  return JSON.parse(window.atob(auth)).environment;
}

module.exports = parseEnviornment;
