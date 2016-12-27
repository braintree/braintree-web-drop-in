'use strict';

var EventEmitter = require('./lib/event-emitter');
var paymentOptionIDs = require('./constants').paymentOptionIDs;
var isGuestCheckout = require('./lib/is-guest-checkout');

function DropinModel(options) {
  this._paymentMethods = options.paymentMethods;
  this.dependenciesInitializing = 0;
  this.isGuestCheckout = isGuestCheckout(options.merchantConfiguration.authorization);

  this.supportedPaymentOptions = getSupportedPaymentOptions(options);

  EventEmitter.call(this);
}

DropinModel.prototype = Object.create(EventEmitter.prototype, {
  constructor: DropinModel
});

DropinModel.prototype.addPaymentMethod = function (paymentMethod) {
  this._paymentMethods.push(paymentMethod);
  this._emit('addPaymentMethod', paymentMethod);
  this.changeActivePaymentMethod(paymentMethod);
};

DropinModel.prototype.changeActivePaymentMethod = function (paymentMethod) {
  this._activePaymentMethod = paymentMethod;
  this._emit('changeActivePaymentMethod', paymentMethod);
};

DropinModel.prototype.changeActivePaymentView = function (paymentViewID) {
  this._activePaymentView = paymentViewID;
  this._emit('changeActivePaymentView', paymentViewID);
};

DropinModel.prototype.getPaymentMethods = function () {
  return this._paymentMethods;
};

DropinModel.prototype.getActivePaymentMethod = function () {
  return this._activePaymentMethod;
};

DropinModel.prototype.getActivePaymentView = function () {
  return this._activePaymentView;
};

DropinModel.prototype.asyncDependencyStarting = function () {
  this.dependenciesInitializing++;
};

DropinModel.prototype.asyncDependencyReady = function () {
  this.dependenciesInitializing--;
  if (this.dependenciesInitializing === 0) {
    this._emit('asyncDependenciesReady');
  }
};

DropinModel.prototype.beginLoading = function () {
  this._emit('loadBegin');
};

DropinModel.prototype.endLoading = function () {
  this._emit('loadEnd');
};

DropinModel.prototype.reportError = function (error) {
  this._emit('errorOccurred', error);
};

DropinModel.prototype.clearError = function () {
  this._emit('errorCleared');
};

module.exports = DropinModel;

function getSupportedPaymentOptions(options) {
  var result = [paymentOptionIDs.card];

  var isPayPalGatewayEnabled = options.client.getConfiguration().gatewayConfiguration.paypalEnabled;
  var isPayPalMerchantEnabled = Boolean(options.merchantConfiguration.paypal);

  if (isPayPalGatewayEnabled && isPayPalMerchantEnabled) {
    result.push(paymentOptionIDs.paypal);
  }

  return result;
}
