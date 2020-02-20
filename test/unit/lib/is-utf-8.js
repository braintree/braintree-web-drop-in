
const isUtf8 = require('../../../src/lib/is-utf-8');

describe('isUtf8', () => {
  test('returns true when characterSet is utf-8', () => {
    const win = {
      document: {
        characterSet: 'utf-8'
      }
    };

    expect(isUtf8(win)).toBe(true);
  });

  test('returns true when characterSet is utf-8', () => {
    const win = {
      document: {
        characterSet: 'utf-8'
      }
    };

    expect(isUtf8(win)).toBe(true);
  });

  test('returns false when characterSet is not utf-8', () => {
    const win = {
      document: {
        characterSet: 'something-else'
      }
    };

    expect(isUtf8(win)).toBe(false);
  });
});
