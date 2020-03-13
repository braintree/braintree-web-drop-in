'use strict';

const assign = require('../../lib/assign').assign;
const Promise = require('../../lib/promise');
const paymentOptionIDs = require('../../constants').paymentOptionIDs;
const BasePayPalView = require('./base-paypal-view');

function PayPalCreditView() {
  BasePayPalView.apply(this, arguments);

  this._isPayPalCredit = true;
}

PayPalCreditView.prototype = Object.create(BasePayPalView.prototype);
PayPalCreditView.prototype.constructor = PayPalCreditView;
PayPalCreditView.ID = PayPalCreditView.prototype.ID = paymentOptionIDs.paypalCredit;

PayPalCreditView.isEnabled = function (options) {
  if (!options.merchantConfiguration.paypalCredit) {
    return Promise.resolve(false);
  }

  return BasePayPalView.isEnabled(assign({
    viewID: PayPalCreditView.ID
  }, options));
};
module.exports = PayPalCreditView;
