'use strict';

var DropinError = require('./lib/dropin-error');
var EventEmitter = require('./lib/event-emitter');
var constants = require('./constants');
var paymentMethodTypes = constants.paymentMethodTypes;
var paymentOptionIDs = constants.paymentOptionIDs;
var isGuestCheckout = require('./lib/is-guest-checkout');

function DropinModel(options) {
  this.componentID = options.componentID;
  this.merchantConfiguration = options.merchantConfiguration;

  this.isGuestCheckout = isGuestCheckout(options.client);

  this.dependenciesInitializing = 0;
  this.dependencySuccessCount = 0;
  this.failedDependencies = {};

  this.supportedPaymentOptions = getSupportedPaymentOptions(options);
  this._paymentMethods = this._getSupportedPaymentMethods(options.paymentMethods);
  this._paymentMethodIsRequestable = this._paymentMethods.length > 0;

  EventEmitter.call(this);
}

DropinModel.prototype = Object.create(EventEmitter.prototype, {
  constructor: DropinModel
});

DropinModel.prototype.isPaymentMethodRequestable = function () {
  return Boolean(this._paymentMethodIsRequestable);
};

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

DropinModel.prototype._shouldEmitRequestableEvent = function (options) {
  var requestableStateHasNotChanged = this.isPaymentMethodRequestable() === options.isRequestable;
  var typeHasNotChanged = options.type === this._paymentMethodRequestableType;

  if (requestableStateHasNotChanged && (!options.isRequestable || typeHasNotChanged)) {
    return false;
  }

  return true;
};

DropinModel.prototype.setPaymentMethodRequestable = function (options) {
  var shouldEmitEvent = this._shouldEmitRequestableEvent(options);

  this._paymentMethodIsRequestable = options.isRequestable;

  if (options.isRequestable) {
    this._paymentMethodRequestableType = options.type;
  } else {
    delete this._paymentMethodRequestableType;
  }

  if (!shouldEmitEvent) {
    return;
  }

  if (options.isRequestable) {
    this._emit('paymentMethodRequestable', {type: options.type});
  } else {
    this._emit('noPaymentMethodRequestable');
  }
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

DropinModel.prototype.asyncDependencyFailed = function (options) {
  this.failedDependencies[options.view] = options.error;
  this.dependenciesInitializing--;
  this._checkAsyncDependencyFinished();
};

DropinModel.prototype._checkAsyncDependencyFinished = function () {
  if (this.dependenciesInitializing === 0) {
    this._emit('asyncDependenciesReady');
  }
};

DropinModel.prototype.reportError = function (error) {
  this._emit('errorOccurred', error);
};

DropinModel.prototype.clearError = function () {
  this._emit('errorCleared');
};

DropinModel.prototype._getSupportedPaymentMethods = function (paymentMethods) {
  var supportedPaymentMethods = this.supportedPaymentOptions.reduce(function (array, key) {
    var paymentMethodType = paymentMethodTypes[key];

    if (paymentMethodType) {
      array.push(paymentMethodType);
    }

    return array;
  }, []);

  return paymentMethods.filter(function (paymentMethod) {
    return supportedPaymentMethods.indexOf(paymentMethod.type) > -1;
  });
};

function getSupportedPaymentOptions(options) {
  var result = [];
  var paymentOptionPriority = options.merchantConfiguration.paymentOptionPriority || ['card', 'paypal', 'paypalCredit'];

  if (!(paymentOptionPriority instanceof Array)) {
    throw new DropinError('paymentOptionPriority must be an array.');
  }

  // Remove duplicates
  paymentOptionPriority = paymentOptionPriority.filter(function (item, pos) { return paymentOptionPriority.indexOf(item) === pos; });

  paymentOptionPriority.forEach(function (paymentOption) {
    if (isPaymentOptionEnabled(paymentOption, options)) {
      result.push(paymentOptionIDs[paymentOption]);
    }
  });

  if (result.length === 0) {
    throw new DropinError('No valid payment options available.');
  }

  return result;
}

function isPaymentOptionEnabled(paymentOption, options) {
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;

  if (paymentOption === 'card') {
    return gatewayConfiguration.creditCards.supportedCardTypes.length > 0;
  } else if (paymentOption === 'paypal') {
    return gatewayConfiguration.paypalEnabled && Boolean(options.merchantConfiguration.paypal);
  } else if (paymentOption === 'paypalCredit') {
    return gatewayConfiguration.paypalEnabled && Boolean(options.merchantConfiguration.paypalCredit);
  }
  throw new DropinError('paymentOptionPriority: Invalid payment option specified.');
}

module.exports = DropinModel;
