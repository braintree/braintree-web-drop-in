require('./helper');

describe('Drop-in card', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry(this.currentTest);
  });

  describe('cardholderName', function () {
    beforeEach(function () {
      this.options = {
        card: {
          cardholderName: true
        }
      };
    });

    it('can add a cardholder name field to the card form', function () {
      browser.start(this.options);

      expect(browser.dropin().getHTML()).toContain('Cardholder Name');
    });

    it('does not include cardholder name field if not included in config', function () {
      browser.start();

      expect(browser.dropin().getHTML()).not.toContain('Cardholder Name');
    });

    it('does not require cardholder name', function () {
      browser.start(this.options);

      browser.hostedFieldSendInput('number');
      browser.hostedFieldSendInput('expirationDate');
      browser.hostedFieldSendInput('cvv');

      expect($('#pay-button').isEnabled()).toBe(true);

      browser.submitPay();

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.description).toContain('ending in 11');
      expect(result.details.cardType).toContain('Visa');
    });

    it('can set cardholder name to be required', function () {
      this.options.card.cardholderName = {
        required: true
      };
      browser.start(this.options);

      browser.hostedFieldSendInput('number');
      browser.hostedFieldSendInput('expirationDate');
      browser.hostedFieldSendInput('cvv');

      expect($('#pay-button').isEnabled()).toBe(false);

      $('.braintree-form-cardholder-name input').typeKeys('First Last');

      expect($('#pay-button').isEnabled()).toBe(true);

      browser.submitPay();

      const result = browser.getResult();

      expect(result.nonce).toBeTruthy();
      expect(result.description).toContain('ending in 11');
      expect(result.details.cardType).toContain('Visa');
    });
  });

  describe('Hosted Fields overrides', function () {
    it('can remove a field from the card form', function () {
      browser.start({
        card: {
          overrides: {
            fields: {
              cvv: null
            }
          }
        }
      });

      const cardSheet = browser.findByBtId('card').getHTML();

      expect(cardSheet).toContain('Card Number');
      expect(cardSheet).toContain('Expiration Date');
      expect(cardSheet).not.toContain('CVV');
    });

    it('can override field configurations', function () {
      browser.start({
        card: {
          overrides: {
            fields: {
              cvv: {
                placeholder: 'my placeholder'
              }
            }
          }
        }
      });

      const iframe = $('iframe[id="braintree-hosted-field-cvv"]');

      browser.inFrame(iframe, () => {
        expect($('.cvv').getProperty('placeholder')).toBe('my placeholder');
      });
    });

    it('can override field configurations with falsey values', function () {
      browser.start({
        card: {
          overrides: {
            fields: {
              cvv: {
                placeholder: ''
              }
            }
          }
        }
      });

      const iframe = $('iframe[id="braintree-hosted-field-cvv"]');

      browser.inFrame(iframe, () => {
        expect($('.cvv').getProperty('placeholder')).toBe('');
      });
    });

    it('can override style configurations', function () {
      browser.start({
        card: {
          overrides: {
            styles: {
              input: {
                'font-size': '20px'
              },
              '.number': {
                'font-size': '10px'
              }
            }
          }
        }
      });

      browser.inFrame($('iframe[id="braintree-hosted-field-cvv"]'), () => {
        expect($('.cvv').getCSSProperty('font-size').value).toBe('20px');
      });

      browser.inFrame($('iframe[id="braintree-hosted-field-number"]'), function () {
        expect($('.number').getCSSProperty('font-size').value).toBe('10px');
      });
    });
  });

  describe('clearFieldsAfterTokenization', function () {
    it('does not persist data by default', function () {
      browser.start();

      browser.hostedFieldSendInput('number');
      browser.hostedFieldSendInput('expirationDate');
      browser.hostedFieldSendInput('cvv');

      browser.submitPay();

      browser.getResult();

      browser.findByBtId('toggle').click();

      expect($('#pay-button').isEnabled()).toBe(false);
    });

    it('persists card data after tokenization if false', function () {
      browser.start({
        card: {
          clearFieldsAfterTokenization: false
        }
      });

      browser.hostedFieldSendInput('number');
      browser.hostedFieldSendInput('expirationDate');
      browser.hostedFieldSendInput('cvv');

      browser.submitPay();

      const oldNonce = browser.getResult().nonce;

      browser.findByBtId('toggle').click();

      expect($('#pay-button').isEnabled()).toBe(true);

      browser.submitPay();

      browser.waitUntil(() => {
        return browser.getResult().nonce !== oldNonce;
      }, {
        timeoutMsg: 'Nonce in result never updated.'
      });

      const newNonce = browser.getResult().nonce;

      expect(oldNonce).not.toBe(newNonce);
    });
  });
});
