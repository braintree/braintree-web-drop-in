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
PayPalView.ID = PayPalView.prototype.ID = 'paypal';

PayPalView.prototype._initialize = function () {
  BasePaymentMethodView.prototype._initialize.apply(this, arguments);
  this._createPayPalButton();
};

PayPalView.prototype._createPayPalButton = function () {
  var buttonContainer = this.getElementById('paypal-button');
  var script = document.createElement('script');
  var scriptAttrs = {
    'data-merchant': 'braintree',
    'data-button': 'checkout',
    'data-button_type': 'button',
    'data-color': 'gold'
  };

  script.src = 'https://www.paypalobjects.com/api/button.js';
  script.async = true;

  Object.keys(scriptAttrs).forEach(function (attr) {
    script.setAttribute(attr, scriptAttrs[attr]);
  });

  buttonContainer.appendChild(script);
};

module.exports = PayPalView;
