'use strict';
/**
 * @module braintree-web-drop-in
 * @description This is the Drop-in module.
 */

var Dropin = require('./dropin');
var client = require('braintree-web/client');
var deferred = require('./lib/deferred');
var constants = require('./constants');
var analytics = require('./lib/analytics');
var DropinError = require('./lib/dropin-error');

var VERSION = process.env.npm_package_version;

/**
 * @static
 * @function create
 * @param {object} options Creation options:
 * @param {string} options.authorization TODO: authorization
 * @param {function} callback TODO: the callback
 * @returns {void}
 */
function create(options, callback) {
  if (typeof callback !== 'function') {
    throw new DropinError('create must include a callback function.');
  }

  callback = deferred(callback);

  if (!options.authorization) {
    callback(new DropinError('options.authorization is required.'));
    return;
  }

  client.create({
    authorization: options.authorization
  }, function (err, clientInstance) {
    if (err) {
      callback(new DropinError({
        message: 'There was an error creating Drop-in.',
        braintreeWebError: err
      }));
      return;
    }

    clientInstance = setAnalyticsIntegration(clientInstance);

    if (clientInstance.getConfiguration().authorizationType === 'TOKENIZATION_KEY') {
      analytics.sendEvent(clientInstance, 'started.tokenization-key');
    } else {
      analytics.sendEvent(clientInstance, 'started.client-token');
    }

    new Dropin({
      merchantConfiguration: options,
      client: clientInstance
    })._initialize(callback);
  });
}

function setAnalyticsIntegration(clientInstance) {
  var configuration = clientInstance.getConfiguration();

  configuration.analyticsMetadata.integration = constants.INTEGRATION;
  configuration.analyticsMetadata.integrationType = constants.INTEGRATION;
  configuration.analyticsMetadata.dropinVersion = VERSION;

  clientInstance.getConfiguration = function () {
    return configuration;
  };

  return clientInstance;
}

module.exports = {
  create: create,
  /**
   * @description The current version of Drop-in, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};
