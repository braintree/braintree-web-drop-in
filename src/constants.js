'use strict';

module.exports = {
  cardTypes: {
    Visa: 'visa',
    MasterCard: 'master-card',
    'American Express': 'american-express',
    'Diners Club': 'diners-club',
    Discover: 'discover',
    JCB: 'jcb',
    UnionPay: 'unionpay',
    Maestro: 'maestro'
  },
  supportedCardTypes: {
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
  STYLESHEET_ID: 'braintree-dropin-stylesheet'
};
