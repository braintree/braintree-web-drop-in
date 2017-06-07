'use strict';

var find = require('./find-parent-form');
var uuid = require('./uuid');
var DropinError = require('./dropin-error');

function createFromScriptTag(createFunction, scriptTag) {
  var authorization, container, form;

  if (!scriptTag) {
    return;
  }

  authorization = scriptTag.getAttribute('data-braintree-dropin-authorization');

  if (!authorization) {
    throw new DropinError('Authorization not found in data-braintree-dropin-authorization attribute');
  }

  container = document.createElement('div');
  container.id = 'braintree-dropin-' + uuid();

  form = find.findParentForm(scriptTag);

  if (!form) {
    throw new DropinError('No form found for script tag integration.');
  }

  form.insertBefore(container, scriptTag);

  createFunction({
    authorization: authorization,
    container: container
  }).then(function (instance) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      instance.requestPaymentMethod(function (requestPaymentError, payload) {
        var paymentMethodNonce;

        if (requestPaymentError) {
          return;
        }

        paymentMethodNonce = form.querySelector('[name="payment_method_nonce"]');

        if (!paymentMethodNonce) {
          paymentMethodNonce = document.createElement('input');
          paymentMethodNonce.type = 'hidden';
          paymentMethodNonce.name = 'payment_method_nonce';
          form.appendChild(paymentMethodNonce);
        }

        paymentMethodNonce.value = payload.nonce;

        form.submit();
      });
    });
  });
}

module.exports = createFromScriptTag;
