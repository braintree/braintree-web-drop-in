'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
var BasePayPalView = require('../../../src/views/payment-sheet-views/base-paypal-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var PaymentMethodsView = require('../../../src/views/payment-methods-view');
var analytics = require('../../../src/lib/analytics');
var classlist = require('../../../src/lib/classlist');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var fs = require('fs');
var HostedFields = require('braintree-web/hosted-fields');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
var PayPalCheckout = require('braintree-web/paypal-checkout');
var sheetViews = require('../../../src/views/payment-sheet-views');
var strings = require('../../../src/translations/en');
var transitionHelper = require('../../../src/lib/transition-helper');

var templateHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

describe('MainView', function () {
  beforeEach(function () {
    this.client = {
      getConfiguration: fake.configuration
    };
    this.sandbox.stub(CardView.prototype, 'getPaymentMethod');
    this.sandbox.stub(BasePayPalView.prototype, '_initialize');
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
      var element = document.createElement('div');

      element.innerHTML = templateHTML;

      this.mainViewOptions = {
        client: this.client,
        element: element,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };
    });

    afterEach(function () {
      document.body.innerHTML = '';
    });

    it('creates a CardView if it is the only payment option', function () {
      var mainView;
      var model = new DropinModel(fake.modelOptions());

      model.supportedPaymentOptions = ['card'];

      this.mainViewOptions.model = model;

      mainView = new MainView(this.mainViewOptions);

      expect(Object.keys(mainView._views)).to.contain(CardView.ID);
      expect(mainView.primaryView.ID).to.equal(CardView.ID);
    });

    it('creates a PaymentOptionsView if there are multiple payment options', function () {
      var model, mainView;
      var modelOptions = fake.modelOptions();

      modelOptions.paymentMethods = [{foo: 'bar'}, {baz: 'qux'}];
      model = new DropinModel(modelOptions);
      model.supportedPaymentOptions = ['card', 'paypal'];

      this.mainViewOptions.model = model;

      this.sandbox.stub(PayPalCheckout, 'create').yields(null, {});

      mainView = new MainView(this.mainViewOptions);

      expect(Object.keys(mainView._views)).to.contain(PaymentOptionsView.ID);
    });

    context('with vaulted payment methods', function () {
      beforeEach(function () {
        var modelOptions = fake.modelOptions();
        var element = document.createElement('div');

        element.innerHTML = templateHTML;

        modelOptions.paymentMethods = [{foo: 'bar'}, {baz: 'qux'}];
        this.model = new DropinModel(modelOptions);
        this.model.supportedPaymentOptions = ['card', 'paypal'];

        this.mainViewOptions = {
          client: {
            getConfiguration: fake.configuration
          },
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: this.model,
          strings: strings
        };

        this.sandbox.stub(PayPalCheckout, 'create').yields(null, {});
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
        var element = document.createElement('div');

        element.innerHTML = templateHTML;

        this.model = new DropinModel(fake.modelOptions());

        this.mainViewOptions = {
          client: this.client,
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: this.model,
          strings: strings
        };

        this.sandbox.stub(PayPalCheckout, 'create').yields(null, {});
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
        _views: []
      };
    });

    it('adds the argument to the array of views', function () {
      MainView.prototype.addView.call(this.context, this.fakeView);

      expect(this.context._views[this.fakeView.ID]).to.equal(this.fakeView);
    });
  });

  describe('setPrimaryView', function () {
    beforeEach(function () {
      var model = new DropinModel(fake.modelOptions());
      var wrapper = document.createElement('div');

      model.supportedPaymentOptions = ['card', 'paypal', 'paypalCredit'];

      wrapper.innerHTML = templateHTML;

      this.mainViewOptions = {
        element: wrapper,
        model: model,
        client: this.client,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };

      this.sandbox.stub(PayPalCheckout, 'create').yields(null, {});
    });

    it('clears any errors', function () {
      var mainView = new MainView(this.mainViewOptions);

      this.sandbox.stub(mainView.model, 'clearError');

      mainView.setPrimaryView(CardView.ID);

      expect(mainView.model.clearError).to.have.been.calledOnce;
    });

    [
      CardView,
      PaymentMethodsView,
      PaymentOptionsView,
      PayPalView
    ].forEach(function (View) {
      describe('when given a ' + View.ID + 'view', function () {
        beforeEach(function () {
          this.sandbox.useFakeTimers();
        });

        it('shows the selected view by updating the classname of the drop-in wrapper', function () {
          var mainView = new MainView(this.mainViewOptions);

          mainView.setPrimaryView(View.ID);
          this.sandbox.clock.tick(1);
          expect(mainView.element.className).to.equal('braintree-show-' + View.ID);
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

    it('applies no-flexbox data attribute when flexbox is not supported', function () {
      var mainView = new MainView(this.mainViewOptions);
      var wrapper = mainView.element;

      mainView.supportsFlexbox = false;

      mainView.setPrimaryView(CardView.ID);

      expect(wrapper.dataset.braintreeNoFlexbox).to.equal('true');
    });

    it('does not apply no-flexbox data attribute when flexbox is supported', function () {
      var mainView = new MainView(this.mainViewOptions);
      var wrapper = mainView.element;

      mainView.supportsFlexbox = true;

      mainView.setPrimaryView(CardView.ID);

      expect(wrapper.dataset.braintreeNoFlexbox).to.not.exist;
    });

    describe('when given a ', function () {
      Object.keys(sheetViews).forEach(function (sheetViewKey) {
        var SheetView = sheetViews[sheetViewKey];

        describe(SheetView.ID + ' view', function () {
          describe('in a non-guest checkout flow', function () {
            it('shows the additional options button', function () {
              var mainView;

              this.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

              mainView = new MainView(this.mainViewOptions);
              mainView.setPrimaryView(SheetView.ID);

              expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.false;
            });

            it('does not show the additional options button if there are no vaulted payment methods', function () {
              var mainView, model;
              var modelOptions = fake.modelOptions();

              modelOptions.paymentMethods = [];
              modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
              model = new DropinModel(modelOptions);
              model.supportedPaymentOptions = [sheetViewKey];

              this.mainViewOptions.model = model;

              mainView = new MainView(this.mainViewOptions);

              mainView.setPrimaryView(SheetView.ID);

              expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.true;
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

    it('calls setPaymentMethodRequestable when there is a payment method requestable', function () {
      var mainView = new MainView(this.mainViewOptions);

      this.sandbox.stub(BaseView.prototype, 'getPaymentMethod').returns({type: 'TYPE'});
      this.sandbox.stub(mainView.model, 'setPaymentMethodRequestable');

      mainView.setPrimaryView(PaymentOptionsView.ID);

      expect(mainView.model.setPaymentMethodRequestable).to.be.calledWith({
        isRequestable: true,
        type: 'TYPE'
      });
    });

    it('calls setPaymentMethodRequestable when there is no payment method requestable', function () {
      var mainView = new MainView(this.mainViewOptions);

      this.sandbox.stub(BaseView.prototype, 'getPaymentMethod').returns(false);
      this.sandbox.stub(mainView.model, 'setPaymentMethodRequestable');

      mainView.setPrimaryView(PaymentOptionsView.ID);

      expect(mainView.model.setPaymentMethodRequestable).to.be.calledWithMatch({
        isRequestable: false
      });
    });
  });

  describe('showSheetError', function () {
    beforeEach(function () {
      this.context = {
        sheetContainer: document.createElement('div'),
        sheetErrorText: document.createElement('div'),
        strings: strings
      };
    });

    it('applies the braintree-sheet--has-error class to sheet container', function () {
      MainView.prototype.showSheetError.call(this.context, {});

      expect(this.context.sheetContainer.classList.contains('braintree-sheet--has-error')).to.be.true;
    });

    it('sets the error text to the expected message for the error code', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION',
        message: 'Some text we do not use'
      };

      MainView.prototype.showSheetError.call(this.context, fakeError);

      expect(this.context.sheetErrorText.textContent).to.equal('Please check your information and try again.');
    });

    it('shows the raw error message when the error has an unknown error code', function () {
      var fakeError = {
        code: 'AN_UNKNOWN_ERROR',
        message: 'Some text we will use because we do not know this error code'
      };

      MainView.prototype.showSheetError.call(this.context, fakeError);

      expect(this.context.sheetErrorText.textContent).to.equal('Some text we will use because we do not know this error code');
    });

    it('shows a fallback error message when the error code is unknown and the error is missing a message', function () {
      var fakeError = {
        code: 'AN_UNKNOWN_ERROR'
      };

      MainView.prototype.showSheetError.call(this.context, fakeError);

      expect(this.context.sheetErrorText.textContent).to.equal('Something went wrong on our end.');
    });
  });

  describe('hideSheetError', function () {
    beforeEach(function () {
      this.context = {
        sheetContainer: document.createElement('div')
      };
    });

    it('removes the braintree-sheet--has-error class from sheet container', function () {
      classlist.add(this.context.sheetContainer, 'braintree-sheet--has-error');

      MainView.prototype.hideSheetError.call(this.context);

      expect(this.context.sheetContainer.classList.contains('braintree-sheet--has-error')).to.be.false;
    });
  });

  describe('dropinErrorState events', function () {
    beforeEach(function () {
      var element = document.createElement('div');

      element.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        element: element,
        getElementById: BaseView.prototype.getElementById,
        hideSheetError: this.sandbox.stub(),
        hideLoadingIndicator: function () {},
        model: new DropinModel(fake.modelOptions()),
        client: {
          getConfiguration: fake.configuration
        },
        setPrimaryView: this.sandbox.stub(),
        showSheetError: this.sandbox.stub(),
        toggleAdditionalOptions: function () {},
        showLoadingIndicator: function () {}
      };

      MainView.prototype._initialize.call(this.context);
    });

    it('calls showSheetError when errorOccurred is emitted', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      this.context.model._emit('errorOccurred', fakeError);

      expect(this.context.showSheetError).to.be.calledWith(fakeError);
    });

    it('calls hideSheetError when errorCleared is emitted', function () {
      this.context.model._emit('errorCleared');

      expect(this.context.hideSheetError).to.be.called;
    });
  });

  describe('hideLoadingIndicator', function () {
    it('hides the loading indicator', function () {
      var dropinContainer = document.createElement('div');
      var upperContainer = document.createElement('div');
      var loadingContainer = document.createElement('div');
      var loadingIndicator = document.createElement('div');
      var context = {
        dropinContainer: dropinContainer,
        loadingContainer: loadingContainer,
        loadingIndicator: loadingIndicator
      };

      this.sandbox.stub(upperContainer, 'removeChild');
      upperContainer.appendChild(loadingContainer);
      this.sandbox.stub(transitionHelper, 'onTransitionEnd').yields();

      MainView.prototype.hideLoadingIndicator.call(context);

      expect(context.dropinContainer.classList.contains('braintree-hidden')).to.be.false;
      expect(context.dropinContainer.classList.contains('braintree-loaded')).to.be.true;
      expect(upperContainer.removeChild).to.have.been.called;
    });
  });

  describe('DropinModel events', function () {
    beforeEach(function () {
      this.element = document.createElement('div');
      this.element.innerHTML = templateHTML;
      this.model = new DropinModel(fake.modelOptions());

      this.mainViewOptions = {
        element: this.element,
        model: this.model,
        client: this.client,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };

      this.sandbox.stub(CardView.prototype, '_initialize');
      this.sandbox.spy(MainView.prototype, 'hideLoadingIndicator');

      this.mainView = new MainView(this.mainViewOptions);
    });

    describe('for changeActivePaymentView', function () {
      beforeEach(function () {
        this.sandbox.stub(this.model, 'setPaymentMethodRequestable');
        this.paymentMethodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
        this.sheetElement = this.element.querySelector('[data-braintree-id="sheet-container"]');
      });

      describe('when the PaymentMethodsView is active', function () {
        beforeEach(function () {
          classlist.remove(this.paymentMethodsContainer, 'braintree-methods--active');
          classlist.add(this.sheetElement, 'braintree-sheet--active');
          this.model._emit('changeActivePaymentView', PaymentMethodsView.ID);
        });

        it('adds braintree-methods--active to the payment methods view element', function () {
          expect(this.paymentMethodsContainer.className).to.contain('braintree-methods--active');
        });

        it('removes braintree-sheet--active from the payment sheet element', function () {
          expect(this.sheetElement.className).to.not.contain('braintree-sheet--active');
        });

        it('does not call model.setPaymentMethodRequestable', function () {
          expect(this.model.setPaymentMethodRequestable).to.not.be.called;
        });
      });

      describe('when a payment sheet is active', function () {
        beforeEach(function () {
          this.sandbox.useFakeTimers();

          classlist.add(this.paymentMethodsContainer, 'braintree-methods--active');
          classlist.remove(this.sheetElement, 'braintree-sheet--active');
        });

        [CardView, PayPalView].forEach(function (PaymentSheetView) {
          beforeEach(function () {
            this.model._emit('changeActivePaymentView', PaymentSheetView.ID);
          });

          it('adds braintree-sheet--active to the payment sheet', function () {
            this.sandbox.clock.tick(1001);
            expect(this.sheetElement.className).to.contain('braintree-sheet--active');
          });

          it('removes braintree-methods--active from the payment methods view', function () {
            this.sandbox.clock.tick(1001);
            expect(this.paymentMethodsContainer.className).to.not.contain('braintree-methods--active');
          });

          it('calls model.setPaymentMethodRequestable', function () {
            expect(this.model.setPaymentMethodRequestable).to.be.calledWith({
              isRequestable: false
            });
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
        element: this.wrapper,
        client: this.client,
        model: new DropinModel(fake.modelOptions()),
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };
      this.sandbox.stub(PayPalCheckout, 'create').yields(null, {});
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

    describe('when there is one payment option', function () {
      beforeEach(function () {
        this.mainViewOptions.model.supportedPaymentOptions = ['card'];
        this.mainView = new MainView(this.mainViewOptions);

        this.mainView.setPrimaryView(PaymentMethodsView.ID);
        this.mainView.toggle.click();
      });

      it('sets the payment option as the active payment view', function () {
        expect(this.mainView.model.getActivePaymentView()).to.equal(CardView.ID);
      });

      it('exposes the payment sheet view', function () {
        expect(this.wrapper.className).to.contain('braintree-show-' + CardView.ID);
      });
    });

    describe('when there are multiple payment options and a payment sheet view is active', function () {
      beforeEach(function () {
        this.mainViewOptions.model.supportedPaymentOptions = ['card', 'paypal'];
        this.sandbox.useFakeTimers();
      });

      describe('and there are no payment methods available', function () {
        it('sets the PaymentOptionsView as the primary view', function () {
          var mainView = new MainView(this.mainViewOptions);

          this.sandbox.spy(mainView, 'setPrimaryView');
          mainView.setPrimaryView(CardView.ID);
          mainView.toggle.click();
          this.sandbox.clock.tick(1);

          expect(mainView.setPrimaryView).to.have.been.calledWith(PaymentOptionsView.ID);
          expect(this.wrapper.className).to.contain('braintree-show-' + PaymentOptionsView.ID);
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
          this.sandbox.clock.tick(1);
        });

        it('sets the PaymentMethodsView as the primary view', function () {
          expect(this.mainView.setPrimaryView).to.have.been.calledWith(PaymentMethodsView.ID, sinon.match.any);
          expect(this.wrapper.className).to.contain('braintree-show-' + PaymentMethodsView.ID);
          expect(this.mainView.model.getActivePaymentView()).to.equal(PaymentMethodsView.ID);
        });

        it('exposes the PaymentOptionsView', function () {
          expect(this.wrapper.className).to.contain('braintree-show-' + PaymentOptionsView.ID);
        });

        it('hides the toggle', function () {
          expect(this.mainView.toggle.className).to.contain('braintree-hidden');
        });
      });
    });
  });

  describe('requestPaymentMethod', function () {
    beforeEach(function () {
      this.wrapper = document.createElement('div');
      this.wrapper.innerHTML = templateHTML;

      this.sandbox.stub(analytics, 'sendEvent');

      this.mainView = new MainView({
        element: this.wrapper,
        model: new DropinModel(fake.modelOptions()),
        client: this.client,
        merchantConfiguration: {
          authorization: 'fake_tokenization_key'
        },
        strings: strings
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
        expect(analytics.sendEvent).to.be.calledWith(this.client, 'request-payment-method.error');
        done();
      }.bind(this));
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

    it('sends analytics event for successful CreditCard', function (done) {
      var stubPaymentMethod = {type: 'CreditCard'};

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(null, stubPaymentMethod);

      this.mainView.requestPaymentMethod(function () {
        expect(analytics.sendEvent).to.be.calledWith(this.client, 'request-payment-method.card');
        done();
      }.bind(this));
    });

    it('sends analytics event for successful PayPalAccount', function (done) {
      var stubPaymentMethod = {type: 'PayPalAccount'};

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(null, stubPaymentMethod);

      this.mainView.requestPaymentMethod(function () {
        expect(analytics.sendEvent).to.be.calledWith(this.client, 'request-payment-method.paypal');
        done();
      }.bind(this));
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
          element: this.wrapper,
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
        _views: {
          'braintree-card-view': {
            teardown: this.sandbox.stub().yields()
          }
        }
      };
    });

    it('calls teardown on each view', function (done) {
      var payWithCardView = this.context._views['braintree-card-view'];

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('waits to call callback until asynchronous teardowns complete', function (done) {
      var payWithCardView = this.context._views['braintree-card-view'];

      payWithCardView.teardown.yieldsAsync();

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('calls callback with error from teardown function', function (done) {
      var payWithCardView = this.context._views['braintree-card-view'];
      var error = new Error('pay with card teardown error');

      payWithCardView.teardown.yields(error);

      MainView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });

  describe('getOptionsElements', function () {
    it('returns options view elements property', function () {
      var elements = {};
      var context = {
        _views: {
          options: {
            elements: elements
          }
        }
      };

      expect(MainView.prototype.getOptionsElements.call(context)).to.equal(elements);
    });
  });
});
