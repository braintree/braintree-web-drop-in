'use strict';

var assign = require('./lib/assign').assign;
var analytics = require('./lib/analytics');
var classList = require('@braintree/class-list');
var constants = require('./constants');
var DropinError = require('./lib/dropin-error');
var DropinModel = require('./dropin-model');
var EventEmitter = require('@braintree/event-emitter');
var assets = require('@braintree/asset-loader');
var fs = require('fs');
var MainView = require('./views/main-view');
var paymentMethodsViewID = require('./views/payment-methods-view').ID;
var paymentOptionsViewID = require('./views/payment-options-view').ID;
var paymentOptionIDs = constants.paymentOptionIDs;
var translations = require('./translations').translations;
var isUtf8 = require('./lib/is-utf-8');
var uuid = require('@braintree/uuid');
var Promise = require('./lib/promise');
var sanitizeHtml = require('./lib/sanitize-html');
var DataCollector = require('./lib/data-collector');
var ThreeDSecure = require('./lib/three-d-secure');
var wrapPrototype = require('@braintree/wrap-promise').wrapPrototype;

var mainHTML = fs.readFileSync(__dirname + '/html/main.html', 'utf8');
var svgHTML = fs.readFileSync(__dirname + '/html/svgs.html', 'utf8');

var PASS_THROUGH_EVENTS = [
  'paymentMethodRequestable',
  'noPaymentMethodRequestable',
  'paymentOptionSelected',

  // Card View Events
  'card:binAvailable',
  'card:blur',
  'card:cardTypeChange',
  'card:empty',
  'card:focus',
  'card:inputSubmitRequest',
  'card:notEmpty',
  'card:validityChange'
];
var UPDATABLE_CONFIGURATION_OPTIONS = [
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit,
  paymentOptionIDs.applePay,
  paymentOptionIDs.googlePay,
  'threeDSecure'
];
var UPDATABLE_CONFIGURATION_OPTIONS_THAT_REQUIRE_UNVAULTED_PAYMENT_METHODS_TO_BE_REMOVED = [
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit,
  paymentOptionIDs.applePay,
  paymentOptionIDs.googlePay
];
var HAS_RAW_PAYMENT_DATA = {};
var VERSION = '__VERSION__';

HAS_RAW_PAYMENT_DATA[constants.paymentMethodTypes.googlePay] = true;
HAS_RAW_PAYMENT_DATA[constants.paymentMethodTypes.applePay] = true;

/**
 * @typedef {object} Dropin~cardPaymentMethodPayload
 * @property {string} nonce The payment method nonce, used by your server to charge the card.
 * @property {object} details Additional account details. See a full list of details in the [Hosted Fields client reference](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#~tokenizePayload).
 * @property {string} description A human-readable description.
 * @property {string} type The payment method type, always `CreditCard` when the method requested is a card.
 * @property {object} binData Information about the card based on the bin. Documented {@link Dropin~binData|here}.
 * @property {?string} deviceData If data collector is configured, the device data property to be used when making a transaction.
 * @property {?boolean} liabilityShifted If 3D Secure is configured, whether or not liability did shift.
 * @property {?boolean} liabilityShiftPossible If 3D Secure is configured, whether or not liability shift is possible.
 * @property {?object} threeDSecureInfo If 3D Secure is configured, the `threeDSecureInfo` documented in the [Three D Secure client reference](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/ThreeDSecure.html#~verifyPayload)
 */

/**
 * @typedef {object} Dropin~paypalPaymentMethodPayload
 * @property {string} nonce The payment method nonce, used by your server to charge the PayPal account.
 * @property {object} details Additional PayPal account details. See a full list of details in the [PayPal client reference](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#~tokenizePayload).
 * @property {string} type The payment method type, always `PayPalAccount` when the method requested is a PayPal account.
 * @property {?string} deviceData If data collector is configured, the device data property to be used when making a transaction.
 */

/**
 * @typedef {object} Dropin~applePayPaymentMethodPayload
 * @property {string} nonce The payment method nonce, used by your server to charge the Apple Pay provided card.
 * @property {string} details.cardType Type of card, ex: Visa, Mastercard.
 * @property {string} details.cardHolderName The name of the card holder.
 * @property {string} details.dpanLastTwo Last two digits of card number.
 * @property {external:ApplePayPayment} details.rawPaymentData The raw response back from the Apple Pay flow, which includes billing/shipping address, phone and email if passed in as required parameters.
 * @property {string} description A human-readable description.
 * @property {string} type The payment method type, always `ApplePayCard` when the method requested is an Apple Pay provided card.
 * @property {object} binData Information about the card based on the bin. Documented {@link Dropin~binData|here}.
 * @property {?string} deviceData If data collector is configured, the device data property to be used when making a transaction.
 */

