'use strict';

var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var CardPickerView = require('../../../../src/views/picker-views/card-picker-view');
var classlist = require('../../../../src/lib/classlist');

describe('CardPickerView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CardPickerView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new CardPickerView(); // eslint-disable-line no-new

      expect(CardPickerView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BasePickerView', function () {
      expect(new CardPickerView()).to.be.an.instanceOf(BasePickerView);
    });
  });

  describe('isEnabled', function () {
    it('returns true', function () {
      expect(CardPickerView.isEnabled()).to.be.true;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.context = {
        element: document.createElement('div'),
        mainView: {
          setActiveView: this.sandbox.spy()
        }
      };
    });

    it('adds pay with card picker view class', function () {
      this.sandbox.spy(classlist, 'add');

      CardPickerView.prototype._initialize.call(this.context);

      expect(classlist.add).to.have.been.calledWith(this.context.element, 'braintree-dropin__pay-with-card-picker-view');
    });

    it('sets pay with card view as the active view when clicked', function () {
      CardPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.setActiveView).to.be.calledOnce;
      expect(this.context.mainView.setActiveView).to.be.calledWith('braintree-dropin__pay-with-card');
    });
  });
});
