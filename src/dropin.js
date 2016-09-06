'use strict';

var MainView = require('./views/main-view');
var uuid = require('./lib/uuid');
var VERSION = require('package.version');
var mainHTML = require('./html/main.html');
var constants = require('./constants');

function Dropin(options) {
  this._componentId = uuid();
  this._options = options;
  this._dropinWrapper = document.createElement('div');
  this._dropinWrapper.id = 'braintree--dropin__' + this._componentId;
}

Dropin.prototype.initialize = function (callback) {
  var container, authorizationFingerprint, mainViewOptions;
  var dropinInstance = this; // eslint-disable-line consistent-this
  var hasCustomerId = false;

  this.injectStylesheet();

  if (!this._options.selector) {
    callback(new Error('options.selector is required.'));
    return;
  }

  container = document.querySelector(this._options.selector);

  if (!container) {
    callback(new Error('options.selector must reference a valid DOM node.'));
    return;
  } else if (container.innerHTML.trim()) {
    callback(new Error('options.selector must reference an empty DOM node.'));
    return;
  }

  this._dropinWrapper.innerHTML = mainHTML;
  container.appendChild(this._dropinWrapper);

  if (!isTokenizationKey(this._options.authorization)) {
    authorizationFingerprint = JSON.parse(atob(this._options.authorization)).authorizationFingerprint;
    hasCustomerId = authorizationFingerprint && authorizationFingerprint.indexOf('customer_id=') !== -1;
  }

  mainViewOptions = {
    callback: function () {
      callback(null, dropinInstance);
    },
    componentId: this._componentId,
    dropinWrapper: this._dropinWrapper,
    existingPaymentMethods: [],
    options: this._options
  };

  if (hasCustomerId) {
    this._options.client.request({
      endpoint: 'payment_methods',
      method: 'get',
      data: {
        defaultFirst: 1
      }
    }, function (err, paymentMethodsPayload) {
      if (!err) {
        mainViewOptions.existingPaymentMethods = paymentMethodsPayload.paymentMethods.map(formatPaymentMethodPayload);
      }
      this.mainView = new MainView(mainViewOptions);
    }.bind(this));
  } else {
    this.mainView = new MainView(mainViewOptions);
  }
};

Dropin.prototype.removeStylesheet = function () {
  var stylesheet = document.getElementById(constants.STYLESHEET_ID);

  if (stylesheet) {
    stylesheet.parentNode.removeChild(stylesheet);
  }
};

Dropin.prototype.injectStylesheet = function () {
  var stylesheet, stylesheetUrl, head, assetsUrl;

  if (document.getElementById(constants.STYLESHEET_ID)) { return; }

  assetsUrl = this._options.client.getConfiguration().gatewayConfiguration.assetsUrl;
  stylesheetUrl = assetsUrl + '/web/' + VERSION + '/css/dropin@DOT_MIN.css';
  stylesheet = document.createElement('link');
  head = document.head;

  stylesheet.setAttribute('rel', 'stylesheet');
  stylesheet.setAttribute('type', 'text/css');
  stylesheet.setAttribute('href', stylesheetUrl);

  if (head.firstChild) {
    head.insertBefore(stylesheet, head.firstChild);
  } else {
    head.appendChild(stylesheet);
  }
};

Dropin.prototype.requestPaymentMethod = function (callback) {
  this.mainView.requestPaymentMethod(callback);
};

Dropin.prototype.teardown = function (callback) {
  this.removeStylesheet();

  this.mainView.teardown(function (err) {
    this._dropinWrapper.parentNode.removeChild(this._dropinWrapper);
    callback(err);
  }.bind(this));
};

function formatPaymentMethodPayload(paymentMethod) {
  var formattedPaymentMethod = {
    nonce: paymentMethod.nonce,
    details: paymentMethod.details,
    type: paymentMethod.type
  };

  if (paymentMethod.type === 'CreditCard') {
    formattedPaymentMethod.description = paymentMethod.description;
  }

  return formattedPaymentMethod;
}

function isTokenizationKey(str) {
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9_]+$/.test(str);
}

module.exports = Dropin;
