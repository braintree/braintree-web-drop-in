'use strict';
/**
 * @module braintree-web-drop-in
 * @description There are two ways to integrate Drop-in into your page: a script tag integration and a JavaScript integration using [`dropin.create`](#.create).
 *
 * The script tag integration is the fastest way to integrate. All you need to do is add the Drop-in script inside your form element where you want Drop-in to appear and include a `data-braintree-dropin-authorization` property with your [tokenization key](https://developers.braintreepayments.com/guides/authorization/tokenization-key/javascript/v3) or [client token](https://developers.braintreepayments.com/guides/authorization/client-token).
 *
 * When your form is submitted, Drop-in will intercept the form submission and attempt to tokenize the payment method. If the tokenization is successful, it will insert the payment method nonce into a hidden input with the name `payment_method_nonce` and then submit your form. If the tokenization is unsuccessful, a relevant error will be shown in the UI.
 *
 * If you have data collector enabled, the device data will be injected into a hidden input with the name `device_data` before form submission.
 *
 * Specify creation options as data attributes in your script tag, as shown in the examples below. The following configuration properties may be set:
 *
 * * `data-locale`
 * * `data-card.cardholder-name.required`
 * * `data-payment-option-priority`
 * * `data-data-collector.kount`
 * * `data-data-collector.paypal`
 * * `data-paypal.amount`
 * * `data-paypal.currency`
 * * `data-paypal.flow`
 * * `data-paypal-credit.amount`
 * * `data-paypal-credit.currency`
 * * `data-paypal-credit.flow`
 *
 * For more control and customization, use [`dropin.create` instead](#.create).
 *
 * See our [demo app](../../script-tag-integration.html) for an example of using our script tag integration.
 *
 * @example
 * <caption>A full example accepting only cards</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="utf-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <form id="payment-form" action="/" method="post">
 *       <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"
 *        data-braintree-dropin-authorization="CLIENT_AUTHORIZATION"
 *       ></script>
 *       <input type="submit" value="Purchase"></input>
 *     </form>
 *   </body>
 * </html>
 *
 * @example
 * <caption>A full example accepting cards, PayPal, and PayPal credit</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="utf-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <form id="payment-form" action="/" method="post">
 *       <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"
 *        data-braintree-dropin-authorization="CLIENT_AUTHORIZATION"
 *        data-paypal.flow="checkout"
 *        data-paypal.amount="10.00"
 *        data-paypal.currency="USD"
 *        data-paypal-credit.flow="vault"
 *       ></script>
 *       <input type="submit" value="Purchase"></input>
 *     </form>
 *   </body>
 * </html>
 *
 * @example
 * <caption>Specifying a locale and payment option priority</caption>
 * <form id="payment-form" action="/" method="post">
 *   <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"
 *    data-braintree-dropin-authorization="CLIENT_AUTHORIZATION"
 *    data-locale="de_DE"
 *    data-payment-option-priority='["paypal","card", "paypalCredit"]'
 *    data-paypal.flow="checkout"
 *    data-paypal.amount="10.00"
 *    data-paypal.currency="USD"
 *    data-paypal-credit.flow="vault"
 *   ></script>
 *   <input type="submit" value="Purchase"></input>
 * </form>
 *
 * @example
 * <caption>Including an optional cardholder name field in card form</caption>
 * <form id="payment-form" action="/" method="post">
 *   <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"
 *    data-braintree-dropin-authorization="CLIENT_AUTHORIZATION"
 *    data-card.cardholder-name.required="false"
 *   ></script>
 *   <input type="submit" value="Purchase"></input>
 * </form>
 *
 * @example
 * <caption>Including a required cardholder name field in card form</caption>
 * <form id="payment-form" action="/" method="post">
 *   <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"
 *    data-braintree-dropin-authorization="CLIENT_AUTHORIZATION"
 *    data-card.cardholder-name.required="true"
 *   ></script>
 *   <input type="submit" value="Purchase"></input>
 * </form>
 */

var Dropin = require('./dropin');
var createFromScriptTag = require('./lib/create-from-script-tag');
var analytics = require('./lib/analytics');
var DropinError = require('./lib/dropin-error');
var Promise = require('./lib/promise');
var wrapPromise = require('@braintree/wrap-promise');

var VERSION = '__VERSION__';

