'use strict';

var BaseView = require('../../../src/views/base-view');
var fake = require('../../helpers/fake');
var fs = require('fs');
var PaymentMethodView = require('../../../src/views/payment-method-view');
var strings = require('../../../src/translations/en_US');

var paymentMethodHTML = fs.readFileSync(__dirname + '/../../../src/html/payment-method.html', 'utf8');

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
        strings: strings,
        _selectDelete: this.sandbox.stub(),
        _choosePaymentMethod: this.sandbox.stub()
      };
    });

    it('sets the inner HTML correctly when the paymentMethod is a credit card', function () {
      var iconElement, iconContainer, labelElement;
      var paymentMethod = {
        type: 'CreditCard',
        details: {
          cardType: 'Visa',
          lastFour: '1111'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      iconContainer = this.context.element.querySelector('.braintree-method__logo svg');
      labelElement = this.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).to.equal('#icon-visa');
      expect(labelElement.textContent).to.contain('Ending in 1111');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('Visa');
      expect(iconContainer.classList.contains('braintree-icon--bordered')).to.be.true;
    });

    it('sets the inner HTML correctly when the paymentMethod is a PayPal account', function () {
      var iconElement, iconContainer, labelElement;
      var paymentMethod = {
        type: 'PayPalAccount',
        details: {
          email: 'test@example.com'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      iconContainer = this.context.element.querySelector('.braintree-method__logo svg');
      labelElement = this.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).to.equal('#logoPayPal');
      expect(labelElement.textContent).to.contain('test@example.com');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('PayPal');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).to.be.false;
    });

    it('sets the inner HTML correctly when the paymentMethod is Google Pay', function () {
      var iconElement, iconContainer, labelElement;
      var paymentMethod = {
        type: 'AndroidPayCard',
        details: {
          cardType: 'Visa',
          dpanLastTwo: '92',
          paymentInstrumentName: 'Visa 0492'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      iconContainer = this.context.element.querySelector('.braintree-method__logo svg');
      labelElement = this.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).to.equal('#logoGooglePay');
      expect(labelElement.textContent).to.contain('Google Pay');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).to.be.false;
    });

    it('sets the inner HTML correctly when the paymentMethod is Apple Pay', function () {
      var iconElement, iconContainer, labelElement;
      var paymentMethod = {
        type: 'ApplePayCard',
        details: {
          cardType: 'Visa',
          dpanLastTwo: '92',
          paymentInstrumentName: 'Visa 0492'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      iconContainer = this.context.element.querySelector('.braintree-method__logo svg');
      labelElement = this.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).to.equal('#logoApplePay');
      expect(labelElement.textContent).to.contain('Apple Pay');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).to.be.false;
    });

    it('sets the inner HTML correctly when the paymentMethod is Venmo', function () {
      var iconElement, iconContainer, labelElement;
      var paymentMethod = {
        type: 'VenmoAccount',
        details: {
          username: '@name'
        }
      };

      this.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(this.context);

      iconElement = this.context.element.querySelector('.braintree-method__logo use');
      iconContainer = this.context.element.querySelector('.braintree-method__logo svg');
      labelElement = this.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).to.equal('#logoVenmo');
      expect(labelElement.textContent).to.contain('@name');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).to.equal('Venmo');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).to.be.false;
    });
  });

  describe('setActive', function () {
    beforeEach(function () {
      this.context = {element: document.createElement('div')};
      this.sandbox.useFakeTimers();
    });

    it('adds braintree-method--active if setting active payment method', function () {
      this.context.element.className = '';

      PaymentMethodView.prototype.setActive.call(this.context, true);
      this.sandbox.clock.tick(1001);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.true;
    });

    it("doesn't change the class if braintree-method--active is already there", function () {
      this.context.element.className = 'braintree-method--active';

      PaymentMethodView.prototype.setActive.call(this.context, true);
      this.sandbox.clock.tick(1001);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.true;
    });

    it('removes braintree-method--active if setting active payment method', function () {
      this.context.element.className = 'braintree-method--active';

      PaymentMethodView.prototype.setActive.call(this.context, false);
      this.sandbox.clock.tick(1001);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.false;
    });

    it("doesn't remove the class if it wasn't there", function () {
      this.context.element.className = '';

      PaymentMethodView.prototype.setActive.call(this.context, false);
      this.sandbox.clock.tick(1001);

      expect(this.context.element.classList.contains('braintree-method--active')).to.be.false;
    });
  });

  describe('edit mode', function () {
    it('does not call model.changeActivePaymentMethod in click handler when in edit mode', function () {
      var model = fake.model();
      var view = new PaymentMethodView({
        model: model,
        strings: strings,
        paymentMethod: {
          type: 'Foo',
          nonce: 'nonce'
        }
      });

      this.sandbox.stub(model, 'changeActivePaymentMethod');
      this.sandbox.stub(model, 'isInEditMode').returns(true);

      view._choosePaymentMethod();

      expect(view.model.changeActivePaymentMethod).to.not.be.called;

      model.isInEditMode.returns(false);
      view._choosePaymentMethod();

      expect(view.model.changeActivePaymentMethod).to.be.calledOnce;
    });

    it('calls model.confirmPaymentMethodDeletion when delete icon is clicked', function () {
      var fakeModel = {
        confirmPaymentMethodDeletion: this.sandbox.stub()
      };
      var paymentMethod = {
        type: 'Foo',
        nonce: 'nonce'
      };
      var view = new PaymentMethodView({
        model: fakeModel,
        strings: strings,
        paymentMethod: paymentMethod
      });

      view._selectDelete();

      expect(fakeModel.confirmPaymentMethodDeletion).to.be.calledOnce;
      expect(fakeModel.confirmPaymentMethodDeletion).to.be.calledWith(paymentMethod);
    });
  });
});
