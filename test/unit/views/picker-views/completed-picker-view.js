'use strict';

var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var CompletedPickerView = require('../../../../src/views/picker-views/completed-picker-view');
var classlist = require('../../../../src/lib/classlist');
var events = require('../../../../src/constants').events;

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
        mainView: {
          emit: this.sandbox.stub(),
          updateCompletedView: this.sandbox.stub()
        },
        paymentMethod: 'a-payment-method'
      };
    });

    it('adds completed picker view class', function () {
      this.sandbox.stub(classlist, 'add');
      CompletedPickerView.prototype._initialize.call(this.context);

      expect(classlist.add).to.have.been.calledWith(this.context.element, 'braintree-dropin__completed-picker-view');
    });

    it('calls updateCompletedView when clicked', function () {
      CompletedPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.updateCompletedView).to.be.calledWith(this.context.paymentMethod, true);
    });

    it('emits PAYMENT_METHOD_REQUESTABLE when clicked', function () {
      CompletedPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.emit).to.be.calledWith(events.PAYMENT_METHOD_REQUESTABLE);
    });
  });
});