/**
 * @typedef {object} cardCreateOptions The configuration options for cards. Internally, Drop-in uses [Hosted Fields](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/module-braintree-web_hosted-fields.html) to render the card form. The `overrides.fields` and `overrides.styles` allow the Hosted Fields to be customized.
 *
 * @param {(boolean|object)} [cardholderName] Will enable a cardholder name field above the card number field. If set to an object, you can specify whether or not the field is required. If set to a `true`, it will default the field to being present, but not required.
 * @param {boolean} [cardholderName.required=false] When true, the cardholder name field will be required to request the payment method nonce.
 * @param {object} [overrides.fields] The Hosted Fields [`fields` options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/module-braintree-web_hosted-fields.html#~fieldOptions). Only `number`, `cvv`, `expirationDate` and `postalCode` can be configured. Each is a [Hosted Fields `field` object](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/module-braintree-web_hosted-fields.html#~field). `selector` cannot be modified.
 * @param {object} [overrides.styles] The Hosted Fields [`styles` options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/module-braintree-web_hosted-fields.html#~styleOptions). These can be used to add custom styles to the Hosted Fields iframes. To style the rest of Drop-in, [review the documentation for customizing Drop-in](https://developers.braintreepayments.com/guides/drop-in/customization/javascript/v3#customize-your-ui).
 * @param {boolean} [clearFieldsAfterTokenization=true] When false, the card form will not clear the card data when the customer returns to the card view after a successful tokenization.
 * @param {object} [vault] Configuration for vaulting credit cards. Only applies when using a [client token with a customer id](https://developers.braintreepayments.com/reference/request/client-token/generate/#customer_id).
 * @param {boolean} [vault.allowAutoVaultOverride=false] When true, the card form will include an option to let the customer decide not to vault the credit card they enter.
 * @param {boolean} [vault.autoVault=true] Whether or not to vault the card upon tokenization. When set to `false` with `allowVaultCardOverride` set to `false`, then cards will not be vaulted. Can be used to opt in or opt of the global [`vaultManager` settings](#~vaultManagerCreateOptions) for autovaulting cards.
 */

/**
 * @typedef {object} dataCollectorOptions The configuration options for Data Collector. Requires [advanced fraud protection](https://developers.braintreepayments.com/guides/advanced-fraud-tools/client-side/javascript/v3) to be enabled in the Braintree gateway. Contact our [support team](https://developers.braintreepayments.com/forms/contact) to configure your Kount ID. The device data will be included on the {@link Dropin#requestPaymentMethod|requestPaymentMethod payload}.
 *
 * @param {boolean} [kount] If true, Kount fraud data collection is enabled. Required if `paypal` parameter is not used.
 * @param {boolean} [paypal] If true, PayPal fraud data collection is enabled. Required if `kount` parameter is not used.
 */

/**
 * @typedef {object} threeDSecureOptions _Deprecated_ If the `threeDSecureOptions` passed into the create call is an object, you may set the `amount` to verify with 3D Secure. However, it's recomended that you pass `true` instead of a configuration object and do all 3D Secure configuration in the {@link Dropin#requestPaymentMethod|requestPaymentMethod options}.
 *
 * @param {string} amount The amount to verify with 3D Secure.
 */

/** @typedef {object} paypalCreateOptions The configuration options for PayPal and PayPalCredit. For a full list of options see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#createPayment).
 *
 * @param {string} flow Either `checkout` for a one-time [Checkout with PayPal](https://developers.braintreepayments.com/guides/paypal/checkout-with-paypal/javascript/v3) flow or `vault` for a [Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3). Required when using PayPal or PayPal Credit.
 * @param {(string|number)} [amount] The amount of the transaction. Required when using the Checkout flow.
 * @param {string} [currency] The currency code of the amount, such as `USD`. Required when using the Checkout flow.
 * @param {object} [buttonStyle] The style object to apply to the PayPal button. Button customization includes color, shape, size, and label. The options [found here](https://developer.paypal.com/docs/integration/direct/express-checkout/integration-jsv4/customize-button/#button-styles) are available.
 * @param {boolean} [commit] The user action to show on the PayPal review page. If true, a `Pay Now` button will be shown. If false, a `Continue` button will be shown.
 * @param {object} [vault] Options for how vaulting should be handled with PayPal accounts.
 * @param {boolean} [vault.autoVault] Can be used to opt in or opt of the global [`vaultManager` settings](#~vaultManagerCreateOptions) for autovaulting.
 */

