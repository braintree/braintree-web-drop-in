'use strict';

var assign = require('./lib/assign').assign;
var analytics = require('./lib/analytics');
var constants = require('./constants');
var DropinError = require('./lib/dropin-error');
var DropinModel = require('./dropin-model');
var EventEmitter = require('./lib/event-emitter');
var isGuestCheckout = require('./lib/is-guest-checkout');
var fs = require('fs');
var MainView = require('./views/main-view');
var paymentOptionIDs = constants.paymentOptionIDs;
var translations = require('./translations');
var uuid = require('./lib/uuid');

var mainHTML = fs.readFileSync(__dirname + '/html/main.html', 'utf8');
var svgHTML = fs.readFileSync(__dirname + '/html/svgs.html', 'utf8');

var DEFAULT_CHECKOUTJS_LOG_LEVEL = 'warn';
var VERSION = process.env.npm_package_version;

// TODO current PayPal version helper

/**
 * @typedef {object} Dropin~cardPaymentMethodPayload
 * @property {string} nonce The payment method nonce.
 * @property {object} details Additional account details.
 * @property {string} details.cardType Type of card, ex: Visa, MasterCard.
 * @property {string} details.lastTwo Last two digits of card number.
 * @property {string} description A human-readable description.
 * @property {string} type The payment method type, always `CreditCard` when the method requested is a card.
 */

// TODO update PayPal details to be a link to the version of paypal-checkout used in this version
/**
 * @typedef {object} Dropin~paypalPaymentMethodPayload
 * @property {string} nonce The payment method nonce.
 * @property {object} details Additional PayPal account details. See a full list of details in the [PayPal client reference](http://braintree.github.io/braintree-web/current/PayPalCheckout.html#~tokenizePayload).
 * @property {string} type The payment method type, always `PayPalAccount` when the method requested is a PayPal account.
 */

/**
 * @name Dropin#on
 * @function
 * @param {string} event The name of the event to which you are subscribing.
 * @param {function} handler A callback to handle the event.
 * @description Subscribes a handler function to a named event. `event` should be {@link HostedFields#event:paymentMethodRequestable|paymentMethodRequestable} or {@link HostedFields#event:noPaymentMethodRequestable|noPaymentMethodRequestable}.
 * @returns {void}
 * @example
 * <caption>Dynamically enable or disable your submit button based on whether or not the payment method is requestable</caption>
 * var submitButton = document.querySelector('#submit-button');
 *
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   selector: '#dropin-container'
 * }, function (err, dropinInstance) {
 *   submitButton.addEventListener('click', function () {
 *     dropinInstance.requestPaymentMethod(function (err, payload) {
 *       // Send payload.nonce to your server.
 *     });
 *   });
 *
 *   if (dropinInstance.isPaymentMethodRequestable()) {
 *     // This will be true if you generated the client token
 *     // with a customer ID and there is a saved payment method
 *     // available to tokenize with that customer.
 *     submitButton.removeAttribute('disabled');
 *   }
 *
 *   dropinInstance.on('paymentMethodRequestable', function (event) {
 *     console.log(event.type); // The type of Payment Method, e.g 'CreditCard', 'PayPalAccount'.
 *
 *     submitButton.removeAttribute('disabled');
 *   });
 *
 *   dropinInstance.on('noPaymentMethodRequestable', function () {
 *     submitButton.setAttribute('disabled', true);
 *   });
 * });
 */

/**
 * This event is emitted when the payment method available in Drop-in changes. This includes when the state of Drop-in transitions from having no payment method available to having a payment method available and when the payment method available changes. This event is not fired if there is no payment method available on initialization. To check if there is a payment method requestable on initialization, use {@link Dropin#isPaymentMethodRequestable|isPaymentMethodRequestable}.
 * @event Dropin#paymentMethodRequestable
 * @type {Dropin~paymentMethodRequestablePayload}
 */

/**
 * @typedef {object} Dropin~paymentMethodRequestablePayload
 * @description The event payload sent from {@link Dropin#on|on} with the {@link Dropin#event:paymentMethodRequestable|paymentMethodRequestable} event.
 * @property {string} type The type of payment method that is requestable. Either `CreditCard` or `PayPalAccount`.
 */

/**
 * This event is emitted when there is no payment method available in Drop-in. This event is not fired if there is no payment method available on initialization. To check if there is a payment method requestable on initialization, use {@link Dropin#isPaymentMethodRequestable|isPaymentMethodRequestable}. No payload is available in the callback for this event.
 * @event Dropin#noPaymentMethodRequestable
 */

/**
 * @class
 * @param {object} options For create options, see {@link module:braintree-web-drop-in|dropin.create}.
 * @description <strong>Do not use this constructor directly. Use {@link module:braintree-web-drop-in|dropin.create} instead.</strong>
 * @classdesc This class represents a Drop-in component, that will create a pre-made UI for accepting cards and PayPal on your page. Instances of this class have methods for requesting a payment method and subscribing to events. For more information, see the [Drop-in guide](https://developers.braintreepayments.com/guides/drop-in/javascript/v3) in the Braintree Developer Docs. To be used in conjunction with the [Braintree Server SDKs](https://developers.braintreepayments.com/start/hello-server/).
 */
