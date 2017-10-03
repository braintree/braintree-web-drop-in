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
  var self = this;

  self.applePayConfiguration = assign({}, self.model.merchantConfiguration.applePay);

  self.model.asyncDependencyStarting();
  asyncDependencyTimeoutHandler = setTimeout(function () {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError('There was an error loading Apple Pay.')
    });
  }, ASYNC_DEPENDENCY_TIMEOUT);

  if (!window.ApplePaySession || !ApplePaySession.canMakePayments()) { // eslint-disable-line no-undef
    self._reportSetupError(asyncDependencyTimeoutHandler, 'Browser does not support Apple Pay.');
    return;
  }

  return btApplePay.create({client: this.client}).then(function (applePayInstance) { // eslint-disable-line consistent-return
    var buttonDiv = self.getElementById('apple-pay-button');

    self.applePayInstance = applePayInstance;

    buttonDiv.onclick = self._showPaymentSheet.bind(self);

    self.model.asyncDependencyReady();
    clearTimeout(asyncDependencyTimeoutHandler);
  }).catch(function (err) {
    self._reportSetupError(asyncDependencyTimeoutHandler, err);
  });
};

ApplePayView.prototype._reportSetupError = function (asyncDependencyTimeoutHandler, err) {
  this.model.asyncDependencyFailed({
    view: this.ID,
    error: new DropinError(err)
  });
  clearTimeout(asyncDependencyTimeoutHandler);
};

ApplePayView.prototype._reportError = function (err) {
  this.model.reportError(err);
};

ApplePayView.prototype._showPaymentSheet = function () {
  var self = this;
  var locale = self.model.merchantConfiguration.locale;
  var request = self.applePayInstance.createPaymentRequest(this.applePayConfiguration.paymentRequest);
  var session = new ApplePaySession(2, request); // eslint-disable-line no-undef

  // TODO: use options from merchant -
  // button style
  // locale

  if (locale) {
    // ...
  }

  session.onvalidatemerchant = function (event) {
    self.applePayInstance.performValidation({
      validationURL: event.validationURL,
      displayName: self.applePayConfiguration.displayName
    }).then(function (validationData) {
      session.completeMerchantValidation(validationData);
    }).catch(function (validationErr) {
      self._reportError(validationErr);
      session.abort();
    });
  };

  session.onpaymentauthorized = function (event) {
    // TODO: optionally get shippingContact and other properties from event
    self.applePayInstance.tokenize({
      token: event.payment.token
    }, function (tokenizeErr, payload) {
      if (tokenizeErr) {
        self._reportError(tokenizeErr);
        session.completePayment(ApplePaySession.STATUS_FAILURE); // eslint-disable-line no-undef
        return;
      }
      session.completePayment(ApplePaySession.STATUS_SUCCESS); // eslint-disable-line no-undef
      self.model.addPaymentMethod(payload);
    });
  };

  // Show the payment sheet
  session.begin();
  return false;
};

ApplePayView.prototype.updateConfiguration = function (key, value) {
  if (READ_ONLY_CONFIGURATION_OPTIONS.indexOf(key) === -1) {
    this.applePayConfiguration[key] = value;
  }
};

module.exports = ApplePayView;
