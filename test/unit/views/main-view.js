'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
var DropinModel = require('../../../src/dropin-model');
var PayWithCardView = require('../../../src/views/pay-with-card-view');
var PaymentMethodPickerView = require('../../../src/views/payment-method-picker-view');
var fake = require('../../helpers/fake');
var strings = require('../../../src/translations/en');
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
        addView: this.sandbox.stub(),
        dependenciesInitializing: 0,
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: function () {},
        hideLoadingIndicator: function () {},
        model: this.model,
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showLoadingIndicator: function () {},
        strings: {
          foo: 'bar'
        }
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

    it('passes localization strings to the PayWithCardView', function () {
      this.context.addView = function (view) {
        if (view instanceof PayWithCardView) {
          expect(view.strings.foo).to.equal('bar');
        }
      };

      MainView.prototype._initialize.call(this.context);
    });

    it('creates a PaymentMethodPickerView', function () {
      MainView.prototype._initialize.call(this.context);

      expect(this.context.addView).to.have.been.calledWith(this.sandbox.match.instanceOf(PaymentMethodPickerView));
    });

    it('passes localization strings to the PaymentMethodPickerView', function () {
      MainView.prototype._initialize.call(this.context);

      expect(this.context.paymentMethodPickerView.strings.foo).to.equal('bar');
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
        model: new DropinModel(),
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
      this.sandbox.stub(DropinModel.prototype, 'clearError');

      MainView.prototype.setActiveView.call(this.context, 'active-payment-method');

      expect(DropinModel.prototype.clearError).to.have.been.calledOnce;
    });

    it('applies no-flexbox class when flexbox is not supported', function () {
      this.context.supportsFlexbox = false;

      MainView.prototype.setActiveView.call(this.context, 'active-payment-method');

      expect(this.context.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.true;
    });

    it('does not apply no-flexbox class when flexbox is supported', function () {
      this.context.supportsFlexbox = true;

      MainView.prototype.setActiveView.call(this.context, 'active-payment-method');

      expect(this.context.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.false;
    });
  });

  describe('showAlert', function () {
    beforeEach(function () {
      this.context = {
        alert: document.createElement('div'),
        strings: strings
      };
    });

    it('shows the alert', function () {
      MainView.prototype.showAlert.call(this.context, {});

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.false;
    });

    it('sets the alert to the expected message for the error code', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION',
        message: 'Some text we do not use'
      };

      MainView.prototype.showAlert.call(this.context, fakeError);

      expect(this.context.alert.textContent).to.equal('Please check your information and try again.');
    });

    it('shows the raw error message when the error has an unknown error code', function () {
      var fakeError = {
        code: 'AN_UNKNOWN_ERROR',
        message: 'Some text we will use because we do not know this error code'
      };

      MainView.prototype.showAlert.call(this.context, fakeError);

      expect(this.context.alert.textContent).to.equal('Some text we will use because we do not know this error code');
    });

    it('shows a fallback error message when the error code is unknown and the error is missing a message', function () {
      var fakeError = {
        code: 'AN_UNKNOWN_ERROR'
      };

      MainView.prototype.showAlert.call(this.context, fakeError);

      expect(this.context.alert.textContent).to.equal('Something went wrong on our end.');
    });
  });

  describe('hideAlert', function () {
    beforeEach(function () {
      this.context = {
        alert: document.createElement('div')
      };
    });

    it('hides the alert', function () {
      MainView.prototype.hideAlert.call(this.context);

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.true;
    });
  });

  describe('dropinErrorState events', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: this.sandbox.stub(),
        hideLoadingIndicator: function () {},
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showAlert: this.sandbox.stub(),
        showLoadingIndicator: function () {}
      };

      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });
      this.sandbox.stub(PayWithCardView.prototype, '_initialize');

      MainView.prototype._initialize.call(this.context);
    });

    it('calls showAlert when errorOccurred is emitted', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      this.context.model._emit('errorOccurred', fakeError);

      expect(this.context.showAlert).to.be.calledWith(fakeError);
    });

    it('calls hideAlert when errorCleared is emitted', function () {
      this.context.model._emit('errorCleared');

      expect(this.context.hideAlert).to.be.called;
    });
  });

  describe('showLoadingIndicator', function () {
    it('shows the loading indicator', function () {
      var dropinContainer = document.createElement('div');
      var loadingContainer = document.createElement('div');
      var loadingIndicator = document.createElement('div');
      var context = {
        dropinContainer: dropinContainer,
        loadingContainer: loadingContainer,
        loadingIndicator: loadingIndicator
      };

      loadingContainer.className = 'braintree-dropin__loading-container--inactive';
      loadingIndicator.className = 'braintree-dropin__loading_indicator--inactive';

      MainView.prototype.showLoadingIndicator.call(context);

      expect(context.dropinContainer.classList.contains('braintree-dropin__hide')).to.be.true;
      expect(context.loadingContainer.classList.contains('braintree-dropin__loading-container--inactive')).to.be.false;
      expect(context.loadingIndicator.classList.contains('braintree-dropin__loading-indicator--inactive')).to.be.false;
    });
  });

  describe('hideLoadingIndicator', function () {
    var clock;

    beforeEach(function () {
      clock = sinon.useFakeTimers();
    });

    afterEach(function () {
      clock.restore();
    });

    it('hides the loading indicator', function () {
      var dropinContainer = document.createElement('div');
      var loadingContainer = document.createElement('div');
      var loadingIndicator = document.createElement('div');
      var context = {
        dropinContainer: dropinContainer,
        loadingContainer: loadingContainer,
        loadingIndicator: loadingIndicator
      };

      dropinContainer.className = 'braintree-dropin__hide';

      MainView.prototype.hideLoadingIndicator.call(context);
      clock.tick(1001);

      expect(context.dropinContainer.classList.contains('braintree-dropin__hide')).to.be.false;
      expect(context.loadingContainer.classList.contains('braintree-dropin__loading-container--inactive')).to.be.true;
      expect(context.loadingIndicator.classList.contains('braintree-dropin__loading-indicator--inactive')).to.be.true;
    });
  });

  describe('DropinModel events', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: function () {},
        hideLoadingIndicator: this.sandbox.stub(),
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showLoadingIndicator: this.sandbox.stub()
      };

      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });
      this.sandbox.stub(PayWithCardView.prototype, '_initialize');

      MainView.prototype._initialize.call(this.context);
    });

    it('calls showLoadingIndicator on loadBegin', function () {
      this.context.model._emit('loadBegin');

      expect(this.context.showLoadingIndicator).to.be.calledOnce;
    });

    it('calls hideLoadingIndicator on loadEnd', function () {
      this.context.model._emit('loadEnd');

      expect(this.context.hideLoadingIndicator).to.be.calledOnce;
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
