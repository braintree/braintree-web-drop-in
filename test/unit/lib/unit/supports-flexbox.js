'use strict';

var supportsFlexbox = require('../../../../src/lib/supports-flexbox');

describe('supportsFlexbox', function () {
  beforeEach(function () {
    this.fakeDiv = {
      style: {
        cssText: '',
        length: 0
      }
    };
  });

  it('returns true in PhantomJS', function () {
    expect(supportsFlexbox()).to.equal(true);
  });

  it("returns false for browsers that don't support flexbox", function () {
    this.sandbox.stub(document, 'createElement').returns(this.fakeDiv);

    expect(supportsFlexbox()).to.equal(false);
  });

  it('returns true if the browser supports flexbox', function () {
    this.sandbox.stub(document, 'createElement').returns(this.fakeDiv);

    this.fakeDiv.style.length = 1;

    expect(supportsFlexbox()).to.equal(true);
  });
});
