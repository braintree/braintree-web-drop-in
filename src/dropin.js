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
  this._merchantConfiguration = assign({}, options.merchantConfiguration);

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
    analytics.sendEvent(this.client, 'configuration-error');
    callback(new Error('options.selector is required.'));
    return;
  }

  container = document.querySelector(this._merchantConfiguration.selector);

  if (!container) {
    analytics.sendEvent(this.client, 'configuration-error');
    callback(new Error('options.selector must reference a valid DOM node.'));
    return;
  } else if (container.innerHTML.trim()) {
    analytics.sendEvent(this.client, 'configuration-error');
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
    this._model = new DropinModel({
      client: this._client,
      componentID: this._componentID,
      merchantConfiguration: this._merchantConfiguration,
      paymentMethods: paymentMethods
    });

    this._model.on('asyncDependenciesReady', function () {
      analytics.sendEvent(this._client, 'appeared');
      callback(null, dropinInstance);
    }.bind(this));

    this._mainView = new MainView({
      client: this._client,
      element: this._dropinWrapper,
      model: this._model,
      strings: strings
    });
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

Dropin.prototype.setPayPalOption = function (option, value) {
  if (!this._merchantConfiguration.paypal) {
    throw new Error('PayPal not enabled.');
  }
  if (value == null) {
    delete this._merchantConfiguration.paypal[option];
  } else {
    this._merchantConfiguration.paypal[option] = value;
  }
};

Dropin.prototype.teardown = function (callback) {
  this._removeStylesheet();

  this._mainView.teardown(function (err) {
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

  if (paymentMethod.type === constants.paymentMethodTypes.card) {
    formattedPaymentMethod.description = paymentMethod.description;
  }

  return formattedPaymentMethod;
}

module.exports = Dropin;
