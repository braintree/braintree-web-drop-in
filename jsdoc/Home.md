# Braintree Web Drop-in Reference <span>v@VERSION</span>

<span class="rule"></span>

* [Overview](#overview)
* [Setup](#setup)
* [Usage](#usage)
  * [Accepting cards](#accepting-cards)
  * [Accepting PayPal](#accepting-paypal)
  * [Localization](#localization)
  * [Events](#events)
  * [Styling](#styling)
* [Browser support](#browser-support)
* [Additional resources](#additional-resources)

<span class="rule"></span>

<a id="overview"></a>
## Overview

Drop-in is a pre-made payments UI for desktop and mobile browsers to be used with cards, PayPal, and PayPal Credit. It can be used as a one-time guest checkout or to offer saved payment methods with a client token created using a [customer ID](https://developers.braintreepayments.com/guides/drop-in/javascript/v3#customer-id).

Test out our [demo app](/braintree-web-drop-in) with one of our [test card numbers](https://developers.braintreepayments.com/reference/general/testing/#no-credit-card-errors) or a [sandbox PayPal account](https://developer.paypal.com/docs/classic/lifecycle/sb_create-accounts/).

If you have any feedback or questions, create a [GitHub issue](https://github.com/braintree/braintree-web-drop-in/issues) or [contact Braintree support](https://developers.braintreepayments.com/forms/contact).

<a id="setup"></a>
## Setup

The Drop-in source is available from our CDN, that you can include in your project with a script tag:

```html
<script src="https://js.braintreegateway.com/web/dropin/@VERSION/js/dropin.min.js"></script>

<script>
braintree.dropin.create({ /* options */ }, callback);
<script>
```

You can also get Drop-in from [npm](https://www.npmjs.com/).

```sh
npm install --save braintree-web-drop-in
```

```javascript
var dropin = require('braintree-web-drop-in');

dropin.create({ /* options */ }, callback);
```

<a id="usage"></a>
## Usage

Drop-in provides a payment method object containing the [payment method nonce](https://developers.braintreepayments.com/start/overview#payment-method-nonce) to send to your server. To get this object, use the `requestPaymentMethod` function.

If you are using a [script tag integration](module-braintree-web-drop-in.html), a hidden `payment_method_nonce` input will be added to the form with the nonce value. The following instructions specify usage of a JavaScript integration.

<a id="accepting-cards"></a>
### Accepting cards

By default, Drop-in is configured to accepted cards and does not require any additional parameters in the [`create`](module-braintree-web-drop-in.html#.create) call. If you are only accepting cards, Drop-in will appear as a card form. If you are accepting multiple payment options, Card will appear as an option in the list. CVV and Postal Code inputs are rendered conditionally based on [AVS and CVV settings](https://articles.braintreepayments.com/guides/fraud-tools/basic/avs-cvv-rules).

For credit cards, calling [`requestPaymentMethod`](Dropin.html#requestPaymentMethod) will attempt to validate the card form and will call the supplied callback with a payload, including the payment method nonce, if successful. If not successful, an error will be shown in the UI and the callback will be called with an error. Errors include invalid card details as well as card types not enabled by your merchant account.

Use [events](Dropin.html#on) to know when the card form could be considered valid. This does not necessarily mean the card form is complete, but it means it is considered valid by our client side validation.

<a id="accepting-paypal"></a>
### Accepting PayPal
For PayPal and PayPal Credit, users will click the PayPal button and continue through the PayPal authentication flow. After successful completion, the PayPal account will be visible in the UI and that payment method can be requested. Use [events](Dropin.html#on) to know when the authentication flow has been completed and the payment method can be requested.

More details about PayPal and PayPal Credit can be found in the Braintree [developer docs](https://developers.braintreepayments.com/guides/paypal/overview/javascript/v3).

<a id="localization"></a>
### Localization

To translate Drop-in into different languages, pass a [supported locale code](module-braintree-web-drop-in.html#.create) in your `create` call:

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  locale: 'de_DE'
}, callback);
```

<a id="events"></a>
### Events

Use events to know whether or not a payment method is currently available from Drop-in. This can be used to dynamically enable and disable a submit button or automatically submit a nonce to your server after the PayPal flow has successfully completed.

See [`on`](Dropin.html#on) for more details and an example of event usage.

<a id="styling"></a>
### Styling

The stylesheet for Drop-in will load automatically when Drop-in is initialized.

If you are using a custom build of Drop-in or would like to use an alternative stylesheet, you can provide a `link` tag on your page with the id `braintree-dropin-stylesheet`. This will prevent the external stylesheet from loading.

If you are using npm to manage your assets and would prefer to use a local version of the CSS, you can use the dropin.css file found in `node_modules/braintree-web-drop-in/dropin.css` and put it on your page in a `link` tag with the id `braintree-dropin-stylesheet`.

<a id="browser-support"></a>
## Browser support

Drop-in and the Braintree JS SDK have the same [browser support](http://braintree.github.io/braintree-web/current/#browser-support).

<a id="additional-resources"></a>
## Additional resources

<li>[Braintree Drop-in Payment UI guide](https://developers.braintreepayments.com/guides/drop-in/javascript/v3)</li>
<li>[`braintree-web-drop-in` GitHub repo](https://github.com/braintree/braintree-web-drop-in)</li>
