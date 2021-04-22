'use strict';

var btClient = require('braintree-web/client');
var constants = require('../constants');
var braintreeClientVersion = require('braintree-web/client').VERSION;
var VERSION = '__VERSION__';

var clientPromise;

function _millisToSeconds(millis) {
  return Math.floor(millis / 1000);
}

function setupAnalytics(authorization) {
  clientPromise = btClient.create({
    authorization: authorization
  }).then(function (clientInstance) {
    var configuration = clientInstance.getConfiguration();

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
  var timestamp = _millisToSeconds(Date.now());

  if (!clientPromise) {
    return Promise.reject(new Error('Client not available.'));
  }

  return clientPromise.then(function (client) {
    var configuration = client.getConfiguration();
    var url = configuration.gatewayConfiguration.analytics.url;
    var data = {
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
