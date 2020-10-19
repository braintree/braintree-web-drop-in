'use strict';

var BaseView = require('../base-view');
var btPaypal = require('braintree-web/paypal-checkout');
var DropinError = require('../../lib/dropin-error');
var constants = require('../../constants');
var assets = require('@braintree/asset-loader');
var translations = require('../../translations').fiveCharacterLocales;

var ASYNC_DEPENDENCY_TIMEOUT = 30000;
var READ_ONLY_CONFIGURATION_OPTIONS = ['offerCredit', 'locale'];
var DEFAULT_CHECKOUTJS_LOG_LEVEL = 'warn';

var paypalScriptLoadInProgressPromise;

function BasePayPalView() {
  BaseView.apply(this, arguments);
}

BasePayPalView.prototype = Object.create(BaseView.prototype);

BasePayPalView.prototype.initialize = function () {
  var asyncDependencyTimeoutHandler;
  var isCredit = Boolean(this._isPayPalCredit);
  var setupComplete = false;
  var self = this;
  var paypalType = isCredit ? 'paypalCredit' : 'paypal';
  var paypalConfiguration = this.model.merchantConfiguration[paypalType];

  this.paypalConfiguration = Object.assign({}, {
    vault: {}
  }, paypalConfiguration);
  this.vaultConfig = this.paypalConfiguration.vault;
  delete this.paypalConfiguration.vault;

  this.model.asyncDependencyStarting();
  asyncDependencyTimeoutHandler = setTimeout(function () {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError('There was an error connecting to PayPal.')
    });
  }, ASYNC_DEPENDENCY_TIMEOUT);

  return btPaypal.create({
    authorization: this.model.authorization
  }).then(function (paypalInstance) {
    var checkoutJSConfiguration;
    var buttonSelector = '[data-braintree-id="paypal-button"]';
    var environment = self.model.environment === 'production' ? 'production' : 'sandbox';
    var locale = self.model.merchantConfiguration.locale;

    self.paypalInstance = paypalInstance;

    self.paypalConfiguration.offerCredit = Boolean(isCredit);
    checkoutJSConfiguration = {
      env: environment,
      style: self.paypalConfiguration.buttonStyle || {},
      commit: self.paypalConfiguration.commit,
      payment: function () {
        return paypalInstance.createPayment(self.paypalConfiguration).catch(reportError);
      },
      onAuthorize: function (data) {
        var shouldVault = self._shouldVault();

        data.vault = shouldVault;

        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          if (shouldVault) {
            tokenizePayload.vaulted = true;
          }
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },
      onError: reportError
    };

    if (locale && locale in translations) {
      self.paypalConfiguration.locale = locale;
      checkoutJSConfiguration.locale = locale;
    }
    checkoutJSConfiguration.funding = {
      disallowed: []
    };

    Object.keys(global.paypal.FUNDING).forEach(function (key) {
      if (key === 'PAYPAL' || key === 'CREDIT') {
        return;
      }
      checkoutJSConfiguration.funding.disallowed.push(global.paypal.FUNDING[key]);
    });

    if (isCredit) {
      buttonSelector = '[data-braintree-id="paypal-credit-button"]';
      checkoutJSConfiguration.style.label = 'credit';
    } else {
      checkoutJSConfiguration.funding.disallowed.push(global.paypal.FUNDING.CREDIT);
    }

    return global.paypal.Button.render(checkoutJSConfiguration, buttonSelector).then(function () {
      self.model.asyncDependencyReady();
      setupComplete = true;
      clearTimeout(asyncDependencyTimeoutHandler);
    });
  }).catch(reportError);

  function reportError(err) {
    if (setupComplete) {
      self.model.reportError(err);
    } else {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      clearTimeout(asyncDependencyTimeoutHandler);
    }
  }
};

BasePayPalView.prototype.requestPaymentMethod = function () {
  this.model.reportError('paypalButtonMustBeUsed');

  return BaseView.prototype.requestPaymentMethod.call(this);
};

BasePayPalView.prototype.updateConfiguration = function (key, value) {
  if (key === 'vault') {
    this.vaultConfig = value;

    return;
  }

  if (READ_ONLY_CONFIGURATION_OPTIONS.indexOf(key) === -1) {
    this.paypalConfiguration[key] = value;
  }
};

BasePayPalView.prototype._shouldVault = function () {
  if (this.paypalConfiguration.flow !== 'vault') {
    return false;
  }

  if (this.vaultConfig.hasOwnProperty('autoVault')) {
    return this.vaultConfig.autoVault;
  }

  return this.model.vaultManagerConfig.autoVaultPaymentMethods;
};

BasePayPalView.isEnabled = function (options) {
  var merchantPayPalConfig = options.merchantConfiguration.paypal || options.merchantConfiguration.paypalCredit;

  if (global.paypal && global.paypal.Button) {
    return Promise.resolve(true);
  }

  if (paypalScriptLoadInProgressPromise) {
    return paypalScriptLoadInProgressPromise;
  }

  paypalScriptLoadInProgressPromise = assets.loadScript({
    src: constants.CHECKOUT_JS_SOURCE,
    id: constants.PAYPAL_CHECKOUT_SCRIPT_ID,
    dataAttributes: {
      'log-level': merchantPayPalConfig.logLevel || DEFAULT_CHECKOUTJS_LOG_LEVEL
    }
  }).then(function () {
    return Promise.resolve(true);
  }).catch(function () {
    return Promise.resolve(false);
  }).then(function (result) {
    paypalScriptLoadInProgressPromise = null;

    return Promise.resolve(result);
  });

  return paypalScriptLoadInProgressPromise;
};

module.exports = BasePayPalView;
