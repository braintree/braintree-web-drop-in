'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btGooglePay = require('braintree-web/google-payment');
var DropinError = require('../../lib/dropin-error');
var constants = require('../../constants');
var assets = require('@braintree/asset-loader');
var analytics = require('../../lib/analytics');

function GooglePayView() {
  BaseView.apply(this, arguments);
}

GooglePayView.prototype = Object.create(BaseView.prototype);
GooglePayView.prototype.constructor = GooglePayView;
GooglePayView.ID = GooglePayView.prototype.ID = constants.paymentOptionIDs.googlePay;

GooglePayView.prototype.initialize = function () {
  var self = this;
  var buttonOptions, googlePayVersion, merchantId;

  self.googlePayConfiguration = assign({}, self.model.merchantConfiguration.googlePay);
  googlePayVersion = self.googlePayConfiguration.googlePayVersion;
  merchantId = self.googlePayConfiguration.merchantId;

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

  delete self.googlePayConfiguration.googlePayVersion;
  delete self.googlePayConfiguration.merchantId;
  delete self.googlePayConfiguration.button;

  return btGooglePay.create({
    client: self.client,
    googlePayVersion: googlePayVersion,
    googleMerchantId: merchantId
  }).then(function (googlePayInstance) {
    self.googlePayInstance = googlePayInstance;
    self.paymentsClient = createPaymentsClient(self.client);
  }).then(function () {
    var buttonContainer = self.getElementById('google-pay-button');

    buttonContainer.appendChild(self.paymentsClient.createButton(buttonOptions));

    self.model.asyncDependencyReady(GooglePayView.ID);
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

GooglePayView.prototype.tokenize = function () {
  var self = this;
  var paymentDataRequest = self.googlePayInstance.createPaymentDataRequest(self.googlePayConfiguration);
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
      analytics.sendEvent(self.client, 'googlepay.loadPaymentData.canceled');

      return;
    } else if (err.statusCode) {
      analytics.sendEvent(self.client, 'googlepay.loadPaymentData.failed');
    }

    self.model.reportError(reportedError);
  });
};

GooglePayView.prototype.updateConfiguration = function (key, value) {
  this.googlePayConfiguration[key] = value;
};

GooglePayView.isEnabled = function (options) {
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;

  if (!(gatewayConfiguration.androidPay && Boolean(options.merchantConfiguration.googlePay))) {
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
    var paymentsClient = createPaymentsClient(options.client);

    return paymentsClient.isReadyToPay({
      allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
    });
  }).then(function (response) {
    return Boolean(response.result);
  });
};

function createPaymentsClient(client) {
  return new global.google.payments.api.PaymentsClient({
    environment: client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'PRODUCTION' : 'TEST'
  });
}

module.exports = GooglePayView;
