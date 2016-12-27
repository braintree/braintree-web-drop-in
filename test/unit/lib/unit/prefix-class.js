'use strict';

var prefixClass = require('../../../../src/lib/prefix-class');

describe('prefixClass', function () {
  it('prefixes strings with "braintree-"', function () {
    expect(prefixClass('foo')).to.equal('braintree-foo');
    expect(prefixClass('boo')).to.equal('braintree-boo');
    expect(prefixClass('')).to.equal('braintree-');
  });
});
