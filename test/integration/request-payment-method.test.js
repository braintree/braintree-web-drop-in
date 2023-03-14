describe('Drop-in#requestPaymentMethod', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry(this.currentTest);
  });

  describe('callback api', function () {
    it('tokenizes a card', function () {
      browser.start();

      browser.hostedFieldSendInput('number');
      browser.hostedFieldSendInput('expirationDate');
      browser.hostedFieldSendInput('cvv');
      browser.hostedFieldSendInput('postalCode');

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getText()).toContain('Paying with');

      expect(browser.dropin().getText()).toContain('Ending in 1111');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.description).toContain('ending in 11');
      expect(result.details.cardType).toContain('Visa');
    });

    it('tokenizes PayPal @paypal', function () {
      browser.start({
        paypal: 'default'
      });

      browser.clickOption('paypal');
      browser.openPayPalAndCompleteLogin();

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getText()).toContain('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.type).toBe('PayPalAccount');
      expect(result.details.email).toContain(process.env.PAYPAL_USERNAME);
    });

    it('tokenizes PayPal Credit @paypal', function () {
      if (browser.name() === 'SAFARI') {
        this.skip(`${browser.name()} broken for the credit flow. It makes the user apply for PP credit :( :( :(`);
      }

      browser.start({
        paypalCredit: 'default'
      });

      browser.clickOption('paypalCredit');
      browser.openPayPalAndCompleteLogin(function () {
        expect($('img[alt="PayPal Credit"]').isExisting()).toBe(true);
      });

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getText()).toContain('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.type).toBe('PayPalAccount');
      expect(result.details.email).toContain(process.env.PAYPAL_USERNAME);
    });
  });

  describe('promise API', function () {
    it('tokenizes a card', function () {
      browser.start('/promise.html');

      browser.clickOption('card');

      browser.hostedFieldSendInput('number');
      browser.hostedFieldSendInput('expirationDate');
      browser.hostedFieldSendInput('cvv');
      browser.hostedFieldSendInput('postalCode');

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getText()).toContain('Paying with');

      expect(browser.dropin().getText()).toContain('Ending in 1111');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.description).toContain('ending in 11');
      expect(result.details.cardType).toContain('Visa');
    });

    it('tokenizes PayPal @paypal', function () {
      browser.start('/promise.html');

      browser.clickOption('paypal');
      browser.openPayPalAndCompleteLogin();

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getText()).toContain('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.type).toBe('PayPalAccount');
      expect(result.details.email).toContain(process.env.PAYPAL_USERNAME);
    });
  });
});
