'use strict';

var fake = require('../../../helpers/fake');
var isTokenizationKey = require('../../../../src/lib/is-tokenization-key');

describe('isTokenizationKey', function () {
  it('returns true when given a tokenization key', function () {
    var auth = fake.tokenizationKey;

    expect(isTokenizationKey(auth)).to.be.true;
  });

  it('returns false when not given a tokenization key', function () {
    var auth = fake.clientToken;

    expect(isTokenizationKey(auth)).to.be.false;
  });
});
