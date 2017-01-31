'use strict';
/**
 * @module braintree-web-drop-in
 * @description This is the Drop-in module.
 */

var packageVersion = require('package.version');
var Dropin = require('./dropin');
var client = require('braintree-web/client');
var deferred = require('./lib/deferred');
var constants = require('./constants');
var analytics = require('./lib/analytics');

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
    throw new Error('create must include a callback function.');
  }

  callback = deferred(callback);

  if (!options.authorization) {
    callback(new Error('options.authorization is required.'));
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
  VERSION: packageVersion
};
