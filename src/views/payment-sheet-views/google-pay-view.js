'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btGooglePay = require('braintree-web/google-payment');
var DropinError = require('../../lib/dropin-error');
var constants = require('../../constants');
var assets = require('../../lib/assets');
var classlist = require('../../lib/classlist');
var Promise = require('../../lib/promise');
var analytics = require('../../lib/analytics');

function GooglePayView() {
  BaseView.apply(this, arguments);
}

GooglePayView.prototype = Object.create(BaseView.prototype);
GooglePayView.prototype.constructor = GooglePayView;
GooglePayView.ID = GooglePayView.prototype.ID = constants.paymentOptionIDs.googlePay;

GooglePayView.prototype.initialize = function () {
  var self = this;

  self.googlePayConfiguration = assign({}, self.model.merchantConfiguration.googlePay);

  self.model.asyncDependencyStarting();

  return btGooglePay.create({client: self.client}).then(function (googlePayInstance) {
    self.googlePayInstance = googlePayInstance;
    self.paymentsClient = createPaymentsClient(self.client);
  }).then(function () {
    var buttonDiv = self.getElementById('google-pay-button');

    buttonDiv.addEventListener('click', function (event) {
      event.preventDefault();

      classlist.add(self.element, 'braintree-sheet--loading');

      self.tokenize().then(function () {
        classlist.remove(self.element, 'braintree-sheet--loading');
      });
    });
    self.model.asyncDependencyReady();
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
  var rawResponse;

  return self.paymentsClient.loadPaymentData(paymentDataRequest).then(function (paymentData) {
    rawResponse = paymentData;
    return self.googlePayInstance.parseResponse(paymentData);
  }).then(function (tokenizePayload) {
    tokenizePayload.rawResponse = rawResponse;
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
    if (!global.google) {
      return assets.loadScript(global.document.head, {
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
