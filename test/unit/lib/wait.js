const wait = require('../../../src/lib/wait');

describe('wait.delay', () => {
  it('returns a promise that resolves after a set amount of time', () => {
    jest.spyOn(window, 'setTimeout');

    return wait.delay(1).then(() => {
      expect(window.setTimeout).toBeCalledTimes(1);
      expect(window.setTimeout).toBeCalledWith(expect.any(Function), 1);
    });
  });

  it('defaults timeout to 0', () => {
    jest.spyOn(window, 'setTimeout');

    return wait.delay().then(() => {
      expect(window.setTimeout).toBeCalledTimes(1);
      expect(window.setTimeout).toBeCalledWith(expect.any(Function), 0);
    });
  });
});
