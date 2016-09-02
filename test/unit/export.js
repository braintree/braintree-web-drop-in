'use strict';

var dropin = require('../../src/');
var packageVersion = require('../../package.json').version;

describe('export', function () {
  it('contains create', function () {
    expect(dropin.create).to.be.a('function');
  });

  it('sets the version', function () {
    expect(dropin.VERSION).to.equal(packageVersion);
  });
});
