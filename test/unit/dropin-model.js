
const vaultManager = require('braintree-web/vault-manager');
const analytics = require('../../src/lib/analytics');
const DropinModel = require('../../src/dropin-model');
const ApplePayView = require('../../src/views/payment-sheet-views/apple-pay-view');
const CardView = require('../../src/views/payment-sheet-views/card-view');
const GooglePayView = require('../../src/views/payment-sheet-views/google-pay-view');
const PayPalView = require('../../src/views/payment-sheet-views/paypal-view');
const PayPalCreditView = require('../../src/views/payment-sheet-views/paypal-credit-view');
const VenmoView = require('../../src/views/payment-sheet-views/venmo-view');
const EventEmitter = require('@braintree/event-emitter');
const isHTTPS = require('../../src/lib/is-https');
const fake = require('../helpers/fake');
const throwIfResolves = require('../helpers/throw-if-resolves');

describe('DropinModel', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.configuration = fake.configuration();

    testContext.vaultManager = {
      fetchPaymentMethods: jest.fn().mockResolvedValue([]),
      deletePaymentMethod: jest.fn().mockResolvedValue()
    };
    jest.spyOn(vaultManager, 'create').mockResolvedValue(testContext.vaultManager);
    testContext.modelOptions = {
      container: document.createElement('div'),
      client: fake.client(testContext.configuration),
      componentID: 'foo123',
      merchantConfiguration: {
        authorization: fake.clientToken,
        paypal: {},
        venmo: {}
      },
      paymentMethods: []
    };
    jest.spyOn(analytics, 'sendEvent').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    jest.spyOn(isHTTPS, 'isHTTPS').mockReturnValue(true);
    global.ApplePaySession = jest.fn().mockReturnValue({});
    global.ApplePaySession.canMakePayments = jest.fn().mockReturnValue(true);

    jest.spyOn(ApplePayView, 'isEnabled').mockResolvedValue(true);
    jest.spyOn(CardView, 'isEnabled').mockResolvedValue(true);
    jest.spyOn(GooglePayView, 'isEnabled').mockResolvedValue(true);
    jest.spyOn(PayPalView, 'isEnabled').mockResolvedValue(true);
    jest.spyOn(PayPalCreditView, 'isEnabled').mockResolvedValue(true);
    jest.spyOn(VenmoView, 'isEnabled').mockResolvedValue(true);
  });

  describe('Constructor', () => {
    test('inherits from EventEmitter', () => {
      expect(new DropinModel(testContext.modelOptions)).toBeInstanceOf(EventEmitter);
    });

    test('sets componentID', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model.componentID).toBe(testContext.modelOptions.componentID);
    });

    test('sets merchantConfiguration', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model.merchantConfiguration).toBe(testContext.modelOptions.merchantConfiguration);
    });

    test('it sets isInShadowDom to false when the container is not in the shadow DOM', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model.isInShadowDom).toBe(false);
    });

    test('it sets isInShadowDom to true when the container is in the shadow DOM', () => {
      const container = document.createElement('div');
      const insideShadowDOMWrapper = document.createElement('div');
      const dropinContainer = document.createElement('div');
      const shadowDom = container.attachShadow({ mode: 'open' });

      insideShadowDOMWrapper.appendChild(dropinContainer);
      shadowDom.appendChild(insideShadowDOMWrapper);

      testContext.modelOptions.container = dropinContainer;

      const model = new DropinModel(testContext.modelOptions);

      expect(model.isInShadowDom).toBe(true);
    });

    test('does not set payment methods as initializing when merchant configuration has falsy values', () => {
      // eslint-disable-next-line no-undefined
      testContext.modelOptions.merchantConfiguration.venmo = undefined;
      testContext.modelOptions.merchantConfiguration.paypalCredit = false;
      testContext.modelOptions.merchantConfiguration.applePay = '';
      testContext.modelOptions.merchantConfiguration.googlePay = 0;

      const model = new DropinModel(testContext.modelOptions);

      expect(model.dependencyStates.paypalCredit).toBeFalsy();
      expect(model.dependencyStates.venmo).toBeFalsy();
      expect(model.dependencyStates.applePay).toBeFalsy();
      expect(model.dependencyStates.googlePay).toBeFalsy();
      expect(model.dependencyStates.card).toBe('initializing');
      expect(model.dependencyStates.paypal).toBe('initializing');
    });

    it('does not set card as initializing when merchant configuration has falsy value', () => {
      testContext.modelOptions.merchantConfiguration.card = false;

      const model = new DropinModel(testContext.modelOptions);

      expect(model.dependencyStates.card).toBeFalsy();
    });

    it('does not set card as initializing when it is not specified in the merchant configuration and not in the payment option priority', () => {
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'paypalCredit', 'googlePay', 'applePay', 'venmo'];

      const model = new DropinModel(testContext.modelOptions);

      expect(model.dependencyStates.card).toBeFalsy();
    });

    it('does not set payment option as initializing when n and not in the payment option priority', () => {
      testContext.modelOptions.merchantConfiguration.card = true;
      testContext.modelOptions.merchantConfiguration.venmo = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.googlePay = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'venmo'];

      const model = new DropinModel(testContext.modelOptions);

      expect(model.dependencyStates.card).toBeFalsy();
      expect(model.dependencyStates.googlePay).toBeFalsy();
      expect(model.dependencyStates.paypal).toBeTruthy();
      expect(model.dependencyStates.venmo).toBeTruthy();
    });

    it('does set data collector and 3DS as initializing when a payment option priority is configured', () => {
      testContext.modelOptions.merchantConfiguration.card = true;
      testContext.modelOptions.merchantConfiguration.venmo = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.googlePay = true;
      testContext.modelOptions.merchantConfiguration.dataCollector = true;
      testContext.modelOptions.merchantConfiguration.threeDSecure = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'venmo'];

      const model = new DropinModel(testContext.modelOptions);

      expect(model.dependencyStates.card).toBeFalsy();
      expect(model.dependencyStates.googlePay).toBeFalsy();
      expect(model.dependencyStates.paypal).toBeTruthy();
      expect(model.dependencyStates.venmo).toBeTruthy();
      expect(model.dependencyStates.dataCollector).toBeTruthy();
      expect(model.dependencyStates.threeDSecure).toBeTruthy();
    });

    describe('isGuestCheckout', () => {
      test('is true when given a tokenization key', () => {
        let model;

        testContext.configuration.authorization = fake.tokenizationKey;
        testContext.configuration.authorizationType = 'TOKENIZATION_KEY';

        model = new DropinModel(testContext.modelOptions);

        expect(model.isGuestCheckout).toBe(true);
      });

      test('is true when given a client token without a customer ID', () => {
        let model;

        testContext.configuration.authorization = fake.clientToken;
        testContext.configuration.authorizationType = 'CLIENT_TOKEN';

        model = new DropinModel(testContext.modelOptions);

        expect(model.isGuestCheckout).toBe(true);
      });

      test('is false when given a client token with a customer ID', () => {
        let model;

        testContext.configuration.authorization = fake.clientTokenWithCustomerID;
        testContext.configuration.authorizationType = 'CLIENT_TOKEN';

        model = new DropinModel(testContext.modelOptions);

        expect(model.isGuestCheckout).toBe(false);
      });
    });
  });

  describe('confirmDropinReady', () => {
    test('sets _setupComplete to true', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model._setupComplete).toBe(false);

      model.confirmDropinReady();

      expect(model._setupComplete).toBe(true);
    });
  });

  describe('initialize', () => {
    test('emits asyncDependenciesReady event when no dependencies are set to initializing', (done) => {
      jest.useFakeTimers();

      const model = new DropinModel(testContext.modelOptions);

      jest.spyOn(model, '_emit');

      model.on('asyncDependenciesReady', () => {
        jest.useRealTimers();
        done();
      });

      model.initialize().then(() => {
        expect(model._emit).not.toBeCalledWith('asyncDependenciesReady');

        model.asyncDependencyReady('paypal');

        expect(model._emit).not.toBeCalledWith('asyncDependenciesReady');

        jest.advanceTimersByTime(1000);

        expect(model._emit).not.toBeCalledWith('asyncDependenciesReady');

        model.asyncDependencyReady('venmo');

        expect(model._emit).not.toBeCalledWith('asyncDependenciesReady');

        jest.advanceTimersByTime(1000);

        model.asyncDependencyReady('card');

        expect(model._emit).not.toBeCalledWith('asyncDependenciesReady');

        jest.advanceTimersByTime(1000);
      });
    });

    test('creates a vault manager', () => {
      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(vaultManager.create).toBeCalledTimes(1);
        expect(vaultManager.create).toBeCalledWith({
          client: testContext.modelOptions.client
        });
      });
    });

    test('sets existing payment methods as _paymentMethods', () => {
      const model = new DropinModel(testContext.modelOptions);

      model.isGuestCheckout = false;
      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([{ type: 'CreditCard', details: { lastTwo: '11' }}]);

      return model.initialize().then(() => {
        expect(model._paymentMethods).toEqual([{ type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true }]);
      });
    });

    test('_paymentMethods is empty if no existing payment methods', () => {
      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model._paymentMethods).toEqual([]);
      });
    });

    test('ignores valid, but disabled payment methods', () => {
      const model = new DropinModel(testContext.modelOptions);

      model.isGuestCheckout = false;
      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);
      PayPalView.isEnabled.mockResolvedValue(false);
      PayPalCreditView.isEnabled.mockResolvedValue(false);

      return model.initialize().then(() => {
        expect(model._paymentMethods).toEqual([
          { type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true }
        ]);
        expect(model.dependencyStates.paypal).toBe('not-enabled');
      });
    });

    test(
      'ignores payment methods that have errored when calling isEnabled',
      () => {
        const model = new DropinModel(testContext.modelOptions);

        model.isGuestCheckout = false;
        testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([
          { type: 'CreditCard', details: { lastTwo: '11' }},
          { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
        ]);

        PayPalView.isEnabled.mockRejectedValue(new Error('fail'));
        PayPalCreditView.isEnabled.mockResolvedValue(false);

        return model.initialize().then(() => {
          expect(model._paymentMethods).toEqual([
            { type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true }
          ]);
        });
      }
    );

    test('calls console.error with error if isEnabled errors', () => {
      const model = new DropinModel(testContext.modelOptions);
      const error = new Error('fail');

      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      PayPalView.isEnabled.mockRejectedValue(error);
      PayPalCreditView.isEnabled.mockResolvedValue(false);

      return model.initialize().then(() => {
        expect(console.error).toBeCalledTimes(2); // eslint-disable-line no-console
        expect(console.error).toBeCalledWith('paypal view errored when checking if it was supported.'); // eslint-disable-line no-console
        expect(console.error).toBeCalledWith(error); // eslint-disable-line no-console
      });
    });

    test('rejects with an error when there are no payment options', () => {
      const model = new DropinModel(testContext.modelOptions);

      ApplePayView.isEnabled.mockResolvedValue(false);
      CardView.isEnabled.mockResolvedValue(false);
      GooglePayView.isEnabled.mockResolvedValue(false);
      PayPalView.isEnabled.mockResolvedValue(false);
      PayPalCreditView.isEnabled.mockResolvedValue(false);
      VenmoView.isEnabled.mockResolvedValue(false);

      return model.initialize().then(throwIfResolves).catch(err => {
        expect(err.message).toBe('No valid payment options available.');
      });
    });

    test(
      'throws an error when paymentOptionPriority is an empty array',
      () => {
        let model;

        testContext.configuration.gatewayConfiguration.paypalEnabled = true;
        testContext.modelOptions.merchantConfiguration.paypal = true;
        testContext.modelOptions.merchantConfiguration.paymentOptionPriority = [];

        model = new DropinModel(testContext.modelOptions);

        return model.initialize().then(throwIfResolves).catch(err => {
          expect(err.message).toBe('No valid payment options available.');
        });
      }
    );

    test(
      'supports cards, PayPal, PayPal Credit, Venmo, Apple Pay and Google Pay and defaults to showing them in correct paymentOptionPriority',
      () => {
        const model = new DropinModel(testContext.modelOptions);

        return model.initialize().then(() => {
          expect(model.supportedPaymentOptions).toEqual(['card', 'paypal', 'paypalCredit', 'venmo', 'applePay', 'googlePay']);
        });
      }
    );

    test('marks payment method as unsupported if isEnabled rejects', () => {
      const model = new DropinModel(testContext.modelOptions);

      GooglePayView.isEnabled.mockRejectedValue(new Error('no google pay'));

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['card', 'paypal', 'paypalCredit', 'venmo', 'applePay']);
      });
    });

    test('uses custom paymentOptionPriority of payment options', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'card'];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['paypal', 'card']);
      });
    });

    test('ignores duplicates', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'paypal', 'card'];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['paypal', 'card']);
      });
    });

    test('ignores configured payment methods that are not present in a custom paymentOptionPriority array', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.venmo = true;
      testContext.modelOptions.merchantConfiguration.applePay = true;
      testContext.modelOptions.merchantConfiguration.googlePay = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'card'];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['paypal', 'card']);
      });
    });

    test(
      'calls isEnabled on payment method view to determine if payment method is available',
      () => {
        const model = new DropinModel(testContext.modelOptions);

        return model.initialize().then(() => {
          expect(ApplePayView.isEnabled).toBeCalledTimes(1);
          expect(ApplePayView.isEnabled).toBeCalledWith({
            client: testContext.modelOptions.client,
            merchantConfiguration: testContext.modelOptions.merchantConfiguration
          });
          expect(CardView.isEnabled).toBeCalledTimes(1);
          expect(CardView.isEnabled).toBeCalledWith({
            client: testContext.modelOptions.client,
            merchantConfiguration: testContext.modelOptions.merchantConfiguration
          });
          expect(GooglePayView.isEnabled).toBeCalledTimes(1);
          expect(GooglePayView.isEnabled).toBeCalledWith({
            client: testContext.modelOptions.client,
            merchantConfiguration: testContext.modelOptions.merchantConfiguration
          });
          expect(PayPalView.isEnabled).toBeCalledTimes(1);
          expect(PayPalView.isEnabled).toBeCalledWith({
            client: testContext.modelOptions.client,
            merchantConfiguration: testContext.modelOptions.merchantConfiguration
          });
          expect(PayPalCreditView.isEnabled).toBeCalledTimes(1);
          expect(PayPalCreditView.isEnabled).toBeCalledWith({
            client: testContext.modelOptions.client,
            merchantConfiguration: testContext.modelOptions.merchantConfiguration
          });
          expect(VenmoView.isEnabled).toBeCalledTimes(1);
          expect(VenmoView.isEnabled).toBeCalledWith({
            client: testContext.modelOptions.client,
            merchantConfiguration: testContext.modelOptions.merchantConfiguration
          });
        });
      }
    );

    test(
      'rejects with an error when an unrecognized payment option is specified',
      () => {
        let model;

        testContext.configuration.gatewayConfiguration.paypalEnabled = true;
        testContext.modelOptions.merchantConfiguration.paypal = true;
        testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['foo', 'paypal', 'card'];

        model = new DropinModel(testContext.modelOptions);

        return model.initialize().then(throwIfResolves).catch(err => {
          expect(err.message).toBe('paymentOptionPriority: Invalid payment option specified.');
        });
      }
    );
  });

  describe('addPaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      return testContext.model.initialize();
    });

    test('adds a new payment method to _paymentMethods', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);

      expect(testContext.model._paymentMethods[0]).toBe(paymentMethod);
    });

    test(
      'emits onAddPaymentMethod event with new payment method',
      done => {
        const paymentMethod = { foo: 'bar' };

        testContext.model.on('addPaymentMethod', emittedPaymentMethod => {
          expect(emittedPaymentMethod).toBe(paymentMethod);
          done();
        });

        testContext.model.addPaymentMethod(paymentMethod);
      }
    );

    test('changes active payment method to active payment method', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);

      expect(testContext.model._activePaymentMethod).toBe(paymentMethod);
    });
  });

  describe('removePaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      return testContext.model.initialize();
    });

    test('removes a payment method from _paymentMethods', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);

      testContext.model.removePaymentMethod(paymentMethod);

      expect(testContext.model._paymentMethods).toEqual([]);
    });

    test(
      'does not remove a payment method from _paymentMethods if it only deep equals the existing payment method',
      () => {
        const paymentMethod = { foo: 'bar' };

        testContext.model.addPaymentMethod(paymentMethod);

        testContext.model.removePaymentMethod({ foo: 'bar' });

        expect(testContext.model._paymentMethods[0]).toBe(paymentMethod);
      }
    );

    test(
      'emits onRemovePaymentMethod event with new payment method',
      done => {
        const paymentMethod = { foo: 'bar' };

        testContext.model.addPaymentMethod(paymentMethod);
        testContext.model.on('removePaymentMethod', emittedPaymentMethod => {
          expect(emittedPaymentMethod).toBe(paymentMethod);
          done();
        });

        testContext.model.removePaymentMethod(paymentMethod);
      }
    );

    test(
      'does not emit onRemovePaymentMethod event when payment method does not exist',
      () => {
        const paymentMethod = { foo: 'bar' };

        jest.spyOn(testContext.model, '_emit');
        testContext.model.addPaymentMethod(paymentMethod);

        testContext.model.removePaymentMethod({ someother: 'paymentMethod' });

        expect(testContext.model._emit).not.toBeCalledWith('removePaymentMethod');
      }
    );
  });

  describe('getPaymentMethods', () => {
    test('returns a copy of the _paymentMethods array', () => {
      const model = new DropinModel(testContext.modelOptions);

      model._paymentMethods = ['these are my payment methods'];

      expect(model.getPaymentMethods()).not.toBe(model._paymentMethods);
      expect(model.getPaymentMethods()).toEqual(model._paymentMethods);
    });
  });

  describe('refreshPaymentMethods', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
      testContext.fakeMethod = { type: 'CreditCard', nonce: 'a-nonce' };
      jest.spyOn(testContext.model, 'getVaultedPaymentMethods').mockResolvedValue([testContext.fakeMethod]);
      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test('calls out to get vaulted payment methods', () => {
      return testContext.model.refreshPaymentMethods().then(() => {
        expect(testContext.model.getVaultedPaymentMethods).toBeCalledTimes(1);
      });
    });

    test('replaces payment methods on model', () => {
      testContext.model._paymentMethods = [{ type: 'foo' }];

      return testContext.model.refreshPaymentMethods().then(() => {
        expect(testContext.model.getPaymentMethods()).toEqual([testContext.fakeMethod]);
      });
    });

    test('remits refresh event', () => {
      return testContext.model.refreshPaymentMethods().then(() => {
        expect(testContext.model._emit).toBeCalledTimes(1);
        expect(testContext.model._emit).toBeCalledWith('refreshPaymentMethods');
      });
    });
  });

  describe('changeActivePaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
    });

    test('sets new payment method to _activePaymentMethod', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.changeActivePaymentMethod(paymentMethod);

      expect(testContext.model._activePaymentMethod).toBe(paymentMethod);
    });

    test(
      'emits changeActivePaymentMethod event with active payment method',
      done => {
        const paymentMethod = { foo: 'bar' };

        testContext.model.on('changeActivePaymentMethod', emittedPaymentMethod => {
          expect(emittedPaymentMethod).toBe(paymentMethod);
          done();
        });

        testContext.model.changeActivePaymentMethod(paymentMethod);
      }
    );
  });

  describe('changeActiveView', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
    });

    test('sets active payment method view id', () => {
      testContext.model._activePaymentViewId = 'methods';

      testContext.model.changeActiveView('card');

      expect(testContext.model._activePaymentViewId).toBe('card');
    });

    test('emits event with new and old ids', () => {
      jest.spyOn(testContext.model, '_emit');

      testContext.model._activePaymentViewId = 'methods';

      testContext.model.changeActiveView('card');

      expect(testContext.model._emit).toBeCalledWith('changeActiveView', {
        previousViewId: 'methods',
        newViewId: 'card'
      });
    });
  });

  describe('removeActivePaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
      jest.spyOn(testContext.model, '_emit').mockImplementation();
      jest.spyOn(testContext.model, 'setPaymentMethodRequestable').mockImplementation();
    });

    test('sets active payment method to null', () => {
      testContext.model._activePaymentMethod = { foo: 'bar' };

      testContext.model.removeActivePaymentMethod();

      expect(testContext.model._activePaymentMethod).toBeFalsy();
    });

    test('emits removeActivePaymentMethod event', () => {
      testContext.model.removeActivePaymentMethod();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('removeActivePaymentMethod');
    });

    test('sets payment method to not be requestable', () => {
      testContext.model.removeActivePaymentMethod();

      expect(testContext.model.setPaymentMethodRequestable).toBeCalledTimes(1);
      expect(testContext.model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: false
      });
    });
  });

  describe('getActivePaymentMethod', () => {
    test('returns _activePaymentMethod', () => {
      const model = new DropinModel(testContext.modelOptions);

      model._activePaymentMethod = 'this is my active payment method';

      expect(model.getActivePaymentMethod()).toBe('this is my active payment method');
    });
  });

  describe('hasAtLeastOneAvailablePaymentOption', () => {
    test('returns false when no payment methods have a setup status of done', async () => {
      // all dependencies will have a setup status of initializing
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.hasAtLeastOneAvailablePaymentOption()).toBe(false);
    });

    test('returns true when at least one payment method has a setup status of done', async () => {
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      model.asyncDependencyReady('card');

      expect(model.hasAtLeastOneAvailablePaymentOption()).toBe(true);
    });

    test('returns false when no payment methods have a setup status of done, even if non-payment methods do', async () => {
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      model.asyncDependencyReady('dataCollector');
      model.asyncDependencyReady('threeDSecure');

      expect(model.hasAtLeastOneAvailablePaymentOption()).toBe(false);
    });
  });

  describe('hasPaymentMethods', () => {
    test('returns true when there is at least one payment method', () => {
      const model = new DropinModel(testContext.modelOptions);

      jest.spyOn(model, 'getPaymentMethods').mockReturnValue([{
        type: 'PayPalAccount',
        nonce: 'fake-paypal-nonce'
      }]);
      expect(model.hasPaymentMethods()).toBe(true);
    });

    test('returns false when there are no payment methods', () => {
      const model = new DropinModel(testContext.modelOptions);

      jest.spyOn(model, 'getPaymentMethods').mockReturnValue([]);
      expect(model.hasPaymentMethods()).toBe(false);
    });
  });

  describe('getInitialViewId', () => {
    test('returns options id when there are more than 1 supported payment options', async () => {
      VenmoView.isEnabled.mockResolvedValue(true);
      CardView.isEnabled.mockResolvedValue(true);

      ApplePayView.isEnabled.mockResolvedValue(false);
      GooglePayView.isEnabled.mockResolvedValue(false);
      PayPalView.isEnabled.mockResolvedValue(false);
      PayPalCreditView.isEnabled.mockResolvedValue(false);

      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.getInitialViewId()).toBe('options');
    });

    test('returns the id for the only payment option when there is just 1 supported payment option', async () => {
      VenmoView.isEnabled.mockResolvedValue(true);

      CardView.isEnabled.mockResolvedValue(false);
      ApplePayView.isEnabled.mockResolvedValue(false);
      GooglePayView.isEnabled.mockResolvedValue(false);
      PayPalView.isEnabled.mockResolvedValue(false);
      PayPalCreditView.isEnabled.mockResolvedValue(false);

      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.getInitialViewId()).toBe('venmo');
    });
  });

  describe('reportAppSwitchPayload', () => {
    test('saves app switch payload to instance', () => {
      const model = new DropinModel(testContext.modelOptions);
      const payload = { nonce: 'fake-nonce' };

      model.reportAppSwitchPayload(payload);

      expect(model.appSwitchPayload).toBe(payload);
    });
  });

  describe('reportAppSwitchError', () => {
    test('saves app switch error and view id', () => {
      const model = new DropinModel(testContext.modelOptions);
      const error = new Error('Error');

      model.reportAppSwitchError('view-id', error);

      expect(model.appSwitchError.id).toBe('view-id');
      expect(model.appSwitchError.error).toBe(error);
    });
  });

  describe('asyncDependencyFailed', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
    });

    test('marks depenedency as failed', () => {
      const err = new Error('a bad error');

      expect(testContext.model.dependencyStates.venmo).toBe('initializing');
      testContext.model.asyncDependencyFailed({
        view: 'venmo',
        error: err
      });
      expect(testContext.model.dependencyStates.venmo).toBe('failed');
    });

    test('adds an error to the failedDependencies object', () => {
      const err = new Error('a bad error');

      testContext.model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      expect(testContext.model.failedDependencies.id).toBe(err);
    });

    test('ignores error if failure was already reported', () => {
      const err = new Error('a bad error');
      const ignoredError = new Error('a different error');

      testContext.model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      testContext.model.asyncDependencyFailed({
        view: 'id',
        error: ignoredError
      });

      expect(testContext.model.failedDependencies.id).not.toBe(ignoredError);
      expect(testContext.model.failedDependencies.id).toBe(err);
    });

    test(
      'emits asyncDependenciesReady event when there are no dependencies initializing',
      done => {
        const model = new DropinModel(testContext.modelOptions);

        model.on('asyncDependenciesReady', () => {
          done();
        });

        model.initialize().then(() => {
          model.asyncDependencyReady('paypal');
          model.asyncDependencyFailed({
            view: 'venmo',
            error: new Error('fake error')
          });
          model.asyncDependencyReady('card');
        });
      }
    );
  });

  describe('asyncDependencyReady', () => {
    beforeEach(() => {
      testContext.context = { callback: jest.fn() };
    });

    test('marks initializing dependency as done', () => {
      const model = new DropinModel(testContext.modelOptions);

      // the modelOptions have a config for paypal and venmo
      expect(model.dependencyStates.paypal).toBe('initializing');
      expect(model.dependencyStates.venmo).toBe('initializing');

      model.asyncDependencyReady('paypal');
      expect(model.dependencyStates.paypal).toBe('done');
      expect(model.dependencyStates.venmo).toBe('initializing');
      expect(model.dependencyStates.card).toBe('initializing');

      model.asyncDependencyReady('venmo');
      expect(model.dependencyStates.paypal).toBe('done');
      expect(model.dependencyStates.venmo).toBe('done');
      expect(model.dependencyStates.card).toBe('initializing');

      model.asyncDependencyReady('card');
      expect(model.dependencyStates.paypal).toBe('done');
      expect(model.dependencyStates.venmo).toBe('done');
      expect(model.dependencyStates.card).toBe('done');
    });

    test(
      'emits asyncDependenciesReady event when there are no dependencies initializing',
      done => {
        const model = new DropinModel(testContext.modelOptions);

        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');

        model.on('asyncDependenciesReady', () => {
          expect(DropinModel.prototype.asyncDependencyReady).toBeCalledTimes(3);
          done();
        });

        model.initialize().then(() => {
          model.asyncDependencyReady('paypal');
          model.asyncDependencyReady('venmo');
          model.asyncDependencyReady('card');
        });
      }
    );

    test('emits asyncDependenciesReady event with prior errors', (done) => {
      const model = new DropinModel(testContext.modelOptions);
      const err = new Error('an earlier dependency failed');

      model.on('asyncDependenciesReady', () => {
        done();
      });

      model.initialize().then(() => {
        model.asyncDependencyReady('card');
        model.asyncDependencyFailed({
          view: 'venmo',
          error: err
        });
        model.asyncDependencyReady('paypal');
      });
    });
  });

  describe('cancelInitialization', () => {
    test('emits cancelInitialization event wth the error', done => {
      const dropinModel = new DropinModel(testContext.modelOptions);
      const fakeError = { foo: 'boo' };

      dropinModel.on('cancelInitialization', error => {
        expect(error).toEqual(fakeError);
        done();
      });

      dropinModel.cancelInitialization(fakeError);
    });
  });

  describe('reportError', () => {
    test('emits an errorOccurred event with the error', done => {
      const dropinModel = new DropinModel(testContext.modelOptions);
      const fakeError = { foo: 'boo' };

      dropinModel.on('errorOccurred', error => {
        expect(error).toEqual(fakeError);
        done();
      });

      dropinModel.reportError(fakeError);
    });
  });

  describe('clearError', () => {
    test('emits an errorCleared event', done => {
      const dropinModel = new DropinModel(testContext.modelOptions);

      dropinModel.on('errorCleared', () => {
        done();
      });

      dropinModel.clearError();
    });
  });

  describe('isPaymentMethodRequestable', () => {
    test(
      'returns false initially if no payment methods are passed in',
      () => {
        const model = new DropinModel(testContext.modelOptions);

        return model.initialize().then(() => {
          expect(model.isPaymentMethodRequestable()).toBe(false);
        });
      }
    );

    test(
      'returns true initially if customer has saved payment methods',
      () => {
        const model = new DropinModel(testContext.modelOptions);

        model.isGuestCheckout = false;
        testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([{ type: 'CreditCard', details: { lastTwo: '11' }}]);

        return model.initialize().then(() => {
          expect(model.isPaymentMethodRequestable()).toBe(true);
        });
      }
    );
  });

  describe('setPaymentMethodRequestable', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      testContext.model.confirmDropinReady();
      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test(
      'sets isPaymentMethodRequestable to true when isRequestable is true',
      () => {
        expect(testContext.model.isPaymentMethodRequestable()).toBe(false);

        testContext.model.setPaymentMethodRequestable({
          isRequestable: true
        });

        expect(testContext.model.isPaymentMethodRequestable()).toBe(true);
      }
    );

    test(
      'emits paymentMethodRequestable with type when isRequestable is true',
      () => {
        testContext.model.setPaymentMethodRequestable({
          isRequestable: true,
          type: 'card'
        });

        expect(testContext.model._emit).toBeCalledTimes(1);
        expect(testContext.model._emit).toBeCalledWith('paymentMethodRequestable', {
          type: 'card',
          paymentMethodIsSelected: false
        });
      }
    );

    test(
      'does not emit paymentMethodRequestable event if drop-in is not ready',
      () => {
        testContext.model._setupComplete = false;
        testContext.model.setPaymentMethodRequestable({
          isRequestable: true,
          type: 'card'
        });

        expect(testContext.model._emit).not.toBeCalled();
      }
    );

    test(
      'sets isPaymentMethodRequestable to false when isRequestable is false',
      () => {
        testContext.model._paymentMethodIsRequestable = true;

        expect(testContext.model.isPaymentMethodRequestable()).toBe(true);

        testContext.model.setPaymentMethodRequestable({
          isRequestable: false
        });

        expect(testContext.model.isPaymentMethodRequestable()).toBe(false);
      }
    );

    test(
      'emits noPaymentMethodRequestable with type when isRequestable is false',
      () => {
        testContext.model._paymentMethodIsRequestable = true;
        testContext.model.setPaymentMethodRequestable({
          isRequestable: false
        });

        expect(testContext.model._emit).toBeCalledTimes(1);
        expect(testContext.model._emit).toBeCalledWith('noPaymentMethodRequestable');
      }
    );

    test(
      'does not emit when isRequestable state and nonce does not change',
      () => {
        testContext.model._paymentMethodIsRequestable = false;
        testContext.model.setPaymentMethodRequestable({
          isRequestable: false
        });

        expect(testContext.model._emit).not.toBeCalled();

        testContext.model._paymentMethodIsRequestable = true;
        testContext.model._paymentMethodRequestableNonce = 'fake-nonce';
        testContext.model.setPaymentMethodRequestable({
          isRequestable: true,
          selectedPaymentMethod: {
            nonce: 'fake-nonce'
          },
          type: 'TYPE'
        });

        expect(testContext.model._emit).not.toBeCalled();
      }
    );

    test(
      'does not emit when isRequestable state is false and nonce has changed',
      () => {
        testContext.model._paymentMethodIsRequestable = false;
        testContext.model.setPaymentMethodRequestable({
          isRequestable: false
        });

        expect(testContext.model._emit).not.toBeCalled();

        testContext.model._paymentMethodRequestableNonce = 'old-fake-nonce';
        testContext.model.setPaymentMethodRequestable({
          isRequestable: false,
          type: 'TYPE',
          selectedPaymentMethod: {
            nonce: 'fake-nonce'
          }
        });

        expect(testContext.model._emit).not.toBeCalled();
      }
    );

    test(
      'does emit when isRequestable state has not changed, but nonce state does',
      () => {
        testContext.model._paymentMethodIsRequestable = true;
        testContext.model._paymentMethodRequestableNonce = 'old-fake-nonce';
        testContext.model.setPaymentMethodRequestable({
          isRequestable: true,
          type: 'TYPE',
          selectedPaymentMethod: {
            nonce: 'fake-nonce'
          }
        });

        expect(testContext.model._emit).toBeCalledTimes(1);
        expect(testContext.model._emit).toBeCalledWith('paymentMethodRequestable', {
          type: 'TYPE',
          paymentMethodIsSelected: true
        });
      }
    );

    test('ignores nonce if isRequestable is false', () => {
      testContext.model._paymentMethodRequestableNonce = 'SOMETHING';
      testContext.model.setPaymentMethodRequestable({
        isRequestable: false,
        type: 'SOME_TYPE',
        selectedPaymentMethod: {
          nonce: 'fake-nonce'
        }
      });

      expect(testContext.model._paymentMethodRequestableNonce).toBeFalsy();
    });

    test(
      'includes the paymentMethodIsSelected as true if Drop-in displays a selected payment method',
      () => {
        const selectedPaymentMethod = { foo: 'bar' };

        testContext.model.setPaymentMethodRequestable({
          isRequestable: true,
          type: 'TYPE',
          selectedPaymentMethod: selectedPaymentMethod
        });

        expect(testContext.model._emit).toBeCalledWith('paymentMethodRequestable', {
          type: 'TYPE',
          paymentMethodIsSelected: true
        });
      }
    );

    test(
      'includes the paymentMethodIsSelected as false if no payment method is actively selected',
      () => {
        testContext.model.setPaymentMethodRequestable({
          isRequestable: true,
          type: 'TYPE'
        });

        expect(testContext.model._emit).toBeCalledWith('paymentMethodRequestable', {
          type: 'TYPE',
          paymentMethodIsSelected: false
        });
      }
    );
  });

  describe('selectPaymentOption', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test(
      'emits a paymentOptionSelected event with the id of the payment option that was selected',
      () => {
        testContext.model.selectPaymentOption('card');

        expect(testContext.model._emit).toBeCalledTimes(1);
        expect(testContext.model._emit).toBeCalledWith('paymentOptionSelected', {
          paymentOption: 'card'
        });
      }
    );
  });

  describe('preventUserAction', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test('emits a preventUserAction event', () => {
      testContext.model.preventUserAction('card');

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('preventUserAction');
    });
  });

  describe('allowUserAction', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test('emits a allowUserAction event', () => {
      testContext.model.allowUserAction('card');

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('allowUserAction');
    });
  });

  describe('Edit mode', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test('model.enableEditMode emits an enableEditMode event', () => {
      testContext.model.enableEditMode();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('enableEditMode');
    });

    test('model.enableEditMode sets isInEditMode to true', () => {
      expect(testContext.model.isInEditMode()).toBe(false);

      testContext.model.enableEditMode();

      expect(testContext.model.isInEditMode()).toBe(true);
    });

    test('model.disableEditMode emits a disableEditMode event', () => {
      testContext.model.disableEditMode();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('disableEditMode');
    });

    test('model.disableEditMode sets isInEditMode to false', () => {
      testContext.model.enableEditMode();

      expect(testContext.model.isInEditMode()).toBe(true);

      testContext.model.disableEditMode();

      expect(testContext.model.isInEditMode()).toBe(false);
    });

    test(
      'model.confirmPaymentMethodDeletion emits a confirmPaymentMethodDeletion event',
      () => {
        const paymentMethod = {
          nonce: '123-fake-nonce'
        };

        testContext.model.confirmPaymentMethodDeletion(paymentMethod);

        expect(testContext.model._emit).toBeCalledTimes(1);
        expect(testContext.model._emit).toBeCalledWith('confirmPaymentMethodDeletion', paymentMethod);
      }
    );
  });

  describe('deleteVaultedPaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      testContext.model._paymentMethodWaitingToBeDeleted = {
        nonce: 'a-nonce'
      };
      testContext.model.isGuestCheckout = false;
      jest.spyOn(testContext.model, '_emit').mockImplementation();

      return testContext.model.initialize();
    });

    test('emits a startVaultedPaymentMethodDeletion event', () => {
      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model._emit).toBeCalledWith('startVaultedPaymentMethodDeletion');
      });
    });

    test('removes stored payment method variable', () => {
      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model._paymentMethodWaitingToBeDeleted).toBeFalsy();
      });
    });

    test('uses vault manager to delete payment method', () => {
      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.vaultManager.deletePaymentMethod).toBeCalledTimes(1);
        expect(testContext.vaultManager.deletePaymentMethod).toBeCalledWith('a-nonce');
      });
    });

    test(
      'does not vault manager to delete payment method if in guest checkout mode',
      () => {
        testContext.model.isGuestCheckout = true;

        return testContext.model.deleteVaultedPaymentMethod().then(() => {
          expect(testContext.vaultManager.deletePaymentMethod).not.toBeCalled();
        });
      }
    );

    test(
      'emits finishVaultedPaymentMethodDeletion event when deletion is succesful',
      () => {
        testContext.vaultManager.deletePaymentMethod.mockResolvedValue();

        return testContext.model.deleteVaultedPaymentMethod().then(() => {
          expect(testContext.model._emit).toBeCalledWith('finishVaultedPaymentMethodDeletion', undefined); // eslint-disable-line no-undefined
        });
      }
    );

    test(
      'emits finishVaultedPaymentMethodDeletion event when deletion is unsuccesful',
      () => {
        const error = new Error('aaaaaaah!');

        testContext.vaultManager.deletePaymentMethod.mockRejectedValue(error);

        return testContext.model.deleteVaultedPaymentMethod().then(() => {
          expect(testContext.model._emit).toBeCalledWith('finishVaultedPaymentMethodDeletion', expect.any(Error));
        });
      }
    );

    test('refetches payment methods', () => {
      const paymentMethods = [{ type: 'CreditCard', nonce: 'a-nonce' }];

      jest.spyOn(testContext.model, 'getVaultedPaymentMethods').mockResolvedValue(paymentMethods);

      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model.getVaultedPaymentMethods).toBeCalledTimes(1);
        expect(testContext.model.getPaymentMethods()).toEqual(paymentMethods);
      });
    });
  });

  describe('cancelDeleteVaultedPaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      testContext.model._paymentMethodWaitingToBeDeleted = {
        nonce: 'a-nonce'
      };
      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    test('emits a cancelVaultedPaymentMethodDeletion event', () => {
      testContext.model.cancelDeleteVaultedPaymentMethod();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('cancelVaultedPaymentMethodDeletion');
    });

    test('removes stored payment method variable', () => {
      testContext.model.cancelDeleteVaultedPaymentMethod();

      expect(testContext.model._paymentMethodWaitingToBeDeleted).toBeFalsy();
    });
  });

  describe('getVaultedPaymentMethods', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      return testContext.model.initialize().then(() => {
        testContext.model.isGuestCheckout = false;
      });
    });

    test(
      'resolves with payment methods as empty array when vault manager errors',
      () => {
        testContext.model.isGuestCheckout = false;
        testContext.vaultManager.fetchPaymentMethods.mockRejectedValue(new Error('error'));

        return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
          expect(testContext.vaultManager.fetchPaymentMethods).toBeCalledWith({
            defaultFirst: true
          });
          expect(paymentMethods).toEqual([]);
        });
      }
    );

    test(
      'resolves with payment methods as empty array when in guest checkout',
      () => {
        testContext.model.isGuestCheckout = true;

        return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
          expect(paymentMethods).toEqual([]);
        });
      }
    );

    test(
      'resolves with payment methods from vault manager when not in guest checkout',
      () => {
        testContext.model.isGuestCheckout = false;
        testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([{
          nonce: '1-nonce',
          type: 'CreditCard'
        }, {
          nonce: '2-nonce',
          type: 'PayPalAccount'
        }]);

        return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
          expect(testContext.vaultManager.fetchPaymentMethods).toBeCalledWith({
            defaultFirst: true
          });
          expect(paymentMethods).toEqual([{
            nonce: '1-nonce',
            type: 'CreditCard',
            vaulted: true
          }, {
            nonce: '2-nonce',
            type: 'PayPalAccount',
            vaulted: true
          }]);
        });
      }
    );

    test(
      'fetches last used payment method instead of default when configured',
      () => {
        testContext.model.merchantConfiguration.showDefaultPaymentMethodFirst = false;
        testContext.model.isGuestCheckout = false;
        testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([]);

        return testContext.model.getVaultedPaymentMethods().then(() => {
          expect(testContext.vaultManager.fetchPaymentMethods).toBeCalledWith({
            defaultFirst: false
          });
        });
      }
    );

    test('only resolves supported payment method types', () => {
      testContext.model.isGuestCheckout = false;
      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([{
        nonce: '1-nonce',
        type: 'CreditCard'
      }, {
        nonce: '2-nonce',
        type: 'FooPay'
      }]);

      return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
        expect(paymentMethods).toEqual([{
          nonce: '1-nonce',
          type: 'CreditCard',
          vaulted: true
        }]);
      });
    });

    test('includes vaulted property on payment method objects', () => {
      testContext.model.isGuestCheckout = false;
      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([{
        nonce: '1-nonce',
        type: 'CreditCard'
      }, {
        nonce: '2-nonce',
        type: 'PayPalAccount'
      }, {
        nonce: '3-nonce',
        type: 'CreditCard'
      }]);

      return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
        expect(testContext.vaultManager.fetchPaymentMethods).toBeCalledWith({
          defaultFirst: true
        });
        expect(paymentMethods[0].vaulted).toBe(true);
        expect(paymentMethods[1].vaulted).toBe(true);
        expect(paymentMethods[2].vaulted).toBe(true);
      });
    });

    test('ignores invalid payment methods', () => {
      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }},
        { type: 'InvalidMethod', details: {}},
        { type: 'AlsoInvalidMethod', details: {}}
      ]);
      testContext.model.merchantConfiguration.paypal = { flow: 'vault' };

      return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
        expect(paymentMethods).toEqual([
          { type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true },
          { type: 'PayPalAccount', details: { email: 'wow@example.com' }, vaulted: true }
        ]);
      });
    });

    test(
      'ignores vaulted payment methods that cannot be used client side',
      () => {
        testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([
          { type: 'CreditCard', details: { lastTwo: '11' }},
          { type: 'PayPalAccount', details: { email: 'wow@example.com' }},
          { type: 'ApplePayCard', details: {}},
          { type: 'AndroidPayCard', details: {}},
          { type: 'VenmoAccount', details: {}}
        ]);

        return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
          expect(paymentMethods).toEqual([
            { type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true },
            { type: 'PayPalAccount', details: { email: 'wow@example.com' }, vaulted: true }
          ]);
        });
      }
    );
  });
});
