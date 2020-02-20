
const atob = require('../../../src/lib/polyfill')._atob;

describe('Polyfill', () => {
  describe('atob', () => {
    test('decodes a base64 encoded string', () => {
      const base64Encoded = btoa('hello world');
      const decoded = atob(base64Encoded);

      expect(decoded).toBe('hello world');
    });

    test('raises an exception if the string is not base64 encoded', () => {
      const error = /Non base64 encoded input passed to window.atob polyfill/;

      expect(() => {
        atob('not-base64-encoded');
      }).toThrowError(error);
    });
  });
});
