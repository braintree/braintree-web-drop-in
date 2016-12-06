'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var CompletedView = require('../../../src/views/completed-view');
var classlist = require('../../../src/lib/classlist');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var HostedFields = require('braintree-web/hosted-fields');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
var PayPal = require('braintree-web/paypal');
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
      var model = new DropinModel();

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        dependenciesInitializing: 0,
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: function () {},
        hideLoadingIndicator: function () {},
        model: model,
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
    });
  });

  afterEach(function () {
    document.body.innerHTML = '';
  });

  it('creates a PaymentOptionsView if there are multiple payment options', function () {
    var mainView;
    var dropinWrapper = document.createElement('div');
    var model = new DropinModel({paymentMethods: [{foo: 'bar'}, {baz: 'qux'}]});

    this.sandbox.stub(PayPalView, 'isEnabled').returns(true);
    this.sandbox.stub(CardView, 'isEnabled').returns(true);
    this.sandbox.stub(PayPal, 'create').yields(null, {});

    dropinWrapper.innerHTML = templateHTML;
    mainView = new MainView({
      dropinWrapper: dropinWrapper,
      model: model,
      options: {
        authorization: 'fake_tokenization_key',
        client: {
          getConfiguration: fake.configuration
        }
      },
      strings: strings
    });

    expect(Object.keys(mainView.views)).to.contain(PaymentOptionsView.ID);
  });

  describe('with vaulted payment methods', function () {
    beforeEach(function () {
      this.dropinWrapper = document.createElement('div');
      this.dropinWrapper.innerHTML = templateHTML;
      this.model = new DropinModel({paymentMethods: [{foo: 'bar'}, {baz: 'qux'}]});
      this.sandbox.stub(PayPalView, 'isEnabled').returns(true);
      this.sandbox.stub(CardView, 'isEnabled').returns(true);
      this.sandbox.stub(PayPal, 'create').yields(null, {});
    });

    it('sets the first payment method to be the active payment method', function () {
      this.sandbox.spy(this.model, 'changeActivePaymentMethod');

      new MainView({ // eslint-disable-line no-new
        dropinWrapper: this.dropinWrapper,
        model: this.model,
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        },
        strings: strings
      });

      expect(this.model.changeActivePaymentMethod).to.have.been.calledWith({foo: 'bar'});
    });

    it('sets the CompletedView as the active view', function () {
      var mainView = new MainView({ // eslint-disable-line no-new
        dropinWrapper: this.dropinWrapper,
        model: this.model,
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        },
        strings: strings
      });

      expect(mainView.activeView.ID).to.equal(CompletedView.ID);
    });
  });

  describe('without vaulted payment methods', function () {
    beforeEach(function () {
      this.dropinWrapper = document.createElement('div');
      this.dropinWrapper.innerHTML = templateHTML;
      this.model = new DropinModel();
      this.sandbox.stub(PayPal, 'create').yields(null, {});
    });

    it('sets PaymentOptionsViews as the active view if there are multiple payment methods', function () {
      var mainView;

      this.sandbox.stub(PayPalView, 'isEnabled').returns(true);
      this.sandbox.stub(CardView, 'isEnabled').returns(true);

      mainView = new MainView({ // eslint-disable-line no-new
        dropinWrapper: this.dropinWrapper,
        model: this.model,
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        },
        strings: strings
      });

      expect(mainView.activeView.ID).to.equal(PaymentOptionsView.ID);
    });

    it('sets the sheet view as the active view if there is one payment method', function () {
      var mainView;

      this.sandbox.stub(PayPalView, 'isEnabled').returns(false);
      this.sandbox.stub(CardView, 'isEnabled').returns(true);

      mainView = new MainView({ // eslint-disable-line no-new
        dropinWrapper: this.dropinWrapper,
        model: this.model,
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        },
        strings: strings
      });

      expect(mainView.activeView.ID).to.equal(CardView.ID);
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
      var wrapper = document.createElement('div');

      wrapper.innerHTML = templateHTML;

      function FakeView(id) {
        this.ID = id;
      }

      this.views = [
        new FakeView('id1'),
        new FakeView('id2'),
        new FakeView('id3')
      ];

      this.mainViewOptions = {
        dropinWrapper: wrapper,
        model: new DropinModel(),
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        }
      };
    });

    it('shows the selected view', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.setActiveView('id1');

      expect(mainView.dropinWrapper.className).to.contain('id1');
      expect(mainView.dropinWrapper.className).to.not.contain('id2');
      expect(mainView.dropinWrapper.className).to.not.contain('id3');
    });

    it('clears any errors', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      this.sandbox.stub(DropinModel.prototype, 'clearError');

      mainView.setActiveView('id1');

      expect(DropinModel.prototype.clearError).to.have.been.calledOnce;
    });

    it('applies no-flexbox class when flexbox is not supported', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.supportsFlexbox = false;

      mainView.setActiveView('id1');

      expect(mainView.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.true;
    });

    it('does not apply no-flexbox class when flexbox is supported', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.supportsFlexbox = true;

      mainView.setActiveView('id1');

      expect(mainView.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.false;
    });

    describe('CardView', function () {
      it('assigns the card view as the active view', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setActiveView(CardView.ID);

        expect(mainView.activeView).to.equal(mainView.getView(CardView.ID));
      });

      context('in vaulted flow', function () {
        it('shows the additional options button', function () {
          var mainView;

          this.mainViewOptions.options.authorization = fake.clientTokenWithCustomerID;

          mainView = new MainView(this.mainViewOptions);

          expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.false;
        });
      });

      context('in guest checkout flow', function () {
        it('does not show the additional options button', function () {
          var mainView = new MainView(this.mainViewOptions);

          expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.true;
        });
      });
    });

    describe('CompletedView', function () {
      it('assigns the completed view as the active view', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setActiveView(CompletedView.ID);

        expect(mainView.activeView).to.equal(mainView.getView(CompletedView.ID));
      });

      it('shows the additional options button', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setActiveView(CompletedView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).to.be.false;
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
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showAlert: this.sandbox.stub(),
        toggleAdditionalOptions: function () {},
        showLoadingIndicator: function () {}
      };

      MainView.prototype._initialize.call(this.context);
    });

    // TODO: add these back in when error handling is ready
    xit('calls showAlert when errorOccurred is emitted', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      this.context.model._emit('errorOccurred', fakeError);

      expect(this.context.showAlert).to.be.calledWith(fakeError);
    });

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
      this.model = new DropinModel();

      this.mainViewOptions = {
        dropinWrapper: this.dropinWrapper,
        model: this.model,
        options: {
          authorization: fake.tokenizationKey,
          client: {
            getConfiguration: fake.configuration
          }
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

    describe('for changeActivePaymentOption', function () {
      beforeEach(function () {
        this.completedElement = this.dropinWrapper.querySelector('[data-braintree-id="' + CompletedView.ID + '"]');
        this.sheetElement = this.dropinWrapper.querySelector('[data-braintree-id="sheet-container"]');
      });

      describe('when the CompletedView is active', function () {
        beforeEach(function () {
          classlist.remove(this.completedElement, 'braintree-completed--active');
          classlist.add(this.sheetElement, 'braintree-sheet--active');
          this.model._emit('changeActivePaymentOption', CompletedView.ID);
        });

        it('adds braintree-completed--active to the completed view element', function () {
          expect(this.completedElement.className).to.contain('braintree-completed--active');
        });

        it('removes braintree-sheet--active from the payment sheet element', function () {
          expect(this.sheetElement.className).to.not.contain('braintree-sheet--active');
        });
      });

      describe('when a payment sheet is active', function () {
        beforeEach(function () {
          classlist.add(this.completedElement, 'braintree-completed--active');
          classlist.remove(this.sheetElement, 'braintree-sheet--active');
        });

        [CardView, PayPalView].forEach(function (PaymentSheetView) {
          beforeEach(function () {
            this.model._emit('changeActivePaymentOption', PaymentSheetView.ID);
          });

          it('adds braintree-sheet--active to the payment sheet', function () {
            expect(this.sheetElement.className).to.contain('braintree-sheet--active');
          });

          it('removes braintree-completed--active from the completed view', function () {
            expect(this.completedElement.className).to.not.contain('braintree-completed--active');
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
        model: new DropinModel(),
        options: {
          authorization: fake.tokenizationKey,
          client: {
            getConfiguration: fake.configuration
          }
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

    describe('when there is one payment option and the CompletedView is active', function () {
      beforeEach(function () {
        this.sandbox.stub(CardView, 'isEnabled').returns(true);
        this.sandbox.stub(PayPalView, 'isEnabled').returns(false);
        this.mainView = new MainView(this.mainViewOptions);

        this.mainView.setActiveView(CompletedView.ID);
        this.mainView.toggle.click();
      });

      it('sets the CardView as the active payment option', function () {
        expect(this.mainView.model.getActivePaymentOption()).to.equal(CardView.ID);
      });

      it('exposes the CardView', function () {
        expect(this.wrapper.className).to.contain('braintree-' + CardView.ID);
      });
    });

    describe('when there are multiple payment options and a payment sheet view is active', function () {
      beforeEach(function () {
        this.sandbox.stub(CardView, 'isEnabled').returns(true);
        this.sandbox.stub(PayPalView, 'isEnabled').returns(true);
      });

      describe('and there are no payment methods available', function () {
        it('sets the PaymentOptionsView as the active view', function () {
          var mainView = new MainView(this.mainViewOptions);

          this.sandbox.spy(mainView, 'setActiveView');
          mainView.setActiveView(CardView.ID);
          mainView.toggle.click();

          expect(mainView.setActiveView).to.have.been.calledWith(PaymentOptionsView.ID);
          expect(this.wrapper.className).to.contain('braintree-' + PaymentOptionsView.ID);
        });
      });

      describe('and there are payment methods available', function () {
        beforeEach(function () {
          this.mainViewOptions.model = new DropinModel({paymentMethods: [{foo: 'bar'}]});
          this.mainView = new MainView(this.mainViewOptions);

          this.sandbox.spy(this.mainView, 'setActiveView');

          this.mainView.setActiveView(CardView.ID);
          this.mainView.toggle.click();
        });

        it('sets the CompletedView as the active view', function () {
          expect(this.mainView.setActiveView).to.have.been.calledWith(CompletedView.ID);
          expect(this.wrapper.className).to.contain('braintree-' + CompletedView.ID);
          expect(this.mainView.model.getActivePaymentOption()).to.equal(CompletedView.ID);
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
        model: new DropinModel(),
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        }
      });
    });

    it('requests payment method from the active view', function () {
      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod');

      this.mainView.requestPaymentMethod();

      expect(this.mainView.activeView.requestPaymentMethod).to.be.called;
    });

    it('calls back with error when error occurs', function (done) {
      var fakeError = new Error('A bad thing happened');

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(fakeError);

      this.mainView.requestPaymentMethod(function (err, payload) {
        expect(payload).to.not.exist;
        expect(err).to.equal(fakeError);
        done();
      });
    });

    it('calls back with payload when successful', function (done) {
      var stubPaymentMethod = {foo: 'bar'};

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(null, stubPaymentMethod);

      this.mainView.requestPaymentMethod(function (err, payload) {
        expect(err).to.not.exist;
        expect(payload).to.equal(stubPaymentMethod);
        done();
      });
    });

    it('sets the CompletedView as the active view when successful', function (done) {
      var stubPaymentMethod = {foo: 'bar'};
      var completedView = this.mainView.getView(CompletedView.ID);

      this.sandbox.stub(CardView.prototype, 'requestPaymentMethod').yields(null, stubPaymentMethod);

      this.mainView.requestPaymentMethod(function () {
        expect(this.mainView.activeView).to.equal(completedView);
        done();
      }.bind(this));
    });

    describe('with vaulted payment methods', function () {
      beforeEach(function () {
        this.sandbox.stub(PayPalView, 'isEnabled').returns(false);
        this.sandbox.stub(CardView, 'isEnabled').returns(true);
        this.wrapper = document.createElement('div');
        this.wrapper.innerHTML = templateHTML;
        this.fakeHostedFieldsInstance = {
          getState: this.sandbox.stub().returns({
            cards: [{type: 'visa'}],
            fields: {
              number: {
                isValid: true
              },
              expirationDate: {
                isValid: true
              }
            }
          })
        };
        this.sandbox.stub(HostedFields, 'create').returns(null, this.fakeHostedFieldsInstance);
        this.mainView = new MainView({
          dropinWrapper: this.wrapper,
          model: new DropinModel(),
          options: {
            authorization: fake.clientTokenWithCustomerID,
            client: {
              getConfiguration: fake.configuration
            }
          }
        });
      });

      it('requests payment method from completed view', function () {
        var completedView = this.mainView.getView(CompletedView.ID);

        this.mainView.model.changeActivePaymentOption(CompletedView.ID);
        this.sandbox.stub(completedView, 'requestPaymentMethod');

        this.mainView.requestPaymentMethod();

        expect(completedView.requestPaymentMethod).to.be.called;
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
          'braintree-pay-with-card-view': {
            teardown: this.sandbox.stub().yields()
          }
        }
      };
    });

    it('calls teardown on each view', function (done) {
      var payWithCardView = this.context.views['braintree-pay-with-card-view'];

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('waits to call callback until asyncronous teardowns complete', function (done) {
      var payWithCardView = this.context.views['braintree-pay-with-card-view'];

      payWithCardView.teardown.yieldsAsync();

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('calls callback with error from teardown function', function (done) {
      var payWithCardView = this.context.views['braintree-pay-with-card-view'];
      var error = new Error('pay with card teardown error');

      payWithCardView.teardown.yields(error);

      MainView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
