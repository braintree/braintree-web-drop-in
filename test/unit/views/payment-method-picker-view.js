'use strict';

var BaseView = require('../../../src/views/base-view');
var CardPickerView = require('../../../src/views/picker-views/card-picker-view');
var classlist = require('../../../src/lib/classlist');
var CompletedPickerView = require('../../../src/views/picker-views/completed-picker-view');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
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
        addCompletedPickerView: this.sandbox.stub(),
        element: this.element,
        getElementById: BaseView.prototype.getElementById,
        ID: PaymentMethodPickerView.ID,
        mainView: {
          asyncDependencyStarting: function () {},
          asyncDependencyReady: function () {}
        },
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: function () {
              return fake.configuration();
            }
          }
        },
        setActivePaymentMethod: this.sandbox.stub(),
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
      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(this.element.querySelector('.braintree-dropin__picker-label').innerHTML).to.equal('Card');
    });

    it('creates completed picker views for all existing payment methods', function () {
      this.context.addCompletedPickerView = this.sandbox.spy();
      this.context.model._paymentMethods = [{}];

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      expect(this.context.addCompletedPickerView).to.be.calledOnce;
    });

    it('shows saved payment methods header when a payment method is added', function () {
      var savedPaymentMethodsHeader;

      PaymentMethodPickerView.prototype._initialize.call(this.context);

      this.context.model.addPaymentMethod({});
      savedPaymentMethodsHeader = this.element.querySelector('[data-braintree-id="saved-payment-methods-header"]');

      expect(savedPaymentMethodsHeader.className).to.equal('braintree-dropin__drawer-header');
    });

    it('shows saved payment methods header if there existing payment methods', function () {
      var savedPaymentMethodsHeader;

      this.context.model.addPaymentMethod({});
      PaymentMethodPickerView.prototype._initialize.call(this.context);
      savedPaymentMethodsHeader = this.element.querySelector('[data-braintree-id="saved-payment-methods-header"]');

      expect(savedPaymentMethodsHeader.className).to.equal('braintree-dropin__drawer-header');
    });
  });

  describe('toggleDrawer', function () {
    it('toggles braintree-dropin__collapsed class of payment method picker element', function () {
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
      this.paymentMethod = {
        details: {
          email: 'me@real.biz'
        },
        type: 'PayPalAccount'
      };
      this.completedPickerView = new CompletedPickerView({
        model: new DropinModel(),
        paymentMethod: this.paymentMethod
      });

      this.context = {
        activePaymentMethod: this.element.querySelector('.braintree-dropin__active-payment-method'),
        choosePaymentMethod: this.element.querySelector('.braintree-dropin__choose-payment-method'),
        views: [this.completedPickerView],
        getElementById: BaseView.prototype.getElementById,
        getCompletedPickerView: this.sandbox.stub().returns(this.completedPickerView)
      };
    });

    it('updates the active payment method HTML', function () {
      PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

      expect(this.context.activePaymentMethod.innerHTML).to.equal(this.completedPickerView.html);
    });

    it('hides the check from non-active payment methods', function () {
      var paymentMethod2 = {
        details: {
          email: 'me@real.biz'
        },
        type: 'PayPalAccount'
      };
      var completedPickerView2 = new CompletedPickerView({
        model: new DropinModel(),
        paymentMethod: paymentMethod2
      });

      this.context.views = [this.completedPickerView, completedPickerView2];

      classlist.add(completedPickerView2.checkIcon, 'braintree-dropin__check-container--active');

      PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

      expect(completedPickerView2.checkIcon.classList.contains('braintree-dropin__check-container--active')).to.be.false;
    });

    it('shows the check on the active payment method', function () {
      PaymentMethodPickerView.prototype.setActivePaymentMethod.call(this.context, this.paymentMethod);

      expect(this.completedPickerView.checkIcon.classList.contains('braintree-dropin__check-container--active')).to.be.true;
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

  describe('getCompletedPickerView', function () {
    it('returns a completed picker view with the same nonce', function () {
      var paymentMethod = {nonce: 'my-nonce'};
      var fakeView = {paymentMethod: paymentMethod};
      var context = {views: [fakeView]};
      var view = PaymentMethodPickerView.prototype.getCompletedPickerView.call(context, paymentMethod);

      expect(view).to.equal(fakeView);
    });

    it('returns null if the completed picker view does not exist', function () {
      var paymentMethod = {nonce: 'my-nonce'};
      var context = {views: [{}]};
      var view = PaymentMethodPickerView.prototype.getCompletedPickerView.call(context, paymentMethod);

      expect(view).to.not.exist;
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
