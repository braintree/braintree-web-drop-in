'use strict';

var clientToken;
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

clientToken = configuration().gatewayConfiguration;
clientToken.authorizationFingerprint = 'encoded_auth_fingerprint';
clientToken = btoa(JSON.stringify(clientToken));

module.exports = {
  tokenizationKey: tokenizationKey,
  clientToken: clientToken,
  configuration: configuration
};
