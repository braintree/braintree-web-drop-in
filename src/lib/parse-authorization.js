'use strict';

var authorizationTypes = require('../constants').authorizationTypes;

function _isTokenizationKey(str) {
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9_]+$/.test(str);
}

function parseEnvironment(auth) {
  var parsedClientToken;

  if (_isTokenizationKey(auth)) {
    return {
      authType: authorizationTypes.TOKENIZATION_KEY,
      environment: auth.split('_')[0],
      hasCustomer: false
    };
  }

  parsedClientToken = JSON.parse(window.atob(auth));

  return {
    authType: authorizationTypes.CLIENT_TOKEN,
    environment: parsedClientToken.environment,
    hasCustomer: Boolean(parsedClientToken.hasCustomer)
  };
}

module.exports = parseEnvironment;
