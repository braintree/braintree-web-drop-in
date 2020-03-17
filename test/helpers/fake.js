
let clientToken, clientTokenWithCustomerID, fakeBTInstances;
const tokenizationKey = 'development_testing_merchant_id';
const braintreeVersion = require('braintree-web').VERSION;
const vaultManager = require('braintree-web/vault-manager');
const DropinModel = require('../../src/dropin-model');

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
clientTokenWithCustomerID.hasCustomer = true;
clientTokenWithCustomerID = btoa(JSON.stringify(clientTokenWithCustomerID));

fakeBTInstances = {
  dataCollector: {
    deviceData: 'device-data',
    getDeviceData: jest.fn().mockResolvedValue('device-data'),
    teardown: function () {}
  },
  hostedFields: {
    clear: jest.fn(),
    getState: jest.fn(),
    on: jest.fn(),
    getSupportedCardTypes: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    setMessage: jest.fn(),
    tokenize: jest.fn()
  },
  paypal: {
    createPayment: function () {},
    tokenizePayment: function () {}
  },
  threeDSecure: {
    verifyCard: function () {},
    cancelVerifyCard: function () {},
    teardown: function () {}
  },
  vaultManager: {
    fetchPaymentMethods: jest.fn(),
    deletePaymentMethod: jest.fn()
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
  let modelInstance;

  options = options || modelOptions();

  modelInstance = new DropinModel(options);

  jest.spyOn(modelInstance, 'getVaultedPaymentMethods').mockResolvedValue([]);
  jest.spyOn(vaultManager, 'create').mockResolvedValue(fakeBTInstances.vaultManager);

  return modelInstance;
}

function modelOptions() {
  return {
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
  hostedFieldsInstance: fakeBTInstances.hostedFields,
  paypalInstance: fakeBTInstances.paypal,
  threeDSecureInstance: fakeBTInstances.threeDSecure,
  vaultManagerInstance: fakeBTInstances.vaultManager,
  modelOptions: modelOptions,
  tokenizationKey: tokenizationKey
};
