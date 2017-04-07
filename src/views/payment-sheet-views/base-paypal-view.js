'use strict';

var BaseView = require('../base-view');
var btPaypal = require('braintree-web/paypal-checkout');

var DEFAULT_LOG_LEVEL = 'warn';

function BasePayPalView() {
  BaseView.apply(this, arguments);
}

BasePayPalView.prototype = Object.create(BaseView.prototype);

BasePayPalView.prototype.setLogLevel = function (paypal) {
  var level = this.model.merchantConfiguration.paypal.logLevel;

  paypal.setup({
    logLevel: level || DEFAULT_LOG_LEVEL
  });
};

BasePayPalView.prototype._initialize = function (isCredit) {
  var self = this;
  // We wait to require paypal-checkout here in order to respect the
  // merchant's configured log level immediately upon instantiation.
  var paypal = require('paypal-checkout');

  this.setLogLevel(paypal);
  this.model.asyncDependencyStarting();

  btPaypal.create({client: this.client}, function (err, paypalInstance) {
    var paypalCheckoutConfiguration;
    var merchantConfiguration = self.model.merchantConfiguration;
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';

    if (err) {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      return;
    }

    self.paypalInstance = paypalInstance;

    paypalCheckoutConfiguration = {
      env: environment,
      payment: function () {
        return paypalInstance.createPayment(merchantConfiguration.paypal).catch(reportError);
      },
      onAuthorize: function (data) {
        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },
      onError: reportError
    };

    if (merchantConfiguration.locale) {
      paypalCheckoutConfiguration.locale = merchantConfiguration.locale;
    }

    if (isCredit) {
      console.log('TODO');
    }

    paypal.Button.render(paypalCheckoutConfiguration, '[data-braintree-id="paypal-button"]').then(function () {
      self.model.asyncDependencyReady();
    });
  });

  function reportError(err) {
    self.model.reportError(err);
  }
};

module.exports = BasePayPalView;
