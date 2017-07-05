'use strict';

var kebabCaseToCamelCase = require('../../../../src/lib/kebab-case-to-camel-case');

describe('kebabCaseToCamelCase', function () {
  it('returns the element if no - in it', function () {
    expect(kebabCaseToCamelCase('foo')).to.equal('foo');
  });

  it('converts kebab case to camel case', function () {
    expect(kebabCaseToCamelCase('foo-bar-baz')).to.equal('fooBarBaz');
  });

  it('does not police incorrect capitalization in kebab-case', function () {
    expect(kebabCaseToCamelCase('FoO')).to.equal('FoO');
    expect(kebabCaseToCamelCase('FoO-bAr-baZ')).to.equal('FoOBArBaZ');
  });
});

