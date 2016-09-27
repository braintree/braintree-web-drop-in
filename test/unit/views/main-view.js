'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
var DropinErrorState = require('../../../src/dropin-error-state');
var DropinModel = require('../../../src/dropin-model');
var PayWithCardView = require('../../../src/views/pay-with-card-view');
var PaymentMethodPickerView = require('../../../src/views/payment-method-picker-view');
var fake = require('../../helpers/fake');
var templateHTML = require('../../../src/html/main.html');

describe('MainView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(MainView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new MainView(); // eslint-disable-line no-new

      expect(MainView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new MainView()).to.be.an.instanceof(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.model = new DropinModel();

      this.context = {
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        addView: this.sandbox.stub(),
        setActiveView: this.sandbox.stub(),
        dependenciesInitializing: 0,
        getElementById: BaseView.prototype.getElementById,
        model: this.model
      };

      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });
      this.sandbox.stub(PayWithCardView.prototype, '_initialize');
    });

    it('creates a PayWithCardView', function () {
      MainView.prototype._initialize.call(this.context);

      expect(this.context.addView).to.have.been.calledWith(this.sandbox.match.instanceOf(PayWithCardView));
    });

    it('creates a PaymentMethodPickerView', function () {
      MainView.prototype._initialize.call(this.context);

      expect(this.context.addView).to.have.been.calledWith(this.sandbox.match.instanceOf(PaymentMethodPickerView));
    });

    it('creates a DropinErrorState', function () {
      MainView.prototype._initialize.call(this.context);

      expect(this.context.errorState).to.be.an.instanceof(DropinErrorState);
    });

    it('adds a listener for changeActivePaymentMethod', function () {
      var instance;

      this.sandbox.stub(MainView.prototype, 'setActiveView');

      instance = new MainView({
        dropinWrapper: this.context.dropinWrapper,
        model: this.context.model,
        options: this.context.options
      });

      this.context.model.changeActivePaymentMethod('payment-method');

      expect(instance.setActiveView).to.be.calledWith('active-payment-method');
    });

    it('sets the active payment method as the active view if there are vaulted payment methods', function () {
      var vaultedPaymentMethod = 'vaulted payment method';

      this.model.addPaymentMethod(vaultedPaymentMethod);
      this.sandbox.spy(this.model, 'changeActivePaymentMethod');

      MainView.prototype._initialize.call(this.context);

      expect(this.context.model.changeActivePaymentMethod).to.have.been.calledWith(vaultedPaymentMethod);
      expect(this.context.setActiveView).to.have.been.calledWith('active-payment-method');
    });

    it('sets choose payment method as the active view if multiple payment methods are enabled', function () {
      PaymentMethodPickerView.prototype._initialize.restore();
      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}, {}];
      });

      MainView.prototype._initialize.call(this.context);

      expect(this.context.setActiveView).to.have.been.calledWith('choose-payment-method');
    });

    it('creates a PayWithCardView if one payment method is enabled', function () {
      PaymentMethodPickerView.prototype._initialize.restore();
      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });

      MainView.prototype._initialize.call(this.context);

      expect(this.context.addView).to.have.been.calledWith(this.sandbox.match.instanceOf(PayWithCardView));
      expect(this.context.setActiveView).to.have.been.calledWith(PayWithCardView.ID);
    });

    it('hides payment method picker if one payment method is enabled', function () {
      var paymentMethodPicker;

      PaymentMethodPickerView.prototype._initialize.restore();
      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });

      MainView.prototype._initialize.call(this.context);
      paymentMethodPicker = this.context.dropinWrapper.querySelector('[data-braintree-id="payment-method-picker"]');

      expect(paymentMethodPicker.classList.contains('braintree-dropin__hide')).to.be.true;
    });
  });

  describe('addView', function () {
    beforeEach(function () {
      this.fakeView = {
        element: document.createElement('span'),
        ID: 'fake-id'
      };

      this.context = {
        element: document.createElement('div'),
        views: []
      };
    });

    it('adds the argument to the array of views', function () {
      MainView.prototype.addView.call(this.context, this.fakeView);

      expect(this.context.views[this.fakeView.ID]).to.equal(this.fakeView);
    });
  });

  describe('setActiveView', function () {
    beforeEach(function () {
      function FakeView(id) {
        this.ID = id;
      }

      this.fakePaymentMethodPickerView = {
        hideCheckMarks: this.sandbox.stub()
      };

      this.context = {
        dropinWrapper: document.createElement('div'),
        errorState: new DropinErrorState(),
        paymentMethodPickerView: this.fakePaymentMethodPickerView,
        views: {
          id1: new FakeView('id1'),
          id2: new FakeView('id2'),
          id3: new FakeView('id3')
        }
      };
    });

    it('shows the selected view', function () {
      MainView.prototype.setActiveView.call(this.context, 'id1');

      expect(this.context.dropinWrapper.className).to.contain('id1');
    });

    it('hides payment method picker check marks if the active view is not the active payment method', function () {
      MainView.prototype.setActiveView.call(this.context, 'id1');

      expect(this.fakePaymentMethodPickerView.hideCheckMarks).to.have.been.calledOnce;
    });

    it('does not hide payment method picker check marks if the active view is the active payment method', function () {
      MainView.prototype.setActiveView.call(this.context, 'active-payment-method');

      expect(this.fakePaymentMethodPickerView.hideCheckMarks).to.not.have.been.called;
    });

    it('clears any errors', function () {
      this.sandbox.stub(DropinErrorState.prototype, 'clear');

      MainView.prototype.setActiveView.call(this.context, 'active-payment-method');

      expect(DropinErrorState.prototype.clear).to.have.been.calledOnce;
    });
  });

  describe('dropinErrorState events', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        hideAlert: MainView.prototype.hideAlert,
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showAlert: MainView.prototype.showAlert
      };

      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });
      this.sandbox.stub(PayWithCardView.prototype, '_initialize');

      MainView.prototype._initialize.call(this.context);
    });

    it('shows the error message alert when errorOccurred is emitted', function () {
      this.context.errorState._emit('errorOccurred', 'HOSTED_FIELDS_FAILED_TOKENIZATION');

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.false;
      expect(this.context.alert.textContent).to.equal('Please check your information and try again.');
    });

    it('shows a fallback error message when errorOccurred is emitted with an unknown error code', function () {
      this.context.errorState._emit('errorOccurred', 'UNKNOWN_CODE_FOO');

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.false;
      expect(this.context.alert.textContent).to.equal('Something went wrong on our end.');
    });

    it('hides the error message alert when errorCleared is emitted', function () {
      this.context.errorState._emit('errorCleared');

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.true;
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        views: {
          'braintree-dropin__pay-with-card-view': {
            teardown: this.sandbox.stub().yields()
          }
        }
      };
    });

    it('calls teardown on each view', function (done) {
      var payWithCardView = this.context.views['braintree-dropin__pay-with-card-view'];

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('waits to call callback until asyncronous teardowns complete', function (done) {
      var payWithCardView = this.context.views['braintree-dropin__pay-with-card-view'];

      payWithCardView.teardown.yieldsAsync();

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('calls callback with error from teardown function', function (done) {
      var payWithCardView = this.context.views['braintree-dropin__pay-with-card-view'];
      var error = new Error('pay with card teardown error');

      payWithCardView.teardown.yields(error);

      MainView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