/**
 * @typedef {object} ApplePayPayment An [Apple Pay Payment object](https://developer.apple.com/documentation/apple_pay_on_the_web/applepaypayment).
 * @external ApplePayPayment
 * @see {@link https://developer.apple.com/documentation/apple_pay_on_the_web/applepaypayment ApplePayPayment}
 */

/**
 * @typedef {object} Dropin~venmoPaymentMethodPayload
 * @property {string} nonce The payment method nonce, used by your server to charge the Venmo account.
 * @property {string} details.username The Venmo username.
 * @property {string} type The payment method type, always `VenmoAccount` when the method requested is a Venmo account.
 * @property {?string} deviceData If data collector is configured, the device data property to be used when making a transaction.
 */

/**
 * @typedef {object} Dropin~googlePayPaymentMethodPayload
 * @property {string} nonce The payment method nonce, used by your server to charge the Google Pay card.
 * @property {string} details.cardType Type of card, ex: Visa, Mastercard.
 * @property {string} details.lastFour The last 4 digits of the card.
 * @property {string} details.lastTwo The last 2 digits of the card.
 * @property {boolean} details.isNetworkTokenized True if the card is network tokenized. A network tokenized card is a generated virtual card with a device-specific account number (DPAN) that is used in place of the underlying source card.
 * @property {string} details.bin First six digits of card number.
 * @property {external:GooglePayPaymentData} details.rawPaymentData The raw response back from the Google Pay flow, which includes shipping address, phone and email if passed in as required parameters.
 * @property {string} type The payment method type, always `AndroidPayCard` when the method requested is a Google Pay Card.
 * @property {object} binData Information about the card based on the bin. Documented {@link Dropin~binData|here}.
 * @property {?string} deviceData If data collector is configured, the device data property to be used when making a transaction.
 */

/**
 * @typedef {object} GooglePayPaymentData A [Google Pay Payment Data object](https://developers.google.com/pay/api/web/object-reference#PaymentData).
 * @external GooglePayPaymentData
 * @see {@link https://developers.google.com/pay/api/web/object-reference#PaymentData PaymentData}
 */

/**
 * @typedef {object} Dropin~binData Information about the card based on the bin.
 * @property {string} commercial Possible values: 'Yes', 'No', 'Unknown'.
 * @property {string} countryOfIssuance The country of issuance.
 * @property {string} debit Possible values: 'Yes', 'No', 'Unknown'.
 * @property {string} durbinRegulated Possible values: 'Yes', 'No', 'Unknown'.
 * @property {string} healthcare Possible values: 'Yes', 'No', 'Unknown'.
 * @property {string} issuingBank The issuing bank.
 * @property {string} payroll Possible values: 'Yes', 'No', 'Unknown'.
 * @property {string} prepaid Possible values: 'Yes', 'No', 'Unknown'.
 * @property {string} productId The product id.
 */

