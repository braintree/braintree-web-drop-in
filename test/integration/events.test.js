require('./helper');

describe('Drop-in events', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry();
  });

  it('disable and enable submit button on credit card validity', function () {
    browser.start();

    expect($('#pay-button').isEnabled()).to.equal(false);

    // Put in valid state
    browser.hostedFieldSendInput('number');
    browser.hostedFieldSendInput('expirationDate');
    browser.hostedFieldSendInput('cvv');

    expect($('#pay-button').isEnabled()).to.equal(true);

    // Put in invalid state
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', '10');

    expect($('#pay-button').isEnabled()).to.equal(false);

    // Put in valid state again
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', 'Backspace');
    browser.hostedFieldSendInput('expirationDate', String((new Date().getFullYear() % 100) + 3));

    expect($('#pay-button').isEnabled()).to.equal(true);
  });

  it('enable submit button on PayPal authorization @paypal', function () {
    browser.start({
      paypal: 'default'
    });

    expect($('#pay-button').isEnabled()).to.equal(false);

    browser.clickOption('paypal');
    browser.openPayPalAndCompleteLogin();

    expect($('#pay-button').isEnabled()).to.equal(true);

    $('.braintree-toggle').click();

    expect($('#pay-button').isEnabled()).to.equal(true);

    browser.clickOption('paypal');

    expect($('#pay-button').isEnabled()).to.equal(false);

    $('.braintree-toggle').click();

    expect($('#pay-button').isEnabled()).to.equal(true);
  });
});
