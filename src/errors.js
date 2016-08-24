'use strict';

var BraintreeError = require('./lib/error');

module.exports = {
  CALLBACK_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'CALLBACK_REQUIRED'
  },
  AUTHORIZATION_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'AUTHORIZATION_REQUIRED'
  },
  SELECTOR_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'SELECTOR_REQUIRED',
    message: 'options.selector is required.'
  },
  VALID_DOM_NODE_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'VALID_DOM_NODE_REQUIRED',
    message: 'options.selector must reference a valid DOM node.'
  },
  EMPTY_DOM_NODE_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'EMPTY_DOM_NODE_REQUIRED',
    message: 'options.selector must reference an empty DOM node.'
  },
  REQUEST_PAYMENT_METHOD_UNAVAILABLE: {
    type: BraintreeError.types.MERCHANT,
    code: 'REQUEST_PAYMENT_METHOD_UNAVAILABLE',
    message: 'No payment method available.'
  },
  DROPIN_CARD_TYPE_UNSUPPORTED: {
    type: BraintreeError.types.CUSTOMER,
    code: 'DROPIN_CARD_TYPE_UNSUPPORTED',
    message: 'Card type is unsupported.'
  }
};
