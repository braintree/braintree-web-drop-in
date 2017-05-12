# Braintree Web Drop-in

A pre-made payments UI for accepting cards and alternative payments in the browser built using version 3 of the [Braintree JS client SDK](https://github.com/braintree/braintree-web).

If you have any feedback or questions, create an [issue](https://github.com/braintree/braintree-web-drop-in/issues) or [contact Braintree support](https://developers.braintreepayments.com/forms/contact).

## What's new

- Updated UI to easily accommodate multiple payment methods
- Not in an iframe; feel free to style Drop-in to blend in with your website
- Now available in [23 languages](#localization)
- Open source and open development

## Setup

Drop-in is currently available directly from our servers, which you can save locally or include in your project through a script tag:

```html
<script src="https://js.braintreegateway.com/web/dropin/1.0.2/js/dropin.min.js"></script>
```

## Basic usage

Drop-in provides a payment method object containing the [payment method nonce](https://developers.braintreepayments.com/start/overview#payment-method-nonce) to send to your server. To get this object, use the `requestPaymentMethod` function as shown below.

For credit cards, this attempts to validate the card form and will call the supplied callback with a payload, including the payment method nonce, if successful. If not successful, an error will be shown in the UI and the callback will be called with an error.

Other payment methods may behave differently. Refer to their documentation for details.

In your `create` call, provide an `authorization` and a `selector`:

- `authorization`: Your [client authorization](https://developers.braintreepayments.com/guides/authorization/overview) should be a [client token](https://developers.braintreepayments.com/guides/authorization/client-token) from your server or a [tokenization key](https://developers.braintreepayments.com/guides/authorization/tokenization-key) that can be found in the Braintree Control Panel. If you [pass a customer ID](https://developers.braintreepayments.com/reference/request/client-token/generate#specify-a-customer-id) when generating the client token, Drop-in will display that customer's saved payment methods and automatically store any newly-added payment methods in their Vault record.

- `selector`: This must be the selector for an empty element, such as a `<div>`, where Drop-in will be included on your page.

```js
var submitButton = document.querySelector('#submit-button');

braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container'
}, function (err, dropinInstance) {
  submitButton.addEventListener('click', function () {
    dropinInstance.requestPaymentMethod(function (err, payload) {
      if (err) {
       // Handle errors in requesting payment method
       // This includes invalid card form or no payment method available
       // Errors relevant to customers will be show in the UI as well

       return;
      }

      // Send payload.nonce to your server
    });
  });
});
```

The structure of the credit card payment method object returned in the callback of `requestPaymentMethod` can be found [here](http://braintree.github.io/braintree-web/current/HostedFields.html#~tokenizePayload).

## Using PayPal

If PayPal is enabled for your merchant account, include PayPal configuration options in the `create` call. The required `flow` property can be either `vault` or `checkout`, depending on whether you want to use the PayPal [Vault](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3) or [Checkout](https://developers.braintreepayments.com/guides/paypal/checkout-with-paypal/javascript/v3) flow.

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypal: {
    flow: 'checkout',
    amount: 10.00,
    currency: 'USD'
  }
}, callback);
```

You can find more PayPal configuration options in the [Braintree JS client SDK v3 reference](http://braintree.github.io/braintree-web/current/PayPalCheckout.html#createPayment).

The structure of the PayPal payment method object returned in the callback of `requestPaymentMethod` can be found [here](http://braintree.github.io/braintree-web/current/PayPalCheckout.html#~tokenizePayload).

### PayPal Credit

PayPal Credit can also be enabled in Drop-in by including `paypalCredit` configuration options in the `create` call:

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypalCredit: {
    flow: 'checkout', // Required for PayPal Credit
    amount: 10.00,
    currency: 'USD'
  }
}, callback);
```

PayPal Credit configuration parameters are the same as those for [PayPal](http://braintree.github.io/braintree-web/current/PayPalCheckout.html#createPayment).

More details about PayPal Credit can be found in the Braintree [support articles](https://articles.braintreepayments.com/guides/payment-methods/paypal/paypal-credit).

## Full example

This is a full example of a Drop-in integration that only accepts credit cards.

 ```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Checkout</title>
  </head>
  <body>
    <div id="dropin-container"></div>
    <button id="submit-button">Purchase</button>

    <script src="https://js.braintreegateway.com/web/dropin/1.0.2/js/dropin.min.js"></script>

    <script>
      var submitButton = document.querySelector('#submit-button');

      braintree.dropin.create({
        authorization: 'CLIENT_AUTHORIZATION',
        selector: '#dropin-container'
      }, function (err, dropinInstance) {
        if (err) {
          // Handle any errors that might've occurred when creating Drop-in
          console.error(err);
          return;
        }
        submitButton.addEventListener('click', function () {
          dropinInstance.requestPaymentMethod(function (err, payload) {
            if (err) {
              // Handle errors in requesting payment method
            }

            // Send payload.nonce to your server
          });
        });
      });
    </script>
  </body>
</html>
```

## Localization

You can pass a `locale` property to translate the Drop-in into other languages. Possible values are:

```
da_DK
de_DE
en_US
en_AU
en_GB
es_ES
fr_CA
fr_FR
id_ID
it_IT
ja_JP
ko_KR
nl_NL
no_NO
pl_PL
pt_BR
pt_PT
ru_RU
sv_SE
th_TH
zh_CN
zh_HK
zh_TW
```

## Payment option priority

By default, Drop-in displays the credit/debit card form first, followed by PayPal (if enabled). You can customize this ordering with `paymentOptionPriority` as shown in this example:

```js
braintree.dropin.create({
  // ...
  paymentOptionPriority: ['paypal', 'card'] // Display PayPal first
}, /* ... */);
```

Payment options omitted from this array will not be offered to the customer.

## Events

### `paymentMethodRequestable` and `noPaymentMethodRequestable`

`paymentMethodRequestable` fires when a payment method can be retrieved using `requestPaymentMethod`. The event includes an object that provides the type of payment method (CreditCard, PayPalAccount, etc) that is ready to be requested. 

`noPaymentMethodRequestable` fires when a payment method can no longer be retrieved with `requestPaymentMethod`.

Using these events, you can dynamically enable or disable your submit button based on whether or not the payment method is requestable:

```js
var submitButton = document.querySelector('#submit-button');

braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container'
}, function (err, dropinInstance) {
  submitButton.addEventListener('click', function () {
    dropinInstance.requestPaymentMethod(function (err, payload) { /* send to payload.nonce to server */ });
  });

  if (dropinInstance.isPaymentMethodRequestable()) {
    // this will be true if you generated the client token
    // with a customer ID and there is a saved payment method
    // available to tokenize with that customer
    submitButton.removeAttribute('disabled');
  }

  dropinInstance.on('paymentMethodRequestable', function (event) {
    event.type; // the type of Payment Method, IE CreditCard, PayPalAccount

    submitButton.removeAttribute('disabled');
  });

  dropinInstance.on('noPaymentMethodRequestable', function () {
    submitButton.setAttribute('disabled', true);
  });
});
```

## Teardown

When you want to cleanly tear down anything set up by `dropin.create`, use `teardown()`. This may be useful in a single-page app.

```js
var dropinInstance;

braintree.dropin.create({
    // ...
  }, function (err, dropin) {
    // ...
    dropinInstance = dropin;
  });

// ...
dropinInstance.teardown(function (err) {
  // Called once teardown is complete. No data is returned if teardown completes successfully.
  if (err) { /* an error occurred during teardown */ }
});
```

## Browser support

Drop-in is supported in all browsers supported by the [Braintree JavaScript Client SDK](http://braintree.github.io/braintree-web/current/#browser-support).
