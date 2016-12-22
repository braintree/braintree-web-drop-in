'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var PaymentMethodsView = require('../../../src/views/payment-methods-view');
var classlist = require('../../../src/lib/classlist');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var HostedFields = require('braintree-web/hosted-fields');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
var PayPal = require('braintree-web/paypal');
var sheetViews = require('../../../src/views/payment-sheet-views');
var strings = require('../../../src/translations/en');
var templateHTML = require('../../../src/html/main.html');

describe('MainView', function () {
  beforeEach(function () {
    this.client = {
      getConfiguration: fake.configuration
    };
  });

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

      this.mainViewOptions = {
        client: this.client,
        dropinWrapper: dropinWrapper,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };
    });

    afterEach(function () {
      document.body.innerHTML = '';
    });

    // TODO: is there a "only one payment option" version of this test?

    it('creates a PaymentOptionsView if there are multiple payment options', function () {
      var model, mainView;
      var modelOptions = fake.modelOptions();

      modelOptions.paymentMethods = [{foo: 'bar'}, {baz: 'qux'}];
      model = new DropinModel(modelOptions);
      model.supportedPaymentOptions = ['card', 'paypal'];

      this.mainViewOptions.model = model;

      this.sandbox.stub(PayPal, 'create').yields(null, {});

      mainView = new MainView(this.mainViewOptions);

      expect(Object.keys(mainView.views)).to.contain(PaymentOptionsView.ID);
    });

    context('with vaulted payment methods', function () {
      beforeEach(function () {
        var modelOptions = fake.modelOptions();
        var dropinWrapper = document.createElement('div');

        dropinWrapper.innerHTML = templateHTML;

        modelOptions.paymentMethods = [{foo: 'bar'}, {baz: 'qux'}];
        this.model = new DropinModel(modelOptions);
        this.model.supportedPaymentOptions = ['card', 'paypal'];

        this.mainViewOptions = {
          client: {
            getConfiguration: fake.configuration
          },
          dropinWrapper: dropinWrapper,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: this.model,
          strings: strings
        };

        this.sandbox.stub(PayPal, 'create').yields(null, {});
      });

      it('sets the first payment method to be the active payment method', function () {
        this.sandbox.spy(this.model, 'changeActivePaymentMethod');

        new MainView(this.mainViewOptions); // eslint-disable-line no-new

        expect(this.model.changeActivePaymentMethod).to.have.been.calledWith({foo: 'bar'});
      });

      it('sets the PaymentMethodsView as the primary view', function () {
        var mainView = new MainView(this.mainViewOptions);

        expect(mainView.primaryView.ID).to.equal(PaymentMethodsView.ID);
      });
    });

    describe('without vaulted payment methods', function () {
      beforeEach(function () {
        var dropinWrapper = document.createElement('div');

        dropinWrapper.innerHTML = templateHTML;

        this.model = new DropinModel(fake.modelOptions());

        this.mainViewOptions = {
          client: this.client,
          dropinWrapper: dropinWrapper,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: this.model,
          strings: strings
        };

        this.sandbox.stub(PayPal, 'create').yields(null, {});
      });

      it('sets PaymentOptionsViews as the primary view if there are multiple payment methods', function () {
        var mainView;

        this.model.supportedPaymentOptions = ['card', 'paypal'];

        mainView = new MainView(this.mainViewOptions);

        expect(mainView.primaryView.ID).to.equal(PaymentOptionsView.ID);
      });

      it('sets the sheet view as the primary view if there is one payment method', function () {
        var mainView;

        this.model.supportedPaymentOptions = ['card'];

        mainView = new MainView(this.mainViewOptions);

        expect(mainView.primaryView.ID).to.equal(CardView.ID);
      });
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

  describe('setPrimaryView', function () {
    beforeEach(function () {
      var model = new DropinModel(fake.modelOptions());
      var wrapper = document.createElement('div');

      model.supportedPaymentOptions = ['card', 'paypal'];

      wrapper.innerHTML = templateHTML;

      this.mainViewOptions = {
        dropinWrapper: wrapper,
        model: model,
        client: this.client,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };

      this.sandbox.stub(PayPal, 'create').yields(null, {});
    });

    it('calls the close frame function of the primary view if one exists', function () {
      var mainView;

      PayPalView.prototype.closeFrame = this.sandbox.stub();

      mainView = new MainView(this.mainViewOptions);

      mainView.setPrimaryView(PayPalView.ID);
      mainView.setPrimaryView(PaymentOptionsView.ID);

      expect(PayPalView.prototype.closeFrame).to.have.been.calledOnce;

      delete PayPalView.prototype.closeFrame;
    });

    [
      CardView,
      PaymentMethodsView,
      PaymentOptionsView,
      PayPalView
    ].forEach(function (View) {
      describe('when given a ' + View.ID + 'view', function () {
        it('shows the selected view by updating the classname of the drop-in wrapper', function () {
          var mainView = new MainView(this.mainViewOptions);

          mainView.setPrimaryView(View.ID);

          expect(mainView.dropinWrapper.className).to.equal('braintree-' + View.ID);
        });
      });

      it('sets the view as the primary view', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setPrimaryView(View.ID);

        expect(mainView.primaryView).to.equal(mainView.getView(View.ID));
      });

      it('changes the active payment option', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setPrimaryView(View.ID);

        expect(mainView.model.getActivePaymentView()).to.equal(View.ID);
      });
    });

    // TODO: Pending until we update errors
    xit('clears any errors', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      this.sandbox.stub(DropinModel.prototype, 'clearError');

      mainView.setPrimaryView('id1');

      expect(DropinModel.prototype.clearError).to.have.been.calledOnce;
    });

    // TODO: Pending until we update to support no flexbox
    xit('applies no-flexbox class when flexbox is not supported', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.supportsFlexbox = false;

      mainView.setPrimaryView('id1');

      expect(mainView.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.true;
    });

    // TODO: Pending until we update to support no flexbox
    xit('does not apply no-flexbox class when flexbox is supported', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.supportsFlexbox = true;

      mainView.setPrimaryView('id1');

      expect(mainView.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.false;
    });

    describe('when given a ', function () {
      var SheetView;

      Object.keys(sheetViews).forEach(function (sheetViewKey) {
        SheetView = sheetViews[sheetViewKey];

        describe(SheetView.ID + ' view', function () {
          describe('in a non-guest checkout flow', function () {
            it('shows the additional options button', function () {
              var mainView;

              this.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

              mainView = new MainView(this.mainViewOptions);
              mainView.setPrimaryView(SheetView.ID);

              expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.false;
            });
          });

          describe('in a guest checkout flow', function () {
            it('shows the additional options button if there are multiple payment options', function () {
              var mainView;

              this.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

              mainView = new MainView(this.mainViewOptions);
              mainView.setPrimaryView(SheetView.ID);

              expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.false;
            });

            it('does not show the additional options button if there is one payment option', function () {
              var mainView;

              this.mainViewOptions.model.supportedPaymentOptions = [sheetViewKey];
              this.mainViewOptions.merchantConfiguration.authorization = fake.tokenizationKey;

              mainView = new MainView(this.mainViewOptions);
              mainView.setPrimaryView(SheetView.ID);

              expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.true;
            });
          });
        });
      });
    });

    describe('when given a PaymentMethodsView', function () {
      it('shows the additional options button', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setPrimaryView(PaymentMethodsView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.false;
      });
    });

    describe('when given a PaymentOptionsView', function () {
      it('hides the additional options button', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setPrimaryView(PaymentOptionsView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.true;
      });
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

      expect(this.context.alert.classList.contains('braintree-hidden')).to.be.false;
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

      expect(this.context.alert.classList.contains('braintree-hidden')).to.be.true;
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
        model: new DropinModel(fake.modelOptions()),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setPrimaryView: this.sandbox.stub(),
        showAlert: this.sandbox.stub(),
        toggleAdditionalOptions: function () {},
        showLoadingIndicator: function () {}
      };

      MainView.prototype._initialize.call(this.context);
    });

    // TODO: Pending until we update errors
    xit('calls showAlert when errorOccurred is emitted', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      this.context.model._emit('errorOccurred', fakeError);

      expect(this.context.showAlert).to.be.calledWith(fakeError);
    });

    // TODO: Pending until we update errors
    xit('calls hideAlert when errorCleared is emitted', function () {
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

      loadingContainer.className = 'braintree-loader__container--inactive';
      loadingIndicator.className = 'braintree-loader__indicator--inactive';

      MainView.prototype.showLoadingIndicator.call(context);

      expect(context.dropinContainer.classList.contains('braintree-hidden')).to.be.true;
      expect(context.loadingContainer.classList.contains('braintree-loader__container--inactive')).to.be.false;
      expect(context.loadingIndicator.classList.contains('braintree-loader__indicator--inactive')).to.be.false;
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

      dropinContainer.className = 'braintree-hidden';

      MainView.prototype.hideLoadingIndicator.call(context);
      clock.tick(1001);

      expect(context.dropinContainer.classList.contains('braintree-hidden')).to.be.false;
      expect(context.loadingContainer.classList.contains('braintree-loader__container--inactive')).to.be.true;
      expect(context.loadingIndicator.classList.contains('braintree-loader__indicator--inactive')).to.be.true;
    });
  });

  describe('DropinModel events', function () {
    beforeEach(function () {
      this.dropinWrapper = document.createElement('div');
      this.dropinWrapper.innerHTML = templateHTML;
      this.model = new DropinModel(fake.modelOptions());

      this.mainViewOptions = {
        dropinWrapper: this.dropinWrapper,
        model: this.model,
        client: this.client,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };

      this.sandbox.stub(CardView.prototype, '_initialize');
      this.sandbox.stub(this.model, 'beginLoading');
      this.sandbox.stub(this.model, 'endLoading');
      this.sandbox.spy(MainView.prototype, 'showLoadingIndicator');
      this.sandbox.spy(MainView.prototype, 'hideLoadingIndicator');

      this.mainView = new MainView(this.mainViewOptions);
    });

    it('calls showLoadingIndicator on loadBegin', function () {
      this.model._emit('loadBegin');

      expect(MainView.prototype.showLoadingIndicator).to.be.calledOnce;
    });

    it('calls hideLoadingIndicator on loadEnd', function () {
      this.model._emit('loadEnd');

      expect(MainView.prototype.hideLoadingIndicator).to.be.calledOnce;
    });

    describe('for changeActivePaymentView', function () {
      beforeEach(function () {
        this.paymentMethodsElement = this.dropinWrapper.querySelector('[data-braintree-id="' + PaymentMethodsView.ID + '"]');
        this.sheetElement = this.dropinWrapper.querySelector('[data-braintree-id="sheet-container"]');
      });

      describe('when the PaymentMethodsView is active', function () {
        beforeEach(function () {
          classlist.remove(this.paymentMethodsElement, 'braintree-methods--active');
          classlist.add(this.sheetElement, 'braintree-sheet--active');
          this.model._emit('changeActivePaymentView', PaymentMethodsView.ID);
        });

        it('adds braintree-methods--active to the payment methods view element', function () {
          expect(this.paymentMethodsElement.className).to.contain('braintree-methods--active');
        });

        it('removes braintree-sheet--active from the payment sheet element', function () {
          expect(this.sheetElement.className).to.not.contain('braintree-sheet--active');
        });
      });

      describe('when a payment sheet is active', function () {
        beforeEach(function () {
          classlist.add(this.paymentMethodsElement, 'braintree-methods--active');
          classlist.remove(this.sheetElement, 'braintree-sheet--active');
        });

        [CardView, PayPalView].forEach(function (PaymentSheetView) {
          beforeEach(function () {
            this.model._emit('changeActivePaymentView', PaymentSheetView.ID);
          });

          it('adds braintree-sheet--active to the payment sheet', function () {
            expect(this.sheetElement.className).to.contain('braintree-sheet--active');
          });

          it('removes braintree-methods--active from the payment methods view', function () {
            expect(this.paymentMethodsElement.className).to.not.contain('braintree-methods--active');
          });
        });
      });
    });
  });

  describe('additional options toggle', function () {
    beforeEach(function () {
      this.wrapper = document.createElement('div');
      this.wrapper.innerHTML = templateHTML;
      this.mainViewOptions = {
        dropinWrapper: this.wrapper,
        client: this.client,
        model: new DropinModel(fake.modelOptions()),
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };
      this.sandbox.stub(PayPal, 'create').yields(null, {});
    });

    it('has an click event listener that calls toggleAdditionalOptions', function () {
      var mainView;

      this.sandbox.stub(MainView.prototype, 'toggleAdditionalOptions');

      mainView = new MainView(this.mainViewOptions);

      mainView.toggle.click();

      expect(mainView.toggleAdditionalOptions).to.have.been.called;
    });

    it('hides toggle', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.toggle.click();

      expect(mainView.toggle.className).to.contain('braintree-hidden');
    });

    describe('when there is one payment option and the PaymentMethodsView is active', function () {
      beforeEach(function () {
        this.mainViewOptions.model.supportedPaymentOptions = ['card'];
        this.mainView = new MainView(this.mainViewOptions);

        this.mainView.setPrimaryView(PaymentMethodsView.ID);
        this.mainView.toggle.click();
      });

      it('sets the CardView as the active payment option', function () {
        expect(this.mainView.model.getActivePaymentView()).to.equal(CardView.ID);
      });

      it('exposes the CardView', function () {
        expect(this.wrapper.className).to.contain('braintree-' + CardView.ID);
      });
    });

    describe('when there are multiple payment options and a payment sheet view is active', function () {
      beforeEach(function () {
        this.mainViewOptions.model.supportedPaymentOptions = ['card', 'paypal'];
      });

      describe('and there are no payment methods available', function () {
        it('sets the PaymentOptionsView as the primary view', function () {
          var mainView = new MainView(this.mainViewOptions);

          this.sandbox.spy(mainView, 'setPrimaryView');
          mainView.setPrimaryView(CardView.ID);
          mainView.toggle.click();

          expect(mainView.setPrimaryView).to.have.been.calledWith(PaymentOptionsView.ID);
          expect(this.wrapper.className).to.contain('braintree-' + PaymentOptionsView.ID);
        });
      });

      describe('and there are payment methods available', function () {
        beforeEach(function () {
          var modelOptions = fake.modelOptions();

          modelOptions.paymentMethods = [{foo: 'bar'}];

          this.mainViewOptions.model = new DropinModel(modelOptions);
          this.mainViewOptions.model.supportedPaymentOptions = ['card', 'paypal'];
          this.mainView = new MainView(this.mainViewOptions);

          this.sandbox.spy(this.mainView, 'setPrimaryView');

          this.mainView.setPrimaryView(CardView.ID);
          this.mainView.toggle.click();
        });

        it('sets the PaymentMethodsView as the primary view', function () {
          expect(this.mainView.setPrimaryView).to.have.been.calledWith(PaymentMethodsView.ID);
          expect(this.wrapper.className).to.contain('braintree-' + PaymentMethodsView.ID);
          expect(this.mainView.model.getActivePaymentView()).to.equal(PaymentMethodsView.ID);
        });

        it('exposes the PaymentOptionsView', function () {
          expect(this.wrapper.className).to.contain('braintree-' + PaymentOptionsView.ID);
        });
      });
    });
  });

  describe('requestPaymentMethod', function () {
    beforeEach(function () {
      this.wrapper = document.createElement('div');
      this.wrapper.innerHTML = templateHTML;

      this.mainView = new MainView({
        dropinWrapper: this.wrapper,
        model: new DropinModel(fake.modelOptions()),
        client: this.client,
        merchantConfiguration: {
          authorization: 'fake_tokenization_key'
        }
      });
    });

    it('requests payment method from the primary view', function () {
      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod');

      this.mainView.requestPaymentMethod();

      expect(this.mainView.primaryView.requestPaymentMethod).to.be.called;
    });

    it('calls callback with error when error occurs', function (done) {
      var fakeError = new Error('A bad thing happened');

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(fakeError);

      this.mainView.requestPaymentMethod(function (err, payload) {
        expect(payload).to.not.exist;
        expect(err).to.equal(fakeError);
        done();
      });
    });

    it('calls callback with payload when successful', function (done) {
      var stubPaymentMethod = {foo: 'bar'};

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(null, stubPaymentMethod);

      this.mainView.requestPaymentMethod(function (err, payload) {
        expect(err).to.not.exist;
        expect(payload).to.equal(stubPaymentMethod);
        done();
      });
    });

    it('sets the PaymentMethodsView as the primary view when successful', function (done) {
      var stubPaymentMethod = {foo: 'bar'};
      var paymentMethodsViews = this.mainView.getView(PaymentMethodsView.ID);

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(null, stubPaymentMethod);

      this.mainView.requestPaymentMethod(function () {
        expect(this.mainView.primaryView).to.equal(paymentMethodsViews);
        done();
      }.bind(this));
    });

    describe('with vaulted payment methods', function () {
      beforeEach(function () {
        var model = new DropinModel(fake.modelOptions());

        model.supportedPaymentOptions = ['card'];

        this.wrapper = document.createElement('div');
        this.wrapper.innerHTML = templateHTML;
        this.sandbox.stub(HostedFields, 'create').returns(null, fake.HostedFieldsInstance);
        this.mainView = new MainView({
          dropinWrapper: this.wrapper,
          client: this.client,
          model: new DropinModel(fake.modelOptions()),
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          }
        });
      });

      it('requests payment method from payment methods view', function () {
        var paymentMethodsViews = this.mainView.getView(PaymentMethodsView.ID);

        this.mainView.model.changeActivePaymentView(PaymentMethodsView.ID);
        this.sandbox.stub(paymentMethodsViews, 'requestPaymentMethod');

        this.mainView.requestPaymentMethod();

        expect(paymentMethodsViews.requestPaymentMethod).to.be.called;
      });

      it('requests payment method from card view when additional options are shown', function () {
        var cardView = this.mainView.getView(CardView.ID);

        this.sandbox.stub(cardView, 'requestPaymentMethod');
        this.mainView.toggleAdditionalOptions();

        this.mainView.requestPaymentMethod();

        expect(cardView.requestPaymentMethod).to.be.called;
      });
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        views: {
          'braintree-card-view': {
            teardown: this.sandbox.stub().yields()
          }
        }
      };
    });

    it('calls teardown on each view', function (done) {
      var payWithCardView = this.context.views['braintree-card-view'];

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('waits to call callback until asyncronous teardowns complete', function (done) {
      var payWithCardView = this.context.views['braintree-card-view'];

      payWithCardView.teardown.yieldsAsync();

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('calls callback with error from teardown function', function (done) {
      var payWithCardView = this.context.views['braintree-card-view'];
      var error = new Error('pay with card teardown error');

      payWithCardView.teardown.yields(error);

      MainView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
