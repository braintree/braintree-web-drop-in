require('./helper');

describe('Drop-in#updateConfiguration', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry();
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

    $('#paypal-config-1').click();

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).to.not.include('future payments');
    });

    $('#paypal-config-9').click();
    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).to.include('future payments');
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

    $('#paypal-config-1').click();

    browser.clickOption('paypalCredit');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).to.not.include('future payments');
    });

    $('#paypal-config-9').click();
    browser.clickOption('paypalCredit');

    browser.openPayPalAndCompleteLogin(function () {
      expect($('body').getHTML().toLowerCase()).to.include('future payments');
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

    $('#paypal-config-1').click();

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin();

    expect(browser.dropin().getHTML()).to.include(process.env.PAYPAL_USERNAME);

    $('#paypal-config-9').click();

    expect(browser.dropin().getHTML()).to.not.include(process.env.PAYPAL_USERNAME);
  });
});
