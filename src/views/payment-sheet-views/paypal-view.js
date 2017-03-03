'use strict';

var BaseView = require('../base-view');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var btPayPal = require('braintree-web/paypal-checkout');

var DEFAULT_LOG_LEVEL = 'warn';

function PayPalView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PayPalView.prototype = Object.create(BaseView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

PayPalView.prototype.setLogLevel = function (paypal) {
  var level = this.model.merchantConfiguration.paypal.logLevel;

  paypal.setup({
    logLevel: level || DEFAULT_LOG_LEVEL
  });
};

PayPalView.prototype._initialize = function () {
  var self = this;
  // We wait to require paypal-checkout here in order to respect the
  // merchant's configured log level immediately upon instantiation.
  var paypal = require('paypal-checkout');

  this.setLogLevel(paypal);
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
        return paypalInstance.createPayment(merchantConfig).catch(reportError);
      },
      onAuthorize: function (data) {
        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },
      onError: reportError
    };

    paypal.Button.render(paypalCheckoutConfig, '[data-braintree-id="paypal-button"]').then(function () {
      self.model.asyncDependencyReady();
    });
  });

  function reportError(err) {
    self.model.reportError(err);
  }
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
