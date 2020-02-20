'use strict';
/* eslint-disable no-new */

const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
const PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

describe('PayPalView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    jest.spyOn(PayPalView.prototype, 'initialize').mockImplementation();
  });

  test('inherits from BasePayPalView', () => {
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

    test('resolves false if base PayPal view resolves false', () => {
      BasePayPalView.isEnabled.mockResolvedValue(false);

      return PayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves false if merchant did not configure paypal', () => {
      delete testContext.options.merchantConfiguration.paypal;

      return PayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves true if merchant enabled paypal', () => {
      return PayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(true);
      });
    });
  });
});
