
const analytics = require('../../../src/lib/analytics');
const atob = require('../../../src/lib/polyfill').atob;
const braintreeClientVersion = require('braintree-web/client').VERSION;
const constants = require('../../../src/constants');
const fake = require('../../helpers/fake');
const {
  yieldsAsync
} = require('../../helpers/yields');

describe('analytics.sendEvent', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.client = fake.client();
    testContext.client._request.mockImplementation(yieldsAsync());
  });

  test('correctly sends an analytics event', () => {
    let postArgs, currentTimestamp;
    const fakeConfiguration = fake.configuration();

    return analytics.sendEvent(testContext.client, 'test.event.kind').then(() => {
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
  });

  test('can receive a promise that resolves with a client', () => {
    let postArgs, currentTimestamp;
    const fakeConfiguration = fake.configuration();

    return analytics.sendEvent(Promise.resolve(testContext.client), 'test.event.kind').then(() => {
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
  });

  test('correctly formats _meta', () => {
    let postArgs;
    const fakeConfiguration = fake.configuration();

    return analytics.sendEvent(testContext.client, 'test.event.kind').then(() => {
      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].data._meta).toEqual(fakeConfiguration.analyticsMetadata);
    });
  });

  test('includes tokenizationKey', () => {
    let client, postArgs;
    const fakeConfiguration = fake.configuration();

    fakeConfiguration.authorization = fake.tokenizationKey;
    client = fake.client(fakeConfiguration);
    client._request.mockImplementation(yieldsAsync());

    return analytics.sendEvent(client, 'test.event.kind').then(() => {
      expect(client._request).toBeCalled();
      postArgs = client._request.mock.calls[0];

      expect(postArgs[0].data.tokenizationKey).toBe(fakeConfiguration.authorization);
      expect(postArgs[0].data.authorizationFingerprint).toBeFalsy();
    });
  });

  test('includes authorizationFingerprint', () => {
    let client, fingerprint, postArgs;
    const fakeConfiguration = fake.configuration();

    fakeConfiguration.authorization = fake.clientToken;
    fakeConfiguration.authorizationType = 'CLIENT_TOKEN';
    fingerprint = JSON.parse(atob(fakeConfiguration.authorization)).authorizationFingerprint;
    client = fake.client(fakeConfiguration);
    client._request.mockImplementation(yieldsAsync());

    return analytics.sendEvent(client, 'test.event.kind').then(() => {
      expect(client._request).toBeCalled();
      postArgs = client._request.mock.calls[0];

      expect(postArgs[0].data.tokenizationKey).toBeFalsy();
      expect(postArgs[0].data.authorizationFingerprint).toBe(fingerprint);
    });
  });

  test('includes braintreeLibraryVersion', () => {
    let postArgs;

    return analytics.sendEvent(testContext.client, 'test.event.kind').then(() => {
      expect(testContext.client._request).toBeCalled();
      postArgs = testContext.client._request.mock.calls[0];

      expect(postArgs[0].data.braintreeLibraryVersion).toBe(braintreeClientVersion);
    });
  });
});
