'use strict';

var assign = require('./lib/assign').assign;
var MainView = require('./views/main-view');
var constants = require('./constants');
var DropinModel = require('./dropin-model');
var EventEmitter = require('./lib/event-emitter');
var isGuestCheckout = require('./lib/is-guest-checkout');
var mainHTML = require('./html/main.html');
var translations = require('./translations');
var svgHTML = require('./html/svgs.html');
var uuid = require('./lib/uuid');
var VERSION = require('package.version');

function Dropin(options) {
  this._componentId = uuid();
  this._options = options;
  this._dropinWrapper = document.createElement('div');
  this._dropinWrapper.id = 'braintree--dropin__' + this._componentId;
  this._dropinWrapper.setAttribute('data-braintree-id', 'wrapper');
  this._dropinWrapper.style.display = 'none';

  EventEmitter.call(this);
}

Dropin.prototype = Object.create(EventEmitter.prototype, {
  constructor: Dropin
});

Dropin.prototype.initialize = function (callback) {
  var container, strings, localizedStrings, localizedHTML;
  var dropinInstance = this; // eslint-disable-line consistent-this

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

  strings = assign({}, translations.en);
  if (this._options.language) {
    localizedStrings = translations[this._options.language] || translations[this._options.language.split('_')[0]];
    strings = assign(strings, localizedStrings);
  }

  localizedHTML = Object.keys(strings).reduce(function (result, stringKey) {
    var stringValue = strings[stringKey];

    return result.replace(RegExp('{{' + stringKey + '}}', 'g'), stringValue);
  }, mainHTML);

  this._dropinWrapper.innerHTML = svgHTML + localizedHTML;
  container.appendChild(this._dropinWrapper);

  this.getVaultedPaymentMethods(function (paymentMethods) {
    var mainViewOptions;

    this._model = new DropinModel({paymentMethods: paymentMethods});

    this._model.on('asyncDependenciesReady', function () {
      callback(null, dropinInstance);
    });

    this._model.on('changeActivePaymentMethod', function (paymentMethod) {
      this._emit('paymentMethodAvailable', paymentMethod);
    }.bind(this));

    mainViewOptions = {
      componentId: this._componentId,
      dropinWrapper: this._dropinWrapper,
      model: this._model,
      options: this._options,
      strings: strings
    };

    this.mainView = new MainView(mainViewOptions);
  }.bind(this));
};

Dropin.prototype.getActivePaymentMethod = function () {
  return this._model.getActivePaymentMethod();
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

Dropin.prototype.getVaultedPaymentMethods = function (callback) {
  if (isGuestCheckout(this._options.authorization)) {
    callback();
  } else {
    this._options.client.request({
      endpoint: 'payment_methods',
      method: 'get',
      data: {
        defaultFirst: 1
      }
    }, function (err, paymentMethodsPayload) {
      var paymentMethods;

      if (!err) {
        paymentMethods = paymentMethodsPayload.paymentMethods.map(formatPaymentMethodPayload);
      }
      callback(paymentMethods);
    });
  }
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

module.exports = Dropin;
