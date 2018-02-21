'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btGooglePay = require('braintree-web/google-payment');
var DropinError = require('../../lib/dropin-error');
var constants = require('../../constants');
var assets = require('../../lib/assets');
var Promise = require('../../lib/promise');

function GooglePayView() {
  BaseView.apply(this, arguments);
}

GooglePayView.prototype = Object.create(BaseView.prototype);
GooglePayView.prototype.constructor = GooglePayView;
GooglePayView.ID = GooglePayView.prototype.ID = constants.paymentOptionIDs.googlePay;

GooglePayView.prototype.initialize = function () {
  var self = this;
  var initializePromise = Promise.resolve();

  self.googlePayConfiguration = assign({}, self.model.merchantConfiguration.googlePay);

  self.model.asyncDependencyStarting();

  if (!global.google) {
    initializePromise = initializePromise.then(function () {
      return assets.loadScript(self.element, {
        id: constants.GOOGLE_PAYMENT_SCRIPT_ID,
        src: constants.GOOGLE_PAYMENT_SOURCE
      });
    });
  }

  return initializePromise.then(function () {
    return btGooglePay.create({client: self.client});
  }).then(function (googlePayInstance) {
    self.googlePayInstance = googlePayInstance;
    self.paymentsClient = new global.google.payments.api.PaymentsClient({
      environment: self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'PRODUCTION' : 'TEST'
    });

    return self.paymentsClient.isReadyToPay({
      allowedPaymentMethods: self.googlePayInstance.createPaymentDataRequest().allowedPaymentMethods
    });
  }).then(function () {
    // button handler
    // prefetch handler
    self.model.asyncDependencyReady();
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

GooglePayView.prototype.updateConfiguration = function (key, value) {
  this.googlePayConfiguration[key] = value;
};

module.exports = GooglePayView;
