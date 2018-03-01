'use strict';
/* eslint-disable no-new */

var BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
var PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

describe('PayPalView', function () {
  beforeEach(function () {
    this.sandbox.stub(PayPalView.prototype, 'initialize');
  });

  it('inherits from BasePayPalView', function () {
    expect(new PayPalView()).to.be.an.instanceOf(BasePayPalView);
  });

  describe('isEnabled', function () {
    beforeEach(function () {
      this.options = {
        merchantConfiguration: {
          paypal: {}
        }
      };

      this.sandbox.stub(BasePayPalView, 'isEnabled').resolves(true);
    });

    it('resolves false if base PayPal view resolves false', function () {
      BasePayPalView.isEnabled.resolves(false);

      return PayPalView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves false if merchant did not configure paypal', function () {
      delete this.options.merchantConfiguration.paypal;

      return PayPalView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves true if merchant enabled paypal', function () {
      return PayPalView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(true);
      });
    });
  });
});
