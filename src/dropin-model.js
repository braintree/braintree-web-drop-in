'use strict';

var analytics = require('./lib/analytics');
var DropinError = require('./lib/dropin-error');
var EventEmitter = require('@braintree/event-emitter');
var constants = require('./constants');
var paymentMethodTypes = constants.paymentMethodTypes;
var paymentOptionIDs = constants.paymentOptionIDs;
var isGuestCheckout = require('./lib/is-guest-checkout');
var Promise = require('./lib/promise');
var paymentSheetViews = require('./views/payment-sheet-views');
var vaultManager = require('braintree-web/vault-manager');

var VAULTED_PAYMENT_METHOD_TYPES_THAT_SHOULD_BE_HIDDEN = [
  paymentMethodTypes.applePay,
  paymentMethodTypes.googlePay,
  paymentMethodTypes.venmo
];
var DEFAULT_PAYMENT_OPTION_PRIORITY = [
  paymentOptionIDs.card,
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit,
  paymentOptionIDs.venmo,
  paymentOptionIDs.applePay,
  paymentOptionIDs.googlePay
];

function DropinModel(options) {
  this.componentID = options.componentID;
  this.merchantConfiguration = options.merchantConfiguration;

  this.isGuestCheckout = isGuestCheckout(options.client);

  this.dependenciesInitializing = 0;
  this.dependencySuccessCount = 0;
  this.failedDependencies = {};
  this._options = options;
  this._setupComplete = false;

  EventEmitter.call(this);
}

EventEmitter.createChild(DropinModel);

DropinModel.prototype.initialize = function () {
  var self = this;

  return vaultManager.create({
    client: self._options.client
  }).then(function (vaultManagerInstance) {
    self._vaultManager = vaultManagerInstance;

    return getSupportedPaymentOptions(self._options);
  }).then(function (paymentOptions) {
    self.supportedPaymentOptions = paymentOptions;

    return self.getVaultedPaymentMethods();
  }).then(function (paymentMethods) {
    self._paymentMethods = paymentMethods;
    self._paymentMethodIsRequestable = self._paymentMethods.length > 0;
  });
};

DropinModel.prototype.confirmDropinReady = function () {
  this._setupComplete = true;
};

DropinModel.prototype.isPaymentMethodRequestable = function () {
  return Boolean(this._paymentMethodIsRequestable);
};

DropinModel.prototype.addPaymentMethod = function (paymentMethod) {
  this._paymentMethods.push(paymentMethod);
  this._emit('addPaymentMethod', paymentMethod);
  this.changeActivePaymentMethod(paymentMethod);
};

DropinModel.prototype.removePaymentMethod = function (paymentMethod) {
  var paymentMethodLocation = this._paymentMethods.indexOf(paymentMethod);

  if (paymentMethodLocation === -1) {
    return;
  }

  this._paymentMethods.splice(paymentMethodLocation, 1);
  this._emit('removePaymentMethod', paymentMethod);
};

DropinModel.prototype.refreshPaymentMethods = function () {
  var self = this;

  return self.getVaultedPaymentMethods().then(function (paymentMethods) {
    self._paymentMethods = paymentMethods;

    self._emit('refreshPaymentMethods');
  });
};

DropinModel.prototype.changeActivePaymentMethod = function (paymentMethod) {
  this._activePaymentMethod = paymentMethod;
  this._emit('changeActivePaymentMethod', paymentMethod);
};

DropinModel.prototype.changeActivePaymentView = function (paymentViewID) {
  this._activePaymentView = paymentViewID;
  this._emit('changeActivePaymentView', paymentViewID);
};

DropinModel.prototype.removeActivePaymentMethod = function () {
  this._activePaymentMethod = null;
  this._emit('removeActivePaymentMethod');
  this.setPaymentMethodRequestable({
    isRequestable: false
  });
};

DropinModel.prototype.selectPaymentOption = function (paymentViewID) {
  this._emit('paymentOptionSelected', {
    paymentOption: paymentViewID
  });
};

