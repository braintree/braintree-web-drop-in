'use strict';

var daDKKeys = Object.keys(require('../../src/translations/da_DK'));
var enUSKeys = Object.keys(require('../../src/translations/en_US'));

describe('translations', function () {
  enUSKeys.forEach(function (enUSKey) {
    xit(enUSKey + ' exists outside of en_US', function () {
      expect(daDKKeys.indexOf(enUSKey)).to.not.equal(-1);
    });
  });
});
