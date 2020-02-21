const parseEnviornment = require('../../../src/lib/parse-environment');
const fake = require('../../helpers/fake');

describe('parseEnviornment', () => {
  test('returns environment from tokenization key', () => {
    expect(parseEnviornment(fake.tokenizationKey)).toBe('development');
  });

  test('returns environment from client token', () => {
    expect(parseEnviornment(fake.clientToken)).toBe('development');
  });
});