DropinModel.prototype.enableEditMode = function () {
  analytics.sendEvent(this._options.client, 'manager.appeared');
  this._isInEditMode = true;
  this._emit('enableEditMode');
};

DropinModel.prototype.disableEditMode = function () {
  this._isInEditMode = false;
  this._emit('disableEditMode');
};

DropinModel.prototype.isInEditMode = function () {
  return Boolean(this._isInEditMode);
};

DropinModel.prototype.confirmPaymentMethodDeletion = function (paymentMethod) {
  this._paymentMethodWaitingToBeDeleted = paymentMethod;
  this._emit('confirmPaymentMethodDeletion', paymentMethod);
};

DropinModel.prototype._shouldEmitRequestableEvent = function (options) {
  var requestableStateHasNotChanged = this.isPaymentMethodRequestable() === options.isRequestable;
  var nonce = options.selectedPaymentMethod && options.selectedPaymentMethod.nonce;
  var nonceHasNotChanged = nonce === this._paymentMethodRequestableNonce;

  if (!this._setupComplete) {
    // don't emit event until after Drop-in is fully set up
    // fixes issues with lazy loading of imports where event
    // should not be emitted
    // https://github.com/braintree/braintree-web-drop-in/issues/511
    return false;
  }

  if (requestableStateHasNotChanged && (!options.isRequestable || nonceHasNotChanged)) {
    return false;
  }

  return true;
};

DropinModel.prototype.setPaymentMethodRequestable = function (options) {
  var shouldEmitEvent = this._shouldEmitRequestableEvent(options);
  var paymentMethodRequestableResponse = {
    paymentMethodIsSelected: Boolean(options.selectedPaymentMethod),
    type: options.type
  };

  this._paymentMethodIsRequestable = options.isRequestable;

  if (options.isRequestable) {
    this._paymentMethodRequestableNonce = options.selectedPaymentMethod && options.selectedPaymentMethod.nonce;
  } else {
    delete this._paymentMethodRequestableNonce;
  }

  if (!shouldEmitEvent) {
    return;
  }

  if (options.isRequestable) {
    this._emit('paymentMethodRequestable', paymentMethodRequestableResponse);
  } else {
    this._emit('noPaymentMethodRequestable');
  }
};

DropinModel.prototype.getPaymentMethods = function () {
  // we want to return a copy of the Array
  // so we can loop through it in dropin.updateConfiguration
  // while calling model.removePaymentMethod
  // which updates the original array
  return this._paymentMethods.slice();
};

DropinModel.prototype.getActivePaymentMethod = function () {
  return this._activePaymentMethod;
};

DropinModel.prototype.getActivePaymentView = function () {
  return this._activePaymentView;
};

DropinModel.prototype.reportAppSwitchPayload = function (payload) {
  this.appSwitchPayload = payload;
};

DropinModel.prototype.reportAppSwitchError = function (sheetId, error) {
  this.appSwitchError = {
    id: sheetId,
    error: error
  };
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
  if (this.failedDependencies.hasOwnProperty(options.view)) {
    return;
  }
  this.failedDependencies[options.view] = options.error;
  this.dependenciesInitializing--;
  this._checkAsyncDependencyFinished();
};

DropinModel.prototype._checkAsyncDependencyFinished = function () {
  if (this.dependenciesInitializing === 0) {
    this._emit('asyncDependenciesReady');
  }
};

DropinModel.prototype.cancelInitialization = function (error) {
  this._emit('cancelInitialization', error);
};

DropinModel.prototype.reportError = function (error) {
  this._emit('errorOccurred', error);
};

DropinModel.prototype.clearError = function () {
  this._emit('errorCleared');
};

DropinModel.prototype.preventUserAction = function () {
  this._emit('preventUserAction');
};

DropinModel.prototype.allowUserAction = function () {
  this._emit('allowUserAction');
};

