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
});
