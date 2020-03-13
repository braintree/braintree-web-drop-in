'use strict';

const assign = require('../../lib/assign').assign;
const BaseView = require('../base-view');
const btApplePay = require('braintree-web/apple-pay');
const DropinError = require('../../lib/dropin-error');
const isHTTPS = require('../../lib/is-https');
const Promise = require('../../lib/promise');
const paymentOptionIDs = require('../../constants').paymentOptionIDs;

const DEFAULT_APPLE_PAY_SESSION_VERSION = 2;

function ApplePayView() {
  BaseView.apply(this, arguments);
}

ApplePayView.prototype = Object.create(BaseView.prototype);
ApplePayView.prototype.constructor = ApplePayView;
ApplePayView.ID = ApplePayView.prototype.ID = paymentOptionIDs.applePay;

ApplePayView.prototype.initialize = function () {
  const self = this;
  const isProduction = this.model.environment === 'production';

  self.applePayConfiguration = assign({}, self.model.merchantConfiguration.applePay);
  self.applePaySessionVersion = self.applePayConfiguration.applePaySessionVersion || DEFAULT_APPLE_PAY_SESSION_VERSION;

  delete self.applePayConfiguration.applePaySessionVersion;

  self.model.asyncDependencyStarting();

  return btApplePay.create({
    authorization: this.model.authorization,
    useDeferredClient: true
  }).then(function (applePayInstance) {
    const buttonDiv = self.getElementById('apple-pay-button');

    self.applePayInstance = applePayInstance;

    self.model.on('changeActivePaymentView', function (paymentViewID) {
      if (paymentViewID !== self.ID) {
        return;
      }

      global.ApplePaySession.canMakePaymentsWithActiveCard(self.applePayInstance.merchantIdentifier).then(function (canMakePayments) {
        if (!canMakePayments) {
          if (isProduction) {
            self.model.reportError('applePayActiveCardError');
          } else {
            console.error('Could not find an active card. This may be because you\'re using a production iCloud account in a sandbox Apple Pay Session. Log in to a Sandbox iCloud account to test this flow, and add a card to your wallet. For additional assistance, visit  https://help.braintreepayments.com'); // eslint-disable-line no-console
            self.model.reportError('developerError');
          }
        }
      });
    });

    buttonDiv.onclick = self._showPaymentSheet.bind(self);
    buttonDiv.style['-apple-pay-button-style'] = self.model.merchantConfiguration.applePay.buttonStyle || 'black';

    self.model.asyncDependencyReady();
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

ApplePayView.prototype._showPaymentSheet = function () {
  const self = this;
  const request = self.applePayInstance.createPaymentRequest(this.applePayConfiguration.paymentRequest);
  const session = new global.ApplePaySession(self.applePaySessionVersion, request);

  session.onvalidatemerchant = function (event) {
    self.applePayInstance.performValidation({
      validationURL: event.validationURL,
      displayName: self.applePayConfiguration.displayName
    }).then(function (validationData) {
      session.completeMerchantValidation(validationData);
    }).catch(function (validationErr) {
      self.model.reportError(validationErr);
      session.abort();
    });
  };

  session.onpaymentauthorized = function (event) {
    self.applePayInstance.tokenize({
      token: event.payment.token
    }).then(function (payload) {
      session.completePayment(global.ApplePaySession.STATUS_SUCCESS);
      payload.rawPaymentData = event.payment;
      self.model.addPaymentMethod(payload);
    }).catch(function (tokenizeErr) {
      self.model.reportError(tokenizeErr);
      session.completePayment(global.ApplePaySession.STATUS_FAILURE);
    });
  };

  session.begin();

  return false;
};

ApplePayView.prototype.updateConfiguration = function (key, value) {
  this.applePayConfiguration[key] = value;
};

ApplePayView.isEnabled = function (options) {
  const applePayEnabled = Boolean(options.merchantConfiguration.applePay);
  var applePaySessionVersion = options.merchantConfiguration.applePay && options.merchantConfiguration.applePay.applePaySessionVersion;
  var applePayBrowserSupported;

  applePaySessionVersion = applePaySessionVersion || DEFAULT_APPLE_PAY_SESSION_VERSION;

  if (!applePayEnabled) {
    return Promise.resolve(false);
  }

  applePayBrowserSupported = global.ApplePaySession && isHTTPS.isHTTPS();

  if (!applePayBrowserSupported) {
    return Promise.resolve(false);
  }

  if (!global.ApplePaySession.supportsVersion(applePaySessionVersion)) {
    return Promise.resolve(false);
  }

  return Promise.resolve(Boolean(global.ApplePaySession.canMakePayments()));
};

module.exports = ApplePayView;
