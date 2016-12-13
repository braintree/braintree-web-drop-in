# Braintree Web Drop-in

A pre-made payments UI for accepting cards and alternative payments in the browser built using version 3 of the [Braintree JS client SDK](https://github.com/braintree/braintree-web).

Because we're still in beta, the API and designs are subject to change. If you have any feedback in these areas, create an [issue](https://github.com/braintree/braintree-web-drop-in/issues) or email us at [web-drop-in-beta@getbraintree.com](mailto:web-drop-in-beta@getbraintree.com).

## What's new

- Updated UI to easily accommodate multiple payment methods
- Not in an iframe; feel free to style Drop-in to blend in with your website
- Open source and open development

## Basic usage

Drop-in provides a payment method object containing the [payment method nonce](https://developers.braintreepayments.com/start/overview#payment-method-nonce) to send to your server. To get this object, use the `requestPaymentMethod` function. For credit cards, this attempts to validate the card form and will call the supplied callback with a payload, including the payment method nonce, if successful. If not successful, an error will be shown in the UI and the callback will be called with an error.

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
       // Errors relevant to users will be show in the UI as well
      }

      // Send payload.nonce to your server
    });
  });
});
```

The structure of the credit card payment method objects that will be returned from Drop-in can be found [here](http://braintree.github.io/braintree-web/current/HostedFields.html#~tokenizePayload);

## Using PayPal

If your merchant account is configured to use PayPal, simply include a PayPal configuration object in your create call to have the PayPal button option included in your dropdown. The following example uses the [PayPal Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3).

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypal: {
    flow: 'vault'
  }
}, callback);
```

You can find more PayPal configuration options in the [Braintree JS client SDK v3 reference](https://braintree.github.io/braintree-web/current/PayPal.html#tokenize).

The structure of the PayPal payment method objects that will be returned from Drop-in can be found [here](http://braintree.github.io/braintree-web/current/PayPal.html#~tokenizeReturn);

## Full example

This is a full example of a Drop-in integration only accepting credit cards.

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

    <script src="https://js.braintreegateway.com/web/dropin/1.0.0-beta.1/js/dropin.min.js"></script>

      <script>
      var submitButton = document.querySelector('#submit-button');

      braintree.dropin.create({
        authorization: 'CLIENT_AUTHORIZATION',
        selector: '#dropin-container'
      }, function (err, dropinInstance) {
        if (err) {
          // Handle any errors that might've occured when creating Drop-in
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
