jest.mock('../../../src/lib/analytics');

const fs = require('fs');
const classList = require('@braintree/class-list');
const hostedFields = require('braintree-web/hosted-fields');
const PayPalCheckout = require('braintree-web/paypal-checkout');
const MainView = require('../../../src/views/main-view');
const ApplePayView = require('../../../src/views/payment-sheet-views/apple-pay-view');
const BaseView = require('../../../src/views/base-view');
const BasePayPalView = require('../../../src/views/payment-sheet-views/base-paypal-view');
const CardView = require('../../../src/views/payment-sheet-views/card-view');
const GooglePayView = require('../../../src/views/payment-sheet-views/google-pay-view');
const PaymentMethodsView = require('../../../src/views/payment-methods-view');
const PaymentOptionsView = require('../../../src/views/payment-options-view');
const PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
const analytics = require('../../../src/lib/analytics');
const fake = require('../../helpers/fake');
const wait = require('../../../src/lib/wait');
const sheetViews = require('../../../src/views/payment-sheet-views');
const strings = require('../../../src/translations/en_US');
const { yields } = require('../../helpers/yields');

const templateHTML = fs.readFileSync(`${__dirname}/../../../src/html/main.html`, 'utf8');
const { CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT } = require('../../../src/constants');

describe('MainView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    jest.spyOn(CardView.prototype, 'getPaymentMethod').mockImplementation();
    jest.spyOn(BasePayPalView.prototype, 'initialize').mockImplementation();
  });

  describe('Constructor', () => {
    beforeEach(() => {
      jest.spyOn(MainView.prototype, '_initialize').mockImplementation();
    });

    it('calls _initialize', () => {
      new MainView(); // eslint-disable-line no-new

      expect(MainView.prototype._initialize).toBeCalledTimes(1);
    });

    it('inherits from BaseView', () => {
      expect(new MainView()).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      const element = document.createElement('div');

      element.innerHTML = templateHTML;

      testContext.mainViewOptions = {
        element: element,
        merchantConfiguration: {
          authorization: fake.tokenizationKey
        },
        strings: strings
      };
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('creates a CardView if it is the only payment option', () => {
      let mainView;
      const model = fake.model();

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];

        testContext.mainViewOptions.model = model;

        mainView = new MainView(testContext.mainViewOptions);

        expect(Object.keys(mainView._views)).toContain(CardView.ID);
        expect(mainView.primaryView.ID).toBe(CardView.ID);
      });
    });

    it('creates a PaymentOptionsView if there are multiple payment options', () => {
      let model,
        mainView;
      const modelOptions = fake.modelOptions();

      modelOptions.paymentMethods = [{ foo: 'bar' }, { baz: 'qux' }];
      model = fake.model(modelOptions);

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card', 'paypal'];

        testContext.mainViewOptions.model = model;

        jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));

        mainView = new MainView(testContext.mainViewOptions);

        expect(Object.keys(mainView._views)).toContain(PaymentOptionsView.ID);
      });
    });

    it('listens for enableEditMode', () => {
      let mainView;
      const model = fake.model();

      return model.initialize().then(() => {
        jest.spyOn(model, 'on').mockImplementation();
        model.supportedPaymentOptions = ['card'];

        testContext.mainViewOptions.model = model;

        mainView = new MainView(testContext.mainViewOptions);

        expect(mainView.model.on).toBeCalledWith('enableEditMode', expect.any(Function));
      });
    });

    it('listens for disableEditMode', () => {
      let mainView;
      const model = fake.model();

      return model.initialize().then(() => {
        jest.spyOn(model, 'on').mockImplementation();
        model.supportedPaymentOptions = ['card'];

        testContext.mainViewOptions.model = model;

        mainView = new MainView(testContext.mainViewOptions);

        expect(mainView.model.on).toBeCalledWith('disableEditMode', expect.any(Function));
      });
    });

    it('listens for confirmPaymentMethodDeletion', () => {
      let mainView;
      const model = fake.model();

      return model.initialize().then(() => {
        jest.spyOn(model, 'on').mockImplementation();
        model.supportedPaymentOptions = ['card'];

        testContext.mainViewOptions.model = model;

        mainView = new MainView(testContext.mainViewOptions);

        expect(mainView.model.on).toBeCalledWith('confirmPaymentMethodDeletion', expect.any(Function));
      });
    });

    describe('with vaulted payment methods', () => {
      beforeEach(() => {
        const element = document.createElement('div');
        const fakeModelOptions = fake.modelOptions();

        fakeModelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

        element.innerHTML = templateHTML;

        testContext.model = fake.model(fakeModelOptions);

        testContext.model.getVaultedPaymentMethods.mockResolvedValue([
          { type: 'CreditCard', details: { lastTwo: '11' }},
          { type: 'PayPalAccount', details: { email: 'me@example.com' }}
        ]);

        testContext.dropinOptions = {
          merchantConfiguration: {
            container: '#foo',
            authorization: fake.tokenizationKey
          }
        };

        return testContext.model.initialize().then(() => {
          testContext.model.supportedPaymentOptions = ['card', 'paypal'];

          testContext.mainViewOptions = {
            element: element,
            merchantConfiguration: {
              authorization: fake.tokenizationKey
            },
            model: testContext.model,
            strings: strings
          };

          jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));
        });
      });

      it('sets the first payment method to be the active payment method', () => {
        jest.spyOn(testContext.model, 'changeActivePaymentMethod');

        new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

        expect(testContext.model.changeActivePaymentMethod).toBeCalledWith({ type: 'CreditCard', details: { lastTwo: '11' }});
      });

      it('does not set the first payment method to be the active payment method if configured not to', () => {
        jest.spyOn(testContext.model, 'changeActivePaymentMethod');
        testContext.model.vaultManagerConfig = {
          preselectVaultedPaymentMethod: false
        };
        jest.spyOn(MainView.prototype, 'setPrimaryView').mockImplementation();

        new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

        expect(testContext.model.changeActivePaymentMethod).not.toBeCalled();
        expect(MainView.prototype.setPrimaryView).toBeCalledTimes(1);
        expect(MainView.prototype.setPrimaryView).toBeCalledWith('methods');
      });

      it('sends preselect analytic event when a vaulted card is preselected', () => {
        testContext.model.vaultManagerConfig = {
          preselectVaultedPaymentMethod: true
        };
        new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

        expect(analytics.sendEvent).toBeCalledWith('vaulted-card.preselect');
      });

      it('does not send preselect analytic event when a vaulted card is not preselected', () => {
        testContext.model.vaultManagerConfig = {
          preselectVaultedPaymentMethod: false
        };

        new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

        expect(analytics.sendEvent).not.toBeCalledWith('vaulted-card.preselect');
      });

      it('sets the PaymentMethodsView as the primary view', done => {
        const mainView = new MainView(testContext.mainViewOptions);

        setTimeout(() => {
          expect(mainView.primaryView.ID).toBe(PaymentMethodsView.ID);
          done();
        }, CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
      });
    });

    describe('without vaulted payment methods', () => {
      beforeEach(() => {
        const element = document.createElement('div');

        element.innerHTML = templateHTML;

        testContext.model = fake.model();

        return testContext.model.initialize().then(() => {
          testContext.mainViewOptions = {
            element: element,
            merchantConfiguration: {
              authorization: fake.tokenizationKey
            },
            model: testContext.model,
            strings: strings
          };

          jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));
        });
      });

      it('sets PaymentOptionsViews as the primary view if there are multiple payment methods', () => {
        let mainView;

        testContext.model.supportedPaymentOptions = ['card', 'paypal'];

        mainView = new MainView(testContext.mainViewOptions);

        expect(mainView.primaryView.ID).toBe(PaymentOptionsView.ID);
      });

      it('sets the sheet view as the primary view if there is one payment method', () => {
        let mainView;

        testContext.model.supportedPaymentOptions = ['card'];

        mainView = new MainView(testContext.mainViewOptions);

        expect(mainView.primaryView.ID).toBe(CardView.ID);
      });
    });
  });

  describe('addView', () => {
    beforeEach(() => {
      testContext.fakeView = {
        element: document.createElement('span'),
        ID: 'fake-id'
      };

      testContext.context = {
        element: document.createElement('div'),
        _views: []
      };
    });

    it('adds the argument to the array of views', () => {
      MainView.prototype.addView.call(testContext.context, testContext.fakeView);

      expect(testContext.context._views[testContext.fakeView.ID]).toBe(testContext.fakeView);
    });
  });

  describe('setPrimaryView', () => {
    beforeEach(() => {
      const model = fake.model();
      const wrapper = document.createElement('div');

      wrapper.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card', 'paypal', 'paypalCredit', 'applePay', 'googlePay', 'venmo'];

        testContext.mainViewOptions = {
          element: wrapper,
          model: model,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          strings: strings
        };

        jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));
      });
    });

    it('clears any errors', () => {
      const mainView = new MainView(testContext.mainViewOptions);

      jest.spyOn(mainView.model, 'clearError').mockImplementation();

      mainView.setPrimaryView(CardView.ID);

      expect(mainView.model.clearError).toBeCalledTimes(1);
    });

    describe.each([
      [ApplePayView.ID],
      [CardView.ID],
      [PaymentMethodsView.ID],
      [PaymentOptionsView.ID],
      [PayPalView.ID],
      [GooglePayView.ID]
    ])('when given a %s view', (viewID) => {
      it('shows the selected view by updating the classname of the drop-in wrapper', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(viewID);

        return wait.delay(1).then(() => {
          expect(mainView.element.className).toBe(`braintree-show-${viewID}`);
        });
      });

      it('sets the view as the primary view', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(viewID);

        expect(mainView.primaryView).toBe(mainView.getView(viewID));
      });

      it('changes the active payment option', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(viewID);

        expect(mainView.model.getActivePaymentView()).toBe(viewID);
      });
    });

    describe.each(Object.keys(sheetViews))('when given a %s view', sheetViewKey => {
      const SheetView = sheetViews[sheetViewKey];

      describe('in a non-guest checkout flow', () => {
        it('shows the additional options button', () => {
          let mainView;

          testContext.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

          mainView = new MainView(testContext.mainViewOptions);
          mainView.setPrimaryView(SheetView.ID);

          expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(false);
        });

        it('does not show the additional options button if there are no vaulted payment methods', () => {
          let mainView, model;
          const modelOptions = fake.modelOptions();

          modelOptions.paymentMethods = [];
          modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
          model = fake.model(modelOptions);

          return model.initialize().then(() => {
            model.supportedPaymentOptions = [sheetViewKey];

            testContext.mainViewOptions.model = model;

            mainView = new MainView(testContext.mainViewOptions);

            mainView.setPrimaryView(SheetView.ID);

            expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(true);
          });
        });
      });

      describe('in a guest checkout flow', () => {
        it('shows the additional options button if there are multiple payment options', () => {
          let mainView;

          testContext.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

          mainView = new MainView(testContext.mainViewOptions);
          mainView.setPrimaryView(SheetView.ID);

          expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(false);
        });

        it('does not show the additional options button if there is one payment option', () => {
          let mainView;

          testContext.mainViewOptions.model.supportedPaymentOptions = [sheetViewKey];
          testContext.mainViewOptions.merchantConfiguration.authorization = fake.tokenizationKey;

          mainView = new MainView(testContext.mainViewOptions);
          mainView.setPrimaryView(SheetView.ID);

          expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(true);
        });
      });
    });

    describe('when given a PaymentMethodsView', () => {
      it('shows the additional options button', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(PaymentMethodsView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(false);
      });
    });

    describe('when given a PaymentOptionsView', () => {
      it('hides the additional options button', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(PaymentOptionsView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(true);
      });
    });

    it('calls setPaymentMethodRequestable when there is a payment method requestable', () => {
      const fakePaymentMethod = {
        type: 'TYPE',
        nonce: 'some-nonce'
      };
      const mainView = new MainView(testContext.mainViewOptions);

      jest.spyOn(BaseView.prototype, 'getPaymentMethod').mockReturnValue(fakePaymentMethod);
      jest.spyOn(mainView.model, 'setPaymentMethodRequestable').mockImplementation();

      mainView.setPrimaryView(PaymentOptionsView.ID);

      expect(mainView.model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: true,
        type: 'TYPE',
        selectedPaymentMethod: fakePaymentMethod
      });
    });

    it('does not call setPaymentMethodRequestable when in edit mode', () => {
      const fakePaymentMethod = {
        type: 'TYPE',
        nonce: 'some-nonce'
      };
      const mainView = new MainView(testContext.mainViewOptions);

      jest.spyOn(BaseView.prototype, 'getPaymentMethod').mockReturnValue(fakePaymentMethod);
      jest.spyOn(mainView.model, 'setPaymentMethodRequestable').mockImplementation();
      jest.spyOn(mainView.model, 'isInEditMode').mockReturnValue(true);

      mainView.setPrimaryView(PaymentOptionsView.ID);

      expect(mainView.model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: false,
        type: 'TYPE',
        selectedPaymentMethod: fakePaymentMethod
      });
    });

    it('calls setPaymentMethodRequestable when there is no payment method requestable', () => {
      const mainView = new MainView(testContext.mainViewOptions);

      jest.spyOn(BaseView.prototype, 'getPaymentMethod').mockReturnValue(false);
      jest.spyOn(mainView.model, 'setPaymentMethodRequestable').mockImplementation();

      mainView.setPrimaryView(PaymentOptionsView.ID);

      expect(mainView.model.setPaymentMethodRequestable).toBeCalledWith(expect.objectContaining({
        isRequestable: false
      }));
    });
  });

  describe('showSheetError', () => {
    beforeEach(() => {
      testContext.context = {
        dropinContainer: document.createElement('div'),
        sheetErrorText: document.createElement('div'),
        strings: strings
      };
    });

    it('applies the braintree-sheet--has-error class to dropin container', () => {
      MainView.prototype.showSheetError.call(testContext.context, {});

      expect(testContext.context.dropinContainer.classList.contains('braintree-sheet--has-error')).toBe(true);
    });

    it('sets the error text to the expected message for the error code', () => {
      const fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION',
        message: 'Some text we do not use'
      };

      MainView.prototype.showSheetError.call(testContext.context, fakeError);

      expect(testContext.context.sheetErrorText.textContent).toBe('Please check your information and try again.');
    });

    it('shows a fallback error message when the error code is unknown and the error is missing a message', () => {
      const fakeError = {
        code: 'AN_UNKNOWN_ERROR'
      };

      MainView.prototype.showSheetError.call(testContext.context, fakeError);

      expect(testContext.context.sheetErrorText.textContent).toBe('Something went wrong on our end.');
    });

    it('shows a developer error message when error is "developerError"', () => {
      const fakeError = 'developerError';

      MainView.prototype.showSheetError.call(testContext.context, fakeError);

      expect(testContext.context.sheetErrorText.textContent).toBe('Developer Error: Something went wrong. Check the console for details.');
    });
  });

  describe('hideSheetError', () => {
    beforeEach(() => {
      testContext.context = {
        dropinContainer: document.createElement('div')
      };
    });

    it('removes the braintree-sheet--has-error class from dropin container', () => {
      classList.add(testContext.context.dropinContainer, 'braintree-sheet--has-error');

      MainView.prototype.hideSheetError.call(testContext.context);

      expect(testContext.context.dropinContainer.classList.contains('braintree-sheet--has-error')).toBe(false);
    });
  });

  describe('dropinErrorState events', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        testContext.context = {
          addView: jest.fn(),
          element: element,
          getElementById: BaseView.prototype.getElementById,
          enableEditMode: jest.fn(),
          disableEditMode: jest.fn(),
          openConfirmPaymentMethodDeletionDialog: jest.fn(),
          cancelVaultedPaymentMethodDeletion: jest.fn(),
          startVaultedPaymentMethodDeletion: jest.fn(),
          finishVaultedPaymentMethodDeletion: jest.fn(),
          hideSheetError: jest.fn(),
          hideLoadingIndicator: function () {},
          _sendToDefaultView: jest.fn(),
          _onChangeActivePaymentMethodView: jest.fn(),
          model: model,
          setPrimaryView: jest.fn(),
          showSheetError: jest.fn(),
          allowUserAction: jest.fn(),
          preventUserAction: jest.fn(),
          toggleAdditionalOptions: function () {},
          showLoadingIndicator: function () {},
          strings: strings
        };

        MainView.prototype._initialize.call(testContext.context);
      });
    });

    it('calls showSheetError when errorOccurred is emitted', () => {
      const fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      testContext.context.model._emit('errorOccurred', fakeError);

      expect(testContext.context.showSheetError).toBeCalledWith(fakeError);
    });

    it('calls hideSheetError when errorCleared is emitted', () => {
      testContext.context.model._emit('errorCleared');

      expect(testContext.context.hideSheetError).toBeCalled();
    });
  });

  describe('hideLoadingIndicator', () => {
    it('sets the loaded class on dropin container', () => {
      const dropinContainer = document.createElement('div');
      const loadingContainer = document.createElement('div');
      const toggleContainer = document.createElement('div');
      const context = {
        toggle: toggleContainer,
        loadingContainer: loadingContainer,
        dropinContainer: dropinContainer
      };

      MainView.prototype.hideLoadingIndicator.call(context);

      expect(dropinContainer.classList.contains('braintree-loaded')).toBe(true);
      expect(dropinContainer.classList.contains('braintree-loading')).toBe(false);
    });
  });

  describe('showLoadingIndicator', () => {
    it('shows the loading indicator', () => {
      const dropinContainer = document.createElement('div');
      const loadingContainer = document.createElement('div');
      const toggleContainer = document.createElement('div');
      const context = {
        toggle: toggleContainer,
        loadingContainer: loadingContainer,
        dropinContainer: dropinContainer
      };

      MainView.prototype.hideLoadingIndicator.call(context);

      expect(dropinContainer.classList.contains('braintree-loading')).toBe(false);
      expect(dropinContainer.classList.contains('braintree-loaded')).toBe(true);

      MainView.prototype.showLoadingIndicator.call(context);

      expect(dropinContainer.classList.contains('braintree-loading')).toBe(true);
      expect(dropinContainer.classList.contains('braintree-loaded')).toBe(false);
    });
  });

  describe('DropinModel events', () => {
    beforeEach(() => {
      testContext.element = document.createElement('div');
      testContext.element.innerHTML = templateHTML;
      testContext.model = fake.model();

      return testContext.model.initialize().then(() => {
        testContext.mainViewOptions = {
          element: testContext.element,
          model: testContext.model,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          strings: strings
        };

        jest.spyOn(CardView.prototype, 'initialize').mockImplementation();
        jest.spyOn(MainView.prototype, 'hideLoadingIndicator');

        testContext.mainView = new MainView(testContext.mainViewOptions);
        testContext.mainView._views = {
          methods: {
            onSelection: jest.fn()
          },
          card: {
            getPaymentMethod: jest.fn(),
            onSelection: jest.fn()
          },
          paypal: {
            getPaymentMethod: jest.fn(),
            onSelection: jest.fn()
          }
        };
      });
    });

    describe('for changeActivePaymentMethod', () => {
      it('sets the PaymentMethodsView as the primary view', done => {
        testContext.mainView.paymentMethodsViews.activeMethodView = { setActive: function () {} };
        jest.spyOn(testContext.mainView, 'setPrimaryView').mockImplementation();

        testContext.model._emit('changeActivePaymentMethod', {});

        setTimeout(() => {
          expect(testContext.mainView.setPrimaryView).toBeCalled();
          done();
        }, CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
      });
    });

    describe('for removeActivePaymentMethod', () => {
      it('calls removeActivePaymentMethod if there is an active view', done => {
        const optionsView = { ID: 'options', removeActivePaymentMethod: jest.fn() };

        testContext.mainView.addView(optionsView);

        jest.spyOn(testContext.model, 'getActivePaymentView').mockReturnValue('options');
        testContext.model._emit('removeActivePaymentMethod');

        setTimeout(() => {
          expect(optionsView.removeActivePaymentMethod).toBeCalledTimes(1);
          done();
        }, CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
      });
    });

    describe('for changeActivePaymentView', () => {
      beforeEach(() => {
        jest.spyOn(testContext.model, 'setPaymentMethodRequestable').mockImplementation();
        testContext.paymentMethodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
        testContext.sheetElement = testContext.element.querySelector('[data-braintree-id="sheet-container"]');
      });

      describe('when the PaymentMethodsView is active', () => {
        beforeEach(() => {
          classList.remove(testContext.paymentMethodsContainer, 'braintree-methods--active');
          classList.add(testContext.sheetElement, 'braintree-sheet--active');
        });

        it('adds braintree-methods--active to the payment methods view element', () => {
          testContext.model._emit('changeActivePaymentView', PaymentMethodsView.ID);
          expect(testContext.paymentMethodsContainer.className).toMatch('braintree-methods--active');
        });

        it('removes braintree-sheet--active from the payment sheet element', () => {
          testContext.model._emit('changeActivePaymentView', PaymentMethodsView.ID);
          expect(testContext.sheetElement.className).toEqual(expect.not.arrayContaining(['braintree-sheet--active']));
        });

        it('does not call model.setPaymentMethodRequestable', () => {
          testContext.model._emit('changeActivePaymentView', PaymentMethodsView.ID);
          expect(testContext.model.setPaymentMethodRequestable).not.toBeCalled();
        });

        it('calls onSelection', () => {
          testContext.model._emit('changeActivePaymentView', PaymentMethodsView.ID);
          expect(testContext.mainView._views.methods.onSelection).toBeCalledTimes(1);
        });
      });

      describe('when a payment sheet is active', () => {
        beforeEach(() => {
          jest.spyOn(wait, 'delay');
          classList.add(testContext.paymentMethodsContainer, 'braintree-methods--active');
          classList.remove(testContext.sheetElement, 'braintree-sheet--active');
        });

        describe.each([
          [CardView.ID], [PayPalView.ID]
        ])('when using a %s sheet', (ID) => {
          beforeEach(() => {
            wait.delay.mockResolvedValue();
            testContext.model._emit('changeActivePaymentView', ID);
          });

          it('adds braintree-sheet--active to the payment sheet', () => {
            expect(testContext.sheetElement.className).toMatch('braintree-sheet--active');
          });

          it('removes braintree-methods--active from the payment methods view', () => {
            expect(testContext.paymentMethodsContainer.className).toEqual(expect.not.arrayContaining(['braintree-methods--active']));
          });

          it('calls model.setPaymentMethodRequestable', () => {
            expect(testContext.model.setPaymentMethodRequestable).toBeCalledWith({
              isRequestable: false
            });
          });

          it('calls onSelection on specific view', () => {
            const view = testContext.mainView._views[ID];

            expect(view.onSelection).toBeCalledTimes(1);
          });
        });
      });
    });
  });

  describe('additional options toggle', () => {
    beforeEach(() => {
      const model = fake.model();

      testContext.wrapper = document.createElement('div');
      testContext.wrapper.innerHTML = templateHTML;

      return model.initialize().then(() => {
        testContext.mainViewOptions = {
          element: testContext.wrapper,
          model: model,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          strings: strings
        };
        jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));
      });
    });

    it('has an click event listener that calls toggleAdditionalOptions', () => {
      let mainView;

      jest.spyOn(MainView.prototype, 'toggleAdditionalOptions').mockImplementation();

      mainView = new MainView(testContext.mainViewOptions);

      mainView.toggle.click();

      expect(mainView.toggleAdditionalOptions).toBeCalled();
    });

    it('hides toggle', () => {
      const mainView = new MainView(testContext.mainViewOptions);

      mainView.toggle.click();

      expect(mainView.toggle.className).toMatch('braintree-hidden');
    });

    describe('when there is one payment option', () => {
      beforeEach(() => {
        testContext.mainViewOptions.model.supportedPaymentOptions = ['card'];
        testContext.mainView = new MainView(testContext.mainViewOptions);

        testContext.mainView.setPrimaryView(PaymentMethodsView.ID);
        testContext.mainView.toggle.click();
      });

      it('sets the payment option as the active payment view', () => {
        expect(testContext.mainView.model.getActivePaymentView()).toBe(CardView.ID);
      });

      it('exposes the payment sheet view', () => {
        expect(testContext.wrapper.className).toMatch(`braintree-show-${CardView.ID}`);
      });
    });

    describe('when there are multiple payment options and a payment sheet view is active', () => {
      beforeEach(() => {
        testContext.mainViewOptions.model.supportedPaymentOptions = ['card', 'paypal'];
      });

      describe('and there are no payment methods available', () => {
        it('sets the PaymentOptionsView as the primary view', () => {
          const mainView = new MainView(testContext.mainViewOptions);

          jest.spyOn(mainView, 'setPrimaryView');
          mainView.setPrimaryView(CardView.ID);
          mainView.toggle.click();

          return wait.delay(1).then(() => {
            expect(mainView.setPrimaryView).toBeCalledWith(PaymentOptionsView.ID);
            expect(testContext.wrapper.className).toMatch(`braintree-show-${PaymentOptionsView.ID}`);
          });
        });
      });

      describe('and there are payment methods available', () => {
        beforeEach(() => {
          testContext.mainViewOptions.model = fake.model();
          testContext.mainViewOptions.model.getVaultedPaymentMethods.mockResolvedValue([{ type: 'CreditCard', details: { lastTwo: '11' }}]);

          return testContext.mainViewOptions.model.initialize().then(() => {
            testContext.mainViewOptions.model.supportedPaymentOptions = ['card', 'paypal'];
            testContext.mainView = new MainView(testContext.mainViewOptions);

            jest.spyOn(testContext.mainView, 'setPrimaryView');

            testContext.mainView.setPrimaryView(CardView.ID);
            testContext.mainView.toggle.click();

            return wait.delay(1);
          });
        });

        it('sets the PaymentMethodsView as the primary view', () => {
          expect(testContext.mainView.setPrimaryView).toBeCalledWith(PaymentMethodsView.ID, expect.anything());
          expect(testContext.wrapper.className).toMatch(`braintree-show-${PaymentMethodsView.ID}`);
          expect(testContext.mainView.model.getActivePaymentView()).toBe(PaymentMethodsView.ID);
        });

        it('exposes the PaymentOptionsView', () => {
          expect(testContext.wrapper.className).toMatch(`braintree-show-${PaymentOptionsView.ID}`);
        });

        it('hides the toggle', () => {
          expect(testContext.mainView.toggle.className).toMatch('braintree-hidden');
        });
      });
    });
  });

  describe('requestPaymentMethod', () => {
    beforeEach(() => {
      const model = fake.model();

      testContext.wrapper = document.createElement('div');
      testContext.wrapper.innerHTML = templateHTML;

      return model.initialize().then(() => {
        testContext.mainView = new MainView({
          element: testContext.wrapper,
          model: model,
          merchantConfiguration: {
            authorization: 'fake_tokenization_key'
          },
          strings: strings
        });
      });
    });

    it('requests payment method from the primary view', () => {
      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue({});

      testContext.mainView.requestPaymentMethod();

      expect(testContext.mainView.primaryView.requestPaymentMethod).toBeCalled();
    });

    it('calls callback with error when error occurs', () => {
      const fakeError = new Error('A bad thing happened');

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockRejectedValue(fakeError);

      return testContext.mainView.requestPaymentMethod().then(() => {
        throw new Error('should not resolve');
      }).catch(err => {
        expect(err).toBe(fakeError);
        expect(analytics.sendEvent).toBeCalledWith('request-payment-method.error');
      });
    });

    it('calls callback with payload when successful', () => {
      const stubPaymentMethod = { foo: 'bar' };

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue(stubPaymentMethod);

      return testContext.mainView.requestPaymentMethod().then(payload => {
        expect(payload).toBe(stubPaymentMethod);
      });
    });

    it('sends analytics event for successful CreditCard', () => {
      const stubPaymentMethod = { type: 'CreditCard' };

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue(stubPaymentMethod);

      return testContext.mainView.requestPaymentMethod().then(() => {
        expect(analytics.sendEvent).toBeCalledWith('request-payment-method.card');
      });
    });

    it('sends analytics event for successful PayPalAccount', () => {
      const stubPaymentMethod = { type: 'PayPalAccount' };

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue(stubPaymentMethod);

      return testContext.mainView.requestPaymentMethod().then(() => {
        expect(analytics.sendEvent).toBeCalledWith('request-payment-method.paypal');
      });
    });

    describe('with vaulted payment methods', () => {
      beforeEach(() => {
        const model = fake.model();

        testContext.wrapper = document.createElement('div');
        testContext.wrapper.innerHTML = templateHTML;
        jest.spyOn(hostedFields, 'create').mockResolvedValue(fake.HostedFieldsInstance);

        return model.initialize().then(() => {
          model.supportedPaymentOptions = ['card'];

          testContext.mainView = new MainView({
            element: testContext.wrapper,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });
        });
      });

      it('requests payment method from payment methods view', () => {
        const paymentMethodsViews = testContext.mainView.getView(PaymentMethodsView.ID);

        testContext.mainView.model.changeActivePaymentView(PaymentMethodsView.ID);
        jest.spyOn(paymentMethodsViews, 'requestPaymentMethod').mockResolvedValue({});

        return testContext.mainView.requestPaymentMethod().then(() => {
          expect(paymentMethodsViews.requestPaymentMethod).toBeCalled();
        });
      });

      it('requests payment method from card view when additional options are shown', () => {
        const cardView = testContext.mainView.getView(CardView.ID);

        jest.spyOn(cardView, 'requestPaymentMethod').mockResolvedValue({});
        testContext.mainView.toggleAdditionalOptions();

        return testContext.mainView.requestPaymentMethod().then(() => {
          expect(cardView.requestPaymentMethod).toBeCalled();
        });
      });
    });
  });

  describe('teardown', () => {
    beforeEach(() => {
      testContext.context = {
        _views: {
          'braintree-card-view': {
            teardown: jest.fn().mockResolvedValue()
          }
        }
      };
    });

    it('calls teardown on each view', () => {
      const payWithCardView = testContext.context._views['braintree-card-view'];

      return MainView.prototype.teardown.call(testContext.context).then(() => {
        expect(payWithCardView.teardown).toBeCalledTimes(1);
      });
    });

    it('waits to call callback until asynchronous teardowns complete', () => {
      const payWithCardView = testContext.context._views['braintree-card-view'];

      payWithCardView.teardown = () => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, 300);
        });
      };

      return MainView.prototype.teardown.call(testContext.context);
    });

    it('calls callback with error from teardown function', () => {
      const payWithCardView = testContext.context._views['braintree-card-view'];
      const error = new Error('pay with card teardown error');

      payWithCardView.teardown.mockRejectedValue(error);

      return MainView.prototype.teardown.call(testContext.context).then(() => {
        throw new Error('should not resolve');
      }).catch(err => {
        expect(err).toBe(error);
      });
    });
  });

  describe('getOptionsElements', () => {
    it('returns options view elements property', () => {
      const elements = {};
      const context = {
        _views: {
          options: {
            elements: elements
          }
        }
      };

      expect(MainView.prototype.getOptionsElements.call(context)).toBe(elements);
    });
  });

  describe('preventUserAction', () => {
    it('displays disable wrapper', () => {
      const wrapper = {};
      const context = {
        disableWrapper: wrapper
      };

      jest.spyOn(classList, 'remove').mockImplementation();

      MainView.prototype.preventUserAction.call(context);

      expect(classList.remove).toBeCalledWith(wrapper, 'braintree-hidden');
    });
  });

  describe('allowUserAction', () => {
    it('hides disable wrapper', () => {
      const wrapper = {};
      const context = {
        disableWrapper: wrapper
      };

      jest.spyOn(classList, 'add').mockImplementation();

      MainView.prototype.allowUserAction.call(context);

      expect(classList.add).toBeCalledWith(wrapper, 'braintree-hidden');
    });
  });

  describe('enableEditMode', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: model,
          strings: strings
        };
        testContext.mainView = new MainView(testContext.mainViewOptions);
      });
    });

    it('enables edit mode on the payment methods view', () => {
      jest.spyOn(testContext.mainView.paymentMethodsViews, 'enableEditMode').mockImplementation();

      testContext.mainView.enableEditMode();

      expect(testContext.mainView.paymentMethodsViews.enableEditMode).toBeCalledTimes(1);
    });

    it('hides the toggle button', () => {
      jest.spyOn(testContext.mainView, 'hideToggle').mockImplementation();

      testContext.mainView.enableEditMode();

      expect(testContext.mainView.hideToggle).toBeCalledTimes(1);
    });

    it('sets payment method requestable to false', () => {
      jest.spyOn(testContext.mainView.model, 'setPaymentMethodRequestable').mockImplementation();

      testContext.mainView.enableEditMode();

      expect(testContext.mainView.model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: false
      });
    });
  });

  describe('disableEditMode', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: model,
          strings: strings
        };
        testContext.mainView = new MainView(testContext.mainViewOptions);
      });
    });

    it('disables edit mode on the payment methods view', () => {
      jest.spyOn(testContext.mainView.paymentMethodsViews, 'disableEditMode').mockImplementation();

      testContext.mainView.disableEditMode();

      expect(testContext.mainView.paymentMethodsViews.disableEditMode).toBeCalledTimes(1);
    });

    it('shows the toggle button', () => {
      jest.spyOn(testContext.mainView, 'showToggle').mockImplementation();

      testContext.mainView.disableEditMode();

      expect(testContext.mainView.showToggle).toBeCalledTimes(1);
    });

    it('sets payment method requestable to true when a payment method is available', () => {
      const fakePaymentMethod = {
        type: 'TYPE',
        nonce: 'some-nonce'
      };

      testContext.mainView.primaryView.getPaymentMethod.mockReturnValue(fakePaymentMethod);
      jest.spyOn(testContext.mainView.model, 'setPaymentMethodRequestable').mockImplementation();

      testContext.mainView.disableEditMode();

      expect(testContext.mainView.model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: true,
        type: 'TYPE',
        selectedPaymentMethod: fakePaymentMethod
      });
    });

    it('sets payment method requestable to false when no payment methods are available', () => {
      jest.spyOn(BaseView.prototype, 'getPaymentMethod').mockReturnValue(false);
      jest.spyOn(testContext.mainView.model, 'setPaymentMethodRequestable').mockImplementation();

      testContext.mainView.disableEditMode();

      expect(testContext.mainView.model.setPaymentMethodRequestable).toBeCalledWith(expect.objectContaining({
        isRequestable: false
      }));
    });
  });

  describe('openConfirmPaymentMethodDeletionDialog', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: model,
          strings: strings
        };
        testContext.mainView = new MainView(testContext.mainViewOptions);

        jest.spyOn(testContext.mainView.deleteConfirmationView, 'applyPaymentMethod').mockImplementation();
        jest.spyOn(testContext.mainView, 'setPrimaryView').mockImplementation();
      });
    });

    it('updates delete confirmation view with payment method', () => {
      const paymentMethod = { nonce: 'a-nonce' };

      testContext.mainView.openConfirmPaymentMethodDeletionDialog(paymentMethod);

      expect(testContext.mainView.deleteConfirmationView.applyPaymentMethod).toBeCalledTimes(1);
      expect(testContext.mainView.deleteConfirmationView.applyPaymentMethod).toBeCalledWith(paymentMethod);
    });

    it('sets primary view to delete confirmation view', () => {
      const paymentMethod = { nonce: 'a-nonce' };

      testContext.mainView.openConfirmPaymentMethodDeletionDialog(paymentMethod);

      expect(testContext.mainView.setPrimaryView).toBeCalledTimes(1);
      expect(testContext.mainView.setPrimaryView).toBeCalledWith('delete-confirmation');
    });
  });

  describe('cancelVaultedPaymentMethodDeletion', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: model,
          strings: strings
        };
        testContext.mainView = new MainView(testContext.mainViewOptions);
        jest.spyOn(testContext.mainView, 'setPrimaryView').mockImplementation();
      });
    });

    it('sets primary view to methods view', () => {
      testContext.mainView.cancelVaultedPaymentMethodDeletion();

      expect(testContext.mainView.setPrimaryView).toBeCalledTimes(1);
      expect(testContext.mainView.setPrimaryView).toBeCalledWith('methods');
    });
  });

  describe('startVaultedPaymentMethodDeletion', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: model,
          strings: strings
        };
        testContext.mainView = new MainView(testContext.mainViewOptions);
      });
    });

    it('calls showLoadingIndicator', () => {
      jest.spyOn(testContext.mainView, 'showLoadingIndicator').mockImplementation();
      testContext.mainView.startVaultedPaymentMethodDeletion();
      expect(testContext.mainView.showLoadingIndicator).toBeCalledTimes(1);
    });

    it('removes classes from dropin wrapper', () => {
      testContext.mainView.element.className = 'braintree-show-methods';

      testContext.mainView.startVaultedPaymentMethodDeletion();

      expect(testContext.mainView.element.className).toBe('');
    });
  });

  describe('finishVaultedPaymentMethodDeletion', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          element: element,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          model: model,
          strings: strings
        };
        testContext.mainView = new MainView(testContext.mainViewOptions);
      });
    });

    it('refreshes payment methods view', () => {
      jest.spyOn(testContext.mainView.paymentMethodsViews, 'refreshPaymentMethods').mockImplementation();

      return testContext.mainView.finishVaultedPaymentMethodDeletion().then(() => {
        expect(testContext.mainView.paymentMethodsViews.refreshPaymentMethods).toBeCalledTimes(1);
      });
    });

    it('calls hideLoadingIndicator after half a second', () => {
      jest.spyOn(testContext.mainView, 'hideLoadingIndicator').mockImplementation();

      return testContext.mainView.finishVaultedPaymentMethodDeletion().then(() => {
        expect(testContext.mainView.hideLoadingIndicator).toBeCalledTimes(1);
      });
    });

    it('sends customer back to their initial view', () => {
      jest.spyOn(testContext.mainView, '_sendToDefaultView').mockImplementation();

      return testContext.mainView.finishVaultedPaymentMethodDeletion().then(() => {
        expect(testContext.mainView._sendToDefaultView).toBeCalledTimes(1);
      });
    });

    it('re-enables edit mode when it errors', () => {
      const err = new Error('some error');
      const fakePaymentMethod = {
        type: 'TYPE',
        nonce: 'some-nonce'
      };

      jest.spyOn(testContext.mainView.model, 'enableEditMode').mockImplementation();
      jest.spyOn(testContext.mainView.model, 'getPaymentMethods').mockReturnValue([fakePaymentMethod]);

      return testContext.mainView.finishVaultedPaymentMethodDeletion(err).then(() => {
        expect(testContext.mainView.model.enableEditMode).toBeCalledTimes(1);
      });
    });

    it('shows sheet error when it errors', () => {
      const err = new Error('some error');
      const fakePaymentMethod = {
        type: 'TYPE',
        nonce: 'some-nonce'
      };

      jest.spyOn(testContext.mainView, 'showSheetError').mockImplementation();
      jest.spyOn(testContext.mainView.model, 'getPaymentMethods').mockReturnValue([fakePaymentMethod]);

      return testContext.mainView.finishVaultedPaymentMethodDeletion(err).then(() => {
        expect(testContext.mainView.showSheetError).toBeCalledTimes(1);
      });
    });

    it('sends customer back to their initial view if erros but there are no saved payment methods',
      () => {
        const err = new Error('some error');

        jest.spyOn(testContext.mainView, '_sendToDefaultView').mockImplementation();
        jest.spyOn(testContext.mainView.model, 'getPaymentMethods').mockReturnValue([]);

        return testContext.mainView.finishVaultedPaymentMethodDeletion(err).then(() => {
          expect(testContext.mainView._sendToDefaultView).toBeCalledTimes(1);
        });
      });
  });
});
