'use strict';

module.exports = {
  paymentMethodCardTypes: {
    Visa: 'visa',
    MasterCard: 'master-card',
    'American Express': 'american-express',
    'Diners Club': 'diners-club',
    Discover: 'discover',
    JCB: 'jcb',
    UnionPay: 'unionpay',
    Maestro: 'maestro'
  },
  configurationCardTypes: {
    visa: 'Visa',
    'master-card': 'MasterCard',
    'american-express': 'American Express',
    'diners-club': 'Discover',
    discover: 'Discover',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    maestro: 'Maestro'
  },
  INTEGRATION: 'dropin',
  STYLESHEET_ID: 'braintree-dropin-stylesheet',
  NO_PAYMENT_METHOD_ERROR: 'No payment method is available.'
};
