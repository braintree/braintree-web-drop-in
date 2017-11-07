'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;

var result = {};

result[paymentOptionIDs.card] = require('./card-view');
result[paymentOptionIDs.paypal] = require('./paypal-view');
result[paymentOptionIDs.paypalCredit] = require('./paypal-credit-view');
result[paymentOptionIDs.applePay] = require('./apple-pay-view');

module.exports = result;
