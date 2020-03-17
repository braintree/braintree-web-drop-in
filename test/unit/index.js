jest.mock('../../src/lib/analytics');

const dropin = require('../../src/index');
const Dropin = require('../../src/dropin');
const DropinError = require('../../src/lib/dropin-error');
const fake = require('../helpers/fake');
const analytics = require('../../src/lib/analytics');
const {
  yields
} = require('../helpers/yields');

describe('dropin.create', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    const container = document.createElement('div');

    testContext.form = document.createElement('form');

    container.id = 'foo';

    testContext.form.appendChild(container);
    document.body.appendChild(testContext.form);
  });

  afterEach(() => {
    document.body.removeChild(testContext.form);
  });

  it('errors out if no authorization given', async () => {
    await expect(dropin.create({})).rejects.toThrow('options.authorization is required.');
  });

  it('sets up analytics', async () => {
    jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(function (callback) {
      callback(null, this); // eslint-disable-line no-invalid-this
    });

    await dropin.create({
      authorization: fake.tokenizationKey,
      selector: '#foo'
    });

    expect(analytics.setupAnalytics).toBeCalledTimes(1);
    expect(analytics.setupAnalytics).toBeCalledWith(fake.tokenizationKey);
  });

  it('resolves a Dropin instance', async () => {
    jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(function (callback) {
      callback(null, this); // eslint-disable-line no-invalid-this
    });

    const instance = await dropin.create({
      authorization: fake.tokenizationKey,
      selector: '#foo'
    });

    expect(instance).toBeInstanceOf(Dropin);
  });

  it('returns an error to callback if Drop-in initialization fails', async () => {
    const dropinError = new DropinError('Dropin Error');

    jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(yields(dropinError));

    await expect(dropin.create({
      authorization: fake.tokenizationKey,
      selector: '#foo'
    })).rejects.toThrow(dropinError);
  });
});
