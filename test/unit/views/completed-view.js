'use strict';

var BaseView = require('../../../src/views/base-view');
var CompletedView = require('../../../src/views/completed-view');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var mainHTML = require('../../../src/html/main.html');

describe('CompletedView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CompletedView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new CompletedView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new CompletedView({}); // eslint-disable-line no-new

      expect(CompletedView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.element = document.createElement('div');
      this.element.innerHTML = mainHTML;
    });

    it('adds all vaulted payment methods', function () {
      var stubModel = {
        getPaymentMethods: function () {
          return [{foo: 'bar'}, {baz: 'qux'}];
        },
        on: function () {}
      };
      var completedView = new CompletedView({
        element: this.element,
        model: stubModel,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      expect(completedView.views.length).to.equal(2);
      expect(completedView.container.childElementCount).to.equal(2);
    });

    it('sets the first payment method as the active payment method view', function () {
      var stubModel = {
        getPaymentMethods: function () {
          return [{foo: 'bar'}, {baz: 'qux'}];
        },
        on: function () {}
      };
      var completedView = new CompletedView({
        element: this.element,
        model: stubModel,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      expect(completedView.activeView).to.equal(completedView.views[0]);
      expect(completedView.views[0].element.classList.contains('braintree-method--active')).to.be.true;
      expect(completedView.views[1].element.classList.contains('braintree-method--active')).to.be.false;
    });

    it('does not add payment methods if there are none', function () {
      var stubModel = {
        getPaymentMethods: function () { return []; },
        on: function () {}
      };
      var completedView = new CompletedView({
        element: this.element,
        model: stubModel,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      expect(completedView.views.length).to.equal(0);
    });

    it('changes the payment method view when the active payment method changes', function () {
      var model, completedView;
      var fakePaymentMethod = {baz: 'qux'};

      model = new DropinModel({
        paymentMethods: [{foo: 'bar'}, fakePaymentMethod]
      });
      completedView = new CompletedView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      model.changeActivePaymentMethod(fakePaymentMethod);

      expect(completedView.activeView).to.equal(completedView.views[1]);
      expect(completedView.views[0].element.classList.contains('braintree-method--active')).to.be.false;
      expect(completedView.views[1].element.classList.contains('braintree-method--active')).to.be.true;
    });
  });

  describe('_addPaymentMethod', function () {
    beforeEach(function () {
      var div = document.createElement('div');

      div.innerHTML = mainHTML;
      this.element = div.querySelector('[data-braintree-id="completed"]');
      this.fakePaymentMethod = {bax: 'qux'};
    });

    it('does not remove other payment methods in non-guest checkout', function () {
      var completedContainer = this.element.querySelector('[data-braintree-id="completed-container"]');
      var model = new DropinModel({paymentMethods: [this.fakePaymentMethod]});
      var completedView = new CompletedView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      model.addPaymentMethod({foo: 'bar'});

      expect(completedView.views.length).to.equal(2);
      expect(completedContainer.childElementCount).to.equal(2);
    });

    it('removes other payment methods in guest checkout', function () {
      var completedContainer = this.element.querySelector('[data-braintree-id="completed-container"]');
      var model = new DropinModel({paymentMethods: [this.fakePaymentMethod]});
      var completedView = new CompletedView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientToken
        },
        strings: {}
      });

      model.addPaymentMethod({foo: 'bar'});

      expect(completedView.views.length).to.equal(1);
      expect(completedContainer.childElementCount).to.equal(1);
    });

    it('does not try to remove a payment method if none exists in guest checkout', function () {
      var completedContainer = this.element.querySelector('[data-braintree-id="completed-container"]');
      var model = new DropinModel();
      var completedView = new CompletedView({
        element: this.element,
        model: model,
        options: {
          authorization: fake.clientToken
        },
        strings: {}
      });

      model.addPaymentMethod({foo: 'bar'});

      expect(completedView.views.length).to.equal(1);
      expect(completedContainer.childElementCount).to.equal(1);
    });
  });

  describe('requestPaymentMethod', function () {
    it('calls the callback with the active payment method', function (done) {
      var completedView;
      var element = document.createElement('div');
      var model = new DropinModel({
        paymentMethods: [{foo: 'bar'}, {baz: 'qux'}]
      });

      element.innerHTML = mainHTML;
      completedView = new CompletedView({
        element: element,
        model: model,
        options: {
          authorization: fake.clientTokenWithCustomerID
        },
        strings: {}
      });

      completedView.requestPaymentMethod(function (err, payload) {
        expect(err).to.not.exist;
        expect(payload.foo).to.equal('bar');
        done();
      });
    });
  });
});
