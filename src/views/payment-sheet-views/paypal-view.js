'use strict';

var assign = require('../../lib/assign').assign;
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var BasePayPalView = require('./base-paypal-view');

function PayPalView() {
  BasePayPalView.apply(this, arguments);
}

PayPalView.prototype = Object.create(BasePayPalView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

PayPalView.isEnabled = function (options) {
  if (!options.merchantConfiguration.paypal) {
    return Promise.resolve(false);
  }

  return BasePayPalView.isEnabled(assign({
    viewID: PayPalView.ID
  }, options));
};

module.exports = PayPalView;
