jest.mock('../../../../src/lib/analytics');

/* eslint-disable no-new */

const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
const PayPalCreditView = require('../../../../src/views/payment-sheet-views/paypal-credit-view');

describe('PayPalCreditView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    jest.spyOn(PayPalCreditView.prototype, 'initialize').mockImplementation();
  });

  test('inherits from BasePayPalView', () => {
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

    test('resolves false if base PayPal view resolves false', () => {
      BasePayPalView.isEnabled.mockResolvedValue(false);

      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves false if merchant did not configure paypalCredit', () => {
      delete testContext.options.merchantConfiguration.paypalCredit;

      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves true if merchant enabled paypalCredit', () => {
      return PayPalCreditView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(true);
      });
    });
  });
});
