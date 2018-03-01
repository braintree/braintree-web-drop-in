'use strict';

var sanitizeHtml = require('../../../src/lib/sanitize-html');

describe('sanitizeHtml', function () {
  it('converts > and < characters to encoded versions', function () {
    expect(sanitizeHtml('<script>alert("foo");</script>')).to.equal('&lt;script&gt;alert("foo");&lt;/script&gt;');
  });
});
