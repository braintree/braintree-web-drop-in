
var clientToken, clientTokenWithCustomerID, fakeBTInstances;
var tokenizationKey = 'development_testing_merchant_id';
var braintreeVersion = require('braintree-web').VERSION;
var DropinModel = require('../../src/dropin-model');

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
      applePayWeb: {},
      androidPay: {},
      payWithVenmo: {
        accessToken: 'access_token$sandbox$id',
        environment: 'sandbox',
        merchantId: 'merchant-id'
      }
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

clientToken = configuration().gatewayConfiguration;
clientToken.authorizationFingerprint = 'encoded_auth_fingerprint';
clientToken = btoa(JSON.stringify(clientToken));

clientTokenWithCustomerID = configuration().gatewayConfiguration;
clientTokenWithCustomerID.authorizationFingerprint = 'encoded_auth_fingerprint&customer_id=abc123';
clientTokenWithCustomerID = btoa(JSON.stringify(clientTokenWithCustomerID));

fakeBTInstances = {
  dataCollector: {
    deviceData: 'device-data',
    teardown: function () {}
  },
  hostedFields() {
    return {
      clear: jest.fn(),
      getState: jest.fn().mockReturnValue({
        cards: [{ type: 'visa' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      }),
      on: jest.fn(),
      removeAttribute: jest.fn(),
      setAttribute: jest.fn(),
      setMessage: jest.fn(),
      teardown: jest.fn().mockResolvedValue(),
      tokenize: jest.fn().mockResolvedValue({})
    };
  },
  paypal: {
    createPayment: function () {},
    tokenizePayment: function () {}
  },
  threeDSecure: {
    verifyCard: function () {},
    cancelVerifyCard: function () {},
    teardown: function () {}
  }
};

function client(conf) {
  conf = conf || configuration();

  return {
    _request: jest.fn().mockResolvedValue(),
    request: jest.fn().mockResolvedValue(),
    getConfiguration: jest.fn().mockReturnValue(conf),
    getVersion: function () { return braintreeVersion; }
  };
}

function model(options) {
  var modelInstance;

  options = options || modelOptions();
  options.container = options.container || document.createElement('div');

  modelInstance = new DropinModel(options);

  jest.spyOn(modelInstance, 'getVaultedPaymentMethods').mockResolvedValue([]);
  jest.spyOn(modelInstance, '_emit');

  return modelInstance;
}

function modelOptions() {
  return {
    client: client(),
    componentID: 'foo123',
    merchantConfiguration: {
      authorization: tokenizationKey
    }
  };
}

module.exports = {
  client: client,
  model: model,
  clientToken: clientToken,
  clientTokenWithCustomerID: clientTokenWithCustomerID,
  configuration: configuration,
  dataCollectorInstance: fakeBTInstances.dataCollector,
  hostedFields: fakeBTInstances.hostedFields,
  paypalInstance: fakeBTInstances.paypal,
  threeDSecureInstance: fakeBTInstances.threeDSecure,
  modelOptions: modelOptions,
  tokenizationKey: tokenizationKey
};
