'use strict';

var analytics = require('./analytics');
var find = require('./find-parent-form');
var uuid = require('@braintree/uuid');
var DropinError = require('./dropin-error');
var kebabCaseToCamelCase = require('./kebab-case-to-camel-case');
var WHITELISTED_DATA_ATTRIBUTES = [
  'locale',
  'payment-option-priority',

  'data-collector.kount',
  'data-collector.paypal',

  // camelcase version was accidentally used initially.
  // we add the kebab case version to match the docs, but
  // we retain the camelcase version for backwards compatibility
  'card.cardholderName',
  'card.cardholderName.required',
  'card.cardholder-name',
  'card.cardholder-name.required',

  'paypal.amount',
  'paypal.currency',
  'paypal.flow',
  'paypal.landing-page-type',

  'paypal-credit.amount',
  'paypal-credit.currency',
  'paypal-credit.flow',
  'paypal-credit.landing-page-type'
];

function injectHiddenInput(name, value, form) {
  var input = form.querySelector('[name="' + name + '"]');

  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    form.appendChild(input);
  }

  input.value = value;
}

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

  scriptTag.parentNode.insertBefore(container, scriptTag);

  createOptions = {
    authorization: authorization,
    container: container
  };

  WHITELISTED_DATA_ATTRIBUTES.forEach(function (compositeKey) {
    var value = scriptTag.getAttribute('data-' + compositeKey);

    if (value == null) {
      return;
    }

    addCompositeKeyValuePairToObject(createOptions, compositeKey, value);
  });

  createFunction(createOptions).then(function (instance) {
    analytics.sendEvent(instance._client, 'integration-type.script-tag');
    form.addEventListener('submit', function () {
      instance.requestPaymentMethod(function (requestPaymentError, payload) {
        if (requestPaymentError) {
          return;
        }

        injectHiddenInput('payment_method_nonce', payload.nonce, form);

        if (payload.deviceData) {
          injectHiddenInput('device_data', payload.deviceData, form);
        }

        form.submit();
      });
    });
  });
}

module.exports = createFromScriptTag;
