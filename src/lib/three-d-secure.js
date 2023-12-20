'use strict';

var assign = require('./assign').assign;
var threeDSecure = require('braintree-web/three-d-secure');

var DEFAULT_ACS_WINDOW_SIZE = '03';
var PASSTHROUGH_EVENTS = [
  'customer-canceled',
  'authentication-modal-render',
  'authentication-modal-close'
];

function ThreeDSecure(client, model) {
  this._client = client;
  this._model = model;
  this._config = assign({}, model.merchantConfiguration.threeDSecure);
}

ThreeDSecure.prototype.initialize = function () {
  var self = this;
  var options = {
    client: this._client,
    version: 2
  };

  if (this._config.cardinalSDKConfig) {
    options.cardinalSDKConfig = this._config.cardinalSDKConfig;
  }

  return threeDSecure.create(options).then(function (instance) {
    self._instance = instance;

    PASSTHROUGH_EVENTS.forEach(function (eventName) {
      self._instance.on(eventName, function (event) {
        self._model._emit('3ds:' + eventName, event);
      });
    });
  });
};

ThreeDSecure.prototype.verify = function (payload, merchantProvidedData) {
  var verifyOptions = assign({
    amount: this._config.amount
  }, merchantProvidedData, {
    nonce: payload.nonce,
    bin: payload.details.bin,
    // TODO in the future, we will allow
    // merchants to pass in a custom
    // onLookupComplete hook
    onLookupComplete: function (data, next) {
      next();
    }
  });

  verifyOptions.additionalInformation = verifyOptions.additionalInformation || {};
  verifyOptions.additionalInformation.acsWindowSize = verifyOptions.additionalInformation.acsWindowSize || DEFAULT_ACS_WINDOW_SIZE;
  this._model.shouldWaitForVerifyCard = true;

  return this._instance.verifyCard(verifyOptions);
};

ThreeDSecure.prototype.updateConfiguration = function (key, value) {
  this._config[key] = value;
};

ThreeDSecure.prototype.teardown = function () {
  return this._instance.teardown();
};

module.exports = ThreeDSecure;
