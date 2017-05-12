'use strict';
/**
 * @module braintree-web-drop-in
 * @description This is the Drop-in module.
 */

var Dropin = require('./dropin');
var client = require('braintree-web/client');
var deferred = require('./lib/deferred');
var constants = require('./constants');
var analytics = require('./lib/analytics');
var DropinError = require('./lib/dropin-error');

var VERSION = process.env.npm_package_version;

// TODO add example
// TODO use PayPal version for client reference link
// TODO remove duplicate information from README

/**
 * @static
 * @function create
 * @description This function is the entry point for `braintree.dropin`. It is used for creating {@link Dropin} instances.
 * @param {object} options Object containing all {@link Dropin} options:
 * @param {string} options.authorization A [tokenization key](https://developers.braintreepayments.com/guides/authorization/tokenization-key/javascript/v3) or a [client token](https://developers.braintreepayments.com/guides/authorization/client-token). If authorization is a client token created with a [customer ID](https://developers.braintreepayments.com/guides/drop-in/javascript/v3#customer-id), Drop-in will render saved payment methods and vault any new payment methods added.
 * @param {string} options.selector A selector for an empty element, such as a `<div>`, where Drop-in will be included on your page. E.g. `#dropin-container`.
 * @param {string} [options.locale=`en_US`] Use this option to change the language, links, and terminology used throughout Drop-in. Supported locales include:
 * `da_DK`,
 * `de_DE`,
 * `en_US`,
 * `en_AU`,
 * `en_GB`,
 * `es_ES`,
 * `fr_CA`,
 * `fr_FR`,
 * `id_ID`,
 * `it_IT`,
 * `ja_JP`,
 * `ko_KR`,
 * `nl_NL`,
 * `no_NO`,
 * `pl_PL`,
 * `pt_BR`,
 * `pt_PT`,
 * `ru_RU`,
 * `sv_SE`,
 * `th_TH`,
 * `zh_CN`,
 * `zh_HK`,
 * `zh_TW`.
 * @param {array} [options.paymentOptionPriority] Use this option to indicate the order in which enabled payment options should appear when multiple payment options are enabled. By default, payment options will appear in this order: `['card', 'paypal', 'paypalCredit']`. Payment options omitted from this array will not be offered to the customer.
 *
 * @param {object} [options.paypal] The configuration options for PayPal. To include a PayPal option in your Drop-in integration, include the `paypal` parameter and [enable PayPal in the Braintree Control Panel](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#go-live). To test in Sandbox, you will need to [link a PayPal sandbox test account to your Braintree sandbox account](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#linked-paypal-testing).
 *
 * Some of the PayPal configuration options are listed here, but for a full list see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/current/PayPalCheckout.html#createPayment).
 * @param {string} [options.paypal.flow] Either `checkout` for a one-time [Checkout with PayPal](https://developers.braintreepayments.com/guides/paypal/checkout-with-paypal/javascript/v3) flow or `vault` for a [Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3). Required when using PayPal.
 * @param {string|number} [options.paypal.amount] The amount of the transaction. Required when using the Checkout flow.
 * @param {string} [options.paypal.currency] The currency code of the amount, such as `USD`. Required when using the Checkout flow.
 *
 * @param {object} [options.paypalCredit] The configuration options for PayPal Credit. To include a PayPal Credit option in your Drop-in integration, include the `paypalCredit` parameter and [enable PayPal in the Braintree Control Panel](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#go-live).
 *
 * Some of the PayPal Credit configuration options are listed here, but for a full list see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/current/PayPalCheckout.html#createPayment). For more information on PayPal Credit, see the [Braintree Developer Docs](https://developers.braintreepayments.com/guides/paypal/paypal-credit/javascript/v3).
 * @param {string} [options.paypalCredit.flow] Either `checkout` for a one-time [Checkout with PayPal](https://developers.braintreepayments.com/guides/paypal/checkout-with-paypal/javascript/v3) flow or `vault` for a [Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3). Required when using PayPal.
 * @param {string|number} [options.paypalCredit.amount] The amount of the transaction. Required when using the Checkout flow.
 * @param {string} [options.paypalCredit.currency] The currency code of the amount, such as `USD`. Required when using the Checkout flow.
 * @param {function} callback The second argument, `data`, is the {@link Dropin} instance.
 * @returns {void}
 */

function create(options, callback) {
  if (typeof callback !== 'function') {
    throw new DropinError('create must include a callback function.');
  }

  callback = deferred(callback);

  if (!options.authorization) {
    callback(new DropinError('options.authorization is required.'));
    return;
  }

  client.create({
    authorization: options.authorization
  }, function (err, clientInstance) {
    if (err) {
      callback(new DropinError({
        message: 'There was an error creating Drop-in.',
        braintreeWebError: err
      }));
      return;
    }

    clientInstance = setAnalyticsIntegration(clientInstance);

    if (clientInstance.getConfiguration().authorizationType === 'TOKENIZATION_KEY') {
      analytics.sendEvent(clientInstance, 'started.tokenization-key');
    } else {
      analytics.sendEvent(clientInstance, 'started.client-token');
    }

    new Dropin({
      merchantConfiguration: options,
      client: clientInstance
    })._initialize(callback);
  });
}

function setAnalyticsIntegration(clientInstance) {
  var configuration = clientInstance.getConfiguration();

  configuration.analyticsMetadata.integration = constants.INTEGRATION;
  configuration.analyticsMetadata.integrationType = constants.INTEGRATION;
  configuration.analyticsMetadata.dropinVersion = VERSION;

  clientInstance.getConfiguration = function () {
    return configuration;
  };

  return clientInstance;
}

module.exports = {
  create: create,
  /**
   * @description The current version of Drop-in, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};
