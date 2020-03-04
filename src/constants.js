'use strict';

module.exports = {
  authorizationTypes: {
    CLIENT_TOKEN: 'CLIENT_TOKEN',
    TOKENIZATION_KEY: 'TOKENIZATION_KEY'
  },
  paymentOptionIDs: {
    card: 'card',
    paypal: 'paypal',
    paypalCredit: 'paypalCredit',
    applePay: 'applePay',
    venmo: 'venmo',
    googlePay: 'googlePay'
  },
  paymentMethodTypes: {
    card: 'CreditCard',
    paypal: 'PayPalAccount',
    paypalCredit: 'PayPalAccount',
    applePay: 'ApplePayCard',
    venmo: 'VenmoAccount',
    googlePay: 'AndroidPayCard'
  },
  analyticsKinds: {
    CreditCard: 'card',
    PayPalAccount: 'paypal',
    ApplePayCard: 'applepay',
    VenmoAccount: 'venmo',
    AndroidPayCard: 'googlepay'
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
    Visa: 'visa',
    Mastercard: 'mastercard',
    'American Express': 'american-express',
    Discover: 'discover',
    JCB: 'jcb',
    // always hide UnionPay cards because Drop-in cannot support the flow
    // UnionPay: 'unionpay',
    Maestro: 'maestro'
  },
  errors: {
    NO_PAYMENT_METHOD_ERROR: 'No payment method is available.',
    DEVELOPER_MISCONFIGURATION_MESSAGE: 'Developer Error: Something went wrong. Check the console for details.'
  },
  ANALYTICS_REQUEST_TIMEOUT_MS: 2000,
  ANALYTICS_PREFIX: 'web.dropin.',
  CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT: 200,
  CHECKOUT_JS_SOURCE: 'https://www.paypalobjects.com/api/checkout.min.js',
  GOOGLE_PAYMENT_SOURCE: 'https://pay.google.com/gp/p/js/pay.js',
  INTEGRATION: 'dropin2',
  PAYPAL_CHECKOUT_SCRIPT_ID: 'braintree-dropin-paypal-checkout-script',
  GOOGLE_PAYMENT_SCRIPT_ID: 'braintree-dropin-google-payment-script',
  DATA_COLLECTOR_SCRIPT_ID: 'braintree-dropin-data-collector-script',
  STYLESHEET_ID: 'braintree-dropin-stylesheet'
};
