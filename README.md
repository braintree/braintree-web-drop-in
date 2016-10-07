# Braintree Web Drop-in

A pre-made payments UI for accepting cards and alternative payments in the browser built using version 3 of the [Braintree JS client SDK](https://github.com/braintree/braintree-web).

Because we're still in beta, the API and designs are subject to change. If you have any feedback in these areas, create an [issue](https://github.com/braintree/braintree-web-drop-in/issues) or email us at [web-drop-in-beta@braintreepayments.com](mailto:web-drop-in-beta@braintreepayments.com).

## What's new

  - Updated UI to easily accommodate multiple payment methods
  - Not in an iframe; feel free to style Drop-in to blend in with your website
  - Open source and open development

## Basic usage

Drop-in provides a payment method object containing the payment method nonce to send to your server. There are two ways to get this payment method object.

Use `getActivePaymentMethod()` to get the payment method object at any time, such as a button click. This example assumes you want to get a payment method object when a `submitButton` is clicked.

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container'
}, function (err, dropinInstance) {
  submitButton.addEventListener('click', function () {
    var paymentMethod = dropinInstance.getActivePaymentMethod();

    if (paymentMethod) {
      // Submit paymentMethod.nonce to your server
    }
  }
});
```

Use `paymentMethodAvailable` events to get the payment method object as soon as it becomes available. This event will _not_ be fired in the case that you are using a vaulted flow using a client token generated with a customer id.

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
}, function (err, dropinInstance) {
  // Make sure to get the first active payment method if you are using a vaulted flow
  var activePaymentMethod = dropinInstance.getActivePaymentMethod();

  dropinInstance.on('paymentMethodAvailable', function (paymentMethod) {
    activePaymentMethod = paymentMethod;
  });

  submitButton.addEventListener('click', function () {
    if (activePaymentMethod) {
      // Submit activePaymentMethod.nonce to your server
    }
  }
});
```

The structure of the credit card payment method objects that will be returned from Drop-in can be found [here](http://braintree.github.io/braintree-web/current/HostedFields.html#~tokenizePayload);

## Using PayPal

If your merchant account is configured to use PayPal, simply include a PayPal configuration object in your create call to have the PayPal button option included in your dropdown. The following example uses our [PayPal Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3).

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypal: {
    flow: 'vault'
  }
}, callback);
```

You can find more PayPal configuration options in the [Braintree JS client SDK v3 reference](https://braintree.github.io/braintree-web/3.3.0/PayPal.html#tokenize).

The structure of the credit card payment method objects that will be returned from Drop-in can be found [here](http://braintree.github.io/braintree-web/current/PayPal.html#~tokenizeReturn);

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
           var paymentMethod = dropinInstance.getActivePaymentMethod();

           if (paymentMethod) {
             // Submit paymentMethod.nonce to your server
           }
         }, false);
       });
     </script>
   </body>
 </html>
 ```
