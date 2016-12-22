'use strict';

var clientToken, clientTokenWithCustomerID, hostedFieldsInstance;
var tokenizationKey = 'development_testing_merchant_id';

function configuration() {
  return {
    gatewayConfiguration: {
      environment: 'development',
      configUrl: 'https://braintreegateway.com/config',
      clientApiUrl: 'https://braintreegateway.com',
      assetsUrl: 'https://assets.braintreegateway.com',
      analytics: {
        url: 'https://braintreegateway.com/analytics'
      },
      challenges: [],
      creditCards: {
        supportedCardTypes: ['American Express', 'Discover', 'JCB', 'MasterCard', 'Visa']
      }
    },
    analyticsMetadata: {
      sdkVersion: '1.2.3',
      merchantAppId: 'http://fakeDomain.com',
      sessionId: 'fakeSessionId',
      platform: 'web',
      source: 'client',
      integration: 'custom',
      integrationType: 'custom'
    },
    authorization: tokenizationKey
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
  setPlaceholder: function () {},
  tokenize: function () {}
};

function modelOptions() {
  return {
    client: {
      getConfiguration: configuration
    },
    merchantConfiguration: {}
  };
}

module.exports = {
  clientToken: clientToken,
  clientTokenWithCustomerID: clientTokenWithCustomerID,
  configuration: configuration,
  hostedFieldsInstance: hostedFieldsInstance,
  modelOptions: modelOptions,
  tokenizationKey: tokenizationKey
};
