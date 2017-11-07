'use strict';

var clientToken, clientTokenWithCustomerID, hostedFieldsInstance, paypalInstance, threeDSecureInstance;
var tokenizationKey = 'development_testing_merchant_id';
var braintreeVersion = require('braintree-web').VERSION;

function configuration() {
  return {
    gatewayConfiguration: {
      environment: 'development',
      configUrl: 'https://braintreegateway.com/config',
      clientApiUrl: 'https://braintreegateway.com',
      assetsUrl: 'https://assets.braintreegateway.com',
      paypalEnabled: true,
      paypal: {
        clientId: 'client-id'
      },
      analytics: {
        url: 'https://braintreegateway.com/analytics'
      },
      challenges: [],
      creditCards: {
        supportedCardTypes: ['American Express', 'Discover', 'JCB', 'MasterCard', 'Visa']
      },
      applePay: {}
    },
    analyticsMetadata: {
      sdkVersion: braintreeVersion,
      merchantAppId: 'http://fakeDomain.com',
      sessionId: 'fakeSessionId',
      platform: 'web',
      source: 'client',
      integration: 'custom',
      integrationType: 'custom'
    },
    authorization: tokenizationKey,
    authorizationType: 'TOKENIZATION_KEY'
  };
}

function getState() {
  return {
    cards: [{type: 'visa'}],
    fields: {
      number: {
        isValid: true
      },
      expirationDate: {
        isValid: false
      }
    }
  };
}

clientToken = configuration().gatewayConfiguration;
clientToken.authorizationFingerprint = 'encoded_auth_fingerprint';
clientToken = btoa(JSON.stringify(clientToken));

clientTokenWithCustomerID = configuration().gatewayConfiguration;
clientTokenWithCustomerID.authorizationFingerprint = 'encoded_auth_fingerprint&customer_id=abc123';
clientTokenWithCustomerID = btoa(JSON.stringify(clientTokenWithCustomerID));

hostedFieldsInstance = {
  getState: getState,
  on: function () {},
  setAttribute: function () {},
  setMessage: function () {},
  tokenize: function () {}
};

paypalInstance = {
  createPayment: function () {},
  tokenizePayment: function () {}
};

threeDSecureInstance = {
  verifyCard: function () {},
  cancelVerifyCard: function () {},
  teardown: function () {}
};

function modelOptions() {
  return {
    client: {
      getConfiguration: configuration
    },
    componentID: 'foo123',
    merchantConfiguration: {
      authorization: tokenizationKey
    },
    paymentMethods: []
  };
}

module.exports = {
  clientToken: clientToken,
  clientTokenWithCustomerID: clientTokenWithCustomerID,
  configuration: configuration,
  hostedFieldsInstance: hostedFieldsInstance,
  paypalInstance: paypalInstance,
  threeDSecureInstance: threeDSecureInstance,
  modelOptions: modelOptions,
  tokenizationKey: tokenizationKey
};
