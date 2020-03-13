'use strict';

const assign = require('../../lib/assign').assign;
const BaseView = require('../base-view');
const btGooglePay = require('braintree-web/google-payment');
const DropinError = require('../../lib/dropin-error');
const constants = require('../../constants');
const assets = require('@braintree/asset-loader');
const Promise = require('../../lib/promise');
const analytics = require('../../lib/analytics');

function GooglePayView() {
  BaseView.apply(this, arguments);
}

GooglePayView.prototype = Object.create(BaseView.prototype);
GooglePayView.prototype.constructor = GooglePayView;
GooglePayView.ID = GooglePayView.prototype.ID = constants.paymentOptionIDs.googlePay;

GooglePayView.prototype.initialize = function () {
  const self = this;
  var buttonOptions, googlePayVersion, merchantId;

  self.googlePayConfiguration = assign({}, self.model.merchantConfiguration.googlePay);
  googlePayVersion = self.googlePayConfiguration.googlePayVersion;
  merchantId = self.googlePayConfiguration.merchantId;

  delete self.googlePayConfiguration.googlePayVersion;
  delete self.googlePayConfiguration.merchantId;

  buttonOptions = assign({
    buttonType: 'short'
  }, self.googlePayConfiguration.button, {
    onClick: function (event) {
      event.preventDefault();

      self.preventUserAction();

      self.tokenize().then(function () {
        self.allowUserAction();
      });
    }
  });

  self.model.asyncDependencyStarting();

  return btGooglePay.create({
    authorization: this.model.authorization,
    googlePayVersion: googlePayVersion,
    googleMerchantId: merchantId,
    useDeferredClient: true
  }).then(function (googlePayInstance) {
    self.googlePayInstance = googlePayInstance;
    self.paymentsClient = createPaymentsClient(self.model.environment);
  }).then(function () {
    const buttonContainer = self.getElementById('google-pay-button');

    buttonContainer.appendChild(self.paymentsClient.createButton(buttonOptions));

    self.model.asyncDependencyReady();
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

GooglePayView.prototype.tokenize = function () {
  const self = this;
  const paymentDataRequest = self.googlePayInstance.createPaymentDataRequest(self.googlePayConfiguration);
  var rawPaymentData;

  return self.paymentsClient.loadPaymentData(paymentDataRequest).then(function (paymentData) {
    rawPaymentData = paymentData;

    return self.googlePayInstance.parseResponse(paymentData);
  }).then(function (tokenizePayload) {
    tokenizePayload.rawPaymentData = rawPaymentData;
    self.model.addPaymentMethod(tokenizePayload);
  }).catch(function (err) {
    var reportedError = err;

    if (err.statusCode === 'DEVELOPER_ERROR') {
      console.error(err); // eslint-disable-line no-console
      reportedError = 'developerError';
    } else if (err.statusCode === 'CANCELED') {
      analytics.sendEvent('googlepay.loadPaymentData.canceled');

      return;
    } else if (err.statusCode) {
      analytics.sendEvent('googlepay.loadPaymentData.failed');
    }

    self.model.reportError(reportedError);
  });
};

GooglePayView.prototype.updateConfiguration = function (key, value) {
  this.googlePayConfiguration[key] = value;
};

GooglePayView.isEnabled = function (options) {
  if (!options.merchantConfiguration.googlePay) {
    return Promise.resolve(false);
  }

  return Promise.resolve().then(function () {
    if (!(global.google && global.google.payments && global.google.payments.api && global.google.payments.api.PaymentsClient)) {
      return assets.loadScript({
        id: constants.GOOGLE_PAYMENT_SCRIPT_ID,
        src: constants.GOOGLE_PAYMENT_SOURCE
      });
    }

    return Promise.resolve();
  }).then(function () {
    const paymentsClient = createPaymentsClient(options.environment);

    return paymentsClient.isReadyToPay({
      allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
    });
  }).then(function (response) {
    return Boolean(response.result);
  });
};

function createPaymentsClient(environment) {
  return new global.google.payments.api.PaymentsClient({
    environment: environment === 'production' ? 'PRODUCTION' : 'TEST'
  });
}

module.exports = GooglePayView;
