const DropinError = require('../../../src/lib/dropin-error');
const BraintreeError = require('braintree-web/lib/braintree-error');

describe('DropinError', () => {
  it('inherits from Error', () => {
    const instance = new DropinError({});

    expect(instance).toBeInstanceOf(DropinError);
  });

  it('sets the name to DropinError', () => {
    const instance = new DropinError({});

    expect(instance.name).toBe('DropinError');
  });

  it('can pass in a object and set the message', () => {
    const instance = new DropinError({
      message: 'Cool message.'
    });

    expect(instance.message).toBe('Cool message.');
  });

  it('can pass in a string and set the message', () => {
    const instance = new DropinError('Cool message.');

    expect(instance.message).toBe('Cool message.');
  });

  it('can pass in an Error object and set the message', () => {
    const instance = new DropinError(new Error('Cool message.'));

    expect(instance.message).toBe('Cool message.');
  });

  it('can pass in a DropinError object and set the message', () => {
    const instance = new DropinError(new DropinError('Cool message.'));

    expect(instance.message).toBe('Cool message.');
  });

  it('sets the _braintreeWebError when given a BraintreeError', () => {
    const btError = new BraintreeError({
      message: 'Cool message.',
      code: 'CODE',
      type: 'MERCHANT'
    });
    const instance = new DropinError(btError);

    expect(instance.message).toBe('Cool message.');
    expect(instance._braintreeWebError).toBe(btError);
  });

  it('sets the _braintreeWebError when not given a BraintreeError', () => {
    const btError = new BraintreeError({
      message: 'Cool message.',
      code: 'CODE',
      type: 'MERCHANT'
    });
    const instance = new DropinError({
      message: 'Custom message.',
      braintreeWebError: btError
    });

    expect(instance.message).toBe('Custom message.');
    expect(instance._braintreeWebError).toBe(btError);
  });
});
