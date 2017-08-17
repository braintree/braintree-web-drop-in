'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var BasePayPalView = require('./base-paypal-view');

function PayPalView() {
  BasePayPalView.apply(this, arguments);
}

PayPalView.prototype = Object.create(BasePayPalView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

module.exports = PayPalView;
