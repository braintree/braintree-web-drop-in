'use strict';

var find = require('./find-parent-form');
var uuid = require('./uuid');
var DropinError = require('./dropin-error');
var kebabCaseToCamelCase = require('./kebab-case-to-camel-case');
var WHITELISTED_DATA_ATTRIBUTES = [
  'locale',
  'payment-option-priority',

  'paypal.amount',
  'paypal.currency',
  'paypal.flow',

  'paypal-credit.amount',
  'paypal-credit.currency',
  'paypal-credit.flow'
];

function addCompositeKeyValuePairToObject(obj, key, value) {
  var decomposedKeys = key.split('.');
  var topLevelKey = kebabCaseToCamelCase(decomposedKeys[0]);

  if (decomposedKeys.length === 1) {
    obj[topLevelKey] = deserialize(value);
  } else {
    obj[topLevelKey] = obj[topLevelKey] || {};
    addCompositeKeyValuePairToObject(obj[topLevelKey], decomposedKeys.slice(1).join('.'), value);
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
  var authorization, container, createOptions, form;

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

  WHITELISTED_DATA_ATTRIBUTES.forEach(function (compositeKey) {
    var value = scriptTag.getAttribute('data-' + compositeKey);

    if (!value) {
      return;
    }

    addCompositeKeyValuePairToObject(createOptions, compositeKey, value);
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
