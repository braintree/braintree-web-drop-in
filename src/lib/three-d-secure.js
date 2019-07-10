'use strict';

var assign = require('./assign').assign;
var threeDSecure = require('braintree-web/three-d-secure');

function ThreeDSecure(client, merchantConfiguration) {
  this._client = client;
  this._config = merchantConfiguration;
}

ThreeDSecure.prototype.initialize = function () {
  var self = this;

  return threeDSecure.create({
    client: this._client,
    version: 2
  }).then(function (instance) {
    self._instance = instance;
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

  return this._instance.verifyCard(verifyOptions);
};

ThreeDSecure.prototype.updateConfiguration = function (key, value) {
  this._config[key] = value;
};

ThreeDSecure.prototype.teardown = function () {
  return this._instance.teardown();
};

module.exports = ThreeDSecure;
