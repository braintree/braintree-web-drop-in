# Braintree Web Drop-in

A pre-made payments UI for accepting cards and alternative payments in the browser built using version 3 of the [Braintree JS client SDK](https://github.com/braintree/braintree-web).

Because we're still in beta, the API and designs are subject to change. If you have any feedback in these areas, create an [issue](https://github.com/braintree/braintree-web-drop-in/issues) or email us at [web-drop-in-beta@getbraintree.com](mailto:web-drop-in-beta@getbraintree.com).

## What's new

- Updated UI to easily accommodate multiple payment methods
- Not in an iframe; feel free to style Drop-in to blend in with your website
- Open source and open development

## Setup

Drop-in is currently available directly from our servers, which you can save locally or include in your project through a script tag:

```html
<script src="https://js.braintreegateway.com/web/dropin/1.0.0-beta.4/js/dropin.min.js"></script>
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

You can find more PayPal configuration options in the [Braintree JS client SDK v3 reference](https://braintree.github.io/braintree-web/current/PayPal.html#tokenize).

The structure of the PayPal payment method object returned in the callback of `requestPaymentMethod` can be found [here](http://braintree.github.io/braintree-web/current/PayPal.html#~tokenizePayload).

If you need to update a field (such as the amount) after creation, you can do so with the `setPayPalOption` method.

```js
dropinInstance.setPayPalOption('amount', '20.00');
```

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

    <script src="https://js.braintreegateway.com/web/dropin/1.0.0-beta.4/js/dropin.min.js"></script>

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

## Beta notes

While in beta, we're still actively working on Drop-in. This means you might have to change your integration when upgrading your Drop-in version. This includes any custom CSS styling applied to `data-braintree-id` attributes.

Browser support will be limited during beta and will not include Internet Explorer 9 or 10, but will eventually include [all browsers supported by Braintree.js](http://braintree.github.io/braintree-web/current/#browser-support).

Much of the behavior in this version of Drop-in differs from the [previous version](https://developers.braintreepayments.com/guides/drop-in/javascript/v2). At this point, adding the hidden `payment_method_nonce` input and automatic form submission (the default behavior in the previous version) are not available.

Here are some of the features we're still working on:

 - Event API: An event system to indicate when a payment method can be requested
 - Localization and internationalization
 - Full documentation in the [Braintree developer docs](https://developers.braintreepayments.com/guides/overview) and an API reference
 - Support for additional types of payment methods
 - Support for Internet Explorer 9 and 10