/**
 * @name Dropin#on
 * @function
 * @param {string} event The name of the event to which you are subscribing.
 * @param {function} handler A callback to handle the event.
 * @description Subscribes a handler function to a named event. `event` should be one of the following:
 *
 *  * [`paymentMethodRequestable`](#event:paymentMethodRequestable)
 *  * [`noPaymentMethodRequestable`](#event:noPaymentMethodRequestable)
 *  * [`paymentOptionSelected`](#event:paymentOptionSelected)
 *
 *  _Card View Specific Events_
 *  * [`card:binAvailable`](#event:card:binAvailable)
 *  * [`card:blur`](#event:card:blur)
 *  * [`card:cardTypeChange`](#event:card:cardTypeChange)
 *  * [`card:empty`](#event:card:empty)
 *  * [`card:focus`](#event:card:focus)
 *  * [`card:inputSubmitRequest`](#event:card:inputSubmitRequest)
 *  * [`card:notEmpty`](#event:card:notEmpty)
 *  * [`card:validityChange`](#event:card:validityChange)
 * @returns {void}
 * @example
 * <caption>Dynamically enable or disable your submit button based on whether or not the payment method is requestable</caption>
 * var submitButton = document.querySelector('#submit-button');
 *
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container'
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
 *     console.log(event.paymentMethodIsSelected); // true if a customer has selected a payment method when paymentMethodRequestable fires
 *
 *     submitButton.removeAttribute('disabled');
 *   });
 *
 *   dropinInstance.on('noPaymentMethodRequestable', function () {
 *     submitButton.setAttribute('disabled', true);
 *   });
 * });
 *
 * @example
 * <caption>Automatically submit nonce to server as soon as it becomes available</caption>
 * var submitButton = document.querySelector('#submit-button');
 *
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container'
 * }, function (err, dropinInstance) {
 *   function sendNonceToServer() {
 *     dropinInstance.requestPaymentMethod(function (err, payload) {
 *       if (err) {
 *         // handle errors
 *       }
 *
 *       // send payload.nonce to your server
 *     });
 *   }
 *
 *   // allows us to still request the payment method manually, such as
 *   // when filling out a credit card form
 *   submitButton.addEventListener('click', sendNonceToServer);
 *
 *   dropinInstance.on('paymentMethodRequestable', function (event) {
 *     // if the nonce is already available (via PayPal authentication
 *     // or by using a stored payment method), we can request the
 *     // nonce right away. Otherwise, we wait for the customer to
 *     // request the nonce by pressing the submit button once they
 *     // are finished entering their credit card details. This is
 *     // particularly important if your credit card form includes a
 *     // postal code input. The `paymentMethodRequestable` event
 *     // could fire before the customer has finished entering their
 *     // postal code. (International postal codes can be as few as 3
 *     // characters in length)
 *     if (event.paymentMethodIsSelected) {
 *       sendNonceToServer();
 *     }
 *   });
 * });
 * @example
 * <caption>Listen on various events from the card view</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container'
 * }, function (err, dropinInstance) {
 *   dropinInstance.on('card:focus', function (event) {
 *     // a card field was focussed
 *   });
 *   dropinInstance.on('card:blur', function (event) {
 *     // a card field was blurred
 *   });
 *   dropinInstance.on('card:validityChange', function (event) {
 *     // the card form went from invalid to valid or valid to invalid
 *   });
 * });
 */

/**
 * @name Dropin#off
 * @function
 * @param {string} event The name of the event to which you are unsubscribing.
 * @param {function} handler A callback to unsubscribe from the event.
 * @description Unsubscribes a handler function to a named event.
 * @returns {void}
 * @example
 * <caption>Subscribe and then unsubscribe from event</caption>
 * var callback = function (event) {
 *   // do something
 * };
 * dropinInstance.on('paymentMethodRequestable', callback);
 *
 * // later on
 * dropinInstance.off('paymentMethodRequestable', callback);
 */

/**
 * This event is emitted when the payment method available in Drop-in changes. This includes when the state of Drop-in transitions from having no payment method available to having a payment method available and when the kind of payment method available changes. This event is not fired if there is no payment method available on initialization. To check if there is a payment method requestable on initialization, use {@link Dropin#isPaymentMethodRequestable|`isPaymentMethodRequestable`}.
 * @event Dropin#paymentMethodRequestable
 * @type {Dropin~paymentMethodRequestablePayload}
 */

/**
 * @typedef {object} Dropin~paymentMethodRequestablePayload
 * @description The event payload sent from {@link Dropin#on|`on`} with the {@link Dropin#event:paymentMethodRequestable|`paymentMethodRequestable`} event.
 * @property {string} type The type of payment method that is requestable. Either `CreditCard` or `PayPalAccount`.
 * @property {boolean} paymentMethodIsSelected A property to determine if a payment method is currently selected when the payment method becomes requestable.
 *
 * This will be `true` any time a payment method is visibly selected in the Drop-in UI, such as when PayPal authentication completes or a stored payment method is selected.
 *
 * This will be `false` when {@link Dropin#requestPaymentMethod|`requestPaymentMethod`} can be called, but a payment method is not currently selected. For instance, when a card form has been filled in with valid values, but has not been submitted to be converted into a payment method nonce.
 */

/**
 * This event is emitted when there is no payment method available in Drop-in. This event is not fired if there is no payment method available on initialization. To check if there is a payment method requestable on initialization, use {@link Dropin#isPaymentMethodRequestable|`isPaymentMethodRequestable`}. No payload is available in the callback for this event.
 * @event Dropin#noPaymentMethodRequestable
 */

/**
 * This event is emitted when the customer selects a new payment option type (e.g. PayPal, PayPal Credit, credit card). This event is not emitted when the user changes between existing saved payment methods. Only relevant when accepting multiple payment options.
 * @event Dropin#paymentOptionSelected
 * @type {Dropin~paymentOptionSelectedPayload}
 */

/**
 * The underlying [hosted fields `binAvailable` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:binAvailable).
 * @event Dropin#card:binAvailable
 * @type {Dropin~card:binAvailable}
 */

