describe('Drop-in events', function () {
  beforeEach(function () {
    if (browser.name() === 'INTERNET EXPLORER') {
      this.skip('IE 11 takes so long to enter card details due to a bug in the IE driver that these tests time out too often');

      return;
    }
    browser.reloadSessionOnRetry(this.currentTest);
  });

  it('disable and enable submit button on credit card validity', function () {
    browser.start();

    expect($('#pay-button').isEnabled()).toBe(false);

    // Put in valid state
    browser.hostedFieldSendInput('number');
    browser.hostedFieldSendInput('expirationDate');
    browser.hostedFieldSendInput('cvv');
    browser.hostedFieldSendInput('postalCode');

    expect($('#pay-button').isEnabled()).toBe(true);

    // Put in invalid state
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', '10');

    expect($('#pay-button').isEnabled()).toBe(false);

    // Put in valid state again
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', String((new Date().getFullYear() % 100) + 3));

    expect($('#pay-button').isEnabled()).toBe(true);
  });

  it('enable submit button on PayPal authorization @paypal', function () {
    browser.start({
      paypal: 'default'
    });

    expect($('#pay-button').isEnabled()).toBe(false);

    browser.clickOption('paypal');
    browser.openPayPalAndCompleteLogin();

    expect($('#pay-button').isEnabled()).toBe(true);

    $('.braintree-toggle').click();

    expect($('#pay-button').isEnabled()).toBe(true);

    browser.clickOption('paypal');

    expect($('#pay-button').isEnabled()).toBe(false);

    $('.braintree-toggle').click();

    expect($('#pay-button').isEnabled()).toBe(true);
  });
});
