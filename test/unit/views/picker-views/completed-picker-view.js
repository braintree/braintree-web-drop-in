'use strict';

var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var CompletedPickerView = require('../../../../src/views/picker-views/completed-picker-view');

describe('CompletedPickerView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CompletedPickerView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new CompletedPickerView(); // eslint-disable-line no-new

      expect(CompletedPickerView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BasePickerView', function () {
      expect(new CompletedPickerView()).to.be.an.instanceOf(BasePickerView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.fakeCompletedPickerView = document.createElement('div');
      document.body.appendChild(this.fakeCompletedPickerView);

      this.context = {
        element: this.fakeCompletedPickerView,
        mainView: {updateActivePaymentMethod: this.sandbox.stub()},
        paymentMethod: 'a-payment-method'
      };
    });

    it('sets the active payment method when clicked', function () {
      CompletedPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.updateActivePaymentMethod).to.be.calledWith(this.context.paymentMethod, true);
    });

    it('appends completed picker html', function () {
      CompletedPickerView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('.braintree-dropin__completed-picker-view')).to.exist;
    });
  });
});