/**
 * The underlying [hosted fields `blur` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:blur).
 * @event Dropin#card:blur
 * @type {Dropin~card:blur}
 */

/**
 * The underlying [hosted fields `cardTypeChange` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:cardTypeChange).
 * @event Dropin#card:cardTypeChange
 * @type {Dropin~card:cardTypeChange}
 */

/**
 * The underlying [hosted fields `empty` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:empty).
 * @event Dropin#card:empty
 * @type {Dropin~card:empty}
 */

/**
 * The underlying [hosted fields `focus` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:focus).
 * @event Dropin#card:focus
 * @type {Dropin~card:focus}
 */

/**
 * The underlying [hosted fields `inputSubmitRequest` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:inputSubmitRequest).
 * @event Dropin#card:inputSubmitRequest
 * @type {Dropin~card:inputSubmitRequest}
 */

/**
 * The underlying [hosted fields `notEmpty` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:notEmpty).
 * @event Dropin#card:notEmpty
 * @type {Dropin~card:notEmpty}
 */

/**
 * The underlying [hosted fields `validityChange` event](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/HostedFields.html#event:validityChange).
 * @event Dropin#card:validityChange
 * @type {Dropin~card:validityChange}
 */

/**
 * @typedef {object} Dropin~paymentOptionSelectedPayload
 * @description The event payload sent from {@link Dropin#on|`on`} with the {@link Dropin#event:paymentOptionSelected|`paymentOptionSelected`} event.
 * @property {string} paymentOption The payment option view selected. Either `card`, `paypal`, or `paypalCredit`.
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

EventEmitter.createChild(Dropin);

Dropin.prototype._initialize = function (callback) {
  var localizedStrings, localizedHTML;
  var self = this;
  var container = self._merchantConfiguration.container || self._merchantConfiguration.selector;

  if (!container) {
    analytics.sendEvent(self._client, 'configuration-error');
    callback(new DropinError('options.container is required.'));

    return;
  } else if (self._merchantConfiguration.container && self._merchantConfiguration.selector) {
    analytics.sendEvent(self._client, 'configuration-error');
    callback(new DropinError('Must only have one options.selector or options.container.'));

    return;
  }

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }

  if (!container || container.nodeType !== 1) {
    analytics.sendEvent(self._client, 'configuration-error');
    callback(new DropinError('options.selector or options.container must reference a valid DOM node.'));

    return;
  }

  if (container.innerHTML.trim()) {
    analytics.sendEvent(self._client, 'configuration-error');
    callback(new DropinError('options.selector or options.container must reference an empty DOM node.'));

    return;
  }

  // Backfill with `en`
  self._strings = assign({}, translations.en);
  if (self._merchantConfiguration.locale) {
    localizedStrings = translations[self._merchantConfiguration.locale] || translations[self._merchantConfiguration.locale.split('_')[0]];
    // Fill `strings` with `localizedStrings` that may exist
    self._strings = assign(self._strings, localizedStrings);
  }

  if (!isUtf8()) {
    // non-utf-8 encodings often don't support the bullet character
    self._strings.endingIn = self._strings.endingIn.replace(/•/g, '*');
  }

  if (self._merchantConfiguration.translations) {
    Object.keys(self._merchantConfiguration.translations).forEach(function (key) {
      self._strings[key] = sanitizeHtml(self._merchantConfiguration.translations[key]);
    });
  }

  localizedHTML = Object.keys(self._strings).reduce(function (result, stringKey) {
    var stringValue = self._strings[stringKey];

    return result.replace(RegExp('{{' + stringKey + '}}', 'g'), stringValue);
  }, mainHTML);

  self._dropinWrapper.innerHTML = svgHTML + localizedHTML;
  container.appendChild(self._dropinWrapper);

  self._model = new DropinModel({
    client: self._client,
    container: container,
    componentID: self._componentID,
    merchantConfiguration: self._merchantConfiguration
  });

  self._injectStylesheet();

  self._model.initialize().then(function () {
    self._model.on('cancelInitialization', function (err) {
      self._dropinWrapper.innerHTML = '';
      analytics.sendEvent(self._client, 'load-error');
      callback(err);
    });

    self._model.on('asyncDependenciesReady', function () {
      if (self._model.dependencySuccessCount >= 1) {
        analytics.sendEvent(self._client, 'appeared');
        self._disableErroredPaymentMethods();

        self._handleAppSwitch();

        self._model.confirmDropinReady();

        callback(null, self);
      } else {
        self._model.cancelInitialization(new DropinError('All payment options failed to load.'));
      }
    });

    PASS_THROUGH_EVENTS.forEach(function (eventName) {
      self._model.on(eventName, function (event) {
        self._emit(eventName, event);
      });
    });

    return self._setUpDependenciesAndViews();
  }).catch(function (err) {
    self.teardown().then(function () {
      callback(err);
    });
  });
};

/**
 * Modify your configuration initially set in {@link module:braintree-web-drop-in|`dropin.create`}.
 *
 * If `updateConfiguration` is called after a user completes the PayPal authorization flow, any PayPal accounts not stored in the Vault record will be removed.
 * @public
 * @param {string} property The top-level property to update. Either `paypal`, `paypalCredit`, `applePay`, or `googlePay`.
 * @param {string} key The key of the property to update, such as `amount` or `currency`.
 * @param {any} value The value of the property to update. Must be the type of the property specified in {@link module:braintree-web-drop-in|`dropin.create`}.
 * @returns {void}
 * @example
 * dropinInstance.updateConfiguration('paypal', 'amount', '10.00');
 */
