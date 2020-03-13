'use strict';

const btClient = require('braintree-web/client');
const constants = require('../constants');
const Promise = require('./promise');
const braintreeClientVersion = require('braintree-web/client').VERSION;
var VERSION = '__VERSION__';

var clientPromise;

function _millisToSeconds(millis) {
  return Math.floor(millis / 1000);
}

function setupAnalytics(authorization) {
  clientPromise = btClient.create({
    authorization: authorization
  }).then(function (clientInstance) {
    const configuration = clientInstance.getConfiguration();

    configuration.analyticsMetadata.integration = constants.INTEGRATION;
    configuration.analyticsMetadata.integrationType = constants.INTEGRATION;
    configuration.analyticsMetadata.dropinVersion = VERSION;

    clientInstance.getConfiguration = function () {
      return configuration;
    };

    return clientInstance;
  });

  return clientPromise;
}

function resetClientPromise() {
  clientPromise = null;
}

function sendAnalyticsEvent(kind) {
  const timestamp = _millisToSeconds(Date.now());

  if (!clientPromise) {
    return Promise.reject(new Error('Client not available.'));
  }

  return clientPromise.then(function (client) {
    const configuration = client.getConfiguration();
    const url = configuration.gatewayConfiguration.analytics.url;
    const data = {
      analytics: [{
        kind: constants.ANALYTICS_PREFIX + kind,
        timestamp: timestamp
      }],
      _meta: configuration.analyticsMetadata,
      braintreeLibraryVersion: braintreeClientVersion
    };

    if (configuration.authorizationType === 'TOKENIZATION_KEY') {
      data.tokenizationKey = configuration.authorization;
    } else {
      data.authorizationFingerprint = JSON.parse(window.atob(configuration.authorization)).authorizationFingerprint;
    }

    return new Promise(function (resolve) {
      client._request({
        url: url,
        method: 'post',
        data: data,
        timeout: constants.ANALYTICS_REQUEST_TIMEOUT_MS
      }, function () {
        resolve();
      });
    });
  });
}

module.exports = {
  resetClientPromise: resetClientPromise,
  sendEvent: sendAnalyticsEvent,
  setupAnalytics: setupAnalytics
};
