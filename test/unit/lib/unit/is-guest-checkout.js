'use strict';

var fake = require('../../../helpers/fake');
var isGuestCheckout = require('../../../../src/lib/is-guest-checkout');

describe('isGuestCheckout', function () {
  it('returns true when given a tokenization key', function () {
    var auth = 'fake_tokenization_key';

    expect(isGuestCheckout(auth)).to.be.true;
  });

  it('returns true when given a client token without a customer ID', function () {
    var auth = fake.clientToken;

    expect(isGuestCheckout(auth)).to.be.true;
  });

  it('returns false when given a client token with a customer ID', function () {
    var fakeClientToken = fake.configuration().gatewayConfiguration;

    fakeClientToken.authorizationFingerprint = 'auth_fingerprint&customer_id=abc123';
    fakeClientToken = btoa(JSON.stringify(fakeClientToken));

    expect(isGuestCheckout(fakeClientToken)).to.be.false;
  });
});
