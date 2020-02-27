
var client = require('braintree-web/client');
const analytics = require('../../../src/lib/analytics');
const atob = require('../../../src/lib/polyfill').atob;
const braintreeClientVersion = require('braintree-web/client').VERSION;
const constants = require('../../../src/constants');
const fake = require('../../helpers/fake');
const {
  yieldsAsync
} = require('../../helpers/yields');

describe('analytics', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.client = fake.client();
    testContext.client._request.mockImplementation(yieldsAsync());
    jest.spyOn(client, 'create').mockResolvedValue(testContext.client);
  });

  describe('setupAnalytics', () => {
    test('creates a client to use with sendEvent', async () => {
      await analytics.setupAnalytics('fake-auth');

      expect(client.create).toBeCalledTimes(1);
      expect(client.create).toBeCalledWith({
        authorization: 'fake-auth'
      });
    });

    test('sets metatdata on the client', async () => {
      const clientInstance = await analytics.setupAnalytics('fake-auth');

      const config = clientInstance.getConfiguration();

      // this gets interpolated with the package version when built
      expect(config.analyticsMetadata.dropinVersion).toBe('__VERSION__');
      expect(config.analyticsMetadata.integration).toBe('dropin2');
      expect(config.analyticsMetadata.integrationType).toBe('dropin2');
    });
  });

  describe('sendEvent', () => {
    beforeEach(async () => {
      await analytics.setupAnalytics('fake-auth');
    });

    test('throws an error if client is not already setup', async () => {
      analytics.resetClientPromise();

      await expect(analytics.sendEvent('test.event.kind')).rejects.toThrow('Client not available.');
    });

    test('correctly sends an analytics event', async () => {
      let postArgs, currentTimestamp;
      const fakeConfiguration = fake.configuration();

      await analytics.sendEvent('test.event.kind');

      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].url).toBe(fakeConfiguration.gatewayConfiguration.analytics.url);
      expect(postArgs[0].method).toBe('post');
      expect(postArgs[0].data.analytics[0].kind).toBe('web.dropin.test.event.kind');
      expect(postArgs[0].data._meta.sessionId).toBe(fakeConfiguration.analyticsMetadata.sessionId);
      currentTimestamp = Date.now() / 1000;
      expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).toBeLessThan(2);
      expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).toBeGreaterThan(0);
      expect(postArgs[0].timeout).toBe(constants.ANALYTICS_REQUEST_TIMEOUT_MS);
    });

    test('correctly formats _meta', async () => {
      let postArgs;
      const fakeConfiguration = fake.configuration();

      fakeConfiguration.analyticsMetadata.dropinVersion = '__VERSION__';
      fakeConfiguration.analyticsMetadata.integration = 'dropin2';
      fakeConfiguration.analyticsMetadata.integrationType = 'dropin2';

      await analytics.sendEvent('test.event.kind');

      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].data._meta).toEqual(fakeConfiguration.analyticsMetadata);
    });

    test('includes tokenizationKey', async () => {
      let postArgs;
      const fakeConfiguration = fake.configuration();

      fakeConfiguration.authorization = fake.tokenizationKey;
      testContext.client.getConfiguration = jest.fn().mockReturnValue(fakeConfiguration);

      // set up again with the new auth type
      await analytics.setupAnalytics('fake-auth');

      await analytics.sendEvent('test.event.kind');

      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].data.tokenizationKey).toBe(fakeConfiguration.authorization);
      expect(postArgs[0].data.authorizationFingerprint).toBeFalsy();
    });

    test('includes authorizationFingerprint', async () => {
      let fingerprint, postArgs;
      const fakeConfiguration = fake.configuration();

      fakeConfiguration.authorization = fake.clientToken;
      fakeConfiguration.authorizationType = 'CLIENT_TOKEN';
      fingerprint = JSON.parse(atob(fakeConfiguration.authorization)).authorizationFingerprint;
      testContext.client.getConfiguration = jest.fn().mockReturnValue(fakeConfiguration);

      // set up again with the new auth type
      await analytics.setupAnalytics('fake-auth');

      await analytics.sendEvent('test.event.kind');

      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].data.tokenizationKey).toBeFalsy();
      expect(postArgs[0].data.authorizationFingerprint).toBe(fingerprint);
    });

    test('includes braintreeLibraryVersion', async () => {
      let postArgs;

      await analytics.sendEvent('test.event.kind');

      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].data.braintreeLibraryVersion).toBe(braintreeClientVersion);
    });
  });
});
