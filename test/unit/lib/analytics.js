'use strict';

var analytics = require('../../../src/lib/analytics');
var atob = require('../../../src/lib/polyfill').atob;
var braintreeClientVersion = require('braintree-web/client').VERSION;
var constants = require('../../../src/constants');
var fake = require('../../helpers/fake');

describe('analytics.sendEvent', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.client = fake.client();
  });

  test('correctly sends an analytics event with a callback', () => {
    var postArgs, currentTimestamp;
    var fakeConfiguration = fake.configuration();

    function callback() {}

    analytics.sendEvent(testContext.client, 'test.event.kind', callback);

    expect(testContext.client._request).toBeCalled();
    postArgs = testContext.client._request.mock.calls[0];

    expect(postArgs[0].url).toBe(fakeConfiguration.gatewayConfiguration.analytics.url);
    expect(postArgs[0].method).toBe('post');
    expect(postArgs[0].data.analytics[0].kind).toBe('web.dropin.test.event.kind');
    expect(postArgs[0].data._meta.sessionId).toBe(fakeConfiguration.analyticsMetadata.sessionId);
    currentTimestamp = Date.now() / 1000;
    expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).toBeLessThan(2);
    expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).toBeGreaterThan(0);
    expect(postArgs[1]).toBe(callback);
    expect(postArgs[0].timeout).toBe(constants.ANALYTICS_REQUEST_TIMEOUT_MS);
  });

  test(
    'correctly sends an analytics event with no callback (fire-and-forget)',
    () => {
      var postArgs, currentTimestamp;
      var fakeConfiguration = fake.configuration();

      analytics.sendEvent(testContext.client, 'test.event.kind');

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
    }
  );

  test('correctly formats _meta', () => {
    var postArgs;
    var fakeConfiguration = fake.configuration();

    analytics.sendEvent(testContext.client, 'test.event.kind');

    expect(testContext.client._request).toBeCalled();
    postArgs = testContext.client._request.mock.calls[0];

    expect(postArgs[0].data._meta).toEqual(fakeConfiguration.analyticsMetadata);
  });

  test('includes tokenizationKey', () => {
    var client, postArgs;
    var fakeConfiguration = fake.configuration();

    fakeConfiguration.authorization = fake.tokenizationKey;
    client = fake.client(fakeConfiguration);

    analytics.sendEvent(client, 'test.event.kind');

    expect(client._request).toBeCalled();
    postArgs = client._request.mock.calls[0];

    expect(postArgs[0].data.tokenizationKey).toBe(fakeConfiguration.authorization);
    expect(postArgs[0].data.authorizationFingerprint).toBeFalsy();
  });

  test('includes authorizationFingerprint', () => {
    var client, fingerprint, postArgs;
    var fakeConfiguration = fake.configuration();

    fakeConfiguration.authorization = fake.clientToken;
    fakeConfiguration.authorizationType = 'CLIENT_TOKEN';
    fingerprint = JSON.parse(atob(fakeConfiguration.authorization)).authorizationFingerprint;
    client = fake.client(fakeConfiguration);

    analytics.sendEvent(client, 'test.event.kind');

    expect(client._request).toBeCalled();
    postArgs = client._request.mock.calls[0];

    expect(postArgs[0].data.tokenizationKey).toBeFalsy();
    expect(postArgs[0].data.authorizationFingerprint).toBe(fingerprint);
  });

  test('includes braintreeLibraryVersion', () => {
    var postArgs;

    analytics.sendEvent(testContext.client, 'test.event.kind');

    expect(testContext.client._request).toBeCalled();
    postArgs = testContext.client._request.mock.calls[0];

    expect(postArgs[0].data.braintreeLibraryVersion).toBe(braintreeClientVersion);
  });
});
