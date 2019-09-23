require('./helper');

describe('Drop-in card', function () {
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

      expect(browser.dropin().getHTML()).to.include('Cardholder Name');
    });

    it('does not include cardholder name field if not included in config', function () {
      browser.start();

      expect(browser.dropin().getHTML()).to.not.include('Cardholder Name');
    });

    it('does not require cardholder name', function () {
      browser.start(this.options);

      browser.hostedFieldSendInput('number', '4111111111111111');
      browser.hostedFieldSendInput('expirationDate', '1019');
      browser.hostedFieldSendInput('cvv', '123');

      expect($('#pay-button').isEnabled()).to.equal(true);

      browser.submitPay();

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.description).to.include('ending in 11');
      expect(result.details.cardType).to.include('Visa');
    });

    it('can set cardholder name to be required', function () {
      this.options.card.cardholderName = {
        required: true
      };
      browser.start(this.options);

      browser.hostedFieldSendInput('number', '4111111111111111');
      browser.hostedFieldSendInput('expirationDate', '1019');
      browser.hostedFieldSendInput('cvv', '123');

      expect($('#pay-button').isEnabled()).to.equal(false);

      $('.braintree-form-cardholder-name input').typeKeys('First Last');

      expect($('#pay-button').isEnabled()).to.equal(true);

      browser.submitPay();

      const result = browser.getResult();

      expect(result.nonce).to.exist;
      expect(result.description).to.include('ending in 11');
      expect(result.details.cardType).to.include('Visa');
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

      expect(cardSheet).to.include('Card Number');
      expect(cardSheet).to.include('Expiration Date');
      expect(cardSheet).to.not.include('CVV');
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
        expect($('.cvv').getProperty('placeholder')).to.equal('my placeholder');
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
        expect($('.cvv').getProperty('placeholder')).to.equal('');
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
        expect($('.cvv').getCSSProperty('font-size').value).to.equal('20px');
      });

      browser.inFrame($('iframe[id="braintree-hosted-field-number"]'), function () {
        expect($('.number').getCSSProperty('font-size').value).to.equal('10px');
      });
    });
  });

  describe('clearFieldsAfterTokenization', function () {
    it('does not persist data by default', function () {
      browser.start();

      browser.hostedFieldSendInput('number', '4111111111111111');
      browser.hostedFieldSendInput('expirationDate', '1019');
      browser.hostedFieldSendInput('cvv', '123');

      browser.submitPay();

      browser.getResult();

      browser.findByBtId('toggle').click();

      expect($('#pay-button').isEnabled()).to.equal(false);
    });

    it('persists card data after tokenization if false', function () {
      browser.start({
        card: {
          clearFieldsAfterTokenization: false
        }
      });

      browser.hostedFieldSendInput('number', '4111111111111111');
      browser.hostedFieldSendInput('expirationDate', '1019');
      browser.hostedFieldSendInput('cvv', '123');

      browser.submitPay();

      const oldNonce = browser.getResult().nonce;

      browser.findByBtId('toggle').click();

      expect($('#pay-button').isEnabled()).to.equal(true);

      browser.submitPay();

      browser.waitUntil(() => {
        return browser.getResult().nonce !== oldNonce;
      }, null, 'Nonce in result never updated.');

      const newNonce = browser.getResult().nonce;

      expect(oldNonce).to.not.equal(newNonce);
    });
  });
});
