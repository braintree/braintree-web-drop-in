'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btApplePay = require('braintree-web/apple-pay');
var DropinError = require('../../lib/dropin-error');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;

var ASYNC_DEPENDENCY_TIMEOUT = 30000;
var READ_ONLY_CONFIGURATION_OPTIONS = ['locale'];

function ApplePayView() {
  BaseView.apply(this, arguments);
}

ApplePayView.prototype = Object.create(BaseView.prototype);
ApplePayView.prototype.constructor = ApplePayView;
ApplePayView.ID = ApplePayView.prototype.ID = paymentOptionIDs.applePay;

ApplePayView.prototype.initialize = function () {
  var asyncDependencyTimeoutHandler;
  var setupComplete = false;
  var self = this;

  this.applePayConfiguration = assign({}, this.model.merchantConfiguration['applePay']);

  this.model.asyncDependencyStarting();
  asyncDependencyTimeoutHandler = setTimeout(function () {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError('There was an error loading Apple Pay.')
    });
  }, ASYNC_DEPENDENCY_TIMEOUT);

  if (!window.ApplePaySession || !ApplePaySession.canMakePayments()) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError('Browser or device does not support Apple Pay.')
    });
    return;
  }

  btApplePay.create({client: this.client}, function (err, applePayInstance) {
    var buttonSelector = '[data-braintree-id="apple-pay-button"]';
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox'; // TODO: remove if not needed
    var locale = self.model.merchantConfiguration.locale;

    if (err) {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      return;
    }

    self.applePayInstance = applePayInstance;

    var showPaymentSheet = function () {
      var request = applePayInstance.createPaymentRequest({
        total: {
          label: 'My Store', // TODO: use options passed in applePayConfiguration
          amount: '19.99'
        }
      });
      var session = new ApplePaySession(2, request);

      // TODO: use options from merchant -
      // button style
      // locale

      if (locale) {
        // ...
      }

      session.onvalidatemerchant = function (event) {
        applePayInstance.performValidation({
          validationURL: event.validationURL,
          displayName: 'My Store' // TODO: use merchant's display name
        }, function (validationErr, merchantSession) {
          if (validationErr) {
            reportError(validationErr);
            session.abort();
            return;
          }
          session.completeMerchantValidation(merchantSession);
        });
      };

      session.onpaymentauthorized = function (event) {
        // TODO: optionally get shippingContact and other properties from event
        applePayInstance.tokenize({
          token: event.payment.token
        }, function (tokenizeErr, payload) {
          if (tokenizeErr) {
            reportError(tokenizeErr);
            session.completePayment(ApplePaySession.STATUS_FAILURE);
            return;
          }
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
          self.model.addPaymentMethod(payload);
        });
      };

      // Show the payment sheet
      session.begin();
      return false;
    };

    var buttonDiv = document.querySelector(buttonSelector);
    var buttonElement = document.createElement('div');
    buttonElement.className = 'apple-pay-button apple-pay-button-black';
    buttonElement.onclick = showPaymentSheet;
    buttonDiv.appendChild(buttonElement);

    self.model.asyncDependencyReady();
    setupComplete = true;
    clearTimeout(asyncDependencyTimeoutHandler);
  }.bind(this));

  function reportError(err) {
    if (setupComplete) {
      self.model.reportError(err);
    } else {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: new DropinError(err)
      });
      clearTimeout(asyncDependencyTimeoutHandler);
    }
  }
};

ApplePayView.prototype.updateConfiguration = function (key, value) {
  if (READ_ONLY_CONFIGURATION_OPTIONS.indexOf(key) === -1) {
    this.applePayConfiguration[key] = value;
  }
};

module.exports = ApplePayView;
