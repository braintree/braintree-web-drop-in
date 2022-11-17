
const BaseView = require('../../../src/views/base-view');
const CardView = require('../../../src/views/payment-sheet-views/card-view');
const PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
const PaymentMethodsView = require('../../../src/views/payment-methods-view');
const PaymentMethodView = require('../../../src/views/payment-method-view');
const DropinError = require('../../../src/lib/dropin-error');
const classList = require('@braintree/class-list');
const fake = require('../../helpers/fake');
const throwIfResolves = require('../../helpers/throw-if-resolves');
const fs = require('fs');
const strings = require('../../../src/translations/en_US');

const mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

describe('PaymentMethodsView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.element = document.createElement('div');
    testContext.element.innerHTML = mainHTML;
    jest.spyOn(CardView, 'isEnabled').mockResolvedValue(true);
    jest.spyOn(PayPalView, 'isEnabled').mockResolvedValue(true);
  });

  describe('Constructor', () => {
    beforeEach(() => {
      jest.spyOn(PaymentMethodsView.prototype, '_initialize').mockImplementation();
    });

    test('inherits from BaseView', () => {
      expect(new PaymentMethodsView({})).toBeInstanceOf(BaseView);
    });

    test('calls _initialize', () => {
      new PaymentMethodsView({}); // eslint-disable-line no-new

      expect(PaymentMethodsView.prototype._initialize).toBeCalledTimes(1);
    });
  });

  describe('_initialize', () => {
    test('adds supported vaulted payment methods', () => {
      let model, paymentMethodsViews;
      const modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = { flow: 'vault' };

      model = fake.model(modelOptions);
      model.getVaultedPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      return model.initialize().then(() => {
        paymentMethodsViews = new PaymentMethodsView({
          element: testContext.element,
          model: model,
          merchantConfiguration: {
            paypal: modelOptions.merchantConfiguration.paypal,
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        expect(paymentMethodsViews.views.length).toBe(2);
        expect(paymentMethodsViews.container.childElementCount).toBe(2);
      });
    });

    test('puts default payment method as first item in list', () => {
      let firstChildLabel, model, paymentMethodsViews;
      const creditCard = {
        details: { cardType: 'Visa' },
        type: 'CreditCard'
      };
      const paypalAccount = {
        details: { email: 'wow@meow.com' },
        type: 'PayPalAccount'
      };
      const modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = { flow: 'vault' };

      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([paypalAccount, creditCard]);

      return model.initialize().then(() => {
        paymentMethodsViews = new PaymentMethodsView({
          element: testContext.element,
          model: model,
          merchantConfiguration: modelOptions.merchantConfiguration,
          strings: strings
        });

        firstChildLabel = paymentMethodsViews.container.firstChild.querySelector('.braintree-method__label .braintree-method__label--small');

        expect(firstChildLabel.textContent).toBe(strings.PayPal);
      });
    });

    test('does not add payment methods if there are none', () => {
      let model, methodsContainer, paymentMethodsViews;
      const modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });

      model = fake.model(modelOptions);

      return model.initialize().then(() => {
        methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
        paymentMethodsViews = new PaymentMethodsView({
          element: testContext.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        expect(paymentMethodsViews.views.length).toBe(0);
        expect(methodsContainer.children.length).toBe(0);
      });
    });

    test(
      'changes the payment method view when the active payment method changes',
      () => {
        let model, paymentMethodsViews;
        const fakePaymentMethod = { baz: 'qux' };
        const modelOptions = fake.modelOptions();

        jest.useFakeTimers();

        modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
        model = fake.model(modelOptions);

        model.getVaultedPaymentMethods.mockResolvedValue([{ foo: 'bar' }, fakePaymentMethod]);

        return model.initialize().then(() => {
          model.asyncDependencyReady('card');
          model.changeActivePaymentMethod({ foo: 'bar' });

          paymentMethodsViews = new PaymentMethodsView({
            element: testContext.element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });

          paymentMethodsViews._addPaymentMethod(fakePaymentMethod);

          model.changeActivePaymentMethod(fakePaymentMethod);

          expect(paymentMethodsViews.activeMethodView.paymentMethod).toBe(fakePaymentMethod);
          jest.advanceTimersByTime(1001);
          expect(paymentMethodsViews.activeMethodView.element.className).toMatch('braintree-method--active');
          jest.advanceTimersByTime();
        });
      }
    );

    test(
      'updates the paying with label when the active payment method changes',
      () => {
        let model, paymentMethodsViews;
        const fakeCard = { type: 'CreditCard', details: { lastTwo: 22 }};
        const fakePayPal = { type: 'PayPalAccount', details: { email: 'buyer@braintreepayments.com' }};
        const modelOptions = fake.modelOptions();

        modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
        model = fake.model(modelOptions);

        model.getVaultedPaymentMethods.mockResolvedValue([fakePayPal, fakeCard]);

        return model.initialize().then(() => {
          model.isGuestCheckout = false;

          paymentMethodsViews = new PaymentMethodsView({
            element: testContext.element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });

          paymentMethodsViews._addPaymentMethod(fakePayPal);
          paymentMethodsViews._addPaymentMethod(fakeCard);

          model.changeActivePaymentMethod(fakeCard);
          expect(paymentMethodsViews.getElementById('methods-label').textContent).toBe('Paying with Card');

          model.changeActivePaymentMethod(fakePayPal);
          expect(paymentMethodsViews.getElementById('methods-label').textContent).toBe('Paying with PayPal');
        });
      }
    );
  });

  describe('_addPaymentMethod', () => {
    beforeEach(() => {
      const div = document.createElement('div');

      div.innerHTML = mainHTML;
      testContext.element = div.querySelector('.braintree-dropin');
      testContext.fakePaymentMethod = {
        type: 'CreditCard',
        details: { lastTwo: '11' }
      };
    });

    test(
      'does not tear down other payment methods in non-guest checkout',
      () => {
        jest.spyOn(PaymentMethodView.prototype, 'teardown');

        let model, paymentMethodsViews;
        const methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
        const modelOptions = fake.modelOptions();

        modelOptions.client.getConfiguration.mockReturnValue({
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        });

        modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
        model = fake.model(modelOptions);

        model.getVaultedPaymentMethods.mockResolvedValue([testContext.fakePaymentMethod]);

        return model.initialize().then(() => {
          paymentMethodsViews = new PaymentMethodsView({
            element: testContext.element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });

          model.addPaymentMethod({ foo: 'bar' });

          expect(paymentMethodsViews.views.length).toBe(2);
          expect(methodsContainer.childElementCount).toBe(2);
          expect(PaymentMethodView.prototype.teardown).not.toBeCalled();
        });
      }
    );

    test('tears down other payment methods in guest checkout', () => {
      jest.spyOn(PaymentMethodView.prototype, 'teardown');

      let model, paymentMethodsViews;
      const methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
      const modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([testContext.fakePaymentMethod]);

      return model.initialize().then(() => {
        paymentMethodsViews = new PaymentMethodsView({
          element: testContext.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientToken
          },
          strings: strings
        });

        model.addPaymentMethod({ foo: 'bar' });

        expect(paymentMethodsViews.views.length).toBe(1);
        expect(methodsContainer.childElementCount).toBe(1);
        expect(PaymentMethodView.prototype.teardown).toBeCalledTimes(1);
      });
    });

    test(
      'does not try to remove a payment method if none exists in guest checkout',
      () => {
        let model, paymentMethodsViews;
        const methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
        const modelOptions = fake.modelOptions();

        modelOptions.merchantConfiguration.authorization = fake.clientToken;
        model = fake.model(modelOptions);

        return model.initialize().then(() => {
          paymentMethodsViews = new PaymentMethodsView({
            element: testContext.element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientToken
            },
            strings: strings
          });

          model.addPaymentMethod({ foo: 'bar' });

          expect(paymentMethodsViews.views.length).toBe(1);
          expect(methodsContainer.childElementCount).toBe(1);
        });
      }
    );
  });

  describe('removeActivePaymentMethod', () => {
    beforeEach(() => {
      let model;
      const modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      model = fake.model(modelOptions);

      return model.initialize().then(() => {
        testContext.paymentMethodsViews = new PaymentMethodsView({
          element: testContext.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientToken
          },
          strings: strings
        });
        testContext.activeMethodView = {
          setActive: jest.fn()
        };

        testContext.paymentMethodsViews.activeMethodView = testContext.activeMethodView;
        jest.spyOn(classList, 'add').mockImplementation();
      });
    });

    test('sets the active method view to not active', () => {
      testContext.paymentMethodsViews.removeActivePaymentMethod();

      expect(testContext.activeMethodView.setActive).toBeCalledTimes(1);
      expect(testContext.activeMethodView.setActive).toBeCalledWith(false);
    });

    test('removes active method view from instance', () => {
      testContext.paymentMethodsViews.removeActivePaymentMethod();

      expect(testContext.paymentMethodsViews.activeMethodView).toBeFalsy();
    });

    test(
      'applies class to heading label to hide it when no payment methods are selected',
      () => {
        testContext.paymentMethodsViews.removeActivePaymentMethod();

        expect(classList.add).toBeCalledTimes(1);
        expect(classList.add).toBeCalledWith(expect.anything(), 'braintree-no-payment-method-selected');
      }
    );
  });

  describe('_removePaymentMethod', () => {
    beforeEach(() => {
      const div = document.createElement('div');

      div.innerHTML = mainHTML;
      testContext.element = div.querySelector('.braintree-dropin');
      testContext.element.id = 'fake-method';
      testContext.fakePaymentMethod = {
        type: 'CreditCard',
        details: { lastTwo: '11' }
      };

      testContext.model = fake.model();

      return testContext.model.initialize().then(() => {
        testContext.paymentMethodsViews = new PaymentMethodsView({
          element: div,
          model: testContext.model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });
        testContext.paymentMethodsViews.views.push({
          paymentMethod: testContext.fakePaymentMethod,
          element: testContext.element,
          teardown: jest.fn()
        });
        testContext.paymentMethodsViews.container = {
          removeChild: jest.fn()
        };
        testContext.paymentMethodsViews._headingLabel = {
          innerHTML: 'Paying with'
        };
      });
    });

    test('removes specified payment method from views', () => {
      expect(testContext.paymentMethodsViews.views[0].paymentMethod).toBe(testContext.fakePaymentMethod);

      testContext.paymentMethodsViews._removePaymentMethod(testContext.fakePaymentMethod);

      expect(testContext.paymentMethodsViews.views[0]).toBeFalsy();
    });

    test('tears down specified payment method', () => {
      const teardown = testContext.paymentMethodsViews.views[0].teardown;

      testContext.paymentMethodsViews._removePaymentMethod(testContext.fakePaymentMethod);

      expect(teardown).toBeCalledTimes(1);
    });

    test('ignores payment methods that are not the exact object', () => {
      const copy = JSON.parse(JSON.stringify(testContext.fakePaymentMethod));

      testContext.paymentMethodsViews._removePaymentMethod(copy);

      expect(testContext.paymentMethodsViews.views[0].paymentMethod).toBe(testContext.fakePaymentMethod);
      expect(testContext.paymentMethodsViews.container.removeChild).not.toBeCalled();
    });
  });

  describe('requestPaymentMethod', () => {
    test(
      'resolves a promise with the active payment method from the active method view',
      () => {
        let paymentMethodsViews;
        const fakeActiveMethodView = {
          paymentMethod: { foo: 'bar' }
        };
        const element = document.createElement('div');
        const model = fake.model();

        return model.initialize().then(() => {
          element.innerHTML = mainHTML;
          paymentMethodsViews = new PaymentMethodsView({
            element: element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });

          paymentMethodsViews.activeMethodView = fakeActiveMethodView;

          return paymentMethodsViews.requestPaymentMethod();
        }).then(payload => {
          expect(payload).toBe(fakeActiveMethodView.paymentMethod);
        });
      }
    );

    test('rejects if there is no activeMethodView', () => {
      let paymentMethodsViews;
      const element = document.createElement('div');
      const model = fake.model();

      return model.initialize().then(() => {
        element.innerHTML = mainHTML;
        paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        return paymentMethodsViews.requestPaymentMethod();
      }).then(throwIfResolves).catch(err => {
        expect(err).toBeInstanceOf(DropinError);
        expect(err.message).toBe('No payment method is available.');
      });
    });

    test('rejects if model is in edit mode', () => {
      let paymentMethodsViews;
      const fakeActiveMethodView = {
        paymentMethod: { foo: 'bar' }
      };
      const element = document.createElement('div');
      const model = fake.model();

      return model.initialize().then(() => {
        element.innerHTML = mainHTML;
        paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        paymentMethodsViews.activeMethodView = fakeActiveMethodView;
        jest.spyOn(model, 'isInEditMode').mockReturnValue(true);

        return paymentMethodsViews.requestPaymentMethod();
      }).then(throwIfResolves).catch(err => {
        expect(err).toBeInstanceOf(DropinError);
        expect(err.message).toBe('No payment method is available.');
      });
    });
  });

  describe('enableEditMode', () => {
    test('calls enableEditMode on each payment method view', () => {
      let model, paymentMethodsViews;
      const modelOptions = fake.modelOptions();
      const element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = { flow: 'vault' };

      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      return model.initialize().then(() => {
        paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: model,
          merchantConfiguration: {
            paypal: modelOptions.merchantConfiguration.paypal,
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        jest.spyOn(paymentMethodsViews.views[0], 'enableEditMode').mockImplementation();
        jest.spyOn(paymentMethodsViews.views[1], 'enableEditMode').mockImplementation();

        paymentMethodsViews.enableEditMode();

        expect(paymentMethodsViews.views[0].enableEditMode).toBeCalledTimes(1);
        expect(paymentMethodsViews.views[1].enableEditMode).toBeCalledTimes(1);
      });
    });
  });

  describe('disableEditMode', () => {
    test('calls disableEditMode on each payment method view', () => {
      let model, paymentMethodsViews;
      const modelOptions = fake.modelOptions();
      const element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = { flow: 'vault' };

      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      return model.initialize().then(() => {
        paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: model,
          merchantConfiguration: {
            paypal: modelOptions.merchantConfiguration.paypal,
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        jest.spyOn(paymentMethodsViews.views[0], 'disableEditMode').mockImplementation();
        jest.spyOn(paymentMethodsViews.views[1], 'disableEditMode').mockImplementation();

        paymentMethodsViews.disableEditMode();

        expect(paymentMethodsViews.views[0].disableEditMode).toBeCalledTimes(1);
        expect(paymentMethodsViews.views[1].disableEditMode).toBeCalledTimes(1);
      });
    });
  });

  describe('refreshPaymentMethods', () => {
    beforeEach(() => {
      const modelOptions = fake.modelOptions();
      const element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = { flow: 'vault' };

      testContext.model = fake.model(modelOptions);

      testContext.model.getVaultedPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }},
        { type: 'VenmoAccount', details: { email: 'wow@example.com' }}
      ]);

      return testContext.model.initialize().then(() => {
        testContext.paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: testContext.model,
          merchantConfiguration: {
            paypal: modelOptions.merchantConfiguration.paypal,
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });
        jest.spyOn(testContext.model, 'getPaymentMethods').mockReturnValue([
          { type: 'CreditCard', details: { lastTwo: '11' }},
          { type: 'VenmoAccount', details: { email: 'wow@example.com' }}
        ]);
      });
    });

    test('tears down all payment method views', () => {
      jest.spyOn(PaymentMethodView.prototype, 'teardown').mockImplementation();

      testContext.paymentMethodsViews.refreshPaymentMethods();

      expect(PaymentMethodView.prototype.teardown).toBeCalledTimes(3);
    });

    test(
      'calls addPaymentMethod for each payment method on the model',
      () => {
        jest.spyOn(testContext.paymentMethodsViews, '_addPaymentMethod').mockImplementation();

        testContext.paymentMethodsViews.refreshPaymentMethods();

        expect(testContext.paymentMethodsViews._addPaymentMethod).toBeCalledTimes(2);
      }
    );
  });
});
