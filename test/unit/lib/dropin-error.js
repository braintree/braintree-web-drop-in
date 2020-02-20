'use strict';

var DropinError = require('../../../src/lib/dropin-error');
var BraintreeError = require('braintree-web/lib/braintree-error');

describe('DropinError', () => {
  test('inherits from Error', () => {
    var instance = new DropinError({});

    expect(instance).toBeInstanceOf(DropinError);
  });

  test('sets the name to DropinError', () => {
    var instance = new DropinError({});

    expect(instance.name).toBe('DropinError');
  });

  test('can pass in a object and set the message', () => {
    var instance = new DropinError({
      message: 'Cool message.'
    });

    expect(instance.message).toBe('Cool message.');
  });

  test('can pass in a string and set the message', () => {
    var instance = new DropinError('Cool message.');

    expect(instance.message).toBe('Cool message.');
  });

  test('can pass in an Error object and set the message', () => {
    var instance = new DropinError(new Error('Cool message.'));

    expect(instance.message).toBe('Cool message.');
  });

  test('can pass in a DropinError object and set the message', () => {
    var instance = new DropinError(new DropinError('Cool message.'));

    expect(instance.message).toBe('Cool message.');
  });

  test('sets the _braintreeWebError when given a BraintreeError', () => {
    var btError = new BraintreeError({
      message: 'Cool message.',
      code: 'CODE',
      type: 'MERCHANT'
    });
    var instance = new DropinError(btError);

    expect(instance.message).toBe('Cool message.');
    expect(instance._braintreeWebError).toBe(btError);
  });

  test(
    'sets the _braintreeWebError when not given a BraintreeError',
    () => {
      var btError = new BraintreeError({
        message: 'Cool message.',
        code: 'CODE',
        type: 'MERCHANT'
      });
      var instance = new DropinError({
        message: 'Custom message.',
        braintreeWebError: btError
      });

      expect(instance.message).toBe('Custom message.');
      expect(instance._braintreeWebError).toBe(btError);
    }
  );
});