/** @typedef {object} applePayCreateOptions The configuration options for Apple Pay.
 *
 * @param {string} [buttonStyle=black] Configures the Apple Pay button style. Valid values are `black`, `white`, `white-outline`.
 * @param {string} displayName The canonical name for your store. Use a non-localized name. This parameter should be a utf-8 string that is a maximum of 128 characters. The system may display this name to the user.
 * @param {number} [applePaySessionVersion=2] The [version of the `ApplePaySession`](https://developer.apple.com/documentation/apple_pay_on_the_web/apple_pay_on_the_web_version_history) to use. It's recommended to use the lowest version that contains all the features you need for your checkout to maximize compatibility.
 * @param {external:ApplePayPaymentRequest} paymentRequest The payment request details to apply on top of those from Braintree.
 */

/** @typedef {object} googlePayCreateOptions The configuration options for Google Pay. Additional options from the few listed here are available, many have default values applied based on the settings found in the Braintree Gateway. For more information, see [Google's Documentation](https://developers.google.com/pay/api/web/object-reference#request-objects).
 *
 * @param {string} merchantId The ID provided by Google for processing transactions in production. Not necessary for testing in sandbox.
 * @param {string} [googlePayVersion=1] The version of the Google Pay API to use. Defaults to 1, but 2 can be passed in.
 * @param {external:GooglePayTransactionInfo} transactionInfo The transaction details necessary for processing the payment.
 * @param {external:GooglePayButtonOptions} [button] The button options for configuring the look of the Google Pay button. The `onClick` property cannot be overwritten.
 */

/** @typedef {object} vaultManagerCreateOptions Options for managing the customer's vault. Must be used with a [client token with a customer id](https://developers.braintreepayments.com/reference/request/client-token/generate/#customer_id).
 *
 * @param {boolean} [autoVaultPaymentMethods=true]  Auto-vault payment methods as they are added by the customer. This can be opted out on a per payment method basis as well.
 * @param {boolean} [presentVaultedPaymentMethods=true] Present a customer's saved payment methods.
 * @param {boolean} [preselectVaultedPaymentMethod=true] Initialize Drop-in with a vaulted payment method pre-selected. Only applicable when `presentVaultedPaymentMethods` is set to `true` and the customer has saved payment methods.
 * @param {boolean} [allowCustomerToDeletePaymentMethods=false] Allow customer to delete saved payment methods. *Note:* Deleting a payment method from Drop-in will permanently delete the payment method, so this option is not recommended for merchants using Braintree's recurring billing system.
 *
 * @example <caption>Overriding global auto-vaulting behavior</caption>
 * // will autovault all payment methods except for PayPal
 * braintree.dropin.create({
 *   vaultManager: {
 *     autoVaultPaymentMethods: true // can also just omit this line
 *   },
 *   paypal: {
 *     autoVault: false
 *   }
 * });
 *
 * // will only autovault PayPal
 * braintree.dropin.create({
 *   vaultManager: {
 *     autoVaultPaymentMethods: false
 *   },
 *   paypal: {
 *     autoVault: true
 *   }
 * });
 */

/**
 * @typedef {object} ApplePayPaymentRequest An [Apple Pay Payment Request object](https://developer.apple.com/reference/applepayjs/1916082-applepay_js_data_types/paymentrequest).
 * @external ApplePayPaymentRequest
 * @see {@link https://developer.apple.com/reference/applepayjs/1916082-applepay_js_data_types/paymentrequest PaymentRequest}
 */

/**
 * @typedef {object} GooglePayTransactionInfo A [Google Pay TransactionInfo object](https://developers.google.com/pay/api/web/object-reference#TransactionInfo).
 * @external GooglePayTransactionInfo
 * @see {@link https://developers.google.com/pay/api/web/object-reference#TransactionInfo TransactionInfo}
 */

/**
 * @typedef {object} GooglePayButtonOptions A [Google Pay ButtonOptions object](https://developers.google.com/pay/api/web/reference/object#ButtonOptions).
 * @external GooglePayButtonOptions
 * @see {@link https://developers.google.com/pay/api/web/reference/object#ButtonOptions ButtonOptions}
 */

/** @typedef {(object|boolean)} venmoCreateOptions The configuration options for Venmo. If `true` is passed instead of a configuration object, the default settings listed will be used.
 *
 * @param {boolean} [allowNewBrowserTab=true] If false, it restricts supported browsers to those that can app switch to the Venmo app without opening a new tab.
 */

