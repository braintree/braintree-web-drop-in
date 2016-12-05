'use strict';

var BaseView = require('../../../src/views/base-view');
var CompletedPaymentMethodView = require('../../../src/views/completed-payment-method-view');
var completedPaymentMethodHTML = require('../../../src/html/completed-payment-method.html');
var strings = require('../../../src/translations/en');

describe('CompletedPaymentMethodView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');
    this.div.innerHTML = completedPaymentMethodHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-exposed__option');
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CompletedPaymentMethodView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new CompletedPaymentMethodView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new CompletedPaymentMethodView({}); // eslint-disable-line no-new

      expect(CompletedPaymentMethodView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.context = {
        element: this.element,
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

      CompletedPaymentMethodView.prototype._initialize.call(this.context);

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

      CompletedPaymentMethodView.prototype._initialize.call(this.context);

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
      CompletedPaymentMethodView.prototype.setActive.call(this.context, true);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.true;
    });

    it('removes braintree-method--active if setting active payment method', function () {
      CompletedPaymentMethodView.prototype.setActive.call(this.context, false);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.false;
    });
  });
});