Dropin.prototype.updateConfiguration = function (property, key, value) {
  var view;

  if (UPDATABLE_CONFIGURATION_OPTIONS.indexOf(property) === -1) {
    return;
  }

  if (property === 'threeDSecure') {
    if (this._threeDSecure) {
      this._threeDSecure.updateConfiguration(key, value);
    }

    return;
  }

  view = this._mainView.getView(property);

  if (!view) {
    return;
  }

  view.updateConfiguration(key, value);

  if (UPDATABLE_CONFIGURATION_OPTIONS_THAT_REQUIRE_UNVAULTED_PAYMENT_METHODS_TO_BE_REMOVED.indexOf(property) === -1) {
    return;
  }

  this._removeUnvaultedPaymentMethods(function (paymentMethod) {
    return paymentMethod.type === constants.paymentMethodTypes[property];
  });
  this._navigateToInitialView();
};

/**
 * Get a list of the available payment methods presented to the user. This is useful for knowing if a paricular payment option was presented to a customer that is browser dependant such as Apple Pay, Google Pay and Venmo. Returns an array of strings. Possible values:
 * * `applePay`
 * * `card`
 * * `googlePay`
 * * `paypalCredit`
 * * `paypal`
 * * `venmo`
 *
 * @public
 * @returns {string[]} An array of possible payment options.
 * @example
 * var paymentOptions = dropinInstance.getAvailablePaymentOptions(); // ['card', 'venmo', 'paypal']
 *
 * if (paymentOptions.includes('venmo')) {
 *   // special logic for when venmo is displayed
 * }
 */
Dropin.prototype.getAvailablePaymentOptions = function () {
  return this._model.supportedPaymentOptions;
};

/**
 * Removes the currently selected payment method and returns the customer to the payment options view. Does not remove vaulted payment methods.
 * @public
 * @returns {void}
 * @example
 * dropinInstance.requestPaymentMethod(function (requestPaymentMethodError, payload) {
 *   if (requestPaymentMethodError) {
 *     // handle errors
 *     return;
 *   }
 *
 *   functionToSendNonceToServer(payload.nonce, function (transactionError, response) {
 *     if (transactionError) {
 *       // transaction sale with selected payment method failed
 *       // clear the selected payment method and add a message
 *       // to the checkout page about the failure
 *       dropinInstance.clearSelectedPaymentMethod();
 *       divForErrorMessages.textContent = 'my error message about entering a different payment method.';
 *     } else {
 *       // redirect to success page
 *     }
 *   });
 * });
 */
Dropin.prototype.clearSelectedPaymentMethod = function () {
  this._removeUnvaultedPaymentMethods();
  this._model.removeActivePaymentMethod();

  if (this._model.getPaymentMethods().length === 0) {
    this._navigateToInitialView();

    return;
  }

  this._mainView.showLoadingIndicator();

  this._model.refreshPaymentMethods().then(function () {
    this._navigateToInitialView();
    this._mainView.hideLoadingIndicator();
  }.bind(this));
};

Dropin.prototype._setUpDataCollector = function () {
  var self = this;
  var config = assign({}, self._merchantConfiguration.dataCollector, {client: self._client});

  this._model.asyncDependencyStarting();
  this._dataCollector = new DataCollector(config);

  this._dataCollector.initialize().then(function () {
    self._model.asyncDependencyReady();
  }).catch(function (err) {
    self._model.cancelInitialization(new DropinError({
      message: 'Data Collector failed to set up.',
      braintreeWebError: err
    }));
  });
};

