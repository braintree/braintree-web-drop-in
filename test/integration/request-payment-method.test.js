require('./helper');

describe('Drop-in#requestPaymentMethod', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry();
  });

  describe('callback api', function () {
    it('tokenizes a card', function () {
      browser.start();

      browser.hostedFieldSendInput('number', '4111111111111111');
      browser.hostedFieldSendInput('expirationDate', '1030');
      browser.hostedFieldSendInput('cvv', '123');

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).to.include('Paying with');

      expect(browser.dropin().getHTML()).to.include('Ending in 1111');

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.description).to.include('ending in 11');
      expect(result.details.cardType).to.include('Visa');
    });

    it('tokenizes PayPal @paypal', function () {
      browser.start({
        paypal: 'default'
      });

      browser.clickOption('paypal');
      browser.openPayPalAndCompleteLogin();

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).to.include('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.type).to.equal('PayPalAccount');
      expect(result.details.email).to.include(process.env.PAYPAL_USERNAME);
    });

    it('tokenizes PayPal Credit', function () {
      switch (browser.name()) {
        case 'SAFARI':
        case 'INTERNET EXPLORER':
          this.skip(`${browser.name()} broken for the credit flow.`);

          return;
        default:
      }

      browser.start({
        paypalCredit: 'default'
      });

      browser.clickOption('paypalCredit');
      browser.openPayPalAndCompleteLogin(function () {
        expect($('body').getHTML()).to.include('PayPal Credit');
      });

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).to.include('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.type).to.equal('PayPalAccount');
      expect(result.details.email).to.include(process.env.PAYPAL_USERNAME);
    });
  });

  describe('promise API', function () {
    it('tokenizes a card', function () {
      browser.start('/promise.html');

      browser.clickOption('card');

      browser.hostedFieldSendInput('number', '4111111111111111');
      browser.hostedFieldSendInput('expirationDate', '1030');
      browser.hostedFieldSendInput('cvv', '123');

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).to.include('Paying with');

      expect(browser.dropin().getHTML()).to.include('Ending in 1111');

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.description).to.include('ending in 11');
      expect(result.details.cardType).to.include('Visa');
    });

    it('tokenizes PayPal', function () {
      browser.start('/promise.html');

      browser.clickOption('paypal');
      browser.openPayPalAndCompleteLogin();

      browser.submitPay();

      expect($('[data-braintree-id="methods-label"]').getHTML()).to.include('Paying with PayPal');

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.type).to.equal('PayPalAccount');
      expect(result.details.email).to.include(process.env.PAYPAL_USERNAME);
    });
  });
});
