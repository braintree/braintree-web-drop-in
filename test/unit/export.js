
const dropin = require('../../src/');
// const packageVersion = require('../../package.json').version;

describe('export', () => {
  it('contains create', () => {
    expect(dropin.create).toBeInstanceOf(Function);
  });

  it('sets the version', () => {
    // TODO build the file first before running this test? Or just assert on __VERSION__ placeholder?
    expect(dropin.VERSION).toBe('__VERSION__');
  });
});
