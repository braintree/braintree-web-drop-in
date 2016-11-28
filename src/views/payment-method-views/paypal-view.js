'use strict';

var BasePaymentMethodView = require('./base-payment-method-view');
var PayPal = require('braintree-web/paypal');

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
  var paypalButton;

  BasePaymentMethodView.prototype._initialize.apply(this, arguments);
  this._createPayPalButton();
  this.model.asyncDependencyStarting();

  PayPal.create({client: this.options.client}, function (err, paypalInstance) {
    if (err) {
      // TODO: handle errors in PayPal creation
      console.error(err);
      return;
    }

    this.paypalInstance = paypalInstance;

    paypalButton = this.getElementById('paypal-button');
    paypalButton.addEventListener('click', this._tokenize.bind(this));

    this.model.asyncDependencyReady();
  }.bind(this));
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

PayPalView.prototype._tokenize = function () {
  event.preventDefault();

  this.paypalInstance.tokenize(this.options.paypal, function (tokenizeErr, tokenizePayload) {
    if (tokenizeErr) {
      if (tokenizeErr.code !== 'PAYPAL_POPUP_CLOSED') {
        this.model.reportError(tokenizeErr);
        if (tokenizeErr.code === 'PAYPAL_INVALID_PAYMENT_OPTION' || tokenizeErr.code === 'PAYPAL_FLOW_OPTION_REQUIRED') {
					// TODO: handle tokenization errors
          console.error(tokenizeErr);
        }
      }
      return;
    }

    this.model.addPaymentMethod(tokenizePayload);
  }.bind(this));
};

module.exports = PayPalView;
