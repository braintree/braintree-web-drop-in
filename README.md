# Braintree Web Drop-in

A pre-made payments UI for accepting cards and alternative payments in the browser built using version 3 of the [Braintree JS client SDK](https://github.com/braintree/braintree-web).

If you have any feedback or questions, create an [issue](https://github.com/braintree/braintree-web-drop-in/issues) or [contact Braintree support](https://developers.braintreepayments.com/forms/contact).

## What's new

- Updated UI to easily accommodate multiple payment methods
- Not in an iframe; feel free to style Drop-in to blend in with your website
- Now available in [23 languages](https://github.com/braintree/braintree-web-drop-in/tree/release#localization)
- Open source and open development

## Getting started
[//]: # (Add the following line when JSDocs are deployed)
[//]: # (For setup and usage, see our [reference](https://braintree.github.io/braintree-web-drop-in/docs/current/).)

See the Getting started guide on the [`release` branch](https://github.com/braintree/braintree-web-drop-in/tree/release#setup) until our reference is available.

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

## Browser support

Drop-in is supported in all browsers supported by the [Braintree JavaScript Client SDK](http://braintree.github.io/braintree-web/current/#browser-support).
