# Braintree Web Drop-in

A pre-made payments UI for integrating Braintree in the browser built using version 3 of the [JS client SDK](https://github.com/braintree/braintree-web).

This version of Drop-in is still in development, but will be available in the near future.

## Usage

```js
braintree.dropin.create({
  authorization: 'CLIENT_AUTHORIZATION',
  selector: '#dropin-container',
  paypal: {
    flow: 'vault'
  }
}, function (err, dropinInstance) {
  submitButton.addEventListener('click', function () {
    dropinInstance.requestPaymentMethod(function (err, data) {
      // Submit data.nonce to your server
    }
  }
});
```
