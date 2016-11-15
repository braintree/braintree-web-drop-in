'use strict';

var BasePaymentMethodView = require('./base-payment-method-view');

function PayPalView() {
  BasePaymentMethodView.apply(this, arguments);
}

PayPalView.isEnabled = function (options) {
  var isGatewayEnabled = options.client.getConfiguration().gatewayConfiguration.paypalEnabled;
  var isMerchantEnabled = Boolean(options.paypal);

  return isGatewayEnabled && isMerchantEnabled;
};

PayPalView.prototype = Object.create(BasePaymentMethodView.prototype);
PayPalView.prototype.constructor = PayPalView;

PayPalView.prototype._initialize = function () {
  BasePaymentMethodView.prototype._initialize.apply(this, arguments);
  this.element.innerHTML = 'PayPalView';
};

module.exports = PayPalView;
