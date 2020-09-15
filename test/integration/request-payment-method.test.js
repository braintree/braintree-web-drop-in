require('./helper');

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

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).toContain('Paying with');

      expect(browser.dropin().getHTML()).toContain('Ending in 1111');

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

      expect($('[data-braintree-id="methods-label"]').getHTML()).toContain('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.type).toBe('PayPalAccount');
      expect(result.details.email).toContain(process.env.PAYPAL_USERNAME);
    });

    it('tokenizes PayPal Credit @paypal', function () {
      switch (browser.name()) {
        case 'SAFARI':
        case 'INTERNET EXPLORER':
          this.skip(`${browser.name()} broken for the credit flow. It makes the user apply for PP credit :( :( :(`);

          return;
        default:
      }

      browser.start({
        paypalCredit: 'default'
      });

      browser.clickOption('paypalCredit');
      browser.openPayPalAndCompleteLogin(function () {
        expect($('body').getHTML()).toContain('PayPal Credit');
      });

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).toContain('Paying with PayPal');

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

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).toContain('Paying with');

      expect(browser.dropin().getHTML()).toContain('Ending in 1111');

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

      expect($('[data-braintree-id="methods-label"]').getHTML()).toContain('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.type).toBe('PayPalAccount');
      expect(result.details.email).toContain(process.env.PAYPAL_USERNAME);
    });
  });
});
