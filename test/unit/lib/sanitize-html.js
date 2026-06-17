
const sanitizeHtml = require('../../../src/lib/sanitize-html');

describe('sanitizeHtml', () => {
  test('converts > and < characters to encoded versions', () => {
    expect(sanitizeHtml('<script>alert();</script>')).toBe('&lt;script&gt;alert();&lt;/script&gt;');
  });

  test('converts " to encoded version', () => {
    expect(sanitizeHtml('"foo"')).toBe('&quot;foo&quot;');
  });

  test('converts & to encoded version', () => {
    expect(sanitizeHtml('<script>alert("foo");</script>')).toBe('&lt;script&gt;alert(&quot;foo&quot;);&lt;/script&gt;');
  });

  test("converts ' to encoded version", () => {
    expect(sanitizeHtml("'foo'")).toBe('&#039;foo&#039;');
  });
});
