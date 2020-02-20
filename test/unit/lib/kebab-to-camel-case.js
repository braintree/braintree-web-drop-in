
const kebabCaseToCamelCase = require('../../../src/lib/kebab-case-to-camel-case');

describe('kebabCaseToCamelCase', () => {
  test('returns the element if no - in it', () => {
    expect(kebabCaseToCamelCase('foo')).toBe('foo');
  });

  test('converts kebab case to camel case', () => {
    expect(kebabCaseToCamelCase('foo-bar-baz')).toBe('fooBarBaz');
  });

  test('does not police incorrect capitalization in kebab-case', () => {
    expect(kebabCaseToCamelCase('FoO')).toBe('FoO');
    expect(kebabCaseToCamelCase('FoO-bAr-baZ')).toBe('FoOBArBaZ');
  });
});

