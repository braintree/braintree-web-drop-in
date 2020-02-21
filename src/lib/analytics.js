'use strict';

var atob = require('./polyfill').atob;
var constants = require('../constants');
var Promise = require('./promise');
var braintreeClientVersion = require('braintree-web/client').VERSION;

function _millisToSeconds(millis) {
  return Math.floor(millis / 1000);
}

function sendAnalyticsEvent(clientPromise, kind) {
  var timestamp = _millisToSeconds(Date.now());

  return Promise.resolve().then(function () {
    return clientPromise;
  }).then(function (client) {
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
      data.authorizationFingerprint = JSON.parse(atob(configuration.authorization)).authorizationFingerprint;
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
  sendEvent: sendAnalyticsEvent
};
