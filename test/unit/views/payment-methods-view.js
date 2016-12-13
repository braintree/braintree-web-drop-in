'use strict';

var BaseView = require('../../../src/views/base-view');
var PaymentMethodsView = require('../../../src/views/payment-methods-view');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var mainHTML = require('../../../src/html/main.html');
var strings = require('../../../src/translations/en');

describe('PaymentMethodsView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentMethodsView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new PaymentMethodsView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new PaymentMethodsView({}); // eslint-disable-line no-new

      expect(PaymentMethodsView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.element = document.createElement('div');
      this.element.innerHTML = mainHTML;
    });

    it('adds all vaulted payment methods', function () {
      var model = new DropinModel({
        paymentMethods: [{foo: 'bar'}, {baz: 'qux'}]
      });
      var paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      expect(paymentMethodsViews.views.length).to.equal(2);
      expect(paymentMethodsViews.container.childElementCount).to.equal(2);
    });

    it('puts default payment method as first item in list', function () {
      var firstChildLabel;
      var creditCard = {
        details: {type: 'Visa'},
        type: 'CreditCard'
      };
      var paypalAccount = {
        details: {email: 'wow@meow.com'},
        type: 'PayPalAccount'
      };
      var model = new DropinModel({paymentMethods: [paypalAccount, creditCard]});
      var paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: strings
      });

      firstChildLabel = paymentMethodsViews.container.firstChild.querySelector('.braintree-method__label .braintree-method__label--small');

      expect(firstChildLabel.textContent).to.equal(strings.PayPal);
    });

    it('does not add payment methods if there are none', function () {
      var model = new DropinModel();
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      expect(paymentMethodsViews.views.length).to.equal(0);
      expect(methodsContainer.children.length).to.equal(0);
    });

    it('changes the payment method view when the active payment method changes', function () {
      var model, paymentMethodsViews;
      var fakePaymentMethod = {baz: 'qux'};

      model = new DropinModel({
        paymentMethods: [{foo: 'bar'}, fakePaymentMethod]
      });
      paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      model.changeActivePaymentMethod(fakePaymentMethod);

      expect(paymentMethodsViews.activeMethodView.paymentMethod).to.equal(fakePaymentMethod);
      expect(paymentMethodsViews.activeMethodView.element.className).to.contain('braintree-method--active');
    });
  });

  describe('_addPaymentMethod', function () {
    beforeEach(function () {
      var div = document.createElement('div');

      div.innerHTML = mainHTML;
      this.element = div.querySelector('[data-braintree-id="methods"]');
      this.fakePaymentMethod = {bax: 'qux'};
    });

    it('does not remove other payment methods in non-guest checkout', function () {
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var model = new DropinModel({paymentMethods: [this.fakePaymentMethod]});
      var paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      model.addPaymentMethod({foo: 'bar'});

      expect(paymentMethodsViews.views.length).to.equal(2);
      expect(methodsContainer.childElementCount).to.equal(2);
    });

    it('removes other payment methods in guest checkout', function () {
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var model = new DropinModel({paymentMethods: [this.fakePaymentMethod]});
      var paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientToken
        },
        strings: {}
      });

      model.addPaymentMethod({foo: 'bar'});

      expect(paymentMethodsViews.views.length).to.equal(1);
      expect(methodsContainer.childElementCount).to.equal(1);
    });

    it('does not try to remove a payment method if none exists in guest checkout', function () {
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var model = new DropinModel();
      var paymentMethodsViews = new PaymentMethodsView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientToken
        },
        strings: {}
      });

      model.addPaymentMethod({foo: 'bar'});

      expect(paymentMethodsViews.views.length).to.equal(1);
      expect(methodsContainer.childElementCount).to.equal(1);
    });
  });

  describe('requestPaymentMethod', function () {
    it('calls the callback with the active payment method', function (done) {
      var paymentMethodsViews;
      var element = document.createElement('div');
      var model = new DropinModel({
        paymentMethods: [{foo: 'bar'}, {baz: 'qux'}]
      });

      element.innerHTML = mainHTML;
      paymentMethodsViews = new PaymentMethodsView({
        element: element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      paymentMethodsViews.requestPaymentMethod(function (err, payload) {
        expect(err).to.not.exist;
        expect(payload.foo).to.equal('bar');
        done();
      });
    });
  });
});
