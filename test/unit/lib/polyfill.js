'use strict';

var atob = require('../../../src/lib/polyfill')._atob;

describe('Polyfill', () => {
  describe('atob', () => {
    test('decodes a base64 encoded string', () => {
      var base64Encoded = btoa('hello world');
      var decoded = atob(base64Encoded);

      expect(decoded).toBe('hello world');
    });

    test('raises an exception if the string is not base64 encoded', () => {
      var error = /Non base64 encoded input passed to window.atob polyfill/;

      expect(function () {
        atob('not-base64-encoded');
      }).toThrowError(error);
    });
  });
});
