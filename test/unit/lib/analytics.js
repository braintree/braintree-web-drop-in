'use strict';

var analytics = require('../../../src/lib/analytics');
var atob = require('../../../src/lib/polyfill').atob;
var braintreeClientVersion = require('braintree-web/client').VERSION;
var constants = require('../../../src/constants');
var fake = require('../../helpers/fake');

describe('analytics.sendEvent', function () {
  beforeEach(function () {
    this.client = fake.client();
  });

  it('correctly sends an analytics event with a callback', function () {
    var postArgs, currentTimestamp;
    var fakeConfiguration = fake.configuration();

    function callback() {}

    analytics.sendEvent(this.client, 'test.event.kind', callback);

    expect(this.client._request).to.have.been.called;
    postArgs = this.client._request.firstCall.args;

    expect(postArgs[0].url).to.equal(fakeConfiguration.gatewayConfiguration.analytics.url);
    expect(postArgs[0].method).to.equal('post');
    expect(postArgs[0].data.analytics[0].kind).to.equal('web.dropin.test.event.kind');
    expect(postArgs[0].data._meta.sessionId).to.equal(fakeConfiguration.analyticsMetadata.sessionId);
    currentTimestamp = Date.now() / 1000;
    expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).to.be.lessThan(2);
    expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).to.be.greaterThan(0);
    expect(postArgs[1]).to.equal(callback);
    expect(postArgs[0].timeout).to.equal(constants.ANALYTICS_REQUEST_TIMEOUT_MS);
  });

  it('correctly sends an analytics event with no callback (fire-and-forget)', function () {
    var postArgs, currentTimestamp;
    var fakeConfiguration = fake.configuration();

    analytics.sendEvent(this.client, 'test.event.kind');

    expect(this.client._request).to.have.been.called;
    postArgs = this.client._request.firstCall.args;

    expect(postArgs[0].url).to.equal(fakeConfiguration.gatewayConfiguration.analytics.url);
    expect(postArgs[0].method).to.equal('post');
    expect(postArgs[0].data.analytics[0].kind).to.equal('web.dropin.test.event.kind');
    expect(postArgs[0].data._meta.sessionId).to.equal(fakeConfiguration.analyticsMetadata.sessionId);
    currentTimestamp = Date.now() / 1000;
    expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).to.be.lessThan(2);
    expect(currentTimestamp - postArgs[0].data.analytics[0].timestamp).to.be.greaterThan(0);
    expect(postArgs[0].timeout).to.equal(constants.ANALYTICS_REQUEST_TIMEOUT_MS);
  });

  it('correctly formats _meta', function () {
    var postArgs;
    var fakeConfiguration = fake.configuration();

    analytics.sendEvent(this.client, 'test.event.kind');

    expect(this.client._request).to.have.been.called;
    postArgs = this.client._request.firstCall.args;

    expect(postArgs[0].data._meta).to.deep.equal(fakeConfiguration.analyticsMetadata);
  });

  it('includes tokenizationKey', function () {
    var client, postArgs;
    var fakeConfiguration = fake.configuration();

    fakeConfiguration.authorization = fake.tokenizationKey;
    client = fake.client(fakeConfiguration);

    analytics.sendEvent(client, 'test.event.kind');

    expect(client._request).to.have.been.called;
    postArgs = client._request.firstCall.args;

    expect(postArgs[0].data.tokenizationKey).to.equal(fakeConfiguration.authorization);
    expect(postArgs[0].data.authorizationFingerprint).to.not.exist;
  });

  it('includes authorizationFingerprint', function () {
    var client, fingerprint, postArgs;
    var fakeConfiguration = fake.configuration();

    fakeConfiguration.authorization = fake.clientToken;
    fakeConfiguration.authorizationType = 'CLIENT_TOKEN';
    fingerprint = JSON.parse(atob(fakeConfiguration.authorization)).authorizationFingerprint;
    client = fake.client(fakeConfiguration);

    analytics.sendEvent(client, 'test.event.kind');

    expect(client._request).to.have.been.called;
    postArgs = client._request.firstCall.args;

    expect(postArgs[0].data.tokenizationKey).to.not.exist;
    expect(postArgs[0].data.authorizationFingerprint).to.equal(fingerprint);
  });

  it('includes braintreeLibraryVersion', function () {
    var postArgs;

    analytics.sendEvent(this.client, 'test.event.kind');

    expect(this.client._request).to.have.been.called;
    postArgs = this.client._request.firstCall.args;

    expect(postArgs[0].data.braintreeLibraryVersion).to.equal(braintreeClientVersion);
  });
});
