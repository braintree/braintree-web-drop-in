
const BaseView = require('../../../src/views/base-view');
const DeleteConfirmationView = require('../../../src/views/delete-confirmation-view');
const fs = require('fs');
const strings = require('../../../src/translations/en_US');

const mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

describe('DeleteConfirmationView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.element = document.createElement('div');
    testContext.element.innerHTML = mainHTML;

    testContext.model = {
      deleteVaultedPaymentMethod: jest.fn(),
      cancelDeleteVaultedPaymentMethod: jest.fn()
    };

    testContext.view = new DeleteConfirmationView({
      element: testContext.element.querySelector('[data-braintree-id="delete-confirmation"]'),
      model: testContext.model,
      strings: strings
    });
  });

  describe('Constructor', () => {
    beforeEach(() => {
      jest.spyOn(DeleteConfirmationView.prototype, '_initialize').mockImplementation();
    });

    test('inherits from BaseView', () => {
      expect(new DeleteConfirmationView({})).toBeInstanceOf(BaseView);
    });

    test('calls _initialize', () => {
      new DeleteConfirmationView({}); // eslint-disable-line no-new

      expect(DeleteConfirmationView.prototype._initialize).toBeCalledTimes(1);
    });

    test('sets up a button click for the yes button', () => {
      const yesButton = testContext.element.querySelector('[data-braintree-id="delete-confirmation__yes"]');

      yesButton.click();

      expect(testContext.model.deleteVaultedPaymentMethod).toBeCalledTimes(1);
    });

    test('sets up a button click for the no button', () => {
      const noButton = testContext.element.querySelector('[data-braintree-id="delete-confirmation__no"]');

      noButton.click();

      expect(testContext.model.cancelDeleteVaultedPaymentMethod).toBeCalledTimes(1);
    });
  });

  describe('applyPaymentMethod', () => {
    test(
      'applies credit card payment method delete confirmation message',
      () => {
        const paymentMethod = {
          nonce: 'a-nonce',
          type: 'CreditCard',
          details: {
            cardType: 'Visa',
            lastFour: '1234',
            description: 'A card ending in 1234'
          }
        };

        testContext.view.applyPaymentMethod(paymentMethod);

        expect(testContext.view._messageBox.innerText).toBe('Delete Visa card ending in 1234?');
      }
    );

    test('applies PayPal payment method delete confirmation message', () => {
      const paymentMethod = {
        nonce: 'a-nonce',
        type: 'PayPalAccount',
        details: {
          email: 'foo@bar.com'
        }
      };

      testContext.view.applyPaymentMethod(paymentMethod);

      expect(testContext.view._messageBox.innerText).toBe('Delete PayPal account foo@bar.com?');
    });

    test('applies Venmo payment method delete confirmation message', () => {
      const paymentMethod = {
        nonce: 'a-nonce',
        type: 'VenmoAccount',
        details: {
          username: 'foobar'
        }
      };

      testContext.view.applyPaymentMethod(paymentMethod);

      expect(testContext.view._messageBox.innerText).toBe('Are you sure you want to delete Venmo account with username foobar?');
    });

    test(
      'applies generic payment method message for non-card, venmo or paypal accounts',
      () => {
        const paymentMethod = {
          nonce: 'a-nonce',
          type: 'SomeMethod'
        };

        testContext.view.applyPaymentMethod(paymentMethod);

        expect(testContext.view._messageBox.innerText).toBe('Are you sure you want to delete this payment method?');
      }
    );
  });

  describe('onSelection', () => {
    test('focuses the yes button', async () => {
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb();
      });
      const focusSpy = jest.spyOn(testContext.view.getElementById('delete-confirmation__yes'), 'focus');

      testContext.view.onSelection();

      expect(focusSpy).toBeCalledTimes(1);
    });
  });
});