Dropin.prototype._setUpThreeDSecure = function () {
  var self = this;
  var config = assign({}, this._merchantConfiguration.threeDSecure);

  this._model.asyncDependencyStarting();

  this._threeDSecure = new ThreeDSecure(this._client, config);

  this._threeDSecure.initialize().then(function () {
    self._model.asyncDependencyReady();
  }).catch(function (err) {
    self._model.cancelInitialization(new DropinError({
      message: '3D Secure failed to set up.',
      braintreeWebError: err
    }));
  });
};

Dropin.prototype._setUpDependenciesAndViews = function () {
  if (this._merchantConfiguration.dataCollector) {
    this._setUpDataCollector();
  }

  if (this._merchantConfiguration.threeDSecure) {
    this._setUpThreeDSecure();
  }

  this._mainView = new MainView({
    client: this._client,
    element: this._dropinWrapper,
    model: this._model,
    strings: this._strings
  });
};

Dropin.prototype._removeUnvaultedPaymentMethods = function (filter) {
  filter = filter || function () { return true; };

  this._model.getPaymentMethods().forEach(function (paymentMethod) {
    if (filter(paymentMethod) && !paymentMethod.vaulted) {
      this._model.removePaymentMethod(paymentMethod);
    }
  }.bind(this));
};

Dropin.prototype._navigateToInitialView = function () {
  var hasNoSavedPaymentMethods, hasOnlyOneSupportedPaymentOption;
  var isOnMethodsView = this._mainView.primaryView.ID === paymentMethodsViewID;

  if (isOnMethodsView) {
    hasNoSavedPaymentMethods = this._model.getPaymentMethods().length === 0;

    if (hasNoSavedPaymentMethods) {
      hasOnlyOneSupportedPaymentOption = this._model.supportedPaymentOptions.length === 1;

      if (hasOnlyOneSupportedPaymentOption) {
        this._mainView.setPrimaryView(this._model.supportedPaymentOptions[0]);
      } else {
        this._mainView.setPrimaryView(paymentOptionsViewID);
      }
    }
  }
};

Dropin.prototype._supportsPaymentOption = function (paymentOption) {
  return this._model.supportedPaymentOptions.indexOf(paymentOption) !== -1;
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
    var error = this._model.failedDependencies[paymentMethodId];
    var errorMessageDiv = div.querySelector('.braintree-option__disabled-message');

    classList.add(div, 'braintree-disabled');
    div.removeEventListener('click', clickHandler);
    errorMessageDiv.innerHTML = constants.errors.DEVELOPER_MISCONFIGURATION_MESSAGE;
    console.error(error); // eslint-disable-line no-console
  }.bind(this));
};

Dropin.prototype._sendVaultedPaymentMethodAppearAnalyticsEvents = function () {
  var i, type;
  var typesThatSentAnEvent = {};
  var paymentMethods = this._model._paymentMethods;

  for (i = 0; i < paymentMethods.length; i++) {
    type = paymentMethods[i].type;

    if (type in typesThatSentAnEvent) {
      // prevents us from sending the analytic multiple times
      // for the same payment method type
      continue;
    }

    typesThatSentAnEvent[type] = true;

    analytics.sendEvent(this._client, 'vaulted-' + constants.analyticsKinds[type] + '.appear');
  }
};

Dropin.prototype._handleAppSwitch = function () {
  if (this._model.appSwitchError) {
    this._mainView.setPrimaryView(this._model.appSwitchError.id);
    this._model.reportError(this._model.appSwitchError.error);
  } else if (this._model.appSwitchPayload) {
    this._model.addPaymentMethod(this._model.appSwitchPayload);
  } else {
    this._sendVaultedPaymentMethodAppearAnalyticsEvents();
  }
};