DropinModel.prototype.deleteVaultedPaymentMethod = function () {
  var self = this;
  var promise = Promise.resolve();
  var error;

  this._emit('startVaultedPaymentMethodDeletion');

  if (!self.isGuestCheckout) {
    promise = this._vaultManager.deletePaymentMethod(this._paymentMethodWaitingToBeDeleted.nonce).catch(function (err) {
      error = err;
    });
  }

  return promise.then(function () {
    delete self._paymentMethodWaitingToBeDeleted;

    return self.refreshPaymentMethods();
  }).then(function () {
    self.disableEditMode();
    self._emit('finishVaultedPaymentMethodDeletion', error);
  });
};

DropinModel.prototype.cancelDeleteVaultedPaymentMethod = function () {
  this._emit('cancelVaultedPaymentMethodDeletion');

  delete this._paymentMethodWaitingToBeDeleted;
};

DropinModel.prototype.getVaultedPaymentMethods = function () {
  var self = this;

  if (self.isGuestCheckout) {
    return Promise.resolve([]);
  }

  return self._vaultManager.fetchPaymentMethods({
    defaultFirst: true
  }).then(function (paymentMethods) {
    return self._getSupportedPaymentMethods(paymentMethods).map(function (paymentMethod) {
      paymentMethod.vaulted = true;

      return paymentMethod;
    });
  }).catch(function () {
    return Promise.resolve([]);
  });
};

DropinModel.prototype._getSupportedPaymentMethods = function (paymentMethods) {
  var supportedPaymentMethods = this.supportedPaymentOptions.reduce(function (array, key) {
    var paymentMethodType = paymentMethodTypes[key];

    if (canShowVaultedPaymentMethodType(paymentMethodType)) {
      array.push(paymentMethodType);
    }

    return array;
  }, []);

  return paymentMethods.filter(function (paymentMethod) {
    return supportedPaymentMethods.indexOf(paymentMethod.type) > -1;
  });
};

function getSupportedPaymentOptions(options) {
  var paymentOptionPriority = options.merchantConfiguration.paymentOptionPriority || DEFAULT_PAYMENT_OPTION_PRIORITY;
  var promises;

  if (!(paymentOptionPriority instanceof Array)) {
    throw new DropinError('paymentOptionPriority must be an array.');
  }

  // Remove duplicates
  paymentOptionPriority = paymentOptionPriority.filter(function (item, pos) { return paymentOptionPriority.indexOf(item) === pos; });

  promises = paymentOptionPriority.map(function (paymentOption) {
    return getPaymentOption(paymentOption, options);
  });

  return Promise.all(promises).then(function (result) {
    result = result.filter(function (item) {
      return item.success;
    });

    if (result.length === 0) {
      return Promise.reject(new DropinError('No valid payment options available.'));
    }

    return result.map(function (item) { return item.id; });
  });
}

function getPaymentOption(paymentOption, options) {
  return isPaymentOptionEnabled(paymentOption, options).then(function (success) {
    return {
      success: success,
      id: paymentOptionIDs[paymentOption]
    };
  });
}

function isPaymentOptionEnabled(paymentOption, options) {
  var SheetView = paymentSheetViews[paymentOptionIDs[paymentOption]];

  if (!SheetView) {
    return Promise.reject(new DropinError('paymentOptionPriority: Invalid payment option specified.'));
  }

  return SheetView.isEnabled({
    client: options.client,
    merchantConfiguration: options.merchantConfiguration
  }).catch(function (error) {
    console.error(SheetView.ID + ' view errored when checking if it was supported.'); // eslint-disable-line no-console
    console.error(error); // eslint-disable-line no-console

    return Promise.resolve(false);
  });
}

function canShowVaultedPaymentMethodType(paymentMethodType) {
  return paymentMethodType && VAULTED_PAYMENT_METHOD_TYPES_THAT_SHOULD_BE_HIDDEN.indexOf(paymentMethodType) === -1;
}

module.exports = DropinModel;
