'use strict';

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

ThreeDSecure.prototype.verify = function (payload) {
  var self = this;

  return this._instance.verifyCard({
    nonce: payload.nonce,
    bin: payload.details.bin,
    amount: self._config.amount,
    onLookupComplete: function (data, next) {
      next();
    }
  });
};

ThreeDSecure.prototype.updateConfiguration = function (key, value) {
  this._config[key] = value;
};

ThreeDSecure.prototype.teardown = function () {
  return this._instance.teardown();
};

module.exports = ThreeDSecure;
