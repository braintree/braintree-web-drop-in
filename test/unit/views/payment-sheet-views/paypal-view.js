jest.mock('../../../../src/lib/analytics');

/* eslint-disable no-new */

const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
const PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

describe('PayPalView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    jest.spyOn(PayPalView.prototype, 'initialize').mockImplementation();
  });

  it('inherits from BasePayPalView', () => {
    expect(new PayPalView()).toBeInstanceOf(BasePayPalView);
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.options = {
        merchantConfiguration: {
          paypal: {}
        }
      };

      jest.spyOn(BasePayPalView, 'isEnabled').mockResolvedValue(true);
    });

    it('resolves false if base PayPal view resolves false', () => {
      BasePayPalView.isEnabled.mockResolvedValue(false);

      return PayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves false if merchant did not configure paypal', () => {
      delete testContext.options.merchantConfiguration.paypal;

      return PayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves true if merchant enabled paypal', () =>
      expect(PayPalView.isEnabled(testContext.options)).resolves.toBe(true)
    );
  });
});