/**
 * Requests a payment method object which includes the payment method nonce used by by the [Braintree Server SDKs](https://developers.braintreepayments.com/start/hello-server/).
 *
 * If a payment method is not available, an error will appear in the UI. When a callback is used, an error will be passed to it. If no callback is used, the returned Promise will be rejected with an error.
 * @public
 * @param {object} [options] All options for requesting a payment method.
 * @param {object} [options.threeDSecure] Any of the options in the [Braintree 3D Secure client reference](https://braintree.github.io/braintree-web/{@pkg bt-web-version}/ThreeDSecure.html#verifyCard) except for `nonce`, `bin`, and `onLookupComplete`. If `amount` is provided, it will override the value of `amount` in the [3D Secure create options](module-braintree-web-drop-in.html#~threeDSecureOptions). The more options provided, the more likely the customer will not need to answer a 3DS challenge. When 3DS is enabled, both credit cards and non-network tokenized Google Pay cards will perform verfication. The recommended fields for achieving a 3DS v2 verification are:
 * * `email`
 * * `mobilePhoneNumber`
 * * `billingAddress`
 *
 * For an example of verifying 3D Secure within Drop-in, [check out this codepen](https://codepen.io/braintree/pen/KjWqGx).
 * @param {callback} [callback] May be used as the only parameter in requestPaymentMethod if no `options` are provided. The first argument will be an error if no payment method is available and will otherwise be null. The second argument will be an object containing a payment method nonce; either a {@link Dropin~cardPaymentMethodPayload|cardPaymentMethodPayload}, a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload}, a {@link Dropin~venmoPaymentMethodPayload|venmoPaymentMethodPayload}, a {@link Dropin~googlePayPaymentMethodPayload|googlePayPaymentMethodPayload} or an {@link Dropin~applePayPaymentMethodPayload|applePayPaymentMethodPayload}. If no callback is provided, `requestPaymentMethod` will return a promise.
 * @returns {(void|Promise)} Returns a promise if no callback is provided.
 * @example <caption>Requesting a payment method</caption>
 * var form = document.querySelector('#my-form');
 * var hiddenNonceInput = document.querySelector('#my-nonce-input');
 *
 * form.addEventListener('submit', function (event) {
 *  event.preventDefault();
 *
 *  dropinInstance.requestPaymentMethod(function (err, payload) {
 *    if (err) {
 *      // handle error
 *      return;
 *    }
 *    hiddenNonceInput.value = payload.nonce;
 *    form.submit();
 *  });
 * });
 * @example <caption>Requesting a payment method with data collector</caption>
 * var form = document.querySelector('#my-form');
 * var hiddenNonceInput = document.querySelector('#my-nonce-input');
 * var hiddenDeviceDataInput = document.querySelector('#my-device-data-input');
 *
 * form.addEventListener('submit', function (event) {
 *  event.preventDefault();
 *
 *  dropinInstance.requestPaymentMethod(function (err, payload) {
 *    if (err) {
 *      // handle error
 *      return;
 *    }
 *    hiddenNonceInput.value = payload.nonce;
 *    hiddenDeviceDataInput.value = payload.deviceData;
 *    form.submit();
 *  });
 * });
 *
 * @example <caption>Requesting a payment method with 3D Secure</caption>
 * var form = document.querySelector('#my-form');
 * var hiddenNonceInput = document.querySelector('#my-nonce-input');
 *
 * form.addEventListener('submit', function (event) {
 *  event.preventDefault();
 *
 *  dropinInstance.requestPaymentMethod(function (err, payload) {
 *    if (err) {
 *      // Handle error
 *      return;
 *    }
 *
 *    if (payload.liabilityShifted || (payload.type !== 'CreditCard' && payload.type !== 'AndroidPayCard')) {
 *      hiddenNonceInput.value = payload.nonce;
 *      form.submit();
 *    } else {
 *      // Decide if you will force the user to enter a different payment method
 *      // if liability was not shifted
 *      dropinInstance.clearSelectedPaymentMethod();
 *    }
 *  });
 * });
 */
Dropin.prototype.requestPaymentMethod = function (options) {
  var self = this;

  options = options || {};

  return this._mainView.requestPaymentMethod().then(function (payload) {
    if (self._shouldPerformThreeDSecureVerification(payload)) {
      self._mainView.showLoadingIndicator();

      return self._threeDSecure.verify(payload, options.threeDSecure).then(function (newPayload) {
        payload.nonce = newPayload.nonce;
        payload.liabilityShifted = newPayload.liabilityShifted;
        payload.liabilityShiftPossible = newPayload.liabilityShiftPossible;
        payload.threeDSecureInfo = newPayload.threeDSecureInfo;

        self._mainView.hideLoadingIndicator();

        return payload;
      }).catch(function (err) {
        self._mainView.hideLoadingIndicator();

        return Promise.reject(err);
      });
    }

    return payload;
  }).then(function (payload) {
    if (self._dataCollector) {
      payload.deviceData = self._dataCollector.getDeviceData();
    }

    return payload;
  }).then(function (payload) {
    return formatPaymentMethodPayload(payload);
  });
};

Dropin.prototype._shouldPerformThreeDSecureVerification = function (payload) {
  if (!this._threeDSecure) {
    return false;
  }

  if (payload.liabilityShifted != null) {
    return false;
  }

  if (payload.type === constants.paymentMethodTypes.card) {
    return true;
  }

  if (payload.type === constants.paymentMethodTypes.googlePay && payload.details.isNetworkTokenized === false) {
    return true;
  }

  return false;
};

