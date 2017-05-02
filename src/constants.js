'use strict';

module.exports = {
  paymentOptionIDs: {
    card: 'card',
    paypal: 'paypal',
    paypalCredit: 'paypalCredit'
  },
  paymentMethodTypes: {
    card: 'CreditCard',
    paypal: 'PayPalAccount',
    paypalCredit: 'PayPalAccount'
  },
  analyticsKinds: {
    CreditCard: 'card',
    PayPalAccount: 'paypal'
  },
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
  errors: {
    NO_PAYMENT_METHOD_ERROR: 'No payment method is available.'
  },
  ANALYTICS_REQUEST_TIMEOUT_MS: 2000,
  ANALYTICS_PREFIX: 'web.dropin.',
  CHECKOUT_JS_SOURCE: 'https://www.paypalobjects.com/api/checkout.4.0.65.min.js',
  INTEGRATION: 'dropin2',
  STYLESHEET_ID: 'braintree-dropin-stylesheet'
};
