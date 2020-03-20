'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btPaypal = require('braintree-web/paypal-checkout');
var DropinError = require('../../lib/dropin-error');
var constants = require('../../constants');
var assets = require('@braintree/asset-loader');
var translations = require('../../translations').fiveCharacterLocales;
var Promise = require('../../lib/promise');

var ASYNC_DEPENDENCY_TIMEOUT = 30000;
var READ_ONLY_CONFIGURATION_OPTIONS = [
  'commit',
  'currency',
  'flow',
  'intent',
  'locale',
  'offerCredit'
];
var DEFAULT_INTENT = 'authorize';

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

  this.paypalConfiguration = assign({}, {
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
    self.paypalInstance = paypalInstance;
    self.paypalConfiguration.offerCredit = Boolean(isCredit);

    return self._loadPayPalSDK();
  }).then(function () {
    var button, fundingSource, buttonSelector;
    var buttonConfig = {
      onApprove: function (data) {
        var shouldVault = self._shouldVault();

        data.vault = shouldVault;

        return self.paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          if (shouldVault) {
            tokenizePayload.vaulted = true;
          }
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },

      onError: reportError
    };

    if (isCredit) {
      fundingSource = global.paypal.FUNDING.CREDIT;
      buttonSelector = '[data-braintree-id="paypal-credit-button"]';
    } else {
      fundingSource = global.paypal.FUNDING.PAYPAL;
      buttonSelector = '[data-braintree-id="paypal-button"]';
    }

    buttonConfig.fundingSource = fundingSource;

    if (paypalConfiguration.flow === 'vault') {
      buttonConfig.createBillingAgreement = self._createPaymentResourceHandler(reportError);
    } else {
      buttonConfig.createOrder = self._createPaymentResourceHandler(reportError);
    }

    button = global.paypal.Buttons(buttonConfig); // eslint-disable-line new-cap

    if (!button.isEligible()) {
      return Promise.reject(new DropinError('Merchant not elligible for PayPal'));
    }

    return button.render(buttonSelector).then(function () {
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

BasePayPalView.prototype._createPaymentResourceHandler = function (reportError) {
  var self = this;

  return function () {
    return self.paypalInstance.createPayment(self.paypalConfiguration).catch(reportError);
  };
};

BasePayPalView.prototype._loadPayPalSDK = function () {
  var config = this.paypalConfiguration;
  var locale = this.model.merchantConfiguration.locale;

  if (!paypalScriptLoadInProgressPromise) {
    paypalScriptLoadInProgressPromise = this.paypalInstance.getClientId().then(function (id) {
      var src = constants.PAYPAL_SDK_JS_SOURCE + '?client-id=' + id + '&components=buttons';
      var intent = config.intent;

      function updateSrc(param, value) {
        if (value) {
          src += '&' + param + '=' + value;
        }
      }

      if (config.flow === 'vault') {
        updateSrc('vault', 'true');
      } else {
        intent = intent || DEFAULT_INTENT;
      }

      updateSrc('intent', intent);
      updateSrc('commit', config.commit);
      updateSrc('currency', config.currency);

      if (locale in translations) {
        config.locale = locale;
        updateSrc('locale', locale);
      }

      return assets.loadScript({
        src: src,
        id: constants.PAYPAL_SDK_SCRIPT_ID
      });
    });
  }

  return paypalScriptLoadInProgressPromise;
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

BasePayPalView.isEnabled = function () {
  return Promise.resolve(true);
};

BasePayPalView.resetPayPalScriptPromise = function () {
  paypalScriptLoadInProgressPromise = null;
};

module.exports = BasePayPalView;
