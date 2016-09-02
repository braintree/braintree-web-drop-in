'use strict';

var BaseView = require('../../../src/views/base-view');
var CardPickerView = require('../../../src/views/picker-views/card-picker-view');
var classlist = require('../../../src/lib/classlist');
var CompletedPickerView = require('../../../src/views/picker-views/completed-picker-view');
var PaymentMethodPickerView = require('../../../src/views/payment-method-picker-view');
var paypal = require('braintree-web/paypal');
var PayPalPickerView = require('../../../src/views/picker-views/paypal-picker-view');

describe('PaymentMethodPickerView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new PaymentMethodPickerView(); // eslint-disable-line no-new

      expect(PaymentMethodPickerView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new PaymentMethodPickerView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.element = document.createElement('div');
      this.element.id = 'braintree-dropin__payment-method-picker';
      this.togglerItem = document.createElement('div');
      this.togglerItem.className = 'braintree-dropin__payment-method-picker-toggler';
      this.element.appendChild(this.togglerItem);
      document.body.appendChild(this.element);

      this.context = {
        element: this.element,
        existingPaymentMethods: [],
        ID: 'braintree-dropin__payment-method-picker',
        mainView: {
          asyncDependencyStarting: function () {},
          asyncDependencyReady: function () {}
        },
        options: {
          client: {}
        },
        toggle: this.sandbox.stub(),
        views: []
      };

      this.sandbox.stub(PayPalPickerView, 'isEnabled').returns(true);
      this.sandbox.stub(paypal, 'create').yields(null, {});
      this.sandbox.stub(CardPickerView, 'isEnabled').returns(true);
    });

    afterEach(function () {
      this.element.parentNode.removeChild(this.element);
    });

    it('adds an event listener for payment method picker toggle', function () {
      PaymentMethodPickerView.prototype._initialize.call(this.context);
      this.togglerItem.click();

      expect(this.context.toggle).to.have.been.calledOnce;
    });

    it('creates picker views for enabled views', function () {
      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(this.context.views).to.have.a.lengthOf(2);
      expect(this.context.views[0]).to.be.an.instanceOf(CardPickerView);
      expect(this.context.views[1]).to.be.an.instanceOf(PayPalPickerView);
    });

    it('does not create picker views for disabled views', function () {
      PayPalPickerView.isEnabled.returns(false);

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(this.context.views).to.have.a.lengthOf(1);
      expect(this.context.views[0]).to.not.be.an.instanceOf(PayPalPickerView);
    });

    it('appends picker view to payment method picker', function () {
      var paymentPickerNode;

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      paymentPickerNode = this.element.querySelector('.braintree-dropin__pay-with-card-picker-view');

      expect(paymentPickerNode).to.exist;
    });

    it('hides payment method picker if one payment method is enabled', function () {
      PayPalPickerView.isEnabled.returns(false);
      this.sandbox.spy(classlist, 'add');

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(classlist.add).to.have.been.calledWith(this.element, 'braintree-dropin__hidden');
    });

    it('creates completed picker views for all existing payment methods', function () {
      this.context.existingPaymentMethods = [{nonce: 'nonce', type: 'type'}];
      this.context.addCompletedPickerView = this.sandbox.spy();

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(this.context.addCompletedPickerView).to.be.calledOnce;
    });
  });

  describe('toggle', function () {
    it('toggles closed class of payment method picker element', function () {
      this.sandbox.spy(classlist, 'toggle');
      this.context = {
        element: document.createElement('div')
      };
      PaymentMethodPickerView.prototype.toggle.call(this.context);

      expect(classlist.toggle).to.be.calledOnce;
      expect(classlist.toggle).to.be.calledWith(this.context.element, 'braintree-dropin__closed');
    });
  });

  describe('collapse', function () {
    it('adds closed class to payment method picker element', function () {
      this.sandbox.spy(classlist, 'add');
      this.context = {
        element: document.createElement('div')
      };
      PaymentMethodPickerView.prototype.collapse.call(this.context);

      expect(classlist.add).to.be.calledOnce;
      expect(classlist.add).to.be.calledWith(this.context.element, 'braintree-dropin__closed');
    });
  });

  describe('addCompletedPickerView', function () {
    beforeEach(function () {
      this.context = {
        element: document.createElement('div'),
        views: []
      };
    });

    it('appends CompletedPickerView to payment method picker element', function () {
      var completedPickerView;
      var paymentMethod = {};

      PaymentMethodPickerView.prototype.addCompletedPickerView.call(this.context, paymentMethod);
      completedPickerView = this.context.element.querySelector('.braintree-dropin__completed-picker-view');

      expect(completedPickerView).to.exist;
    });

    it('removes hidden class from payment method picker element', function () {
      this.sandbox.spy(classlist, 'remove');

      PaymentMethodPickerView.prototype.addCompletedPickerView.call(this.context, {});

      expect(classlist.remove).to.be.calledWith(this.context.element, 'braintree-dropin__hidden');
    });

    it('adds newly created CompletedPickerView to views', function () {
      PaymentMethodPickerView.prototype.addCompletedPickerView.call(this.context, {});

      expect(this.context.views).to.have.a.lengthOf(1);
      expect(this.context.views[0]).to.be.an.instanceOf(CompletedPickerView);
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        views: {
          'braintree-dropin__completed-picker-view': {
            teardown: this.sandbox.stub().yields()
          },
          'braintree-dropin__paypal-picker-view': {
            teardown: this.sandbox.stub().yields()
          },
          'braintree-dropin__card-picker-view': {
            teardown: this.sandbox.stub().yields()
          }
        }
      };
    });

    it('calls teardown on each view', function (done) {
      var cardPickerView = this.context.views['braintree-dropin__card-picker-view'];
      var paypalPickerView = this.context.views['braintree-dropin__paypal-picker-view'];
      var completedPickerView = this.context.views['braintree-dropin__completed-picker-view'];

      PaymentMethodPickerView.prototype.teardown.call(this.context, function () {
        expect(cardPickerView.teardown).to.be.calledOnce;
        expect(paypalPickerView.teardown).to.be.calledOnce;
        expect(completedPickerView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('waits to call callback until asyncronous teardowns complete', function (done) {
      var paypalPickerView = this.context.views['braintree-dropin__paypal-picker-view'];

      paypalPickerView.teardown.yieldsAsync();

      PaymentMethodPickerView.prototype.teardown.call(this.context, function () {
        expect(paypalPickerView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('calls callback with error from teardown function', function (done) {
      var paypalPickerView = this.context.views['braintree-dropin__paypal-picker-view'];
      var error = new Error('paypal teardown error');

      paypalPickerView.teardown.yields(error);

      PaymentMethodPickerView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('calls callback with last error if multiple views error', function (done) {
      var cardPickerView = this.context.views['braintree-dropin__card-picker-view'];
      var paypalPickerView = this.context.views['braintree-dropin__paypal-picker-view'];
      var cardPickerViewError = new Error('card picker view teardown error');

      paypalPickerView.teardown.yields(new Error('paypal picker view teardown error'));
      cardPickerView.teardown.yields(cardPickerViewError);

      PaymentMethodPickerView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(cardPickerViewError);
        done();
      });
    });
  });
});
