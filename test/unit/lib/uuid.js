
const uuid = require('../../../src/lib/uuid');
const isUuid = require('is-uuid');

describe('uuid', () => {
  test('returns valid v4 UUIDs', () => {
    let i;

    for (i = 0; i < 10; i++) {
      expect(isUuid.v4(uuid())).toBe(true);
    }
  });
});
