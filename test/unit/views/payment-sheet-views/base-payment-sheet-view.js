'use strict';

var BasePaymentSheetView = require('../../../../src/views/payment-sheet-views/base-payment-sheet-view');
var BaseView = require('../../../../src/views/base-view');

describe('BasePaymentSheetView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(BasePaymentSheetView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new BasePaymentSheetView({})).to.be.an.instanceOf(BaseView);
    });

    it('calls _initialize', function () {
      new BasePaymentSheetView({}); // eslint-disable-line no-new

      expect(BasePaymentSheetView.prototype._initialize).to.have.been.calledOnce;
    });
  });
});
