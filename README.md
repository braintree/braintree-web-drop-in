# Braintree Web Drop-in

A pre-made payments UI for integrating Braintree in the browser built using version 3 of the [JS client SDK](https://github.com/braintree/braintree-web).

This version of Drop-in is still in development, but will be available in the near future.

## Usage

Using `getActivePaymentMethod()`

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypal: {
    flow: 'vault'
  }
}, function (err, dropinInstance) {
  submitButton.addEventListener('click', function () {
    var paymentMethod = dropinInstance.getActivePaymentMethod();

    if (paymentMethod) {
      // Submit paymentMethod.nonce to your server
    }
  }
});
```

Subscribing to `paymentMethodAvailable` events:

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypal: {
    flow: 'vault'
  }
}, function (err, dropinInstance) {
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
