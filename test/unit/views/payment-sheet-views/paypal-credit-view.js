jest.mock('../../../../src/lib/analytics');

/* eslint-disable no-new */

const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
const PayPalCreditView = require('../../../../src/views/payment-sheet-views/paypal-credit-view');

describe('PayPalCreditView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    jest.spyOn(PayPalCreditView.prototype, 'initialize').mockImplementation();
  });

  it('inherits from BasePayPalView', () => {
    expect(new PayPalCreditView()).toBeInstanceOf(BasePayPalView);
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.options = {
        merchantConfiguration: {
          paypalCredit: {}
        }
      };

      jest.spyOn(BasePayPalView, 'isEnabled').mockResolvedValue(true);
    });

    it('resolves false if base PayPal view resolves false', () => {
      BasePayPalView.isEnabled.mockResolvedValue(false);

      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves false if merchant configured the normal PayPal view to use the vault flow', () => {
      testContext.options.merchantConfiguration.paypal = {
        flow: 'vault'
      };

      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves false if merchant configured the PayPal credit view to use the vault flow', () => {
      testContext.options.merchantConfiguration.paypalCredit = {
        flow: 'vault'
      };

      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves false if merchant did not configure paypalCredit', () => {
      delete testContext.options.merchantConfiguration.paypalCredit;

      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves true if merchant enabled paypalCredit', () =>
      expect(PayPalCreditView.isEnabled(testContext.options)).resolves.toBe(true)
    );
  });
});
