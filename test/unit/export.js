
const dropin = require('../../src/');
// const packageVersion = require('../../package.json').version;

describe('export', () => {
  test('contains create', () => {
    expect(dropin.create).toBeInstanceOf(Function);
  });

  test('sets the version', () => {
    // TODO build the file first before running this test? Or just assert on __VERSION__ placeholder?
    expect(dropin.VERSION).toBe('__VERSION__');
  });
});