Dropin.prototype._removeStylesheet = function () {
  var stylesheet = document.getElementById(constants.STYLESHEET_ID);

  if (stylesheet) {
    stylesheet.parentNode.removeChild(stylesheet);
  }
};

Dropin.prototype._injectStylesheet = function () {
  var assetsUrl;
  var loadStylesheetOptions = {
    id: constants.STYLESHEET_ID
  };

  if (document.getElementById(constants.STYLESHEET_ID)) { return; }

  assetsUrl = this._client.getConfiguration().gatewayConfiguration.assetsUrl;
  loadStylesheetOptions.href = assetsUrl + '/web/dropin/' + VERSION + '/css/dropin@DOT_MIN.css';

  if (this._model.isInShadowDom) {
    // if Drop-in is in the shadow DOM, put the
    // style sheet in the shadow DOM node instead of
    // in the head of the document
    loadStylesheetOptions.container = this._model.rootNode;
  }

  assets.loadStylesheet(loadStylesheetOptions);
};

/**
 * Cleanly remove anything set up by {@link module:braintree-web-drop-in|dropin.create}. This may be be useful in a single-page app.
 * @public
 * @param {callback} [callback] Called on completion, containing an error if one occurred. No data is returned if teardown completes successfully. If no callback is provided, `teardown` will return a promise.
 * @returns {(void|Promise)} Returns a promise if no callback is provided.
 */
Dropin.prototype.teardown = function () {
  var teardownError;
  var promise = Promise.resolve();
  var self = this;

  this._removeStylesheet();

  if (this._mainView) {
    promise.then(function () {
      return self._mainView.teardown().catch(function (err) {
        teardownError = err;
      });
    });
  }

  if (this._dataCollector) {
    promise.then(function () {
      return this._dataCollector.teardown().catch(function (error) {
        teardownError = new DropinError({
          message: 'Drop-in errored tearing down Data Collector.',
          braintreeWebError: error
        });
      });
    }.bind(this));
  }

  if (this._threeDSecure) {
    promise.then(function () {
      return this._threeDSecure.teardown().catch(function (error) {
        teardownError = new DropinError({
          message: 'Drop-in errored tearing down 3D Secure.',
          braintreeWebError: error
        });
      });
    }.bind(this));
  }

  return promise.then(function () {
    return self._removeDropinWrapper();
  }).then(function () {
    if (teardownError) {
      return Promise.reject(teardownError);
    }

    return Promise.resolve();
  });
};

/**
 * Returns a boolean indicating if a payment method is available through {@link Dropin#requestPaymentMethod|requestPaymentMethod}. Particularly useful for detecting if using a client token with a customer ID to show vaulted payment methods.
 * @public
 * @returns {Boolean} True if a payment method is available, otherwise false.
 */
Dropin.prototype.isPaymentMethodRequestable = function () {
  return this._model.isPaymentMethodRequestable();
};

Dropin.prototype._removeDropinWrapper = function () {
  this._dropinWrapper.parentNode.removeChild(this._dropinWrapper);

  return Promise.resolve();
};

function formatPaymentMethodPayload(paymentMethod) {
  var formattedPaymentMethod = {
    nonce: paymentMethod.nonce,
    details: paymentMethod.details,
    type: paymentMethod.type
  };

  if (paymentMethod.vaulted != null) {
    formattedPaymentMethod.vaulted = paymentMethod.vaulted;
  }

  if (paymentMethod.type === constants.paymentMethodTypes.card) {
    formattedPaymentMethod.description = paymentMethod.description;
  }

  if (paymentMethod.type in HAS_RAW_PAYMENT_DATA) {
    formattedPaymentMethod.details.rawPaymentData = paymentMethod.rawPaymentData;
  }

  if (typeof paymentMethod.liabilityShiftPossible === 'boolean') {
    formattedPaymentMethod.liabilityShifted = paymentMethod.liabilityShifted;
    formattedPaymentMethod.liabilityShiftPossible = paymentMethod.liabilityShiftPossible;
  }

  if (paymentMethod.threeDSecureInfo) {
    formattedPaymentMethod.threeDSecureInfo = paymentMethod.threeDSecureInfo;
  }

  if (paymentMethod.deviceData) {
    formattedPaymentMethod.deviceData = paymentMethod.deviceData;
  }

  if (paymentMethod.binData) {
    formattedPaymentMethod.binData = paymentMethod.binData;
  }

  return formattedPaymentMethod;
}

module.exports = wrapPrototype(Dropin);
