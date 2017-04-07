'use strict';

var BaseView = require('../base-view');
var assign = require('../../lib/assign').assign;
var btPaypal = require('braintree-web/paypal-checkout');

var DEFAULT_LOG_LEVEL = 'warn';

function BasePayPalView() {
  BaseView.apply(this, arguments);
}

BasePayPalView.prototype = Object.create(BaseView.prototype);

BasePayPalView.prototype.setLogLevel = function (paypal) {
  var level = this.paypalConfiguration.logLevel;

  paypal.setup({
    logLevel: level || DEFAULT_LOG_LEVEL
  });
};

BasePayPalView.prototype._initialize = function (isCredit) {
  var self = this;
  // We wait to require paypal-checkout here in order to respect the
  // merchant's configured log level immediately upon instantiation.
  var paypal = require('paypal-checkout');
  var paypalConfiguration = isCredit ? this.model.merchantConfiguration.paypalCredit : this.model.merchantConfiguration.paypal;

  this.paypalConfiguration = assign({}, paypalConfiguration);

  this.setLogLevel(paypal);
  this.model.asyncDependencyStarting();

  btPaypal.create({client: this.client}, function (err, paypalInstance) {
    var checkoutJSConfiguration;
    var buttonSelector = '[data-braintree-id="paypal-button"]';
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';
    var locale = self.model.merchantConfiguration.locale;

    if (err) {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      return;
    }

    self.paypalInstance = paypalInstance;

    self.paypalConfiguration.offerCredit = Boolean(isCredit);
    checkoutJSConfiguration = {
      env: environment,
      payment: function () {
        return paypalInstance.createPayment(self.paypalConfiguration).catch(reportError);
      },
      onAuthorize: function (data) {
        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },
      onError: reportError
    };

    if (locale) {
      checkoutJSConfiguration.locale = locale;
    }

    if (isCredit) {
      buttonSelector = '[data-braintree-id="paypal-credit-button"]';
      checkoutJSConfiguration.style = {label: 'credit'};
    }

    paypal.Button.render(checkoutJSConfiguration, buttonSelector).then(function () {
      self.model.asyncDependencyReady();
    });
  });

  function reportError(err) {
    self.model.reportError(err);
  }
};

module.exports = BasePayPalView;
