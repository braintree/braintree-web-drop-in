'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var BasePayPalView = require('./base-paypal-view');

function PayPalView() {
  BasePayPalView.apply(this, arguments);
}

PayPalView.prototype = Object.create(BasePayPalView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

PayPalView.isEnabled = function (options) {
  return BasePayPalView.isEnabled(options).then(function (enabled) {
    return enabled && Boolean(options.merchantConfiguration.paypal);
  });
};

module.exports = PayPalView;
