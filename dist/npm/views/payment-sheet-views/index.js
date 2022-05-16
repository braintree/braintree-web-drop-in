'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;

var result = {};

result[paymentOptionIDs.applePay] = require('./apple-pay-view');
result[paymentOptionIDs.card] = require('./card-view');
result[paymentOptionIDs.googlePay] = require('./google-pay-view');
result[paymentOptionIDs.paypal] = require('./paypal-view');
result[paymentOptionIDs.paypalCredit] = require('./paypal-credit-view');
result[paymentOptionIDs.venmo] = require('./venmo-view');

module.exports = result;
