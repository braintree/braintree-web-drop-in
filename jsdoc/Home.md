# Braintree Web Drop-in Reference <span>v{@pkg version}</span>

<span class="rule"></span>

* [Overview](#overview)
* [Setup](#setup)
* [Usage](#usage)
  * [Accepting cards](#accepting-cards)
  * [Accepting PayPal](#accepting-paypal)
  * [Accepting Venmo](#accepting-venmo)
  * [Accepting Apple Pay](#accepting-apple-pay)
  * [Accepting Google Pay](#accepting-google-pay)
  * [Localization](#localization)
  * [Events](#events)
  * [Styling](#styling)
* [Browser support](#browser-support)
* [Content Security Policy](#content-security-policy)
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
<script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"></script>

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

<a id="accepting-venmo"></a>
### Accepting Venmo
For Venmo, users will click the Venmo button on their mobile device, which will open up the Venmo app to authenticate the purchase and then return back to the webpage. After successful completion, the Venmo account will be visible in the UI and that payment method can be requested. Use [events](Dropin.html#on) to know when the authentication flow has been completed and the payment method can be requested.

More details about Venmo can be found in the Braintree [developer docs](https://developers.braintreepayments.com/guides/venmo/overview).

<a id="accepting-apple-pay"></a>
### Accepting Apple Pay
For Apple Pay, users will click the Apple Pay button. After successful completion, the payment method can be requested. Use [events](Dropin.html#on) to know when the authentication flow has been completed and the payment method can be requested.

More details about Apple Pay can be found in the Braintree [developer docs](https://developers.braintreepayments.com/guides/apple-pay/overview).

<a id="accepting-google-pay"></a>
### Accepting Google Pay
For Google Pay, users will click the Google Pay button. After successful completion, the payment method can be requested. Use [events](Dropin.html#on) to know when the authentication flow has been completed and the payment method can be requested.

More details about Google Pay can be found in the Braintree [developer docs](https://developers.braintreepayments.com/guides/google-pay/overview).

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

<a id="content-security-policy"></a>
## Using `braintree-web-drop-in` with a Content Security Policy

[Content Security Policy](http://www.html5rocks.com/en/tutorials/security/content-security-policy/) is a feature of web browsers that mitigates cross-site scripting and other attacks. By limiting the origins of resources that may be loaded on your page, you can maintain tighter control over any potentially malicious code. We recommend considering the implementation of a CSP when available.

### Basic Directives

|             | Sandbox                                                                                                        | Production                                                                                     |
|-------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| script-src  | js.braintreegateway.com<br/>assets.braintreegateway.com                                                        | js.braintreegateway.com<br/>assets.braintreegateway.com                                        |
| img-src     | assets.braintreegateway.com<br/>data:                                                                          | assets.braintreegateway.com<br/>data:                                                          |
| child-src   | assets.braintreegateway.com                                                                                    | assets.braintreegateway.com                                                                    |
| frame-src   | assets.braintreegateway.com                                                                                    | assets.braintreegateway.com                                                                    |
| connect-src | api.sandbox.braintreegateway.com<br/>client-analytics.sandbox.braintreegateway.com<br/>&#42;.braintree-api.com | api.braintreegateway.com<br/>client-analytics.braintreegateway.com<br/>&#42;.braintree-api.com |

### PayPal Specific Directives

If using [PayPal](module-braintree-web-drop-in.html#~paypalCreateOptions), include these additional directives:

|             | Sandbox                                                          | Production                                                       |
|-------------|------------------------------------------------------------------|------------------------------------------------------------------|
| script-src  | www.paypalobjects.com<br/>&#42;.paypal.com<br/>'unsafe-inline' | www.paypalobjects.com<br/>&#42;.paypal.com<br/>'unsafe-inline' |
| style-src   | 'unsafe-inline'                                                  | 'unsafe-inline'                                                  |
| img-src     | checkout.paypal.com                                              | checkout.paypal.com                                              |
| child-src   | &#42;.paypal.com                                                 | &#42;.paypal.com                                                 |
| frame-src   | &#42;.paypal.com                                                 | &#42;.paypal.com                                                 |

### Google Pay Specific Directives

If using [Google Pay](module-braintree-web-drop-in.html#~googlePayCreateOptions), include these additional directives:

|             | Sandbox         | Production      |
|-------------|-----------------|-----------------|
| script-src  | pay.google.com  | pay.google.com  |
| style-src   | 'unsafe-inline' | 'unsafe-inline' |

The `style-src` directive is required so that the styles for the Google Pay button can be generated by the Google Pay SDK. You may omit this directive, so long as you include style rules for the Google Pay button to satisfy [Google's brand guidelines](https://developers.google.com/pay/api/web/guides/brand-guidelines#payment-buttons).

### 3D Secure Specific Directives

If using [3D Secure](module-braintree-web-drop-in.html#~threeDSecureOptions), include these additional directives:

|             | Sandbox                           | Production                    |
|-------------|-----------------------------------|-------------------------------|
| script-src  | songbirdstag.cardinalcommerce.com | songbird.cardinalcommerce.com |
| frame-src   | &#42;.cardinalcommerce.com        | &#42;.cardinalcommerce.com    |
| connect-src | &#42;.cardinalcommerce.com        | &#42;.cardinalcommerce.com    |

### Data Collector Specific Directives

If using Kount with [Data Collector](module-braintree-web-drop-in.html#~dataCollectorOptions), adhere to the [Kount CSP guide](https://support.kount.com/s/article/How-is-Content-Security-Policy-Used).

<a id="additional-resources"></a>
## Additional resources

- [Braintree Drop-in Payment UI guide](https://developers.braintreepayments.com/guides/drop-in/javascript/v3)
- [`braintree-web-drop-in` GitHub repo](https://github.com/braintree/braintree-web-drop-in)
