'use strict';

var fake = require('../../helpers/fake');
var isGuestCheckout = require('../../../src/lib/is-guest-checkout');

describe('isGuestCheckout', function () {
  it('returns true when given a client with a tokenization key', function () {
    var fakeClient = {
      getConfiguration: function () {
        return {
          authorizationType: 'TOKENIZATION_KEY',
          authorization: fake.tokenizationKey
        };
      }
    };

    expect(isGuestCheckout(fakeClient)).to.be.true;
  });

  it('returns true when given a client with a client token without a customer ID', function () {
    var fakeClient = {
      getConfiguration: function () {
        return {
          authorizationType: 'CLIENT_TOKEN',
          authorization: fake.clientToken
        };
      }
    };

    expect(isGuestCheckout(fakeClient)).to.be.true;
  });

  it('returns false when given a client with a client token with a customer ID', function () {
    var fakeClient = {
      getConfiguration: function () {
        return {
          authorizationType: 'CLIENT_TOKEN',
          authorization: fake.clientTokenWithCustomerID
        };
      }
    };

    expect(isGuestCheckout(fakeClient)).to.be.false;
  });
});
