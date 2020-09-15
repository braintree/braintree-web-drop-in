require('./helper');

describe('Drop-in#updateConfiguration', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry(this.currentTest);
  });

  it('updates PayPal configuration @paypal', function () {
    if (browser.name()) {
      this.skip('This test fails repeatedly in multiple browsers. Something about opening 2 popups results in the driver having trouble');

      return;
    }

    browser.start({
      paypal: 'default',
      showUpdatePayPalMenu: true
    });

    $('#paypal-config-checkout').click();

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).not.toContain('future payments');
    });

    $('#paypal-config-vault').click();
    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).toContain('future payments');
    });
  });

  it('updates PayPal Credit configuration @paypal', function () {
    if (browser.name()) {
      this.skip('This test fails repeatedly in multiple browsers. Something about opening 2 popups results in the driver having trouble');

      return;
    }

    browser.start({
      paypal: 'default',
      showUpdatePayPalMenu: true
    });

    $('#paypal-config-checkout').click();

    browser.clickOption('paypalCredit');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).not.toContain('future payments');
    });

    $('#paypal-config-vault').click();
    browser.clickOption('paypalCredit');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).toContain('future payments');
    });
  });

  it('removes authorized PayPal account when configuration is updated @paypal', function () {
    if (browser.name() === 'INTERNET EXPLORER') {
      this.skip('Fails for unknown reasons on IE');

      return;
    }

    browser.start({
      paypal: 'default',
      showUpdatePayPalMenu: true
    });

    $('#paypal-config-checkout').click();

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin();

    expect(browser.dropin().getHTML()).toContain(process.env.PAYPAL_USERNAME);

    $('#paypal-config-vault').click();

    expect(browser.dropin().getHTML()).not.toContain(process.env.PAYPAL_USERNAME);
  });
});
