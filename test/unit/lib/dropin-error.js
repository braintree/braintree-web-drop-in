'use strict';

var DropinError = require('../../../src/lib/dropin-error');
var BraintreeError = require('braintree-web/lib/braintree-error');

describe('DropinError', function () {
  it('inherits from Error', function () {
    var instance = new DropinError({});

    expect(instance).to.be.an.instanceOf(DropinError);
  });

  it('sets the name to DropinError', function () {
    var instance = new DropinError({});

    expect(instance.name).to.equal('DropinError');
  });

  it('can pass in a object and set the message', function () {
    var instance = new DropinError({
      message: 'Cool message.'
    });

    expect(instance.message).to.equal('Cool message.');
  });

  it('can pass in a string and set the message', function () {
    var instance = new DropinError('Cool message.');

    expect(instance.message).to.equal('Cool message.');
  });

  it('can pass in an Error object and set the message', function () {
    var instance = new DropinError(new Error('Cool message.'));

    expect(instance.message).to.equal('Cool message.');
  });

  it('can pass in a DropinError object and set the message', function () {
    var instance = new DropinError(new DropinError('Cool message.'));

    expect(instance.message).to.equal('Cool message.');
  });

  it('sets the _braintreeWebError when given a BraintreeError', function () {
    var btError = new BraintreeError({
      message: 'Cool message.',
      code: 'CODE',
      type: 'MERCHANT'
    });
    var instance = new DropinError(btError);

    expect(instance.message).to.equal('Cool message.');
    expect(instance._braintreeWebError).to.equal(btError);
  });

  it('sets the _braintreeWebError when not given a BraintreeError', function () {
    var btError = new BraintreeError({
      message: 'Cool message.',
      code: 'CODE',
      type: 'MERCHANT'
    });
    var instance = new DropinError({
      message: 'Custom message.',
      braintreeWebError: btError
    });

    expect(instance.message).to.equal('Custom message.');
    expect(instance._braintreeWebError).to.equal(btError);
  });
});
