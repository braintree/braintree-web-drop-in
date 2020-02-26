const parseAuthorization = require('../../../src/lib/parse-authorization');
const fake = require('../../helpers/fake');

describe('parseAuthorization', () => {
  test('returns environment from tokenization key', () => {
    expect(parseAuthorization(fake.tokenizationKey).environment).toBe('development');
  });

  test('returns authType from tokenization key', () => {
    expect(parseAuthorization(fake.tokenizationKey).authType).toBe('TOKENIZATION_KEY');
  });

  test('returns environment from client token', () => {
    expect(parseAuthorization(fake.clientToken).environment).toBe('development');
  });

  test('returns authType from client token', () => {
    expect(parseAuthorization(fake.clientToken).authType).toBe('CLIENT_TOKEN');
  });
});
