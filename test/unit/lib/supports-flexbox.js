const supportsFlexbox = require('../../../src/lib/supports-flexbox');

describe('supportsFlexbox', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.fakeDiv = {
      style: {
        cssText: '',
        length: 0
      }
    };
  });

  it('returns true in PhantomJS', () => {
    expect(supportsFlexbox()).toBe(true);
  });

  it('returns false for browsers that don\'t support flexbox', () => {
    jest.spyOn(document, 'createElement').mockReturnValue(testContext.fakeDiv);

    expect(supportsFlexbox()).toBe(false);
  });

  it('returns true if the browser supports flexbox', () => {
    jest.spyOn(document, 'createElement').mockReturnValue(testContext.fakeDiv);

    testContext.fakeDiv.style.length = 1;

    expect(supportsFlexbox()).toBe(true);
  });
});
