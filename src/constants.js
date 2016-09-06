'use strict';

module.exports = {
  cardTypes: {
    visa: 'Visa',
    'master-card': 'MasterCard',
    'american-express': 'American Express',
    'diners-club': 'Discover',
    discover: 'Discover',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    maestro: 'Maestro'
  },
  events: {
    NO_PAYMENT_METHOD_REQUESTABLE: 'noPaymentMethodRequestable',
    PAYMENT_METHOD_REQUESTABLE: 'paymentMethodRequestable'
  },
  INTEGRATION: 'dropin'
};
