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
});
