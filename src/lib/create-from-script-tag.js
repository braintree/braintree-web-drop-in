'use strict';

var find = require('./find-parent-form');
var uuid = require('./uuid');
var DropinError = require('./dropin-error');

function createFromScriptTag(createFunction, scriptTag) {
  var authorization, containerId, container, form;

  if (!scriptTag) {
    return;
  }

  authorization = scriptTag.getAttribute('data-braintree-dropin-authorization');

  if (!authorization) {
    throw new DropinError('Authorization not found in data-braintree-dropin-authorization attribute');
  }

  containerId = 'braintree-dropin-' + uuid();
  container = document.createElement('div');
  container.id = containerId;

  form = find.findParentForm(scriptTag);

  if (!form) {
    throw new DropinError('No form found for script tag integration.');
  }

  form.insertBefore(container, scriptTag);

  createFunction({
    authorization: authorization,
    selector: '#' + containerId
  }, function (createError, instance) {
    if (createError) {
      throw createError;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      instance.requestPaymentMethod(function (requestPaymentError, payload) {
        var paymentMethodNonce = form.querySelector('[name="payment_method_nonce"]');

        if (requestPaymentError) {
          return;
        }

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
