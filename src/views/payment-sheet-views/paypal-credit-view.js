'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var BasePayPalView = require('./base-paypal-view');

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

  // TODO currently, the PayPal SDK does not support the vault flow
  // for PayPal Credit. Remove this check when the PayPal SDK supports it.
  if (options.merchantConfiguration.paypalCredit.flow === 'vault') {
    return Promise.resolve(false);
  }

  // TODO currently, the PayPal SDK does not support having
  // 2 PayPal buttons on the page with different flows (vault or checkout)
  // For this reason, we're temporarilly disabling the PP Credit
  // setup if the PayPal view is created with the vault flow,
  // since the credit button cannot be used with the vault flow
  // at this time. Remove this check when the PayPal SDK supports it.
  if (options.merchantConfiguration.paypal && options.merchantConfiguration.paypal.flow === 'vault') {
    return Promise.resolve(false);
  }

  return BasePayPalView.isEnabled(Object.assign({
    viewID: PayPalCreditView.ID
  }, options));
};

module.exports = PayPalCreditView;
