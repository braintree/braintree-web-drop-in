'use strict';
/* eslint-disable no-new */

var BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
var PayPalCreditView = require('../../../../src/views/payment-sheet-views/paypal-credit-view');

describe('PayPalCreditView', function () {
  beforeEach(function () {
    this.sandbox.stub(PayPalCreditView.prototype, 'initialize');
  });

  it('inherits from BasePayPalView', function () {
    expect(new PayPalCreditView()).to.be.an.instanceOf(BasePayPalView);
  });

  describe('isEnabled', function () {
    beforeEach(function () {
      this.options = {
        merchantConfiguration: {
          paypalCredit: {}
        }
      };

      this.sandbox.stub(BasePayPalView, 'isEnabled').resolves(true);
    });

    it('resolves false if base PayPal view resolves false', function () {
      BasePayPalView.isEnabled.resolves(false);

      return PayPalCreditView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves false if merchant did not configure paypalCredit', function () {
      delete this.options.merchantConfiguration.paypalCredit;

      return PayPalCreditView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves true if merchant enabled paypalCredit', function () {
      return PayPalCreditView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(true);
      });
    });
  });
});
