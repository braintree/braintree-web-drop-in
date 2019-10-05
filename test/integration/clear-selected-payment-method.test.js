require('./helper');

describe('Drop-in#clearSelectedPaymentMethod', function () {
  it('clears a credit card when it is the active payment method', function () {
    browser.start();

    browser.hostedFieldSendInput('number', '4111111111111111');
    browser.hostedFieldSendInput('expirationDate', '1019');
    browser.hostedFieldSendInput('cvv', '123');

    browser.submitPay();

    expect($('.braintree-method.braintree-method--active').isExisting()).to.equal(true);

    $('#clear-button').click();

    expect($('.braintree-method.braintree-method--active').isExisting()).to.equal(false);
  });

  it('clears paypal when it is the active payment method', function () {
    this.timeout(120000);

    browser.start({
      paypal: 'default'
    });

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin();

    browser.submitPay();

    expect($('.braintree-method.braintree-method--active').isExisting()).to.equal(true);

    $('#clear-button').click();

    expect($('.braintree-method.braintree-method--active').isExisting()).to.equal(false);
  });
});