function Dropin(options) {
  this._client = options.client;
  this._componentID = uuid();
  this._dropinWrapper = document.createElement('div');
  this._dropinWrapper.id = 'braintree--dropin__' + this._componentID;
  this._dropinWrapper.setAttribute('data-braintree-id', 'wrapper');
  this._dropinWrapper.style.display = 'none';
  this._dropinWrapper.className = 'braintree-loading';
  this._merchantConfiguration = options.merchantConfiguration;

  EventEmitter.call(this);
}

Dropin.prototype = Object.create(EventEmitter.prototype, {
  constructor: Dropin
});

Dropin.prototype._initialize = function (callback) {
  var container, localizedStrings, localizedHTML, strings;
  var dropinInstance = this; // eslint-disable-line consistent-this

  this._injectStylesheet();

  if (!this._merchantConfiguration.selector) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('options.selector is required.'));
    return;
  }

  container = document.querySelector(this._merchantConfiguration.selector);

  if (!container) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('options.selector must reference a valid DOM node.'));
    return;
  } else if (container.innerHTML.trim()) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('options.selector must reference an empty DOM node.'));
    return;
  }

  // Backfill with `en`
  strings = assign({}, translations.en);
  if (this._merchantConfiguration.locale) {
    localizedStrings = translations[this._merchantConfiguration.locale] || translations[this._merchantConfiguration.locale.split('_')[0]];
    // Fill `strings` with `localizedStrings` that may exist
    strings = assign(strings, localizedStrings);
  }

  localizedHTML = Object.keys(strings).reduce(function (result, stringKey) {
    var stringValue = strings[stringKey];

    return result.replace(RegExp('{{' + stringKey + '}}', 'g'), stringValue);
  }, mainHTML);

  this._dropinWrapper.innerHTML = svgHTML + localizedHTML;
  container.appendChild(this._dropinWrapper);

  this._getVaultedPaymentMethods(function (paymentMethods) {
    var paypalRequired;

    try {
      this._model = new DropinModel({
        client: this._client,
        componentID: this._componentID,
        merchantConfiguration: this._merchantConfiguration,
        paymentMethods: paymentMethods
      });
    } catch (modelError) {
      dropinInstance.teardown(function () {
        callback(modelError);
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
        callback(new DropinError('All payment options failed to load.'));
      }
    }.bind(this));

    this._model.on('paymentMethodRequestable', function (event) {
      this._emit('paymentMethodRequestable', event);
    }.bind(this));

    this._model.on('noPaymentMethodRequestable', function () {
      this._emit('noPaymentMethodRequestable');
    }.bind(this));

    function createMainView() {
      dropinInstance._mainView = new MainView({
        client: dropinInstance._client,
        element: dropinInstance._dropinWrapper,
        model: dropinInstance._model,
        strings: strings
      });
    }

    paypalRequired = this._supportsPaymentOption(paymentOptionIDs.paypal) || this._supportsPaymentOption(paymentOptionIDs.paypalCredit);

    if (paypalRequired) {
      this._loadPayPalScript(createMainView);
    } else {
      createMainView();
    }
  }.bind(this));
};

Dropin.prototype._supportsPaymentOption = function (paymentOption) {
  return this._model.supportedPaymentOptions.indexOf(paymentOption) !== -1;
};

Dropin.prototype._loadPayPalScript = function (callback) {
  var script = document.createElement('script');

  script.src = constants.CHECKOUT_JS_SOURCE;
  script.async = true;
  script.addEventListener('load', callback);
  script.setAttribute('data-log-level', this._merchantConfiguration.paypal.logLevel || DEFAULT_CHECKOUTJS_LOG_LEVEL);
  this._dropinWrapper.appendChild(script);
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

/**
 * Requests a payment method object, that includes the payment method nonce used by by the [Braintree Server SDKs](https://developers.braintreepayments.com/start/hello-server/). The structure of this object varies by type: a {@link Dropin~cardPaymentMethodPayload|cardPaymentMethodPayload} is returned when the payment method is a card, a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload} is returned when the payment method is a PayPal account. If a payment method is not available, an error will appear in the UI and and error will be returned in the callback.
 * @public
 * @param {callback} callback The first argument will be an error if no payment method is available and will otherwise be null. The second argument will be an object containing a payment method nonce; either a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload} or a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload}.
 * @returns {void}
 */
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
  stylesheet.setAttribute('id', constants.STYLESHEET_ID);

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

/**
 * Cleanly remove anything set up by {@link module:braintree-web-drop-in|dropin.create}. This maybe be useful in a single-page app.
 * @public
 * @param {callback} [callback] Called on completion, containing an error if one occurred. No data is returned if teardown completes successfully.
 * @returns {void}
 */
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

/**
 * Returns a boolean indicating if a payment method is available through {@link Dropin#requestPaymentMethod|requestPaymentMethod}. Particularly useful for detecting if using a client token with a customer ID to show vaulted payment methods.
 * @public
 * @returns {Boolean} True if a payment method is available, otherwise false.
 */
Dropin.prototype.isPaymentMethodRequestable = function () {
  return this._model.isPaymentMethodRequestable();
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
