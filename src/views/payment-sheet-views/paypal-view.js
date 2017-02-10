'use strict';

var BaseView = require('../base-view');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var btPayPal = require('braintree-web/paypal-checkout');
var paypal = require('paypal-checkout');

function PayPalView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PayPalView.prototype = Object.create(BaseView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

PayPalView.prototype._initialize = function () {
  var self = this;

  this.model.asyncDependencyStarting();

  btPayPal.create({client: this.client}, function (err, paypalInstance) {
    var paypalCheckoutConfig;
    var merchantConfig = self.model.merchantConfiguration.paypal;
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';

    if (err) {
      console.error(err);
      return;
    }
    self.paypalInstance = paypalInstance;

    paypalCheckoutConfig = {
      env: environment,
      locale: merchantConfig.locale,
      payment: function () {
        return paypalInstance.createPayment(merchantConfig);
      },
      onAuthorize: function (data) {
        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          self.model.addPaymentMethod(tokenizePayload);
        });
      },
      onError: function (paypalCheckoutErr) {
        self.model.reportError(paypalCheckoutErr);
      }
    };

    paypal.Button.render(paypalCheckoutConfig, '[data-braintree-id="paypal-button"]').then(function () {
      self.model.asyncDependencyReady();
    });
  });
};

PayPalView.prototype._createPayPalButton = function () {
  var buttonContainer = this.getElementById('paypal-button');
  var script = document.createElement('script');
  var scriptAttrs = {
    'data-merchant': 'braintree',
    'data-button': 'checkout',
    'data-button_type': 'button',
    'data-color': 'gold',
    'data-size': 'small'
  };

  script.src = 'https://www.paypalobjects.com/api/button.js';
  script.async = true;

  Object.keys(scriptAttrs).forEach(function (attr) {
    script.setAttribute(attr, scriptAttrs[attr]);
  });

  buttonContainer.appendChild(script);
};

module.exports = PayPalView;
