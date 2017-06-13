'use strict';

var assign = require('./assign').assign;
var find = require('./find-parent-form');
var uuid = require('./uuid');
var DropinError = require('./dropin-error');

function addCompositeKeyValuePairToObject(obj, key, value) {
  var decomposedKeys = key.split('.');

  if (decomposedKeys.length === 1) {
    obj[decomposedKeys[0]] = deserialize(value);
  } else {
    obj[decomposedKeys[0]] = obj[decomposedKeys[0]] || {};
    addCompositeKeyValuePairToObject(obj[decomposedKeys[0]], decomposedKeys.slice(1).join('.'), value);
  }
}

function deserialize(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function createFromScriptTag(createFunction, scriptTag) {
  var authorization, container, createOptions, form, scriptTagDataset;

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

  form.addEventListener('submit', function (event) {
    event.preventDefault();
  });

  form.insertBefore(container, scriptTag);

  createOptions = {
    authorization: authorization,
    container: container
  };

  scriptTagDataset = assign({}, scriptTag.dataset);
  delete scriptTagDataset.braintreeDropinAuthorization;
  Object.keys(scriptTagDataset).forEach(function (compositeKey) {
    addCompositeKeyValuePairToObject(createOptions, compositeKey, scriptTag.dataset[compositeKey]);
  });

  createFunction(createOptions).then(function (instance) {
    form.addEventListener('submit', function () {
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
