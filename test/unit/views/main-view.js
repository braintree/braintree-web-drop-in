
const MainView = require('../../../src/views/main-view');
const ApplePayView = require('../../../src/views/payment-sheet-views/apple-pay-view');
const BaseView = require('../../../src/views/base-view');
const BasePayPalView = require('../../../src/views/payment-sheet-views/base-paypal-view');
const CardView = require('../../../src/views/payment-sheet-views/card-view');
const GooglePayView = require('../../../src/views/payment-sheet-views/google-pay-view');
const PaymentMethodsView = require('../../../src/views/payment-methods-view');
const Promise = require('../../../src/lib/promise');
const wait = require('../../../src/lib/wait');
const analytics = require('../../../src/lib/analytics');
const classList = require('@braintree/class-list');
const fake = require('../../helpers/fake');
const fs = require('fs');
const hostedFields = require('braintree-web/hosted-fields');
const PaymentOptionsView = require('../../../src/views/payment-options-view');
const PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
const PayPalCheckout = require('braintree-web/paypal-checkout');
const sheetViews = require('../../../src/views/payment-sheet-views');
const strings = require('../../../src/translations/en_US');
const {
  yields
} = require('../../helpers/yields');

const templateHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');
const CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT = require('../../../src/constants').CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT;

describe('MainView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.client = fake.client();
    jest.spyOn(CardView.prototype, 'getPaymentMethod').mockImplementation();
    jest.spyOn(BasePayPalView.prototype, 'initialize').mockImplementation();
    jest.spyOn(analytics, 'sendEvent').mockImplementation();
  });

  describe('Constructor', () => {
    beforeEach(() => {
      jest.spyOn(MainView.prototype, '_initialize').mockImplementation();
    });

    test('calls _initialize', () => {
      new MainView(); // eslint-disable-line no-new

      expect(MainView.prototype._initialize).toBeCalledTimes(1);
    });

    test('inherits from BaseView', () => {
      expect(new MainView()).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      const element = document.createElement('div');

      element.innerHTML = templateHTML;

      testContext.mainViewOptions = {
        client: testContext.client,
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

    test('creates a CardView if it is the only payment option', () => {
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

    test(
      'creates a PaymentOptionsView if there are multiple payment options',
      () => {
        let model, mainView;
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
      }
    );

    test('listens for enableEditMode', () => {
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

    test('listens for disableEditMode', () => {
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

    test('listens for confirmPaymentMethodDeletion', () => {
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

        element.innerHTML = templateHTML;

        testContext.model = fake.model();

        testContext.model.getVaultedPaymentMethods.mockResolvedValue([
          { type: 'CreditCard', details: { lastTwo: '11' }},
          { type: 'PayPalAccount', details: { email: 'me@example.com' }}
        ]);

        testContext.dropinOptions = {
          client: testContext.client,
          merchantConfiguration: {
            container: '#foo',
            authorization: fake.tokenizationKey
          }
        };

        return testContext.model.initialize().then(() => {
          testContext.model.supportedPaymentOptions = ['card', 'paypal'];

          testContext.mainViewOptions = {
            client: testContext.client,
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

      test(
        'sets the first payment method to be the active payment method',
        () => {
          jest.spyOn(testContext.model, 'changeActivePaymentMethod');

          new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

          expect(testContext.model.changeActivePaymentMethod).toBeCalledWith({ type: 'CreditCard', details: { lastTwo: '11' }});
        }
      );

      test(
        'does not set the first payment method to be the active payment method if configured not to',
        () => {
          jest.spyOn(testContext.model, 'changeActivePaymentMethod');
          testContext.model.merchantConfiguration.preselectVaultedPaymentMethod = false;
          jest.spyOn(MainView.prototype, 'setPrimaryView').mockImplementation();

          new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

          expect(testContext.model.changeActivePaymentMethod).not.toBeCalled();
          expect(MainView.prototype.setPrimaryView).toBeCalledTimes(1);
          expect(MainView.prototype.setPrimaryView).toBeCalledWith('methods');
        }
      );

      test(
        'sends preselect analytic event when a vaulted card is preselected',
        () => {
          testContext.model.merchantConfiguration.preselectVaultedPaymentMethod = true;
          new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

          expect(analytics.sendEvent).toBeCalledWith(testContext.client, 'vaulted-card.preselect');
        }
      );

      test(
        'does not send preselect analytic event when a vaulted card is not preselected',
        () => {
          testContext.model.merchantConfiguration.preselectVaultedPaymentMethod = false;

          new MainView(testContext.mainViewOptions); // eslint-disable-line no-new

          expect(analytics.sendEvent).not.toBeCalledWith(testContext.client, 'vaulted-card.preselect');
        }
      );

      test('sets the PaymentMethodsView as the primary view', done => {
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
            client: testContext.client,
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

      test(
        'sets PaymentOptionsViews as the primary view if there are multiple payment methods',
        () => {
          let mainView;

          testContext.model.supportedPaymentOptions = ['card', 'paypal'];

          mainView = new MainView(testContext.mainViewOptions);

          expect(mainView.primaryView.ID).toBe(PaymentOptionsView.ID);
        }
      );

      test(
        'sets the sheet view as the primary view if there is one payment method',
        () => {
          let mainView;

          testContext.model.supportedPaymentOptions = ['card'];

          mainView = new MainView(testContext.mainViewOptions);

          expect(mainView.primaryView.ID).toBe(CardView.ID);
        }
      );
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

    test('adds the argument to the array of views', () => {
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
          client: testContext.client,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          strings: strings
        };

        jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));
      });
    });

    test('clears any errors', () => {
      const mainView = new MainView(testContext.mainViewOptions);

      jest.spyOn(mainView.model, 'clearError').mockImplementation();

      mainView.setPrimaryView(CardView.ID);

      expect(mainView.model.clearError).toBeCalledTimes(1);
    });

    [
      ApplePayView,
      CardView,
      PaymentMethodsView,
      PaymentOptionsView,
      PayPalView,
      GooglePayView
    ].forEach(View => {
      describe('when given a ' + View.ID + 'view', () => {
        test(
          'shows the selected view by updating the classname of the drop-in wrapper',
          () => {
            const mainView = new MainView(testContext.mainViewOptions);

            mainView.setPrimaryView(View.ID);

            return wait.delay(1).then(() => {
              expect(mainView.element.className).toBe('braintree-show-' + View.ID);
            });
          }
        );
      });

      test('sets the view as the primary view', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(View.ID);

        expect(mainView.primaryView).toBe(mainView.getView(View.ID));
      });

      test('changes the active payment option', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(View.ID);

        expect(mainView.model.getActivePaymentViewId()).toBe(View.ID);
      });
    });

    test(
      'applies no-flexbox data attribute when flexbox is not supported',
      () => {
        const mainView = new MainView(testContext.mainViewOptions);
        const wrapper = mainView.element;

        mainView.supportsFlexbox = false;

        mainView.setPrimaryView(CardView.ID);

        expect(wrapper.dataset.braintreeNoFlexbox).toBe('true');
      }
    );

    test(
      'does not apply no-flexbox data attribute when flexbox is supported',
      () => {
        const mainView = new MainView(testContext.mainViewOptions);
        const wrapper = mainView.element;

        mainView.supportsFlexbox = true;

        mainView.setPrimaryView(CardView.ID);

        expect(wrapper.dataset.braintreeNoFlexbox).toBeFalsy();
      }
    );

    describe('when given a ', () => {
      Object.keys(sheetViews).forEach(sheetViewKey => {
        const SheetView = sheetViews[sheetViewKey];

        describe(SheetView.ID + ' view', () => {
          describe('in a non-guest checkout flow', () => {
            test('shows the additional options button', () => {
              let mainView;

              testContext.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

              mainView = new MainView(testContext.mainViewOptions);
              mainView.setPrimaryView(SheetView.ID);

              expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(false);
            });

            test(
              'does not show the additional options button if there are no vaulted payment methods',
              () => {
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
              }
            );
          });

          describe('in a guest checkout flow', () => {
            test(
              'shows the additional options button if there are multiple payment options',
              () => {
                let mainView;

                testContext.mainViewOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

                mainView = new MainView(testContext.mainViewOptions);
                mainView.setPrimaryView(SheetView.ID);

                expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(false);
              }
            );

            test(
              'does not show the additional options button if there is one payment option',
              () => {
                let mainView;

                testContext.mainViewOptions.model.supportedPaymentOptions = [sheetViewKey];
                testContext.mainViewOptions.merchantConfiguration.authorization = fake.tokenizationKey;

                mainView = new MainView(testContext.mainViewOptions);
                mainView.setPrimaryView(SheetView.ID);

                expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(true);
              }
            );
          });
        });
      });
    });

    describe('when given a PaymentMethodsView', () => {
      test('shows the additional options button', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(PaymentMethodsView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(false);
      });
    });

    describe('when given a PaymentOptionsView', () => {
      test('hides the additional options button', () => {
        const mainView = new MainView(testContext.mainViewOptions);

        mainView.setPrimaryView(PaymentOptionsView.ID);

        expect(mainView.toggle.classList.contains('braintree-hidden')).toBe(true);
      });
    });

    test(
      'calls setPaymentMethodRequestable when there is a payment method requestable',
      () => {
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
      }
    );

    test(
      'does not call setPaymentMethodRequestable when in edit mode',
      () => {
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
      }
    );

    test(
      'calls setPaymentMethodRequestable when there is no payment method requestable',
      () => {
        const mainView = new MainView(testContext.mainViewOptions);

        jest.spyOn(BaseView.prototype, 'getPaymentMethod').mockReturnValue(false);
        jest.spyOn(mainView.model, 'setPaymentMethodRequestable').mockImplementation();

        mainView.setPrimaryView(PaymentOptionsView.ID);

        expect(mainView.model.setPaymentMethodRequestable).toBeCalledWith(expect.objectContaining({
          isRequestable: false
        }));
      }
    );
  });

  describe('showSheetError', () => {
    beforeEach(() => {
      testContext.context = {
        dropinContainer: document.createElement('div'),
        sheetErrorText: document.createElement('div'),
        strings: strings
      };
    });

    test(
      'applies the braintree-sheet--has-error class to dropin container',
      () => {
        MainView.prototype.showSheetError.call(testContext.context, {});

        expect(testContext.context.dropinContainer.classList.contains('braintree-sheet--has-error')).toBe(true);
      }
    );

    test(
      'sets the error text to the expected message for the error code',
      () => {
        const fakeError = {
          code: 'HOSTED_FIELDS_FAILED_TOKENIZATION',
          message: 'Some text we do not use'
        };

        MainView.prototype.showSheetError.call(testContext.context, fakeError);

        expect(testContext.context.sheetErrorText.textContent).toBe('Please check your information and try again.');
      }
    );

    test(
      'shows a fallback error message when the error code is unknown and the error is missing a message',
      () => {
        const fakeError = {
          code: 'AN_UNKNOWN_ERROR'
        };

        MainView.prototype.showSheetError.call(testContext.context, fakeError);

        expect(testContext.context.sheetErrorText.textContent).toBe('Something went wrong on our end.');
      }
    );

    test(
      'shows a developer error message when error is "developerError"',
      () => {
        const fakeError = 'developerError';

        MainView.prototype.showSheetError.call(testContext.context, fakeError);

        expect(testContext.context.sheetErrorText.textContent).toBe('Developer Error: Something went wrong. Check the console for details.');
      }
    );
  });

  describe('hideSheetError', () => {
    beforeEach(() => {
      testContext.context = {
        dropinContainer: document.createElement('div')
      };
    });

    test(
      'removes the braintree-sheet--has-error class from dropin container',
      () => {
        classList.add(testContext.context.dropinContainer, 'braintree-sheet--has-error');

        MainView.prototype.hideSheetError.call(testContext.context);

        expect(testContext.context.dropinContainer.classList.contains('braintree-sheet--has-error')).toBe(false);
      }
    );
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
          _onChangeActiveView: jest.fn(),
          model: model,
          client: fake.client(),
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

    test('calls showSheetError when errorOccurred is emitted', () => {
      const fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      testContext.context.model._emit('errorOccurred', fakeError);

      expect(testContext.context.showSheetError).toBeCalledWith(fakeError);
    });

    test('calls hideSheetError when errorCleared is emitted', () => {
      testContext.context.model._emit('errorCleared');

      expect(testContext.context.hideSheetError).toBeCalled();
    });
  });

  describe('hideLoadingIndicator', () => {
    test('sets the loaded class on dropin container', () => {
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
    test('shows the loading indicator', () => {
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
          client: testContext.client,
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
      test('sets the PaymentMethodsView as the primary view', done => {
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
      test(
        'calls removeActivePaymentMethod if there is an active view',
        done => {
          const optionsView = { ID: 'options', removeActivePaymentMethod: jest.fn() };

          testContext.mainView.addView(optionsView);

          jest.spyOn(testContext.model, 'getActivePaymentViewId').mockReturnValue('options');
          testContext.model._emit('removeActivePaymentMethod');

          setTimeout(() => {
            expect(optionsView.removeActivePaymentMethod).toBeCalledTimes(1);
            done();
          }, CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
        }
      );
    });

    describe('for changeActiveView', () => {
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

        test(
          'adds braintree-methods--active to the payment methods view element',
          () => {
            testContext.model._emit('changeActiveView', {
              newViewId: PaymentMethodsView.ID
            });
            expect(testContext.paymentMethodsContainer.className).toMatch('braintree-methods--active');
          }
        );

        test(
          'removes braintree-sheet--active from the payment sheet element',
          () => {
            testContext.model._emit('changeActiveView', {
              newViewId: PaymentMethodsView.ID
            });
            expect(testContext.sheetElement.className).toEqual(expect.not.arrayContaining(['braintree-sheet--active']));
          }
        );

        test('does not call model.setPaymentMethodRequestable', () => {
          testContext.model._emit('changeActiveView', {
            newViewId: PaymentMethodsView.ID
          });
          expect(testContext.model.setPaymentMethodRequestable).not.toBeCalled();
        });

        test('calls onSelection', () => {
          testContext.model._emit('changeActiveView', {
            newViewId: PaymentMethodsView.ID
          });
          expect(testContext.mainView._views.methods.onSelection).toBeCalledTimes(1);
        });
      });

      describe('when a payment sheet is active', () => {
        beforeEach(() => {
          jest.spyOn(wait, 'delay');
          classList.add(testContext.paymentMethodsContainer, 'braintree-methods--active');
          classList.remove(testContext.sheetElement, 'braintree-sheet--active');
        });

        [CardView, PayPalView].forEach(PaymentSheetView => {
          const ID = PaymentSheetView.ID;

          describe('using a ' + ID + ' sheet', () => {
            beforeEach(() => {
              wait.delay.mockResolvedValue();
              testContext.model._emit('changeActiveView', {
                newViewId: ID
              });
            });

            test('adds braintree-sheet--active to the payment sheet', () => {
              expect(testContext.sheetElement.className).toMatch('braintree-sheet--active');
            });

            test(
              'removes braintree-methods--active from the payment methods view',
              () => {
                expect(testContext.paymentMethodsContainer.className).toEqual(expect.not.arrayContaining(['braintree-methods--active']));
              }
            );

            test('calls model.setPaymentMethodRequestable', () => {
              expect(testContext.model.setPaymentMethodRequestable).toBeCalledWith({
                isRequestable: false
              });
            });

            test('calls onSelection on specific view', () => {
              const view = testContext.mainView._views[ID];

              expect(view.onSelection).toBeCalledTimes(1);
            });
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
          client: testContext.client,
          model: model,
          merchantConfiguration: {
            authorization: fake.tokenizationKey
          },
          strings: strings
        };
        jest.spyOn(PayPalCheckout, 'create').mockImplementation(yields(null, {}));
      });
    });

    test(
      'has an click event listener that calls toggleAdditionalOptions',
      () => {
        let mainView;

        jest.spyOn(MainView.prototype, 'toggleAdditionalOptions').mockImplementation();

        mainView = new MainView(testContext.mainViewOptions);

        mainView.toggle.click();

        expect(mainView.toggleAdditionalOptions).toBeCalled();
      }
    );

    test('hides toggle', () => {
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

      test('sets the payment option as the active payment view', () => {
        expect(testContext.mainView.model.getActivePaymentViewId()).toBe(CardView.ID);
      });

      test('exposes the payment sheet view', () => {
        expect(testContext.wrapper.className).toMatch('braintree-show-' + CardView.ID);
      });
    });

    describe('when there are multiple payment options and a payment sheet view is active', () => {
      beforeEach(() => {
        testContext.mainViewOptions.model.supportedPaymentOptions = ['card', 'paypal'];
      });

      describe('and there are no payment methods available', () => {
        test('sets the PaymentOptionsView as the primary view', () => {
          const mainView = new MainView(testContext.mainViewOptions);

          jest.spyOn(mainView, 'setPrimaryView');
          mainView.setPrimaryView(CardView.ID);
          mainView.toggle.click();

          return wait.delay(1).then(() => {
            expect(mainView.setPrimaryView).toBeCalledWith(PaymentOptionsView.ID);
            expect(testContext.wrapper.className).toMatch('braintree-show-' + PaymentOptionsView.ID);
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

        test('sets the PaymentMethodsView as the primary view', () => {
          expect(testContext.mainView.setPrimaryView).toBeCalledWith(PaymentMethodsView.ID, expect.anything());
          expect(testContext.wrapper.className).toMatch('braintree-show-' + PaymentMethodsView.ID);
          expect(testContext.mainView.model.getActivePaymentViewId()).toBe(PaymentMethodsView.ID);
        });

        test('exposes the PaymentOptionsView', () => {
          expect(testContext.wrapper.className).toMatch('braintree-show-' + PaymentOptionsView.ID);
        });

        test('hides the toggle', () => {
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
          client: testContext.client,
          merchantConfiguration: {
            authorization: 'fake_tokenization_key'
          },
          strings: strings
        });
      });
    });

    test('requests payment method from the primary view', () => {
      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue({});

      testContext.mainView.requestPaymentMethod();

      expect(testContext.mainView.primaryView.requestPaymentMethod).toBeCalled();
    });

    test('calls callback with error when error occurs', () => {
      const fakeError = new Error('A bad thing happened');

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockRejectedValue(fakeError);

      return testContext.mainView.requestPaymentMethod().then(() => {
        throw new Error('should not resolve');
      }).catch(err => {
        expect(err).toBe(fakeError);
        expect(analytics.sendEvent).toBeCalledWith(testContext.client, 'request-payment-method.error');
      });
    });

    test('calls callback with payload when successful', () => {
      const stubPaymentMethod = { foo: 'bar' };

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue(stubPaymentMethod);

      return testContext.mainView.requestPaymentMethod().then(payload => {
        expect(payload).toBe(stubPaymentMethod);
      });
    });

    test('sends analytics event for successful CreditCard', () => {
      const stubPaymentMethod = { type: 'CreditCard' };

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue(stubPaymentMethod);

      return testContext.mainView.requestPaymentMethod().then(() => {
        expect(analytics.sendEvent).toBeCalledWith(testContext.client, 'request-payment-method.card');
      });
    });

    test('sends analytics event for successful PayPalAccount', () => {
      const stubPaymentMethod = { type: 'PayPalAccount' };

      jest.spyOn(CardView.prototype, 'requestPaymentMethod').mockResolvedValue(stubPaymentMethod);

      return testContext.mainView.requestPaymentMethod().then(() => {
        expect(analytics.sendEvent).toBeCalledWith(testContext.client, 'request-payment-method.paypal');
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
            client: testContext.client,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });
        });
      });

      test('requests payment method from payment methods view', () => {
        const paymentMethodsViews = testContext.mainView.getView(PaymentMethodsView.ID);

        testContext.mainView.model.changeActiveView(PaymentMethodsView.ID);
        jest.spyOn(paymentMethodsViews, 'requestPaymentMethod').mockResolvedValue({});

        return testContext.mainView.requestPaymentMethod().then(() => {
          expect(paymentMethodsViews.requestPaymentMethod).toBeCalled();
        });
      });

      test(
        'requests payment method from card view when additional options are shown',
        () => {
          const cardView = testContext.mainView.getView(CardView.ID);

          jest.spyOn(cardView, 'requestPaymentMethod').mockResolvedValue({});
          testContext.mainView.toggleAdditionalOptions();

          return testContext.mainView.requestPaymentMethod().then(() => {
            expect(cardView.requestPaymentMethod).toBeCalled();
          });
        }
      );
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

    test('calls teardown on each view', () => {
      const payWithCardView = testContext.context._views['braintree-card-view'];

      return MainView.prototype.teardown.call(testContext.context).then(() => {
        expect(payWithCardView.teardown).toBeCalledTimes(1);
      });
    });

    test(
      'waits to call callback until asynchronous teardowns complete',
      () => {
        const payWithCardView = testContext.context._views['braintree-card-view'];

        payWithCardView.teardown = () => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve();
            }, 300);
          });
        };

        return MainView.prototype.teardown.call(testContext.context);
      }
    );

    test('calls callback with error from teardown function', () => {
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
    test('returns options view elements property', () => {
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
    test('displays disable wrapper', () => {
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
    test('hides disable wrapper', () => {
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
          client: testContext.client,
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

    test('enables edit mode on the payment methods view', () => {
      jest.spyOn(testContext.mainView.paymentMethodsViews, 'enableEditMode').mockImplementation();

      testContext.mainView.enableEditMode();

      expect(testContext.mainView.paymentMethodsViews.enableEditMode).toBeCalledTimes(1);
    });

    test('hides the toggle button', () => {
      jest.spyOn(testContext.mainView, 'hideToggle').mockImplementation();

      testContext.mainView.enableEditMode();

      expect(testContext.mainView.hideToggle).toBeCalledTimes(1);
    });

    test('sets payment method requestable to false', () => {
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
          client: testContext.client,
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

    test('disables edit mode on the payment methods view', () => {
      jest.spyOn(testContext.mainView.paymentMethodsViews, 'disableEditMode').mockImplementation();

      testContext.mainView.disableEditMode();

      expect(testContext.mainView.paymentMethodsViews.disableEditMode).toBeCalledTimes(1);
    });

    test('shows the toggle button', () => {
      jest.spyOn(testContext.mainView, 'showToggle').mockImplementation();

      testContext.mainView.disableEditMode();

      expect(testContext.mainView.showToggle).toBeCalledTimes(1);
    });

    test(
      'sets payment method requestable to true when a payment method is available',
      () => {
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
      }
    );

    test(
      'sets payment method requestable to false when no payment methods are available',
      () => {
        jest.spyOn(BaseView.prototype, 'getPaymentMethod').mockReturnValue(false);
        jest.spyOn(testContext.mainView.model, 'setPaymentMethodRequestable').mockImplementation();

        testContext.mainView.disableEditMode();

        expect(testContext.mainView.model.setPaymentMethodRequestable).toBeCalledWith(expect.objectContaining({
          isRequestable: false
        }));
      }
    );
  });

  describe('openConfirmPaymentMethodDeletionDialog', () => {
    beforeEach(() => {
      const element = document.createElement('div');
      const model = fake.model();

      element.innerHTML = templateHTML;

      return model.initialize().then(() => {
        model.supportedPaymentOptions = ['card'];
        testContext.mainViewOptions = {
          client: testContext.client,
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

    test('updates delete confirmation view with payment method', () => {
      const paymentMethod = { nonce: 'a-nonce' };

      testContext.mainView.openConfirmPaymentMethodDeletionDialog(paymentMethod);

      expect(testContext.mainView.deleteConfirmationView.applyPaymentMethod).toBeCalledTimes(1);
      expect(testContext.mainView.deleteConfirmationView.applyPaymentMethod).toBeCalledWith(paymentMethod);
    });

    test('sets primary view to delete confirmation view', () => {
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
          client: testContext.client,
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

    test('sets primary view to methods view', () => {
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
          client: testContext.client,
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

    test('calls showLoadingIndicator', () => {
      jest.spyOn(testContext.mainView, 'showLoadingIndicator').mockImplementation();
      testContext.mainView.startVaultedPaymentMethodDeletion();
      expect(testContext.mainView.showLoadingIndicator).toBeCalledTimes(1);
    });

    test('removes classes from dropin wrapper', () => {
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
          client: testContext.client,
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

    test('refreshes payment methods view', () => {
      jest.spyOn(testContext.mainView.paymentMethodsViews, 'refreshPaymentMethods').mockImplementation();

      return testContext.mainView.finishVaultedPaymentMethodDeletion().then(() => {
        expect(testContext.mainView.paymentMethodsViews.refreshPaymentMethods).toBeCalledTimes(1);
      });
    });

    test('calls hideLoadingIndicator after half a second', () => {
      jest.spyOn(testContext.mainView, 'hideLoadingIndicator').mockImplementation();

      return testContext.mainView.finishVaultedPaymentMethodDeletion().then(() => {
        expect(testContext.mainView.hideLoadingIndicator).toBeCalledTimes(1);
      });
    });

    test('sends customer back to their initial view', () => {
      jest.spyOn(testContext.mainView, '_sendToDefaultView').mockImplementation();

      return testContext.mainView.finishVaultedPaymentMethodDeletion().then(() => {
        expect(testContext.mainView._sendToDefaultView).toBeCalledTimes(1);
      });
    });

    test('re-enables edit mode when it errors', () => {
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

    test('shows sheet error when it errors', () => {
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

    test(
      'sends customer back to their initial view if erros but there are no saved payment methods',
      () => {
        const err = new Error('some error');

        jest.spyOn(testContext.mainView, '_sendToDefaultView').mockImplementation();
        jest.spyOn(testContext.mainView.model, 'getPaymentMethods').mockReturnValue([]);

        return testContext.mainView.finishVaultedPaymentMethodDeletion(err).then(() => {
          expect(testContext.mainView._sendToDefaultView).toBeCalledTimes(1);
        });
      }
    );
  });
});
