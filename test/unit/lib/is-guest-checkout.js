'use strict';

var fake = require('../../helpers/fake');
var isGuestCheckout = require('../../../src/lib/is-guest-checkout');

describe('isGuestCheckout', () => {
  test('returns true when given a client with a tokenization key', () => {
    var fakeClient = fake.client({
      authorizationType: 'TOKENIZATION_KEY',
      authorization: fake.tokenizationKey
    });

    expect(isGuestCheckout(fakeClient)).toBe(true);
  });

  test(
    'returns true when given a client with a client token without a customer ID',
    () => {
      var fakeClient = fake.client({
        authorizationType: 'CLIENT_TOKEN',
        authorization: fake.clientToken
      });

      expect(isGuestCheckout(fakeClient)).toBe(true);
    }
  );

  test(
    'returns false when given a client with a client token with a customer ID',
    () => {
      var fakeClient = fake.client({
        authorizationType: 'CLIENT_TOKEN',
        authorization: fake.clientTokenWithCustomerID
      });

      expect(isGuestCheckout(fakeClient)).toBe(false);
    }
  );
});
