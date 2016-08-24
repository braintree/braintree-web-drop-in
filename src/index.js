'use strict';

var packageVersion = require('package.version');
var Dropin = require('./dropin');
var BraintreeError = require('./lib/error');
var client = require('braintree-web/client');
var deferred = require('./lib/deferred');
var errors = require('./errors');
var assign = require('./lib/assign').assign;
var constants = require('./constants');

function create(options, callback) {
  if (typeof callback !== 'function') {
    throw new BraintreeError({
      type: errors.CALLBACK_REQUIRED.type,
      code: errors.CALLBACK_REQUIRED.code,
      message: 'create must include a callback function.'
    });
  }

  callback = deferred(callback);

  if (!options.authorization) {
    callback(new BraintreeError({
      type: errors.AUTHORIZATION_REQUIRED.type,
      code: errors.AUTHORIZATION_REQUIRED.code,
      message: 'options.authorization is required.'
    }));
    return;
  }

  client.create({
    authorization: options.authorization
  }, function (err, clientInstance) {
    if (err) {
      callback(err);
      return;
    }

    clientInstance = setAnalyticsIntegration(clientInstance);

    new Dropin(assign({}, options, {
      client: clientInstance
    })).initialize(callback);
  });
}

function setAnalyticsIntegration(clientInstance) {
  var configuration = clientInstance.getConfiguration();

  configuration.analyticsMetadata.integration = constants.INTEGRATION;
  configuration.analyticsMetadata.integrationType = constants.INTEGRATION;

  clientInstance.toJSON = function () {
    return configuration;
  };

  return clientInstance;
}

module.exports = {
  create: create,
  VERSION: packageVersion
};
