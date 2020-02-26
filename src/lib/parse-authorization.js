'use strict';

var authorizationTypes = require('../constants').authorizationTypes;

function _isTokenizationKey(str) {
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9_]+$/.test(str);
}

function parseEnviornment(auth) {
  if (_isTokenizationKey(auth)) {
    return {
      authType: authorizationTypes.TOKENIZATION_KEY,
      environment: auth.split('_')[0]
    };
  }

  return {
    authType: authorizationTypes.CLIENT_TOKEN,
    environment: JSON.parse(window.atob(auth)).environment
  };
}

module.exports = parseEnviornment;
