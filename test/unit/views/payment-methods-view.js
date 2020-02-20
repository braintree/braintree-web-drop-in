'use strict';

var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
var PaymentMethodsView = require('../../../src/views/payment-methods-view');
var DropinError = require('../../../src/lib/dropin-error');
var classList = require('@braintree/class-list');
var fake = require('../../helpers/fake');
var throwIfResolves = require('../../helpers/throw-if-resolves');
var fs = require('fs');
var strings = require('../../../src/translations/en_US');

var mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

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
      var model, paymentMethodsViews;
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = fake.model(modelOptions);
      model.getVaultedPaymentMethods.mockResolvedValue([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      return model.initialize().then(function () {
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
      var firstChildLabel, model, paymentMethodsViews;
      var creditCard = {
        details: {cardType: 'Visa'},
        type: 'CreditCard'
      };
      var paypalAccount = {
        details: {email: 'wow@meow.com'},
        type: 'PayPalAccount'
      };
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([paypalAccount, creditCard]);

      return model.initialize().then(function () {
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
      var model, methodsContainer, paymentMethodsViews;
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });

      model = fake.model(modelOptions);

      return model.initialize().then(function () {
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
        var model, paymentMethodsViews;
        var fakePaymentMethod = {baz: 'qux'};
        var modelOptions = fake.modelOptions();

        jest.useFakeTimers();

        modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
        model = fake.model(modelOptions);

        model.getVaultedPaymentMethods.mockResolvedValue([{foo: 'bar'}, fakePaymentMethod]);

        return model.initialize().then(function () {
          model.changeActivePaymentMethod({foo: 'bar'});

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
        var model, paymentMethodsViews;
        var fakeCard = {type: 'CreditCard', details: {lastTwo: 22}};
        var fakePayPal = {type: 'PayPalAccount', details: {email: 'buyer@braintreepayments.com'}};
        var modelOptions = fake.modelOptions();

        modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
        model = fake.model(modelOptions);

        model.getVaultedPaymentMethods.mockResolvedValue([fakePayPal, fakeCard]);

        return model.initialize().then(function () {
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
      var div = document.createElement('div');

      div.innerHTML = mainHTML;
      testContext.element = div.querySelector('.braintree-dropin');
      testContext.fakePaymentMethod = {
        type: 'CreditCard',
        details: {lastTwo: '11'}
      };
    });

    test(
      'does not remove other payment methods in non-guest checkout',
      () => {
        var model, paymentMethodsViews;
        var methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
        var modelOptions = fake.modelOptions();

        modelOptions.client.getConfiguration.mockReturnValue({
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        });

        modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
        model = fake.model(modelOptions);

        model.getVaultedPaymentMethods.mockResolvedValue([testContext.fakePaymentMethod]);

        return model.initialize().then(function () {
          paymentMethodsViews = new PaymentMethodsView({
            element: testContext.element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientTokenWithCustomerID
            },
            strings: strings
          });

          model.addPaymentMethod({foo: 'bar'});

          expect(paymentMethodsViews.views.length).toBe(2);
          expect(methodsContainer.childElementCount).toBe(2);
        });
      }
    );

    test('removes other payment methods in guest checkout', () => {
      var model, paymentMethodsViews;
      var methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
      var modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([testContext.fakePaymentMethod]);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: testContext.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientToken
          },
          strings: strings
        });

        model.addPaymentMethod({foo: 'bar'});

        expect(paymentMethodsViews.views.length).toBe(1);
        expect(methodsContainer.childElementCount).toBe(1);
      });
    });

    test(
      'does not try to remove a payment method if none exists in guest checkout',
      () => {
        var model, paymentMethodsViews;
        var methodsContainer = testContext.element.querySelector('[data-braintree-id="methods-container"]');
        var modelOptions = fake.modelOptions();

        modelOptions.merchantConfiguration.authorization = fake.clientToken;
        model = fake.model(modelOptions);

        return model.initialize().then(function () {
          paymentMethodsViews = new PaymentMethodsView({
            element: testContext.element,
            model: model,
            merchantConfiguration: {
              authorization: fake.clientToken
            },
            strings: strings
          });

          model.addPaymentMethod({foo: 'bar'});

          expect(paymentMethodsViews.views.length).toBe(1);
          expect(methodsContainer.childElementCount).toBe(1);
        });
      }
    );
  });

  describe('removeActivePaymentMethod', () => {
    beforeEach(() => {
      var model;
      var modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      model = fake.model(modelOptions);

      return model.initialize().then(function () {
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
      var div = document.createElement('div');

      div.innerHTML = mainHTML;
      testContext.element = div.querySelector('.braintree-dropin');
      testContext.element.id = 'fake-method';
      testContext.fakePaymentMethod = {
        type: 'CreditCard',
        details: {lastTwo: '11'}
      };

      testContext.model = fake.model();

      return testContext.model.initialize().then(function () {
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
          element: testContext.element
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

    test('removes specified payment method div from DOM', () => {
      testContext.paymentMethodsViews._removePaymentMethod(testContext.fakePaymentMethod);

      expect(testContext.paymentMethodsViews.container.removeChild).toBeCalledTimes(1);
      expect(testContext.paymentMethodsViews.container.removeChild).toBeCalledWith(testContext.element);
    });

    test('ignores payment methods that are not the exact object', () => {
      var copy = JSON.parse(JSON.stringify(testContext.fakePaymentMethod));

      testContext.paymentMethodsViews._removePaymentMethod(copy);

      expect(testContext.paymentMethodsViews.views[0].paymentMethod).toBe(testContext.fakePaymentMethod);
      expect(testContext.paymentMethodsViews.container.removeChild).not.toBeCalled();
    });
  });

  describe('requestPaymentMethod', () => {
    test(
      'resolves a promise with the active payment method from the active method view',
      () => {
        var paymentMethodsViews;
        var fakeActiveMethodView = {
          paymentMethod: {foo: 'bar'}
        };
        var element = document.createElement('div');
        var model = fake.model();

        return model.initialize().then(function () {
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
        }).then(function (payload) {
          expect(payload).toBe(fakeActiveMethodView.paymentMethod);
        });
      }
    );

    test('rejects if there is no activeMethodView', () => {
      var paymentMethodsViews;
      var element = document.createElement('div');
      var model = fake.model();

      return model.initialize().then(function () {
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
      }).then(throwIfResolves).catch(function (err) {
        expect(err).toBeInstanceOf(DropinError);
        expect(err.message).toBe('No payment method is available.');
      });
    });

    test('rejects if model is in edit mode', () => {
      var paymentMethodsViews;
      var fakeActiveMethodView = {
        paymentMethod: {foo: 'bar'}
      };
      var element = document.createElement('div');
      var model = fake.model();

      return model.initialize().then(function () {
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
      }).then(throwIfResolves).catch(function (err) {
        expect(err).toBeInstanceOf(DropinError);
        expect(err.message).toBe('No payment method is available.');
      });
    });
  });

  describe('enableEditMode', () => {
    test('calls enableEditMode on each payment method view', () => {
      var model, paymentMethodsViews;
      var modelOptions = fake.modelOptions();
      var element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      return model.initialize().then(function () {
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
      var model, paymentMethodsViews;
      var modelOptions = fake.modelOptions();
      var element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = fake.model(modelOptions);

      model.getVaultedPaymentMethods.mockResolvedValue([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      return model.initialize().then(function () {
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
      var modelOptions = fake.modelOptions();
      var element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      testContext.model = fake.model(modelOptions);

      testContext.model.getVaultedPaymentMethods.mockResolvedValue([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}},
        {type: 'VenmoAccount', details: {email: 'wow@example.com'}}
      ]);


      return testContext.model.initialize().then(function () {
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
          {type: 'CreditCard', details: {lastTwo: '11'}},
          {type: 'VenmoAccount', details: {email: 'wow@example.com'}}
        ]);

      });
    });

    test('removes all payment method views from container', () => {
      jest.spyOn(testContext.paymentMethodsViews.container, 'removeChild').mockImplementation();

      testContext.paymentMethodsViews.refreshPaymentMethods();

      expect(testContext.paymentMethodsViews.container.removeChild).toBeCalledTimes(3);
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
