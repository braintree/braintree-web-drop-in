'use strict';

var analytics = require('./lib/analytics');
var DropinError = require('./lib/dropin-error');
var EventEmitter = require('@braintree/event-emitter');
var constants = require('./constants');
var paymentMethodTypes = constants.paymentMethodTypes;
var paymentOptionIDs = constants.paymentOptionIDs;
var dependencySetupStates = constants.dependencySetupStates;
var isGuestCheckout = require('./lib/is-guest-checkout');
var Promise = require('./lib/promise');
var paymentSheetViews = require('./views/payment-sheet-views');
var vaultManager = require('braintree-web/vault-manager');
var paymentOptionsViewID = require('./views/payment-options-view').ID;

// these vaulted payment methods can only be used for existing subscription
// any new transactions or subscriptons should prompt the customer to
// authorize them again before using them and thus should always be hidden.
var VAULTED_PAYMENT_METHOD_TYPES_THAT_SHOULD_ALWAYS_BE_HIDDEN = [
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
var NON_PAYMENT_OPTION_DEPENDENCIES = ['threeDSecure', 'dataCollector'];
var ASYNC_DEPENDENCIES = DEFAULT_PAYMENT_OPTION_PRIORITY.concat(NON_PAYMENT_OPTION_DEPENDENCIES);
var DEPENDENCY_READY_CHECK_INTERVAL = 200;

function DropinModel(options) {
  this.rootNode = options.container;
  this.componentID = options.componentID;
  this.merchantConfiguration = options.merchantConfiguration;
  this.isGuestCheckout = isGuestCheckout(options.client);
  this.dependencyStates = ASYNC_DEPENDENCIES.reduce(function (total, dependencyKey) {
    if (this._shouldIncludeDependency(dependencyKey)) {
      total[dependencyKey] = dependencySetupStates.INITIALIZING;
    }

    return total;
  }.bind(this), {});
  this.hiddenVaultedPaymentMethodTypes =
    constructHiddenPaymentMethodTypes(
      options.merchantConfiguration.hiddenVaultedPaymentMethodTypes
    );

  this.failedDependencies = {};
  this._options = options;
  this._setupComplete = false;

  while (this.rootNode.parentNode) {
    this.rootNode = this.rootNode.parentNode;
  }
  this.isInShadowDom = this.rootNode.toString() === '[object ShadowRoot]';

  EventEmitter.call(this);
}

EventEmitter.createChild(DropinModel);

DropinModel.prototype.initialize = function () {
  var dep;
  var self = this;
  var dependencyReadyInterval = setInterval(function () {
    for (dep in self.dependencyStates) {
      if (self.dependencyStates[dep] === dependencySetupStates.INITIALIZING) {
        return;
      }
    }

    clearInterval(dependencyReadyInterval);

    self._emit('asyncDependenciesReady');
  }, DEPENDENCY_READY_CHECK_INTERVAL);

  return vaultManager.create({
    client: self._options.client
  }).then(function (vaultManagerInstance) {
    self._vaultManager = vaultManagerInstance;

    return self._getSupportedPaymentOptions(self._options);
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

DropinModel.prototype.changeActiveView = function (paymentViewID) {
  var previousViewId = this._activePaymentViewId;

  this._activePaymentViewId = paymentViewID;
  this._emit('changeActiveView', {
    previousViewId: previousViewId,
    newViewId: paymentViewID
  });
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

DropinModel.prototype._shouldIncludeDependency = function (key) {
  if (key === 'card') {
    // card is turned on by default unless the merchant explicitly
    // passes a value of `false` or omits it from a custom
    // `paymentOptionPriority` array
    if (this.merchantConfiguration.card === false) {
      return false;
    }
  } else if (!this.merchantConfiguration[key]) {
    // if the merchant does not have the non-card dependency
    // configured, do not include the dependency
    return false;
  }

  if (NON_PAYMENT_OPTION_DEPENDENCIES.indexOf(key) > -1) {
    // if the dependency is not a payment option (3DS, data collector)
    // include it since the merchant configured Drop-in for it

    return true;
  }

  if (this.merchantConfiguration.paymentOptionPriority) {
    // if the merchant passed a custom `paymentOptionPriority` array,
    // only include the dependency if it was configured _and_
    // included in the array
    return this.merchantConfiguration.paymentOptionPriority.indexOf(key) > -1;
  }

  // otherwise, include it if it is a valid payment option
  return DEFAULT_PAYMENT_OPTION_PRIORITY.indexOf(key) > -1;
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

DropinModel.prototype.hasPaymentMethods = function () {
  return this.getPaymentMethods().length > 0;
};

DropinModel.prototype.getInitialViewId = function () {
  if (this.supportedPaymentOptions.length > 1) {
    return paymentOptionsViewID;
  }

  return this.supportedPaymentOptions[0];
};

DropinModel.prototype.getActivePaymentViewId = function () {
  return this._activePaymentViewId;
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

DropinModel.prototype.hasAtLeastOneAvailablePaymentOption = function () {
  var self = this;
  var i;

  for (i = 0; i < this.supportedPaymentOptions.length; i++) {
    if (self.dependencyStates[this.supportedPaymentOptions[i]] === dependencySetupStates.DONE) {
      return true;
    }
  }

  return false;
};

DropinModel.prototype.asyncDependencyReady = function (key) {
  this.dependencyStates[key] = dependencySetupStates.DONE;
};

DropinModel.prototype.asyncDependencyFailed = function (options) {
  if (this.failedDependencies.hasOwnProperty(options.view)) {
    return;
  }
  this.failedDependencies[options.view] = options.error;
  this.dependencyStates[options.view] = dependencySetupStates.FAILED;
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
    defaultFirst: this.merchantConfiguration.showDefaultPaymentMethodFirst !== false
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
  var self = this;
  var supportedPaymentMethods = this.supportedPaymentOptions.reduce(function (
    array,
    key
  ) {
    var paymentMethodType = paymentMethodTypes[key];

    if (
      canShowVaultedPaymentMethodType(
        paymentMethodType,
        self.hiddenVaultedPaymentMethodTypes
      )
    ) {
      array.push(paymentMethodType);
    }

    return array;
  },
  []);

  return paymentMethods.filter(function (paymentMethod) {
    return supportedPaymentMethods.indexOf(paymentMethod.type) > -1;
  });
};

DropinModel.prototype._getSupportedPaymentOptions = function (options) {
  var self = this;
  var paymentOptionPriority = options.merchantConfiguration.paymentOptionPriority || DEFAULT_PAYMENT_OPTION_PRIORITY;
  var promises;

  if (!(paymentOptionPriority instanceof Array)) {
    throw new DropinError('paymentOptionPriority must be an array.');
  }

  // Remove duplicates
  paymentOptionPriority = paymentOptionPriority.filter(function (item, pos) { return paymentOptionPriority.indexOf(item) === pos; });

  promises = paymentOptionPriority.map(function (paymentOption) {
    return getPaymentOption(paymentOption, options).then(function (result) {
      if (!result.success) {
        self.dependencyStates[result.id] = dependencySetupStates.NOT_ENABLED;
      }

      return result;
    });
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
};

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

function canShowVaultedPaymentMethodType(
  paymentMethodType,
  hiddenVaultedPaymentMethodTypes
) {
  return (
    paymentMethodType &&
    hiddenVaultedPaymentMethodTypes.indexOf(paymentMethodType) ===
      -1
  );
}

function constructHiddenPaymentMethodTypes(paymentMethods) {
  var hiddenVaultedPaymentMethodTypes = [].concat(
    VAULTED_PAYMENT_METHOD_TYPES_THAT_SHOULD_ALWAYS_BE_HIDDEN
  );

  if (Array.isArray(paymentMethods)) {
    paymentMethods.forEach(function (paymentMethod) {
      var paymentMethodId = paymentMethodTypes[paymentMethod];

      if (!paymentMethodId) {
        // don't add it if it is an unknown payment method
        return;
      }

      if (
        hiddenVaultedPaymentMethodTypes.indexOf(paymentMethodId) >
        -1
      ) {
        // don't add the same payment method type a second time
        return;
      }

      hiddenVaultedPaymentMethodTypes.push(paymentMethodId);
    });
  }

  return hiddenVaultedPaymentMethodTypes;
}

module.exports = DropinModel;
