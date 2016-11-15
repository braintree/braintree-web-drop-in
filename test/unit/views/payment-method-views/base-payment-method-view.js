'use strict';

var BasePaymentMethodView = require('../../../../src/views/payment-method-views/base-payment-method-view');
var BaseView = require('../../../../src/views/base-view');

describe('BasePaymentMethodView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(BasePaymentMethodView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new BasePaymentMethodView({})).to.be.an.instanceOf(BaseView);
    });

    it('calls _initialize', function () {
      new BasePaymentMethodView({}); // eslint-disable-line no-new

      expect(BasePaymentMethodView.prototype._initialize).to.have.been.calledOnce;
    });
  });
});
