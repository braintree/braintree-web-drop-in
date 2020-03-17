const parseAuthorization = require('../../../src/lib/parse-authorization');
const fake = require('../../helpers/fake');

describe('parseAuthorization', () => {
  it('returns environment from tokenization key', () => {
    expect(parseAuthorization(fake.tokenizationKey).environment).toBe('development');
  });

  it('returns authType from tokenization key', () => {
    expect(parseAuthorization(fake.tokenizationKey).authType).toBe('TOKENIZATION_KEY');
  });

  it('returns hasCustomer field as false from tokenization key', () => {
    expect(parseAuthorization(fake.tokenizationKey).hasCustomer).toBe(false);
  });

  it('returns environment from client token', () => {
    expect(parseAuthorization(fake.clientToken).environment).toBe('development');
  });

  it('returns authType from client token', () => {
    expect(parseAuthorization(fake.clientToken).authType).toBe('CLIENT_TOKEN');
  });

  it('returns hasCustomer field as false from client token without a customer', () => {
    expect(parseAuthorization(fake.clientToken).hasCustomer).toBe(false);
  });

  it('returns hasCustomer field as true from client token with a customer', () => {
    expect(parseAuthorization(fake.clientTokenWithCustomerID).hasCustomer).toBe(true);
  });
});
