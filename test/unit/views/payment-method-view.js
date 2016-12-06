'use strict';

var BaseView = require('../../../src/views/base-view');
var PaymentMethodView = require('../../../src/views/payment-method-view');
var paymentMethodHTML = require('../../../src/html/payment-method.html');
var strings = require('../../../src/translations/en');

describe('PaymentMethodView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');
    this.div.innerHTML = paymentMethodHTML;
    document.body.appendChild(this.div);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentMethodView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new PaymentMethodView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new PaymentMethodView({}); // eslint-disable-line no-new

      expect(PaymentMethodView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.context = {
        strings: strings
      };
    });

    it('sets the inner HTML correctly when the paymentMethod is a credit card', function () {
      var iconElement, labelElement;
      var paymentMethod = {
        type: 'CreditCard',
        details: {
          cardType: 'Visa',
          lastTwo: '11'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      labelElement = this.context.element.querySelector('.braintree-method__label');
      expect(iconElement.getAttribute('xlink:href')).to.equal('#icon-visa');
      expect(labelElement.textContent).to.contain('Ending in ••11');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('Visa');
    });

    it('sets the inner HTML correctly when the paymentMethod is a PayPal account', function () {
      var iconElement, labelElement;
      var paymentMethod = {
        type: 'PayPalAccount',
        details: {
          email: 'test@example.com'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      labelElement = this.context.element.querySelector('.braintree-method__label');
      expect(iconElement.getAttribute('xlink:href')).to.equal('#logoPayPal');
      expect(labelElement.textContent).to.contain('test@example.com');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('PayPal');
    });
  });

  describe('setActive', function () {
    beforeEach(function () {
      this.context = {element: document.createElement('div')};
    });

    it('adds braintree-method--active if setting active payment method', function () {
      PaymentMethodView.prototype.setActive.call(this.context, true);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.true;
    });

    it('removes braintree-method--active if setting active payment method', function () {
      PaymentMethodView.prototype.setActive.call(this.context, false);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.false;
    });
  });
});
