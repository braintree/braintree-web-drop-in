'use strict';

var BaseView = require('../../../src/views/base-view');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
// var mainHTML = require('../../../src/html/main.html');

describe('PaymentOptionsView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentOptionsView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new PaymentOptionsView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new PaymentOptionsView({}); // eslint-disable-line no-new

      expect(PaymentOptionsView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
  });
});
