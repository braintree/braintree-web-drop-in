jest.mock('../../src/lib/analytics');

const vaultManager = require('braintree-web/vault-manager');
const EventEmitter = require('@braintree/event-emitter');
const ApplePayView = require('../../src/views/payment-sheet-views/apple-pay-view');
const CardView = require('../../src/views/payment-sheet-views/card-view');
const DropinModel = require('../../src/dropin-model');
const GooglePayView = require('../../src/views/payment-sheet-views/google-pay-view');
const PayPalCreditView = require('../../src/views/payment-sheet-views/paypal-credit-view');
const PayPalView = require('../../src/views/payment-sheet-views/paypal-view');
const VenmoView = require('../../src/views/payment-sheet-views/venmo-view');
const isHTTPS = require('../../src/lib/is-https');
const analytics = require('../../src/lib/analytics');
const fake = require('../helpers/fake');
const throwIfResolves = require('../helpers/throw-if-resolves');

describe('DropinModel', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.configuration = fake.configuration();

    jest.spyOn(vaultManager, 'create').mockResolvedValue(fake.vaultManagerInstance);
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

    fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([]);
    fake.vaultManagerInstance.deletePaymentMethod.mockResolvedValue();
  });

  describe('Constructor', () => {
    it('inherits from EventEmitter', () => {
      expect(new DropinModel(testContext.modelOptions)).toBeInstanceOf(EventEmitter);
    });

    it('sets componentID', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model.componentID).toBe(testContext.modelOptions.componentID);
    });

    it('sets merchantConfiguration', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model.merchantConfiguration).toBe(testContext.modelOptions.merchantConfiguration);
    });

    it('sets isInShadowDom to false when the container is not in the shadow DOM', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model.isInShadowDom).toBe(false);
    });

    it('sets isInShadowDom to true when the container is in the shadow DOM', () => {
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
  });

  describe('confirmDropinReady', () => {
    it('sets _setupComplete to true', () => {
      const model = new DropinModel(testContext.modelOptions);

      expect(model._setupComplete).toBe(false);

      model.confirmDropinReady();

      expect(model._setupComplete).toBe(true);
    });
  });

  describe('initialize', () => {
    it('sends web.dropin.started.tokenization-key event when using a tokenization key', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.tokenizationKey;
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(analytics.sendEvent).toBeCalledWith('started.tokenization-key');
    });

    it('sends web.dropin.started.client-token event when using a client token', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientToken;
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(analytics.sendEvent).toBeCalledWith('started.client-token');
    });

    it('sets vault manager config with defaults for client tokens with customer ids if not provided', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.vaultManagerConfig).toEqual({
        autoVaultPaymentMethods: true,
        presentVaultedPaymentMethods: true,
        preselectVaultedPaymentMethod: true,
        allowCustomerToDeletePaymentMethods: false
      });
    });

    it('sets vault manager config with defaults for client tokens without customer ids if not provided', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientToken;
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.vaultManagerConfig).toEqual({
        autoVaultPaymentMethods: false,
        presentVaultedPaymentMethods: false,
        preselectVaultedPaymentMethod: false,
        allowCustomerToDeletePaymentMethods: false
      });
    });

    it('sets vault manager config with defaults for tokenization keys if not provided', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.tokenizationKey;
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.vaultManagerConfig).toEqual({
        autoVaultPaymentMethods: false,
        presentVaultedPaymentMethods: false,
        preselectVaultedPaymentMethod: false,
        allowCustomerToDeletePaymentMethods: false
      });
    });

    it('rejects with an error when passing a vault manager option with a tokeniation key', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.tokenizationKey;
      testContext.modelOptions.merchantConfiguration.vaultManager = {
        autoVaultPaymentMethods: true
      };
      const model = new DropinModel(testContext.modelOptions);

      await expect(model.initialize()).rejects.toThrow('vaultManager cannot be used with tokenization keys.');
    });

    it('overrides the vault manager config if provided', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      testContext.modelOptions.merchantConfiguration.vaultManager = {
        autoVaultPaymentMethods: false,
        presentVaultedPaymentMethods: false,
        preselectVaultedPaymentMethod: false,
        allowCustomerToDeletePaymentMethods: true
      };
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.vaultManagerConfig).toEqual({
        autoVaultPaymentMethods: false,
        presentVaultedPaymentMethods: false,
        preselectVaultedPaymentMethod: false,
        allowCustomerToDeletePaymentMethods: true
      });
    });

    it('provides vault manager defaults when only some options are provided', async () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      testContext.modelOptions.merchantConfiguration.vaultManager = {
        autoVaultPaymentMethods: false
      };
      const model = new DropinModel(testContext.modelOptions);

      await model.initialize();

      expect(model.vaultManagerConfig).toEqual({
        autoVaultPaymentMethods: false,
        presentVaultedPaymentMethods: true,
        preselectVaultedPaymentMethod: true,
        allowCustomerToDeletePaymentMethods: false
      });
    });

    it('creates a vault manager', () => {
      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(vaultManager.create).toBeCalledTimes(1);
        expect(vaultManager.create).toBeCalledWith({
          authorization: fake.clientToken
        });
      });
    });

    it('sets existing payment methods as _paymentMethods', () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

      const model = new DropinModel(testContext.modelOptions);

      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }}
      ]);

      return model.initialize().then(() => {
        expect(model._paymentMethods).toEqual([{ type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true }]);
      });
    });

    it('_paymentMethods is empty if no existing payment methods', () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model._paymentMethods).toEqual([]);
      });
    });

    it('ignores valid, but disabled payment methods', () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

      const model = new DropinModel(testContext.modelOptions);

      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);
      PayPalView.isEnabled.mockResolvedValue(false);
      PayPalCreditView.isEnabled.mockResolvedValue(false);

      return model.initialize().then(() => {
        expect(model._paymentMethods).toEqual([
          { type: 'CreditCard', details: { lastTwo: '11' }, vaulted: true }
        ]);
      });
    });

    it('ignores payment methods that have errored when calling isEnabled', () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

      const model = new DropinModel(testContext.modelOptions);

      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([
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
    });

    it('calls console.error with error if isEnabled errors', () => {
      const model = new DropinModel(testContext.modelOptions);
      const error = new Error('fail');

      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      PayPalView.isEnabled.mockRejectedValue(error);
      PayPalCreditView.isEnabled.mockResolvedValue(false);

      return model.initialize().then(() => {
        expect(console.error).toBeCalledTimes(2);
        expect(console.error).toBeCalledWith('paypal view errored when checking if it was supported.');
        expect(console.error).toBeCalledWith(error);
      });
    });

    it('rejects with an error when there are no payment options', () => {
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

    it('throws an error when paymentOptionPriority is an empty array', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = [];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(throwIfResolves).catch(err => {
        expect(err.message).toBe('No valid payment options available.');
      });
    });

    it('supports cards, PayPal, PayPal Credit, Venmo, Apple Pay and Google Pay and defaults to showing them in correct paymentOptionPriority', () => {
      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['card', 'paypal', 'paypalCredit', 'venmo', 'applePay', 'googlePay']);
      });
    });

    it('marks payment method as unsupported if isEnabled rejects', () => {
      const model = new DropinModel(testContext.modelOptions);

      GooglePayView.isEnabled.mockRejectedValue(new Error('no google pay'));

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['card', 'paypal', 'paypalCredit', 'venmo', 'applePay']);
      });
    });

    it('uses custom paymentOptionPriority of payment options', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'card'];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['paypal', 'card']);
      });
    });

    it('ignores duplicates', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'paypal', 'card'];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.supportedPaymentOptions).toEqual(['paypal', 'card']);
      });
    });

    it('calls isEnabled on payment method view to determine if payment method is available', () => {
      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(ApplePayView.isEnabled).toBeCalledTimes(1);
        expect(ApplePayView.isEnabled).toBeCalledWith({
          environment: 'development',
          merchantConfiguration: testContext.modelOptions.merchantConfiguration
        });
        expect(CardView.isEnabled).toBeCalledTimes(1);
        expect(CardView.isEnabled).toBeCalledWith({
          environment: 'development',
          merchantConfiguration: testContext.modelOptions.merchantConfiguration
        });
        expect(GooglePayView.isEnabled).toBeCalledTimes(1);
        expect(GooglePayView.isEnabled).toBeCalledWith({
          environment: 'development',
          merchantConfiguration: testContext.modelOptions.merchantConfiguration
        });
        expect(PayPalView.isEnabled).toBeCalledTimes(1);
        expect(PayPalView.isEnabled).toBeCalledWith({
          environment: 'development',
          merchantConfiguration: testContext.modelOptions.merchantConfiguration
        });
        expect(PayPalCreditView.isEnabled).toBeCalledTimes(1);
        expect(PayPalCreditView.isEnabled).toBeCalledWith({
          environment: 'development',
          merchantConfiguration: testContext.modelOptions.merchantConfiguration
        });
        expect(VenmoView.isEnabled).toBeCalledTimes(1);
        expect(VenmoView.isEnabled).toBeCalledWith({
          environment: 'development',
          merchantConfiguration: testContext.modelOptions.merchantConfiguration
        });
      });
    });

    it('rejects with an error when an unrecognized payment option is specified', () => {
      let model;

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      testContext.modelOptions.merchantConfiguration.paypal = true;
      testContext.modelOptions.merchantConfiguration.paymentOptionPriority = ['foo', 'paypal', 'card'];

      model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(throwIfResolves).catch(err => {
        expect(err.message).toBe('paymentOptionPriority: Invalid payment option specified.');
      });
    });
  });

  describe('addPaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      return testContext.model.initialize();
    });

    it('adds a new payment method to _paymentMethods', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);

      expect(testContext.model._paymentMethods[0]).toBe(paymentMethod);
    });

    it('emits onAddPaymentMethod event with new payment method', done => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.on('addPaymentMethod', emittedPaymentMethod => {
        expect(emittedPaymentMethod).toBe(paymentMethod);
        done();
      });

      testContext.model.addPaymentMethod(paymentMethod);
    });

    it('changes active payment method to active payment method', () => {
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

    it('removes a payment method from _paymentMethods', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);

      testContext.model.removePaymentMethod(paymentMethod);

      expect(testContext.model._paymentMethods).toEqual([]);
    });

    it('does not remove a payment method from _paymentMethods if it only deep equals the existing payment method', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);

      testContext.model.removePaymentMethod({ foo: 'bar' });

      expect(testContext.model._paymentMethods[0]).toBe(paymentMethod);
    });

    it('emits onRemovePaymentMethod event with new payment method', done => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.addPaymentMethod(paymentMethod);
      testContext.model.on('removePaymentMethod', emittedPaymentMethod => {
        expect(emittedPaymentMethod).toBe(paymentMethod);
        done();
      });

      testContext.model.removePaymentMethod(paymentMethod);
    });

    it('does not emit onRemovePaymentMethod event when payment method does not exist', () => {
      const paymentMethod = { foo: 'bar' };

      jest.spyOn(testContext.model, '_emit');
      testContext.model.addPaymentMethod(paymentMethod);

      testContext.model.removePaymentMethod({ someother: 'paymentMethod' });

      expect(testContext.model._emit).not.toBeCalledWith('removePaymentMethod');
    });
  });

  describe('getPaymentMethods', () => {
    it('returns a copy of the _paymentMethods array', () => {
      const model = new DropinModel(testContext.modelOptions);

      model._paymentMethods = ['these are my payment methods'];

      expect(model.getPaymentMethods()).not.toBe(model._paymentMethods);
      expect(model.getPaymentMethods()).toEqual(model._paymentMethods);
    });
  });

  describe('removeUnvaultedPaymentMethods', () => {
    it('removes all unvaulted payment methods', () => {
      const model = new DropinModel(testContext.modelOptions);

      model._paymentMethods = [];

      const unvaultedPaymentMethod = { id: 'unvaulted-1' };
      const vaultedPaymentMethod = { id: 'vaulted', vaulted: true };
      const otherUnvaultedPaymentMethod = { id: 'unvaulted-2' };

      model.addPaymentMethod(unvaultedPaymentMethod);
      model.addPaymentMethod(vaultedPaymentMethod);
      model.addPaymentMethod(otherUnvaultedPaymentMethod);

      model.removeUnvaultedPaymentMethods();

      expect(model._paymentMethods).toEqual([{
        id: 'vaulted', vaulted: true
      }]);
    });

    it('removes all unvaulted payment methods that match specified filter', () => {
      const model = new DropinModel(testContext.modelOptions);

      model._paymentMethods = [];

      const unvaultedPaymentMethod = { id: 'unvaulted-1' };
      const vaultedPaymentMethod = { id: 'vaulted', vaulted: true };
      const otherUnvaultedPaymentMethod = { id: 'unvaulted-2' };

      model.addPaymentMethod(unvaultedPaymentMethod);
      model.addPaymentMethod(vaultedPaymentMethod);
      model.addPaymentMethod(otherUnvaultedPaymentMethod);

      model.removeUnvaultedPaymentMethods((paymentMethod) => {
        return paymentMethod.id === 'unvaulted-1';
      });

      expect(model._paymentMethods).toEqual([{
        id: 'vaulted', vaulted: true
      }, {
        id: 'unvaulted-2'
      }]);
    });
  });

  describe('refreshPaymentMethods', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
      testContext.fakeMethod = { type: 'CreditCard', nonce: 'a-nonce' };
      jest.spyOn(testContext.model, 'getVaultedPaymentMethods').mockResolvedValue([testContext.fakeMethod]);
      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    it('calls out to get vaulted payment methods', () => {
      return testContext.model.refreshPaymentMethods().then(() => {
        expect(testContext.model.getVaultedPaymentMethods).toBeCalledTimes(1);
      });
    });

    it('replaces payment methods on model', () => {
      testContext.model._paymentMethods = [{ type: 'foo' }];

      return testContext.model.refreshPaymentMethods().then(() => {
        expect(testContext.model.getPaymentMethods()).toEqual([testContext.fakeMethod]);
      });
    });

    it('remits refresh event', () => {
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

    it('sets new payment method to _activePaymentMethod', () => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.changeActivePaymentMethod(paymentMethod);

      expect(testContext.model._activePaymentMethod).toBe(paymentMethod);
    });

    it('emits changeActivePaymentMethod event with active payment method', done => {
      const paymentMethod = { foo: 'bar' };

      testContext.model.on('changeActivePaymentMethod', emittedPaymentMethod => {
        expect(emittedPaymentMethod).toBe(paymentMethod);
        done();
      });

      testContext.model.changeActivePaymentMethod(paymentMethod);
    });
  });

  describe('removeActivePaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
      jest.spyOn(testContext.model, '_emit').mockImplementation();
      jest.spyOn(testContext.model, 'setPaymentMethodRequestable').mockImplementation();
    });

    it('sets active payment method to null', () => {
      testContext.model._activePaymentMethod = { foo: 'bar' };

      testContext.model.removeActivePaymentMethod();

      expect(testContext.model._activePaymentMethod).toBeFalsy();
    });

    it('emits removeActivePaymentMethod event', () => {
      testContext.model.removeActivePaymentMethod();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('removeActivePaymentMethod');
    });

    it('sets payment method to not be requestable', () => {
      testContext.model.removeActivePaymentMethod();

      expect(testContext.model.setPaymentMethodRequestable).toBeCalledTimes(1);
      expect(testContext.model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: false
      });
    });
  });

  describe('getActivePaymentMethod', () => {
    it('returns _activePaymentMethod', () => {
      const model = new DropinModel(testContext.modelOptions);

      model._activePaymentMethod = 'this is my active payment method';

      expect(model.getActivePaymentMethod()).toBe('this is my active payment method');
    });
  });

  describe('reportAppSwitchPayload', () => {
    it('saves app switch payload to instance', () => {
      const model = new DropinModel(testContext.modelOptions);
      const payload = { nonce: 'fake-nonce' };

      model.reportAppSwitchPayload(payload);

      expect(model.appSwitchPayload).toBe(payload);
    });
  });

  describe('reportAppSwitchError', () => {
    it('saves app switch error and view id', () => {
      const model = new DropinModel(testContext.modelOptions);
      const error = new Error('Error');

      model.reportAppSwitchError('view-id', error);

      expect(model.appSwitchError.id).toBe('view-id');
      expect(model.appSwitchError.error).toBe(error);
    });
  });

  describe('asyncDependencyStarting', () => {
    beforeEach(() => {
      testContext.context = {
        dependenciesInitializing: 0
      };
    });

    it('increments dependenciesInitializing by one', () => {
      DropinModel.prototype.asyncDependencyStarting.call(testContext.context);
      expect(testContext.context.dependenciesInitializing).toBe(1);
    });
  });

  describe('asyncDependencyFailed', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);
    });

    it('adds an error to the failedDependencies object', () => {
      const err = new Error('a bad error');

      testContext.model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      expect(testContext.model.failedDependencies.id).toBe(err);
    });

    it('ignores error if failure was already reported', () => {
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

    it('emits asyncDependenciesReady event when there are no dependencies initializing', done => {
      const model = new DropinModel(testContext.modelOptions);

      model.on('asyncDependenciesReady', () => {
        done();
      });

      model.asyncDependencyStarting();
      model.asyncDependencyFailed({
        view: 'id',
        error: new Error('fake error')
      });
    });
  });

  describe('asyncDependencyReady', () => {
    beforeEach(() => {
      testContext.context = { callback: jest.fn() };
    });

    it('decrements dependenciesInitializing by one', () => {
      const model = new DropinModel(testContext.modelOptions);

      model.dependenciesInitializing = 2;

      model.asyncDependencyReady();

      expect(model.dependenciesInitializing).toBe(1);
    });

    it('emits asyncDependenciesReady event when there are no dependencies initializing', done => {
      const model = new DropinModel(testContext.modelOptions);

      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');

      model.on('asyncDependenciesReady', () => {
        expect(DropinModel.prototype.asyncDependencyReady).toBeCalledTimes(1);
        done();
      });

      model.asyncDependencyStarting();
      model.asyncDependencyReady();
    });

    it('emits asyncDependenciesReady event with prior errors', () => {
      const model = new DropinModel(testContext.modelOptions);
      const err = new Error('an earlier dependency failed');

      jest.spyOn(model, '_emit');

      model.asyncDependencyStarting();
      model.asyncDependencyStarting();
      model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      model.asyncDependencyReady();

      expect(model._emit).toBeCalledWith('asyncDependenciesReady');
    });
  });

  describe('cancelInitialization', () => {
    it('emits cancelInitialization event wth the error', done => {
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
    it('emits an errorOccurred event with the error', done => {
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
    it('emits an errorCleared event', done => {
      const dropinModel = new DropinModel(testContext.modelOptions);

      dropinModel.on('errorCleared', () => {
        done();
      });

      dropinModel.clearError();
    });
  });

  describe('isPaymentMethodRequestable', () => {
    it('returns false initially if no payment methods are available', () => {
      const model = new DropinModel(testContext.modelOptions);

      return model.initialize().then(() => {
        expect(model.isPaymentMethodRequestable()).toBe(false);
      });
    });

    it('returns true initially if customer has saved payment methods', () => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      const model = new DropinModel(testContext.modelOptions);

      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([{ type: 'CreditCard', details: { lastTwo: '11' }}]);

      return model.initialize().then(() => {
        expect(model.isPaymentMethodRequestable()).toBe(true);
      });
    });
  });

  describe('setPaymentMethodRequestable', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      testContext.model.confirmDropinReady();
      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    it('sets isPaymentMethodRequestable to true when isRequestable is true', () => {
      expect(testContext.model.isPaymentMethodRequestable()).toBe(false);

      testContext.model.setPaymentMethodRequestable({
        isRequestable: true
      });

      expect(testContext.model.isPaymentMethodRequestable()).toBe(true);
    });

    it('emits paymentMethodRequestable with type when isRequestable is true', () => {
      testContext.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'card'
      });

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('paymentMethodRequestable', {
        type: 'card',
        paymentMethodIsSelected: false
      });
    });

    it('does not emit paymentMethodRequestable event if drop-in is not ready', () => {
      testContext.model._setupComplete = false;
      testContext.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'card'
      });

      expect(testContext.model._emit).not.toBeCalled();
    });

    it('sets isPaymentMethodRequestable to false when isRequestable is false', () => {
      testContext.model._paymentMethodIsRequestable = true;

      expect(testContext.model.isPaymentMethodRequestable()).toBe(true);

      testContext.model.setPaymentMethodRequestable({
        isRequestable: false
      });

      expect(testContext.model.isPaymentMethodRequestable()).toBe(false);
    });

    it('emits noPaymentMethodRequestable with type when isRequestable is false', () => {
      testContext.model._paymentMethodIsRequestable = true;
      testContext.model.setPaymentMethodRequestable({
        isRequestable: false
      });

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('noPaymentMethodRequestable');
    });

    it('does not emit when isRequestable state and nonce does not change', () => {
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
    });

    it('does not emit when isRequestable state is false and nonce has changed', () => {
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
    });

    it('does emit when isRequestable state has not changed, but nonce state does', () => {
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
    });

    it('ignores nonce if isRequestable is false', () => {
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

    it('includes the paymentMethodIsSelected as true if Drop-in displays a selected payment method', () => {
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
    });

    it('includes the paymentMethodIsSelected as false if no payment method is actively selected', () => {
      testContext.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'TYPE'
      });

      expect(testContext.model._emit).toBeCalledWith('paymentMethodRequestable', {
        type: 'TYPE',
        paymentMethodIsSelected: false
      });
    });
  });

  describe('selectPaymentOption', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    it('emits a paymentOptionSelected event with the id of the payment option that was selected', () => {
      testContext.model.selectPaymentOption('card');

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('paymentOptionSelected', {
        paymentOption: 'card'
      });
    });
  });

  describe('preventUserAction', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      jest.spyOn(testContext.model, '_emit').mockImplementation();
    });

    it('emits a preventUserAction event', () => {
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

    it('emits a allowUserAction event', () => {
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

    it('model.enableEditMode emits an enableEditMode event', () => {
      testContext.model.enableEditMode();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('enableEditMode');
    });

    it('model.enableEditMode sets isInEditMode to true', () => {
      expect(testContext.model.isInEditMode()).toBe(false);

      testContext.model.enableEditMode();

      expect(testContext.model.isInEditMode()).toBe(true);
    });

    it('model.disableEditMode emits a disableEditMode event', () => {
      testContext.model.disableEditMode();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('disableEditMode');
    });

    it('model.disableEditMode sets isInEditMode to false', () => {
      testContext.model.enableEditMode();

      expect(testContext.model.isInEditMode()).toBe(true);

      testContext.model.disableEditMode();

      expect(testContext.model.isInEditMode()).toBe(false);
    });

    it('model.confirmPaymentMethodDeletion emits a confirmPaymentMethodDeletion event', () => {
      const paymentMethod = {
        nonce: '123-fake-nonce'
      };

      testContext.model.confirmPaymentMethodDeletion(paymentMethod);

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('confirmPaymentMethodDeletion', paymentMethod);
    });
  });

  describe('deleteVaultedPaymentMethod', () => {
    beforeEach(() => {
      testContext.model = new DropinModel(testContext.modelOptions);

      testContext.model._paymentMethodWaitingToBeDeleted = {
        nonce: 'a-nonce',
        vaulted: true
      };
      jest.spyOn(testContext.model, '_emit').mockImplementation();

      return testContext.model.initialize();
    });

    it('emits a startVaultedPaymentMethodDeletion event', () => {
      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model._emit).toBeCalledWith('startVaultedPaymentMethodDeletion');
      });
    });

    it('removes stored payment method variable', () => {
      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model._paymentMethodWaitingToBeDeleted).toBeFalsy();
      });
    });

    it('uses vault manager to delete payment method', () => {
      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(fake.vaultManagerInstance.deletePaymentMethod).toBeCalledTimes(1);
        expect(fake.vaultManagerInstance.deletePaymentMethod).toBeCalledWith('a-nonce');
      });
    });

    it('does not vault manager to delete payment method if payment method is not vaulted', () => {
      delete testContext.model._paymentMethodWaitingToBeDeleted.vaulted;

      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(fake.vaultManagerInstance.deletePaymentMethod).not.toBeCalled();
      });
    });

    it('emits finishVaultedPaymentMethodDeletion event when deletion is succesful', () => {
      fake.vaultManagerInstance.deletePaymentMethod.mockResolvedValue();

      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model._emit).toBeCalledWith('finishVaultedPaymentMethodDeletion', undefined); // eslint-disable-line no-undefined
      });
    });

    it('emits finishVaultedPaymentMethodDeletion event when deletion is unsuccesful', () => {
      const error = new Error('aaaaaaah!');

      fake.vaultManagerInstance.deletePaymentMethod.mockRejectedValue(error);

      return testContext.model.deleteVaultedPaymentMethod().then(() => {
        expect(testContext.model._emit).toBeCalledWith('finishVaultedPaymentMethodDeletion', expect.any(Error));
      });
    });

    it('refetches payment methods', () => {
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

    it('emits a cancelVaultedPaymentMethodDeletion event', () => {
      testContext.model.cancelDeleteVaultedPaymentMethod();

      expect(testContext.model._emit).toBeCalledTimes(1);
      expect(testContext.model._emit).toBeCalledWith('cancelVaultedPaymentMethodDeletion');
    });

    it('removes stored payment method variable', () => {
      testContext.model.cancelDeleteVaultedPaymentMethod();

      expect(testContext.model._paymentMethodWaitingToBeDeleted).toBeFalsy();
    });
  });

  describe('getVaultedPaymentMethods', () => {
    beforeEach(() => {
      testContext.modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      testContext.model = new DropinModel(testContext.modelOptions);

      return testContext.model.initialize();
    });

    it('resolves with payment methods as empty array when vault manager errors', () => {
      fake.vaultManagerInstance.fetchPaymentMethods.mockRejectedValue(new Error('error'));

      return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
        expect(fake.vaultManagerInstance.fetchPaymentMethods).toBeCalledWith({
          defaultFirst: true
        });
        expect(paymentMethods).toEqual([]);
      });
    });

    it('resolves with payment methods as empty array when presentVaultedPaymentMethods is false', () => {
      testContext.model.vaultManagerConfig.presentVaultedPaymentMethods = false;

      return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
        expect(paymentMethods).toEqual([]);
      });
    });

    it('resolves with payment methods from vault manager when not in guest checkout', () => {
      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([{
        nonce: '1-nonce',
        type: 'CreditCard'
      }, {
        nonce: '2-nonce',
        type: 'PayPalAccount'
      }]);

      return testContext.model.getVaultedPaymentMethods().then(paymentMethods => {
        expect(fake.vaultManagerInstance.fetchPaymentMethods).toBeCalledWith({
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
    });

    it('only resolves supported payment method types', () => {
      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([{
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

    it('includes vaulted property on payment method objects', () => {
      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([{
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
        expect(fake.vaultManagerInstance.fetchPaymentMethods).toBeCalledWith({
          defaultFirst: true
        });
        expect(paymentMethods[0].vaulted).toBe(true);
        expect(paymentMethods[1].vaulted).toBe(true);
        expect(paymentMethods[2].vaulted).toBe(true);
      });
    });

    it('ignores invalid payment methods', () => {
      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([
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

    it('ignores vaulted payment methods that cannot be used client side', () => {
      fake.vaultManagerInstance.fetchPaymentMethods.mockResolvedValue([
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
    });
  });
});
