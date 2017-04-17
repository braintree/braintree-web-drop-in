'use strict';
/* eslint-disable no-new */

var BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');
var PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

describe('PayPalView', function () {
  beforeEach(function () {
    this.sandbox.stub(PayPalView.prototype, '_initialize');
  });

  it('calls _initialize with false for isCredit', function () {
    new PayPalView();

    expect(PayPalView.prototype._initialize).to.have.been.calledOnce;
    expect(PayPalView.prototype._initialize).to.have.been.calledWith(false);
  });

  it('inherits from BasePayPalView', function () {
    expect(new PayPalView()).to.be.an.instanceOf(BasePayPalView);
  });
});
