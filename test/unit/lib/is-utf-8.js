'use strict';

var isUtf8 = require('../../../src/lib/is-utf-8');

describe('isUtf8', function () {
  it('returns true when characterSet is utf-8', function () {
    var win = {
      document: {
        characterSet: 'utf-8'
      }
    };

    expect(isUtf8(win)).to.be.true;
  });

  it('returns true when characterSet is utf-8', function () {
    var win = {
      document: {
        characterSet: 'utf-8'
      }
    };

    expect(isUtf8(win)).to.be.true;
  });

  it('returns false when characterSet is not utf-8', function () {
    var win = {
      document: {
        characterSet: 'something-else'
      }
    };

    expect(isUtf8(win)).to.be.false;
  });
});
