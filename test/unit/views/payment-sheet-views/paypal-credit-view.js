'use strict';
/* eslint-disable no-new */

var BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
var PayPalCreditView = require('../../../../src/views/payment-sheet-views/paypal-credit-view');

describe('PayPalCreditView', function () {
  beforeEach(function () {
    this.sandbox.stub(PayPalCreditView.prototype, '_initialize');
  });

  it('calls _initialize with true for isCredit', function () {
    new PayPalCreditView();

    expect(PayPalCreditView.prototype._initialize).to.have.been.calledOnce;
    expect(PayPalCreditView.prototype._initialize).to.have.been.calledWith(true);
  });

  it('inherits from BasePayPalView', function () {
    expect(new PayPalCreditView()).to.be.an.instanceOf(BasePayPalView);
  });
});
