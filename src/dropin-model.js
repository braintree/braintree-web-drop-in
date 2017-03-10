'use strict';

var EventEmitter = require('./lib/event-emitter');
var paymentOptionIDs = require('./constants').paymentOptionIDs;
var isGuestCheckout = require('./lib/is-guest-checkout');

function DropinModel(options) {
  this._paymentMethods = options.paymentMethods;
  this.componentID = options.componentID;
  this.merchantConfiguration = options.merchantConfiguration;

  this.isGuestCheckout = isGuestCheckout(options.client);

  this.dependenciesInitializing = 0;
  this.dependencySuccessCount = 0;
  this.dependencyErrors = [];

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
  this.dependencySuccessCount++;
  this.dependenciesInitializing--;
  this._checkAsyncDependencyFinished();
};

DropinModel.prototype.asyncDependencyFailed = function (err) {
  this.dependencyErrors.push(err);
  this.dependenciesInitializing--;
  this._checkAsyncDependencyFinished();
};

DropinModel.prototype._checkAsyncDependencyFinished = function () {
  if (this.dependenciesInitializing === 0) {
    this._emit('loadEnd');
    this._emit('asyncDependenciesReady', {errors: this.dependencyErrors});
  }
};

DropinModel.prototype.reportError = function (error) {
  this._emit('errorOccurred', error);
};

DropinModel.prototype.clearError = function () {
  this._emit('errorCleared');
};

function getSupportedPaymentOptions(options) {
  var result = [];
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;
  var isCardGatewayEnabled = gatewayConfiguration.creditCards.supportedCardTypes.length > 0;
  var isPayPalGatewayEnabled = gatewayConfiguration.paypalEnabled;
  var isPayPalMerchantEnabled = Boolean(options.merchantConfiguration.paypal);

  if (isCardGatewayEnabled) {
    result.push(paymentOptionIDs.card);
  }

  if (isPayPalGatewayEnabled && isPayPalMerchantEnabled) {
    result.push(paymentOptionIDs.paypal);
  }

  return result;
}

module.exports = DropinModel;
