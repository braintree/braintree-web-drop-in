require('./helper');

describe('Drop-in#clearSelectedPaymentMethod', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry(this.currentTest);
  });

  it('clears a credit card when it is the active payment method', function () {
    browser.start();

    browser.hostedFieldSendInput('number');
    browser.hostedFieldSendInput('expirationDate');
    browser.hostedFieldSendInput('cvv');

    browser.submitPay();

    expect($('.braintree-method.braintree-method--active').isExisting()).toBe(true);

    $('#clear-button').click();

    expect($('.braintree-method.braintree-method--active').isExisting()).toBe(false);
  });

  it('clears paypal when it is the active payment method @paypal', function () {
    browser.start({
      paypal: 'default'
    });

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin();

    browser.submitPay();

    expect($('.braintree-method.braintree-method--active').isExisting()).toBe(true);

    $('#clear-button').click();

    expect($('.braintree-method.braintree-method--active').isExisting()).toBe(false);
  });
});