/**
 * @static
 * @function create
 * @description This function is the entry point for `braintree.dropin`. It is used for creating {@link Dropin} instances.
 * @param {object} options Object containing all {@link Dropin} options:
 * @param {string} options.authorization A [tokenization key](https://developers.braintreepayments.com/guides/authorization/tokenization-key/javascript/v3) or a [client token](https://developers.braintreepayments.com/guides/authorization/client-token). If authorization is a client token created with a [customer ID](https://developers.braintreepayments.com/guides/drop-in/javascript/v3#customer-id), Drop-in will render saved payment methods and automatically store any newly-added payment methods in their Vault record.
 * @param {(string|HTMLElement)} options.container A reference to an empty element, such as a `<div>`, where Drop-in will be included on your page or the selector for the empty element. e.g. `#dropin-container`.
 * @param {string} options.selector Deprecated: Now an alias for `options.container`.
 * @param {string} [options.locale=`en_US`] Use this option to change the language, links, and terminology used throughout Drop-in. Supported locales include:
 * `da_DK`,
 * `de_DE`,
 * `en_AU`,
 * `en_GB`,
 * `en_US`,
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
 *
 * @param {object} [options.translations] To use your own translations, pass an object with the strings you wish to replace. This object must use the same structure as the object used internally for supported translations, which can be found [here](https://github.com/braintree/braintree-web-drop-in/blob/master/src/translations/en_US.js). Any strings that are not included will be those from the provided `locale` or `en_US` if no `locale` is provided. See below for an example of creating Drop-in with custom translations.
 * @param {array} [options.paymentOptionPriority] Use this option to indicate the order in which enabled payment options should appear when multiple payment options are enabled. By default, payment options will appear in this order: `['card', 'paypal', 'paypalCredit', 'venmo', 'applePay', 'googlePay']`. Payment options omitted from this array will not be offered to the customer.
 *
 * @param {(boolean|object)} [options.card] The configuration options for cards. See [`cardCreateOptions`](#~cardCreateOptions) for all `card` options. If this option is omitted, cards will still appear as a payment option. To remove cards, pass `false` for the value.
 * @param {object} [options.paypal] The configuration options for PayPal. To include a PayPal option in your Drop-in integration, include the `paypal` parameter and [enable PayPal in the Braintree Control Panel](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#go-live). To test in Sandbox, you will need to [link a PayPal sandbox test account to your Braintree sandbox account](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#linked-paypal-testing).
 *
 * Some of the PayPal configuration options are listed [here](#~paypalCreateOptions), but for a full list see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#createPayment).
 *
 * PayPal is not [supported in Internet Explorer versions lower than 11](https://developer.paypal.com/docs/checkout/reference/faq/#which-browsers-does-paypal-checkout-support).
 *
 * @param {object} [options.paypalCredit] The configuration options for PayPal Credit. To include a PayPal Credit option in your Drop-in integration, include the `paypalCredit` parameter and [enable PayPal in the Braintree Control Panel](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#go-live).
 *
 * Some of the PayPal Credit configuration options are listed [here](#~paypalCreateOptions), but for a full list see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#createPayment). For more information on PayPal Credit, see the [Braintree Developer Docs](https://developers.braintreepayments.com/guides/paypal/paypal-credit/javascript/v3).
 *
 * PayPal Credit is not [supported in Internet Explorer versions lower than 11](https://developer.paypal.com/docs/checkout/reference/faq/#which-browsers-does-paypal-checkout-support).
 *
 * @param {(object|boolean)} [options.venmo] The configuration options for Pay with Venmo. To include a Venmo option in your Drop-in integration, include the `venmo` parameter and [follow the documentation for setting up Venmo in the Braintree control panel](https://articles.braintreepayments.com/guides/payment-methods/venmo#setup). If a user's browser does not support Venmo, the Venmo option will not be rendered.
 *
 * See [`venmoCreateOptions`](#~venmoCreateOptions) for `venmo` options.
 *
 * @param {object} [options.applePay] The configuration options for Apple Pay. To include an Apple Pay option in your Drop-in integration, include the `applePay` parameter and [enable Apple Pay in the Braintree Control Panel](https://developers.braintreepayments.com/guides/apple-pay/configuration/javascript/v3). If a user's browser does not support Apple Pay, the Apple Pay option will not be rendered. See [Apple's documentation](https://support.apple.com/en-us/HT201469) for browser and device support.
 *
 * See [`applePayCreateOptions`](#~applePayCreateOptions) for `applePay` options.
 *
 * @param {object} [options.googlePay] The configuration options for Google Pay. To include a Google Pay option in your Drop-in integration, include the `googlePay` parameter and [enable Google Pay in the Braintree Control Panel](https://developers.braintreepayments.com/guides/google-pay/configuration/javascript/v3). If a user's browser does not support Google Pay, the Google Pay option will not be rendered. See [Google's documentation](https://developers.google.com/pay/api/web/test-and-deploy) for browser and device support.
 *
 * See [`googlePayCreateOptions`](#~googlePayCreateOptions) for `googlePay` options.
 *
 * @param {object} [options.dataCollector] The configuration options for data collector. See [`dataCollectorOptions`](#~dataCollectorOptions) for all `dataCollector` options. If Data Collector is configured and fails to load, Drop-in creation will fail.
 *
 * @param {(boolean|object)} [options.threeDSecure] It's recommended that you pass `true` here to enable 3D Secure and pass the configuration options for 3D Secure into {@link Dropin#requestPaymentMethod|requestPaymentMethod options}.See [`threeDSecureOptions`](#~threeDSecureOptions) for the deprecated create options. If 3D Secure is configured and fails to load, Drop-in creation will fail.
 *
 * @param {object} [options.vaultManager] The configuration options for vault management.
 *
 * See [`vaultManagerCreateOptions`](#~vaultManagerCreateOptions) for `vaultManager` options.
 *
 * @param {function} [callback] The second argument, `data`, is the {@link Dropin} instance. Returns a promise if no callback is provided.
 * @returns {(void|Promise)} Returns a promise if no callback is provided.
 * @example
 * <caption>A full example of accepting credit cards with callback API</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="utf-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <div id="dropin-container"></div>
 *     <button id="submit-button">Purchase</button>
 *
 *     <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"></script>
 *
 *     <script>
 *       var submitButton = document.querySelector('#submit-button');
 *
 *       braintree.dropin.create({
 *         authorization: 'CLIENT_AUTHORIZATION',
 *         container: '#dropin-container'
 *       }, function (err, dropinInstance) {
 *         if (err) {
 *           // Handle any errors that might've occurred when creating Drop-in
 *           console.error(err);
 *           return;
 *         }
 *         submitButton.addEventListener('click', function () {
 *           dropinInstance.requestPaymentMethod(function (err, payload) {
 *             if (err) {
 *               // Handle errors in requesting payment method
 *             }
 *
 *             // Send payload.nonce to your server
 *           });
 *         });
 *       });
 *     </script>
 *   </body>
 * </html>
 * @example
 * <caption>A full example of accepting credit cards with promise API</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="utf-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <div id="dropin-container"></div>
 *     <button id="submit-button">Purchase</button>
 *
 *     <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"></script>
 *
 *     <script>
 *       var submitButton = document.querySelector('#submit-button');
 *
 *       braintree.dropin.create({
 *         authorization: 'CLIENT_AUTHORIZATION',
 *         container: '#dropin-container'
 *       }).then(function (dropinInstance) {
 *         submitButton.addEventListener('click', function () {
 *           dropinInstance.requestPaymentMethod().then(function (payload) {
 *             // Send payload.nonce to your server
 *           }).catch(function (err) {
 *             // Handle errors in requesting payment method
 *           });
 *         });
 *       }).catch(function (err) {
 *         // Handle any errors that might've occurred when creating Drop-in
 *         console.error(err);
 *       });
 *     </script>
 *   </body>
 * </html>
 * @example
 * <caption>Setting up a Drop-in instance to accept credit cards, PayPal, PayPal Credit, Venmo, and Apple Pay</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   applePay: {
 *     displayName: 'Merchant Name',
 *     paymentRequest: {
   *     label: 'Localized Name',
 *       total: '10.00'
 *     }
 *   },
 *   paypal: {
 *     flow: 'checkout',
 *     amount: '10.00',
 *     currency: 'USD'
 *   },
 *  paypalCredit: {
 *    flow: 'checkout',
 *    amount: '10.00',
 *    currency: 'USD'
 *   },
 *   venmo: true
 * }, function (err, dropinInstance) {
 *   // Set up a handler to request a payment method and
 *   // submit the payment method nonce to your server
 * });
 * @example
 * <caption>Setting up a Drop-in instance to accept Venmo with restricted browser support</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   venmo: {
 *     allowNewBrowserTab: false
 *   }
 * }, function (err, dropinInstance) {
 *   // Set up a handler to request a payment method and
 *   // submit the payment method nonce to your server
 * });
 *
 * @example
 * <caption>Submitting the payment method nonce to the server using a form</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="utf-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <form id="payment-form" action="/" method="post">
 *       <div id="dropin-container"></div>
 *       <input type="submit" value="Purchase"></input>
 *       <input type="hidden" id="nonce" name="payment_method_nonce"></input>
 *     </form>
 *
 *     <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"></script>
 *
 *     <script>
 *       var form = document.querySelector('#payment-form');
 *       var nonceInput = document.querySelector('#nonce');
 *
 *       braintree.dropin.create({
 *         authorization: 'CLIENT_AUTHORIZATION',
 *         container: '#dropin-container'
 *       }, function (err, dropinInstance) {
 *         if (err) {
 *           // Handle any errors that might've occurred when creating Drop-in
 *           console.error(err);
 *           return;
 *         }
 *         form.addEventListener('submit', function (event) {
 *           event.preventDefault();
 *
 *           dropinInstance.requestPaymentMethod(function (err, payload) {
 *             if (err) {
 *               // Handle errors in requesting payment method
 *               return;
 *             }
 *
 *             // Send payload.nonce to your server
 *             nonceInput.value = payload.nonce;
 *             form.submit();
 *           });
 *         });
 *       });
 *     </script>
 *   </body>
 * </html>
 *
 * @example
 * <caption>Use your own translations</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   translations: {
 *     payingWith: 'You are paying with {{paymentSource}}',
 *     chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string',
 *     // Any other custom translation strings
 *   }
 * }, callback);
 *
 * @example
 * <caption>Customizing Drop-in with card form overrides</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   card: {
 *     overrides: {
 *       fields: {
 *         number: {
 *           placeholder: '1111 1111 1111 1111' // Update the number field placeholder
 *         },
 *         postalCode: {
 *           minlength: 5 // Set the minimum length of the postal code field
 *         },
 *         cvv: null // Remove the CVV field from your form
 *       },
 *       styles: {
 *         input: {
 *           'font-size': '18px' // Change the font size for all inputs
 *         },
 *         ':focus': {
 *           color: 'red' // Change the focus color to red for all inputs
 *         }
 *       }
 *     }
 *   }
 * }, callback);
 *
 * @example
 * <caption>Mask Card Inputs</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   card: {
 *     overrides: {
 *       fields: {
 *         number: {
 *           maskInput: {
 *             showLastFour: true
 *           }
 *         },
 *         cvv: {
 *           maskInput: true
 *         }
 *       }
 *     }
 *   }
 * }, callback);
 *
 * @example
 * <caption>Including a cardholder name field</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   card: {
 *     cardholderName: true
 *   }
 * }, callback);
 *
 * @example
 * <caption>Including a required cardholder name field</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   card: {
 *     cardholderName: {
 *       required: true
 *     }
 *   }
 * }, callback);
 *
 * @example
 * <caption>Enabling 3D Secure</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   threeDSecure: true
 * }, function (err, dropinInstance) {
 *   // setup payment button
 *   btn.addEventListener('click', function (e) {
 *     e.preventDefault();
 *
 *     dropinInstance.requestPaymentMethod(|
 *       threeDSecure: {
 *         amount: '100.00',
 *         billingAddress: {
 *           givenName: 'Jill', // ASCII-printable characters required, else will throw a validation error
 *           surname: 'Doe', // ASCII-printable characters required, else will throw a validation error
 *           phoneNumber: '8101234567',
 *           streetAddress: '555 Smith St.',
 *           extendedAddress: '#5',
 *           locality: 'Oakland',
 *           region: 'CA',
 *           postalCode: '12345',
 *           countryCodeAlpha2: 'US'
 *         },
 *         // additional 3ds params
 *       }
 *     }, function (err, payload) {
 *       // inspect payload.liablityShifted
 *       // send payload.nonce to server
 *     });
 *   });
 * });
 *
 * @example
 * <caption>Enabled Vault Manager</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   vaultManager: true
 * }, callback);
 */

function create(options) {
  if (!options.authorization) {
    return Promise.reject(new DropinError('options.authorization is required.'));
  }

  analytics.setupAnalytics(options.authorization);

  return new Promise(function (resolve, reject) {
    new Dropin({
      merchantConfiguration: options
    })._initialize(function (err, instance) {
      if (err) {
        reject(err);

        return;
      }

      resolve(instance);
    });
  });
}

// we check for document's existence to support server side rendering
createFromScriptTag(create, typeof document !== 'undefined' && document.querySelector('script[data-braintree-dropin-authorization]'));

module.exports = {
  create: wrapPromise(create),
  /**
   * @description The current version of Drop-in, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};
