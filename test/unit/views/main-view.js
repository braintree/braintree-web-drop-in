'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
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
      expect(new MainView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        dropinWrapper: dropinWrapper,
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        addView: this.sandbox.stub(),
        setActiveView: this.sandbox.stub(),
        existingPaymentMethods: {},
        dependenciesInitializing: 0,
        getElementById: BaseView.prototype.getElementById
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

      expect(this.context.paymentMethodPickerView).to.be.an.instanceOf(PaymentMethodPickerView);
      expect(this.context.addView).to.have.been.calledWith(this.sandbox.match.instanceOf(PaymentMethodPickerView));
    });

    it('sets choose payment method as the active view if multiple payment methods are available', function () {
      PaymentMethodPickerView.prototype._initialize.restore();
      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}, {}];
      });

      MainView.prototype._initialize.call(this.context);

      expect(this.context.setActiveView).to.have.been.calledWith('choose-payment-method');
    });

    it('creates a PayWithCardView if one payment method is available', function () {
      PaymentMethodPickerView.prototype._initialize.restore();
      this.sandbox.stub(PaymentMethodPickerView.prototype, '_initialize', function () {
        this.views = [{}];
      });

      MainView.prototype._initialize.call(this.context);

      expect(this.context.addView).to.have.been.calledWith(this.sandbox.match.instanceOf(PayWithCardView));
      expect(this.context.setActiveView).to.have.been.calledWith(PayWithCardView.ID);
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

      this.context = {
        paymentMethodPickerView: {
          collapse: this.sandbox.stub()
        },
        dropinWrapper: document.createElement('div'),
        views: {
          id1: new FakeView('id1'),
          id2: new FakeView('id2'),
          id3: new FakeView('id3')
        }
      };
    });

    it('sets the active view', function () {
      MainView.prototype.setActiveView.call(this.context, 'id2');

      expect(this.context.activeView).to.equal(this.context.views.id2);
    });

    it('shows the selected view', function () {
      MainView.prototype.setActiveView.call(this.context, 'id1');

      expect(this.context.dropinWrapper.className).to.contain('id1');
    });
  });

  describe('requestPaymentMethod', function () {
    beforeEach(function () {
      this.context = {
        activeView: {
          requestPaymentMethod: this.sandbox.stub().yields(null, 'payment-method')
        }
      };
    });

    it('calls the callback with the payment method of the active view', function (done) {
      MainView.prototype.requestPaymentMethod.call(this.context, function (err, paymentMethod) {
        expect(err).to.not.exist;
        expect(paymentMethod).to.eql('payment-method');
        expect(this.context.activeView.requestPaymentMethod).to.be.calledOnce;

        done();
      }.bind(this));
    });

    it('calls callback with error if activeView does not have a requestPaymentMethod function', function (done) {
      delete this.context.activeView.requestPaymentMethod;

      MainView.prototype.requestPaymentMethod.call(this.context, function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('No payment method available.');

        done();
      });
    });
  });

  describe('asyncDependencyStarting', function () {
    beforeEach(function () {
      this.context = {
        dependenciesInitializing: 0
      };
    });

    it('increments dependenciesInitializing by one', function () {
      MainView.prototype.asyncDependencyStarting.call(this.context);
      expect(this.context.dependenciesInitializing).to.equal(1);
    });
  });

  describe('asyncDependencyReady', function () {
    beforeEach(function () {
      this.context = {callback: this.sandbox.stub()};
    });

    it('decrements dependenciesInitializing by one', function () {
      this.context.dependenciesInitializing = 2;

      MainView.prototype.asyncDependencyReady.call(this.context);

      expect(this.context.dependenciesInitializing).to.equal(1);
      expect(this.context.callback).to.not.be.called;
    });

    it('calls the create callback when there are no dependencies initializing', function () {
      this.context.dependenciesInitializing = 1;

      MainView.prototype.asyncDependencyReady.call(this.context);

      expect(this.context.dependenciesInitializing).to.equal(0);
      expect(this.context.callback).to.be.called;
    });
  });

  describe('updateActivePaymentMethod', function () {
    beforeEach(function () {
      this.context = {
        paymentMethodPickerView: {
          addCompletedPickerView: this.sandbox.stub(),
          setActivePaymentMethod: this.sandbox.stub()
        },
        setActiveView: this.sandbox.stub(),
        views: [{
          'braintree-dropin__payment-method-picker': {
            setActivePaymentMethod: this.sandbox.stub()
          }
        }]
      };
    });

    it('sets active payment method as active view', function () {
      var paymentMethod = {};

      MainView.prototype.updateActivePaymentMethod.call(this.context, paymentMethod);

      expect(this.context.setActiveView).to.be.calledWith('active-payment-method');
    });

    it('sets the payment method as the active payment method', function () {
      var paymentMethod = {};

      MainView.prototype.updateActivePaymentMethod.call(this.context, paymentMethod);

      expect(this.context.paymentMethodPickerView.setActivePaymentMethod).to.be.calledWith(paymentMethod);
    });

    it('adds payment method to picker view by default', function () {
      var paymentMethod = {};

      MainView.prototype.updateActivePaymentMethod.call(this.context, paymentMethod);

      expect(this.context.paymentMethodPickerView.addCompletedPickerView).to.be.calledWith(paymentMethod);
    });

    it('adds payment method to picker view when existing is false', function () {
      var paymentMethod = {};

      MainView.prototype.updateActivePaymentMethod.call(this.context, paymentMethod);

      expect(this.context.paymentMethodPickerView.addCompletedPickerView).to.be.calledWith(paymentMethod);
    });

    it('does not add payment method to picker view when existing is true', function () {
      var paymentMethod = {};

      MainView.prototype.updateActivePaymentMethod.call(this.context, paymentMethod, true);

      expect(this.context.paymentMethodPickerView.addCompletedPickerView).to.not.have.been.called;
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
