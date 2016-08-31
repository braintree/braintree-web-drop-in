'use strict';

module.exports = {
  events: {
    NO_PAYMENT_METHOD_REQUESTABLE: 'noPaymentMethodRequestable',
    PAYMENT_METHOD_REQUESTABLE: 'paymentMethodRequestable'
  },
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
  INTEGRATION: 'dropin2'
};
