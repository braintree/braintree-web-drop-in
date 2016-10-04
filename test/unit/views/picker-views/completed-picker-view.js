'use strict';

var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var CompletedPickerView = require('../../../../src/views/picker-views/completed-picker-view');
var DropinModel = require('../../../../src/dropin-model');

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

      this.model = new DropinModel();

      this.context = {
        element: this.fakeCompletedPickerView,
        model: this.model,
        _onSelect: CompletedPickerView.prototype._onSelect,
        paymentMethod: 'a-payment-method'
      };
    });

    it('sets the active payment method when clicked', function () {
      this.sandbox.stub(this.model, 'changeActivePaymentMethod');

      CompletedPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.model.changeActivePaymentMethod).to.be.calledWith(this.context.paymentMethod);
    });

    it('sets the active payment method when enter is pressed', function () {
      var event = new CustomEvent('keydown');

      this.sandbox.stub(this.model, 'changeActivePaymentMethod');

      CompletedPickerView.prototype._initialize.call(this.context);

      event.which = 13;
      this.context.element.dispatchEvent(event);

      expect(this.model.changeActivePaymentMethod).to.be.calledWith(this.context.paymentMethod);
    });

    it('appends completed picker html', function () {
      CompletedPickerView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('.braintree-dropin__completed-picker-view')).to.exist;
    });

    it('sets correct details for CreditCard payment methods', function () {
      var detail, icon, type;

      this.context.paymentMethod = {
        details: {
          cardType: 'MasterCard',
          lastTwo: '66'
        },
        type: 'CreditCard'
      };

      CompletedPickerView.prototype._initialize.call(this.context);

      detail = this.context.element.querySelector('.braintree-dropin__list-term');
      type = this.context.element.querySelector('.braintree-dropin__list-desc');
      icon = this.context.element.querySelector('[*|href="#icon-master-card"]');

      expect(detail.innerHTML).to.equal('Ending in ••66');
      expect(type.innerHTML).to.equal('MasterCard');
      expect(icon).to.exist;
    });

    it('sets correct details for PayPalAccount payment methods', function () {
      var detail, icon, type;

      this.context.paymentMethod = {
        details: {
          email: 'my-email@cool.biz'
        },
        type: 'PayPalAccount'
      };

      CompletedPickerView.prototype._initialize.call(this.context);

      detail = this.context.element.querySelector('.braintree-dropin__list-term');
      type = this.context.element.querySelector('.braintree-dropin__list-desc');
      icon = this.context.element.querySelector('[*|href="#logoPayPal"]');

      expect(detail.innerHTML).to.equal('my-email@cool.biz');
      expect(type.innerHTML).to.equal('PayPal');
      expect(icon).to.exist;
    });
  });
});
