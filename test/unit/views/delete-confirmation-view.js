'use strict';

var BaseView = require('../../../src/views/base-view');
var DeleteConfirmationView = require('../../../src/views/delete-confirmation-view');
var fs = require('fs');
var strings = require('../../../src/translations/en_US');

var mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

describe('DeleteConfirmationView', function () {
  beforeEach(function () {
    this.element = document.createElement('div');
    this.element.innerHTML = mainHTML;

    this.model = {
      deleteVaultedPaymentMethod: this.sandbox.stub(),
      cancelDeleteVaultedPaymentMethod: this.sandbox.stub()
    };

    this.view = new DeleteConfirmationView({
      element: this.element.querySelector('[data-braintree-id="delete-confirmation"]'),
      model: this.model,
      strings: strings
    });
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(DeleteConfirmationView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new DeleteConfirmationView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new DeleteConfirmationView({}); // eslint-disable-line no-new

      expect(DeleteConfirmationView.prototype._initialize).to.have.been.calledOnce;
    });

    it('sets up a button click for the yes button', function () {
      var yesButton = this.element.querySelector('[data-braintree-id="delete-confirmation__yes"]');

      yesButton.click();

      expect(this.model.deleteVaultedPaymentMethod).to.be.calledOnce;
    });

    it('sets up a button click for the no button', function () {
      var noButton = this.element.querySelector('[data-braintree-id="delete-confirmation__no"]');

      noButton.click();

      expect(this.model.cancelDeleteVaultedPaymentMethod).to.be.calledOnce;
    });
  });

  describe('applyPaymentMethod', function () {
    it('applies credit card payment method delete confirmation message', function () {
      var paymentMethod = {
        nonce: 'a-nonce',
        type: 'CreditCard',
        details: {
          cardType: 'Visa',
          lastFour: '1234',
          description: 'A card ending in 1234'
        }
      };

      this.view.applyPaymentMethod(paymentMethod);

      expect(this.view._messageBox.innerText).to.equal('Delete Visa card ending in 1234?');
    });

    it('applies PayPal payment method delete confirmation message', function () {
      var paymentMethod = {
        nonce: 'a-nonce',
        type: 'PayPalAccount',
        details: {
          email: 'foo@bar.com'
        }
      };

      this.view.applyPaymentMethod(paymentMethod);

      expect(this.view._messageBox.innerText).to.equal('Delete PayPal account foo@bar.com?');
    });

    it('applies Venmo payment method delete confirmation message', function () {
      var paymentMethod = {
        nonce: 'a-nonce',
        type: 'VenmoAccount',
        details: {
          username: 'foobar'
        }
      };

      this.view.applyPaymentMethod(paymentMethod);

      expect(this.view._messageBox.innerText).to.equal('Are you sure you want to delete Venmo account with username foobar?');
    });

    it('applies generic payment method message for non-card, venmo or paypal accounts', function () {
      var paymentMethod = {
        nonce: 'a-nonce',
        type: 'SomeMethod'
      };

      this.view.applyPaymentMethod(paymentMethod);

      expect(this.view._messageBox.innerText).to.equal('Are you sure you want to delete this payment method?');
    });
  });
});
