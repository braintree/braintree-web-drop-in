'use strict';

var analytics = require('../../lib/analytics');
var assign = require('../../lib/assign').assign;
var browserDetection = require('../../lib/browser-detection');
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
  var dropinWrapperId = '#braintree--dropin__' + this.model.componentID;

  this.paypalConfiguration = assign({}, paypalConfiguration);

  asyncDependencyTimeoutHandler = setTimeout(function () {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError('There was an error connecting to PayPal.')
    });
  }, ASYNC_DEPENDENCY_TIMEOUT);

  return btPaypal.create({client: this.client}).then(function (paypalInstance) {
    var checkoutJSConfiguration;
    var buttonSelector = '[data-braintree-id="paypal-button"]';
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';
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
        // NEXT_MAJOR_VERSION change out this vaultPayPal property
        // to something more generic, such as vaultOnTokenization so
        // all the vault objects can have the same shape (instead
        // of being specific to PayPal accounts here)
        var shouldNotVault = self.paypalConfiguration.vault && self.paypalConfiguration.vault.vaultPayPal === false;

        if (shouldNotVault) {
          data.vault = false;
        }

        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          if (!shouldNotVault && self.paypalConfiguration.flow === 'vault' && !self.model.isGuestCheckout) {
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

    buttonSelector = dropinWrapperId + ' ' + buttonSelector;

    return global.paypal.Button.render(checkoutJSConfiguration, buttonSelector).then(function () {
      self.model.asyncDependencyReady(paypalType);
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
  if (READ_ONLY_CONFIGURATION_OPTIONS.indexOf(key) === -1) {
    this.paypalConfiguration[key] = value;
  }
};

BasePayPalView.isEnabled = function (options) {
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;
  var merchantPayPalConfig = options.merchantConfiguration.paypal || options.merchantConfiguration.paypalCredit;

  if (!gatewayConfiguration.paypalEnabled) {
    return Promise.resolve(false);
  }

  if (browserDetection.isIe9() || browserDetection.isIe10()) {
    analytics.sendEvent(options.client, options.viewID + '.checkout.js-browser-not-supported');

    return Promise.resolve(false);
  }

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
