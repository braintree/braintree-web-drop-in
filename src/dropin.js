'use strict';

var assign = require('./lib/assign').assign;
var analytics = require('./lib/analytics');
var MainView = require('./views/main-view');
var constants = require('./constants');
var DropinModel = require('./dropin-model');
var EventEmitter = require('./lib/event-emitter');
var isGuestCheckout = require('./lib/is-guest-checkout');
var fs = require('fs');
var translations = require('./translations');
var uuid = require('./lib/uuid');

var mainHTML = fs.readFileSync(__dirname + '/html/main.html', 'utf8');
var svgHTML = fs.readFileSync(__dirname + '/html/svgs.html', 'utf8');

var VERSION = process.env.npm_package_version;

function Dropin(options) {
  this._client = options.client;
  this._componentID = uuid();
  this._dropinWrapper = document.createElement('div');
  this._dropinWrapper.id = 'braintree--dropin__' + this._componentID;
  this._dropinWrapper.setAttribute('data-braintree-id', 'wrapper');
  this._dropinWrapper.style.display = 'none';
  this._merchantConfiguration = options.merchantConfiguration;

  EventEmitter.call(this);
}

Dropin.prototype = Object.create(EventEmitter.prototype, {
  constructor: Dropin
});

Dropin.prototype._initialize = function (callback) {
  var container, strings, localizedStrings, localizedHTML;
  var dropinInstance = this; // eslint-disable-line consistent-this

  this._injectStylesheet();

  if (!this._merchantConfiguration.selector) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new Error('options.selector is required.'));
    return;
  }

  container = document.querySelector(this._merchantConfiguration.selector);

  if (!container) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new Error('options.selector must reference a valid DOM node.'));
    return;
  } else if (container.innerHTML.trim()) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new Error('options.selector must reference an empty DOM node.'));
    return;
  }

  strings = assign({}, translations.en);
  if (this._merchantConfiguration.locale) {
    localizedStrings = translations[this._merchantConfiguration.locale] || translations[this._merchantConfiguration.locale.split('_')[0]];
    strings = assign(strings, localizedStrings);
  }

  localizedHTML = Object.keys(strings).reduce(function (result, stringKey) {
    var stringValue = strings[stringKey];

    return result.replace(RegExp('{{' + stringKey + '}}', 'g'), stringValue);
  }, mainHTML);

  this._dropinWrapper.innerHTML = svgHTML + localizedHTML;
  container.appendChild(this._dropinWrapper);

  this._getVaultedPaymentMethods(function (paymentMethods) {
    try {
      this._model = new DropinModel({
        client: this._client,
        componentID: this._componentID,
        merchantConfiguration: this._merchantConfiguration,
        paymentMethods: paymentMethods
      });
    } catch (err) {
      dropinInstance.teardown(function (teardownErr) {
        callback(teardownErr || err);
      });
      return;
    }

    this._model.on('asyncDependenciesReady', function () {
      if (this._model.dependencySuccessCount >= 1) {
        analytics.sendEvent(this._client, 'appeared');
        this._disableErroredPaymentMethods();
        callback(null, dropinInstance);
      } else {
        analytics.sendEvent(this._client, 'load-error');
        this._dropinWrapper.innerHTML = '';
        callback(new Error('All payment options failed to load.'));
      }
    }.bind(this));

    this._mainView = new MainView({
      client: this._client,
      element: this._dropinWrapper,
      model: this._model,
      strings: strings
    });
  }.bind(this));
};

Dropin.prototype._disableErroredPaymentMethods = function () {
  var paymentMethodOptionsElements;
  var failedDependencies = Object.keys(this._model.failedDependencies);

  if (failedDependencies.length === 0) {
    return;
  }

  paymentMethodOptionsElements = this._mainView.getOptionsElements();

  failedDependencies.forEach(function (paymentMethodId) {
    var element = paymentMethodOptionsElements[paymentMethodId];
    var div = element.div;
    var clickHandler = element.clickHandler;
    var error = this._model.failedDependencies[paymentMethodId].message;

    div.classList.add('braintree-disabled');
    div.removeEventListener('click', clickHandler);
    div.querySelector('.braintree-option__disabled-message').textContent = error;
  }.bind(this));
};

Dropin.prototype.requestPaymentMethod = function (callback) {
  this._mainView.requestPaymentMethod(callback);
};

Dropin.prototype._removeStylesheet = function () {
  var stylesheet = document.getElementById(constants.STYLESHEET_ID);

  if (stylesheet) {
    stylesheet.parentNode.removeChild(stylesheet);
  }
};

Dropin.prototype._injectStylesheet = function () {
  var stylesheet, stylesheetUrl, head, assetsUrl;

  if (document.getElementById(constants.STYLESHEET_ID)) { return; }

  assetsUrl = this._client.getConfiguration().gatewayConfiguration.assetsUrl;
  stylesheetUrl = assetsUrl + '/web/dropin/' + VERSION + '/css/dropin@DOT_MIN.css';
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

Dropin.prototype._getVaultedPaymentMethods = function (callback) {
  if (isGuestCheckout(this._client)) {
    callback([]);
  } else {
    this._client.request({
      endpoint: 'payment_methods',
      method: 'get',
      data: {
        defaultFirst: 1
      }
    }, function (err, paymentMethodsPayload) {
      var paymentMethods;

      if (err) {
        paymentMethods = [];
      } else {
        paymentMethods = paymentMethodsPayload.paymentMethods.map(formatPaymentMethodPayload);
      }

      callback(paymentMethods);
    });
  }
};

Dropin.prototype.teardown = function (callback) {
  this._removeStylesheet();

  if (this._mainView) {
    this._mainView.teardown(function (err) {
      this._removeDropinWrapper(err, callback);
    }.bind(this));
  } else {
    this._removeDropinWrapper(null, callback);
  }
};

Dropin.prototype._removeDropinWrapper = function (err, callback) {
  this._dropinWrapper.parentNode.removeChild(this._dropinWrapper);
  callback(err);
};

function formatPaymentMethodPayload(paymentMethod) {
  var formattedPaymentMethod = {
    nonce: paymentMethod.nonce,
    details: paymentMethod.details,
    type: paymentMethod.type
  };

  if (paymentMethod.type === constants.paymentMethodTypes.card) {
    formattedPaymentMethod.description = paymentMethod.description;
  }

  return formattedPaymentMethod;
}

module.exports = Dropin;
