'use strict';

var sanitizeHtml = require('../../../src/lib/sanitize-html');

describe('sanitizeHtml', () => {
  test('converts > and < characters to encoded versions', () => {
    expect(sanitizeHtml('<script>alert("foo");</script>')).toBe('&lt;script&gt;alert("foo");&lt;/script&gt;');
  });
});
