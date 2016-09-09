'use strict';

var BaseView = require('../../../src/views/base-view');
var CardPickerView = require('../../../src/views/picker-views/card-picker-view');
var classlist = require('../../../src/lib/classlist');
var CompletedPickerView = require('../../../src/views/picker-views/completed-picker-view');
var mainHTML = require('../../../src/html/main.html');
var PaymentMethodPickerView = require('../../../src/views/payment-method-picker-view');
var paypal = require('braintree-web/paypal');
var PayPalPickerView = require('../../../src/views/picker-views/paypal-picker-view');

describe('PaymentMethodPickerView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('[data-braintree-id="payment-method-picker"]');
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

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
      this.context = {
        element: this.element,
        existingPaymentMethods: [],
        getElementById: BaseView.prototype.getElementById,
        ID: PaymentMethodPickerView.ID,
        mainView: {
          asyncDependencyStarting: function () {},
          asyncDependencyReady: function () {},
          element: document.body.querySelector('.braintree-dropin')
        },
        options: {
          client: {}
        },
        toggleDrawer: this.sandbox.stub(),
        views: []
      };

      this.sandbox.stub(PayPalPickerView, 'isEnabled').returns(true);
      this.sandbox.stub(paypal, 'create').yields(null, {});
      this.sandbox.stub(CardPickerView, 'isEnabled').returns(true);
    });

    it('adds an event listener for payment method picker toggle', function () {
      var drawer = document.body.querySelector('[data-braintree-id="drawer"]');

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      drawer.click();

      expect(this.context.toggleDrawer).to.have.been.calledOnce;
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

    it('creates completed picker views for all existing payment methods', function () {
      this.context.existingPaymentMethods = [{nonce: 'nonce', type: 'type'}];
      this.context.addCompletedPickerView = this.sandbox.spy();

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(this.context.addCompletedPickerView).to.be.calledOnce;
    });
  });

  describe('toggleDrawer', function () {
    it('toggles braintree-dropin__hide class of payment method picker element', function () {
      this.sandbox.spy(classlist, 'toggle');
      this.context = {
        element: this.element.querySelector('.braintree-dropin__drawer')
      };
      PaymentMethodPickerView.prototype.toggleDrawer.call(this.context);

      expect(classlist.toggle).to.be.calledOnce;
      expect(classlist.toggle).to.be.calledWith(this.context.element, 'braintree-dropin__collapsed');
    });
  });

  describe('setActivePaymentMethod', function () {
    beforeEach(function () {
      this.context = {
        activePaymentMethod: this.element.querySelector('.braintree-dropin__active-payment-method'),
        choosePaymentMethod: this.element.querySelector('.braintree-dropin__choose-payment-method')
      };
    });

    it('sets the new payment method', function () {
      var paymentMethod = {
        foo: 'bar'
      };

      PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, paymentMethod);

      expect(this.context.paymentMethod).to.equal(paymentMethod);
    });

    describe('with a PayPalAccount', function () {
      beforeEach(function () {
        this.paymentMethod = {
          details: {
            email: 'me@real.biz'
          },
          type: 'PayPalAccount'
        };

        this.termSlot = this.context.activePaymentMethod.querySelector('.braintree-dropin__list-term');
        this.descriptionSlot = this.context.activePaymentMethod.querySelector('.braintree-dropin__list-desc');
      });

      it('sets the payer email as the term slot', function () {
        PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

        expect(this.termSlot.innerHTML).to.equal('me@real.biz');
      });

      it('sets PayPal as the description slot', function () {
        PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

        expect(this.descriptionSlot.innerHTML).to.equal('PayPal');
      });
    });

    describe('with a CreditCard', function () {
      beforeEach(function () {
        this.paymentMethod = {
          details: {
            cardType: 'FooCard',
            lastTwo: 'LastTwo'
          },
          type: 'CreditCard'
        };

        this.termSlot = this.context.activePaymentMethod.querySelector('.braintree-dropin__list-term');
        this.descriptionSlot = this.context.activePaymentMethod.querySelector('.braintree-dropin__list-desc');
      });

      it('sets the last two numbers of the card in the term slot', function () {
        PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

        expect(this.termSlot.innerHTML).to.equal('Ending in ••LastTwo');
      });

      it('sets card type as the description slot', function () {
        PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

        expect(this.descriptionSlot.innerHTML).to.equal('FooCard');
      });
    });
  });

  describe('addCompletedPickerView', function () {
    beforeEach(function () {
      this.context = {
        savedPaymentMethods: this.element.querySelector('[data-braintree-id="saved-payment-methods"]'),
        views: []
      };
    });

    it('appends CompletedPickerView to payment method picker element', function () {
      var completedPickerView;
      var paymentMethod = {};

      PaymentMethodPickerView.prototype.addCompletedPickerView.call(this.context, paymentMethod);
      completedPickerView = this.context.savedPaymentMethods.querySelector('.braintree-dropin__completed-picker-view');

      expect(completedPickerView).to.exist;
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

  describe('requestPaymentMethod', function () {
    it('calls the callback with the active payment method if one exists', function (done) {
      var context = {
        paymentMethod: 'really cool payment method'
      };

      PaymentMethodPickerView.prototype.requestPaymentMethod.call(context, function (err, data) {
        expect(err).to.not.exist;
        expect(data).to.equal(context.paymentMethod);
        done();
      });
    });

    it('calls the callback with an error if no active payment method exists', function (done) {
      PaymentMethodPickerView.prototype.requestPaymentMethod.call(context, function (err, data) {
        expect(data).to.not.exist;
        expect(err.message).to.equal('No payment method available.');
        done();
      });
    });
  });
});
