'use strict';

var BaseView = require('../base-view');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var btPaypal = require('braintree-web/paypal-checkout');

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

  btPaypal.create({client: this.client}, function (err, paypalInstance) {
    var paypalCheckoutConfig;
    var merchantConfig = self.model.merchantConfiguration.paypal;
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';

    if (err) {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      return;
    }

    self.paypalInstance = paypalInstance;

    paypalCheckoutConfig = {
      env: environment,
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

module.exports = PayPalView;
