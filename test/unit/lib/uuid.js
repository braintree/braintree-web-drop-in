'use strict';

var uuid = require('../../../src/lib/uuid');
var isUuid = require('is-uuid');

describe('uuid', () => {
  test('returns valid v4 UUIDs', () => {
    var i;

    for (i = 0; i < 10; i++) {
      expect(isUuid.v4(uuid())).toBe(true);
    }
  });
});
