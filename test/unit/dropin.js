/* eslint-disable consistent-return */

jest.mock('../../src/lib/analytics');

const assets = require('@braintree/asset-loader');
const hostedFields = require('braintree-web/hosted-fields');
const paypalCheckout = require('braintree-web/paypal-checkout');
const threeDSecure = require('braintree-web/three-d-secure');
const vaultManager = require('braintree-web/vault-manager');
const Dropin = require('../../src/dropin');
const CardView = require('../../src/views/payment-sheet-views/card-view');
const DataCollector = require('../../src/lib/data-collector');
const DropinModel = require('../../src/dropin-model');
const EventEmitter = require('@braintree/event-emitter');
const ThreeDSecure = require('../../src/lib/three-d-secure');
const analytics = require('../../src/lib/analytics');
const fake = require('../helpers/fake');
const constants = require('../../src/constants');

function delay(amount) {
  amount = amount || 100;

  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, amount);
  });
}

describe('Dropin', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.vaultManager = {
      fetchPaymentMethods: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(vaultManager, 'create').mockResolvedValue(testContext.vaultManager);

    testContext.container = document.createElement('div');
    testContext.container.id = 'foo';
    document.body.appendChild(testContext.container);

    testContext.dropinOptions = {
      merchantConfiguration: {
        container: '#foo',
        authorization: fake.tokenizationKey
      }
    };

    const fakeHostedFieldsInstance = fake.hostedFields();

    jest.spyOn(CardView.prototype, 'getPaymentMethod').mockImplementation();
    jest.spyOn(hostedFields, 'create').mockResolvedValue(fakeHostedFieldsInstance);
    jest.spyOn(paypalCheckout, 'create').mockResolvedValue(fake.paypalInstance);
    jest.spyOn(threeDSecure, 'create').mockResolvedValue(fake.threeDSecureInstance);

    fakeHostedFieldsInstance.getSupportedCardTypes.mockResolvedValue([]);
  });

  afterEach(() => {
    const stylesheet = document.getElementById(constants.STYLESHEET_ID);

    if (document.body.querySelector('#foo')) {
      document.body.removeChild(testContext.container);
    }

    if (stylesheet) {
      stylesheet.parentNode.removeChild(stylesheet);
    }
  });

  describe('Constructor', () => {
    it('inherits from EventEmitter', () => {
      expect(new Dropin(testContext.dropinOptions)).toBeInstanceOf(EventEmitter);
    });
  });

  describe('_initialize', () => {
    beforeEach(() => {
      testContext.paypalCheckout = {
        FUNDING: {
          PAYPAL: 'paypal'
        },
        Button: {
          render: jest.fn().mockResolvedValue()
        },
        setup: jest.fn()
      };

      jest.spyOn(assets, 'loadScript').mockImplementation(() => {
        global.paypal = testContext.paypalCheckout;

        return Promise.resolve();
      });
      jest.spyOn(console, 'error').mockImplementation();
    });

    it('errors out if no selector or container are given', done => {
      let instance;

      delete testContext.dropinOptions.merchantConfiguration.container;

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err.message).toBe('options.container is required.');
        expect(analytics.sendEvent).toBeCalledWith('configuration-error');
        done();
      });
    });

    it('errors out if both a selector and container are given', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.selector = { value: '#bar' };

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err.message).toBe('Must only have one options.selector or options.container.');
        expect(analytics.sendEvent).toBeCalledWith('configuration-error');
        done();
      });
    });

    it('errors out if all async dependencies fail', done => {
      let instance;
      const paypalError = new Error('PayPal Error');
      const hostedFieldsError = new Error('HostedFields Error');

      hostedFields.create.mockRejectedValue(hostedFieldsError);
      paypalCheckout.create.mockRejectedValue(paypalError);

      testContext.dropinOptions.merchantConfiguration.paypal = { flow: 'vault' };

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('All payment options failed to load.');
        expect(instance._dropinWrapper.innerHTML).toBe('');
        expect(analytics.sendEvent).toBeCalledWith('load-error');
        done();
      });
    });

    it('does not error if at least one dependency is available', done => {
      let instance;
      const hostedFieldsError = new Error('HostedFields Error');

      hostedFields.create.mockRejectedValue(hostedFieldsError);
      testContext.dropinOptions.merchantConfiguration.paypal = { flow: 'vault' };

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeFalsy();
        done();
      });
    });

    it('presents payment option as disabled if it fails', done => {
      let instance;
      const paypalError = new Error('PayPal Error');

      paypalCheckout.create.mockRejectedValue(paypalError);
      testContext.dropinOptions.merchantConfiguration.paypal = { flow: 'vault' };

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        const paypalOption = testContext.container.querySelector('.braintree-option__paypal');

        expect(paypalOption.className).toMatch('braintree-disabled');
        expect(paypalOption.innerHTML).toMatch('Developer Error: Something went wrong. Check the console for details.');
        done();
      });
    });

    it('logs specific error in the console', done => {
      let instance;
      const paypalError = new Error('PayPal Error');

      paypalCheckout.create.mockRejectedValue(paypalError);
      testContext.dropinOptions.merchantConfiguration.paypal = { flow: 'vault' };

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(console.error).toBeCalledTimes(1);
        expect(console.error).toBeCalledWith(paypalError);
        done();
      });
    });

    it('throws an error with a container that points to a nonexistent DOM node', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.container = '#garbage';

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('options.selector or options.container must reference a valid DOM node.');
        expect(analytics.sendEvent).toBeCalledWith('configuration-error');
        done();
      });
    });

    it('throws an error if merchant container from options.container is not empty', done => {
      let instance;
      const div = document.createElement('div');

      testContext.container.appendChild(div);

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('options.selector or options.container must reference an empty DOM node.');
        expect(analytics.sendEvent).toBeCalledWith('configuration-error');
        done();
      });
    });

    it('throws an error if merchant container from options.container is not empty', done => {
      let instance;
      const div = document.createElement('div');

      testContext.container.appendChild(div);

      testContext.dropinOptions.merchantConfiguration.container = testContext.container;

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('options.selector or options.container must reference an empty DOM node.');
        expect(analytics.sendEvent).toBeCalledWith('configuration-error');
        done();
      });
    });

    it('throws an error if merchant container from options.container is not a domNode-like object', done => {
      let instance;
      const fakeDiv = { appendChild: 'fake' };

      testContext.dropinOptions.merchantConfiguration.container = fakeDiv;

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('options.selector or options.container must reference a valid DOM node.');
        expect(analytics.sendEvent).toBeCalledWith('configuration-error');
        done();
      });
    });

    it('inserts dropin into container if merchant container has white space', done => {
      let instance;

      testContext.container.innerHTML = ' ';

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(testContext.container.innerHTML).toMatch('class="braintree-dropin');

        done();
      });
    });

    it('accepts a selector', done => {
      let instance;

      delete testContext.dropinOptions.merchantConfiguration.container;
      testContext.dropinOptions.merchantConfiguration.selector = '#foo';

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(err => {
        expect(err).toBeFalsy();
        done();
      });
    });

    it('inserts dropin into container', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(testContext.container.innerHTML).toMatch('class="braintree-dropin');

        done();
      });
    });

    it('inserts svgs into container', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(testContext.container.innerHTML).toMatch('data-braintree-id="svgs"');

        done();
      });
    });

    it('injects stylesheet with correct id', done => {
      jest.spyOn(assets, 'loadStylesheet');

      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        const stylesheet = document.getElementById(constants.STYLESHEET_ID);

        expect(stylesheet).toBeDefined();
        expect(stylesheet.href).toMatch(/assets\.braintreegateway\.com/);

        expect(assets.loadStylesheet).toBeCalledTimes(1);
        expect(assets.loadStylesheet).toBeCalledWith({
          id: constants.STYLESHEET_ID,
          href: expect.stringContaining('assets.braintreegateway.com')
        });

        done();
      });
    });

    test('injects stylesheet into shadow DOM instead of the head', done => {
      jest.spyOn(assets, 'loadStylesheet');

      const container = document.createElement('div');
      const insideShadowDOMWrapper = document.createElement('div');
      const dropinContainer = document.createElement('div');
      const shadowDom = container.attachShadow({ mode: 'open' });

      dropinContainer.id = 'dropin';
      insideShadowDOMWrapper.appendChild(dropinContainer);
      shadowDom.appendChild(insideShadowDOMWrapper);

      document.body.appendChild(container);
      testContext.dropinOptions.merchantConfiguration.container = dropinContainer;

      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        const stylesheet = shadowDom.querySelector(`#${constants.STYLESHEET_ID}`);

        expect(stylesheet).toBeDefined();
        expect(stylesheet.href).toMatch(/assets\.braintreegateway\.com/);

        expect(assets.loadStylesheet).toBeCalledTimes(1);
        expect(assets.loadStylesheet).toBeCalledWith({
          id: constants.STYLESHEET_ID,
          href: expect.stringContaining('assets.braintreegateway.com'),
          container: shadowDom
        });

        done();
      });
    });

    it('does not inject stylesheet if it already exists on the page', done => {
      const instance = new Dropin(testContext.dropinOptions);
      const stylesheetOnPage = document.createElement('link');

      stylesheetOnPage.id = constants.STYLESHEET_ID;
      stylesheetOnPage.href = '/customer/dropin.css';

      document.body.appendChild(stylesheetOnPage);

      instance._initialize(() => {
        const stylesheet = document.getElementById(constants.STYLESHEET_ID);

        expect(stylesheet).toBeDefined();
        expect(stylesheet.href).toMatch(/\/customer\/dropin\.css/);

        done();
      });
    });

    it('requests payment methods if a customerId is provided', done => {
      let instance;

      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([]);

      testContext.dropinOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        try {
          expect(vaultManager.create).toBeCalledTimes(1);
          expect(vaultManager.create).toBeCalledWith({
            authorization: fake.clientTokenWithCustomerID
          });
          expect(testContext.vaultManager.fetchPaymentMethods).toBeCalledTimes(1);
          expect(testContext.vaultManager.fetchPaymentMethods).toBeCalledWith(expect.objectContaining({
            defaultFirst: true
          }));
        } catch (e) {
          done(e);
        }

        done();
      });
    });

    it('creates a MainView when a customerId exists', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView).toBeDefined();

        done();
      });
    });

    it('creates a MainView a customerId does not exist', done => {
      testContext.dropinOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;

      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView).toBeDefined();
        done();
      });
    });

    it('calls the create callback when async dependencies are ready', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

      instance._initialize(err => {
        done(err);
      });

      delay().then(() => {
        instance._model.dependencySuccessCount = 1;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('returns to app switch view that reported an error', done => {
      const instance = new Dropin(testContext.dropinOptions);
      const error = new Error('error');

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'reportError').mockImplementation();

      instance._initialize(() => {
        expect(instance._model.reportError).toBeCalledTimes(1);
        expect(instance._model.reportError).toBeCalledWith(error);
        expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
        expect(instance._mainView.setPrimaryView).toBeCalledWith('view-id');
        done();
      });

      delay().then(() => {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchError = {
          id: 'view-id',
          error: error
        };
        jest.spyOn(instance._mainView, 'setPrimaryView').mockImplementation();
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('adds payment method if app switch payload exists', done => {
      const instance = new Dropin(testContext.dropinOptions);
      const payload = { nonce: 'fake-nonce' };

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'addPaymentMethod').mockImplementation();

      instance._initialize(() => {
        expect(instance._model.addPaymentMethod).toBeCalledTimes(1);
        expect(instance._model.addPaymentMethod).toBeCalledWith(payload);
        done();
      });

      delay().then(() => {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchPayload = payload;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('sends web.dropin.appeared event when async dependencies are ready', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

      instance._initialize(() => {
        expect(analytics.sendEvent).toBeCalledWith('appeared');
        done();
      });

      delay().then(() => {
        instance._model.dependencySuccessCount = 2;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('sends vaulted payment method appeared events for each vaulted payment method', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      instance._initialize(() => {
        expect(analytics.sendEvent).toBeCalledWith('vaulted-card.appear');
        expect(analytics.sendEvent).toBeCalledWith('vaulted-paypal.appear');
        done();
      });
    });

    it('sends a single analytic event even when multiple vaulted payment methods of the same kind are available', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'CreditCard', details: { lastTwo: '22' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }},
        { type: 'PayPalAccount', details: { email: 'woah@example.com' }}
      ]);

      instance._initialize(() => {
        expect(analytics.sendEvent).toBeCalledWith('vaulted-card.appear');
        expect(analytics.sendEvent).toBeCalledWith('vaulted-paypal.appear');
        done();
      });
    });

    it('does not send payment method analytic event when app switch payload present', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

      instance._initialize(() => {
        expect(analytics.sendEvent).not.toBeCalledWith('vaulted-card.appear');
        expect(analytics.sendEvent).not.toBeCalledWith('vaulted-paypal.appear');

        done();
      });

      delay().then(() => {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchPayload = {
          nonce: 'a-nonce'
        };
        jest.spyOn(instance._mainView, 'setPrimaryView').mockImplementation();

        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('does not send payment method analytic event when app switch error present', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
        { type: 'CreditCard', details: { lastTwo: '11' }},
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

      instance._initialize(() => {
        expect(analytics.sendEvent).not.toBeCalledWith('vaulted-card.appear');
        expect(analytics.sendEvent).not.toBeCalledWith('vaulted-paypal.appear');

        done();
      });

      delay().then(() => {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchError = {
          ID: 'view',
          error: new Error('error')
        };
        jest.spyOn(instance._mainView, 'setPrimaryView').mockImplementation();

        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('does not send web.vaulted-card.appear analytic event when no vaulted cards appear', done => {
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
        { type: 'PayPalAccount', details: { email: 'wow@example.com' }}
      ]);

      instance._initialize(() => {
        expect(analytics.sendEvent).not.toBeCalledWith('vaulted-card.appear');
        done();
      });
    });

    it('loads strings by default', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
        done();
      });
    });

    it('loads localized strings into mainView when options.locale is specified', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.locale = 'es_ES';
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.postalCodeLabel).toBe('Código postal');
        done();
      });
    });

    it('uses custom translations when options.translations is specified', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.translations = {
        payingWith: 'You are paying with {{paymentSource}}',
        chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string'
      };
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.payingWith).toBe('You are paying with {{paymentSource}}');
        expect(instance._mainView.strings.chooseAnotherWayToPay).toBe('My custom chooseAnotherWayToPay string');
        expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
        done();
      });
    });

    it('sanitizes html in custom translations', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.translations = {
        chooseAnotherWayToPay: '<script>alert()</script>'
      };
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.chooseAnotherWayToPay).toBe('&lt;script&gt;alert()&lt;/script&gt;');
        done();
      });
    });

    it('uses locale with custom translations', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.locale = 'es_ES';
      testContext.dropinOptions.merchantConfiguration.translations = {
        payingWith: 'You are paying with {{paymentSource}}',
        chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string'
      };
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.payingWith).toBe('You are paying with {{paymentSource}}');
        expect(instance._mainView.strings.chooseAnotherWayToPay).toBe('My custom chooseAnotherWayToPay string');
        expect(instance._mainView.strings.postalCodeLabel).toBe('Código postal');
        done();
      });
    });

    it('loads localized strings into mainView when options.locale is a supported locale ID', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.locale = 'en_GB';
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.postalCodeLabel).toBe('Postcode');
        done();
      });
    });

    it('loads supported localized strings into mainView when options.locale is a locale ID with an unsupported country', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.locale = 'en_NA';
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
        done();
      });
    });

    it('loads default strings into mainView when options.locale is unknown', done => {
      let instance;

      testContext.dropinOptions.merchantConfiguration.locale = 'foo';
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
        done();
      });
    });
  });

  describe('loads data collector', () => {
    beforeEach(() => {
      testContext.dropinOptions.merchantConfiguration.dataCollector = { kount: true };
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');
      jest.spyOn(Dropin.prototype, '_setUpDataCollector').mockImplementation();
    });

    it('does not load Data Collector if Data Collector is not enabled', done => {
      let instance;

      delete testContext.dropinOptions.merchantConfiguration.dataCollector;
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._setUpDataCollector).not.toBeCalled();

        done();
      });
    });

    it('does load Data Collector if Data Collector is enabled', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._setUpDataCollector).toBeCalled();

        done();
      });
    });
  });

  describe('loads 3D Secure', () => {
    beforeEach(() => {
      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');
      jest.spyOn(Dropin.prototype, '_setUpThreeDSecure');
    });

    it('does not load 3D Secure if 3D Secure is not enabled', done => {
      let instance;

      delete testContext.dropinOptions.merchantConfiguration.threeDSecure;
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._setUpThreeDSecure).not.toBeCalled();

        done();
      });
    });

    it('does load 3D Secure if 3D Secure is enabled', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        expect(instance._setUpThreeDSecure).toBeCalled();

        done();
      });
    });
  });

  describe('_setUpDataCollector', () => {
    beforeEach(() => {
      testContext.model = fake.model({
        componentID: 'foo',
        merchantConfiguration: {
          container: '#foo',
          authorization: fake.tokenizationKey
        },
        paymentMethods: ['card']
      });
      jest.spyOn(DataCollector.prototype, 'initialize').mockResolvedValue();
    });

    it('sets up datacollector', () => {
      Dropin.prototype._setUpDataCollector.call({
        _authorization: 'fake-auth',
        _model: testContext.model,
        _strings: {},
        _merchantConfiguration: {
          dataCollector: {
            kount: true
          }
        }
      });

      expect(DataCollector.prototype.initialize).toBeCalledTimes(1);
    });

    it('fails initialization when Data Collection creation fails', done => {
      const error = new Error('failed.');

      jest.spyOn(DropinModel.prototype, 'cancelInitialization');

      DataCollector.prototype.initialize.mockRejectedValue(error);

      Dropin.prototype._setUpDataCollector.call({
        _authorization: 'fake-auth',
        _model: testContext.model,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(DataCollector.prototype.initialize).toBeCalledTimes(1);
      setTimeout(() => {
        expect(DropinModel.prototype.cancelInitialization).toBeCalled();
        done();
      }, 1000);
    });

    it('starts an async dependency', () => {
      function noop() {}
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');

      Dropin.prototype._setUpDataCollector.call({
        _authorization: 'fake-auth',
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        },
        _model: testContext.model
      }, noop);

      expect(DropinModel.prototype.asyncDependencyStarting).toBeCalledTimes(1);
    });
  });

  describe('_setUpThreeDSecure', () => {
    beforeEach(() => {
      testContext.model = fake.model({
        componentID: 'foo',
        merchantConfiguration: {
          container: '#foo',
          authorization: fake.tokenizationKey
        },
        paymentMethods: ['card']
      });
      jest.spyOn(ThreeDSecure.prototype, 'initialize').mockResolvedValue();
    });

    it('sets up 3ds', () => {
      Dropin.prototype._setUpThreeDSecure.call({
        _authorization: 'fake-auth',
        _model: testContext.model,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(ThreeDSecure.prototype.initialize).toBeCalledTimes(1);
    });

    it('fails initialization when 3DS creation fails', done => {
      const error = new Error('failed.');

      jest.spyOn(DropinModel.prototype, 'cancelInitialization');

      ThreeDSecure.prototype.initialize.mockRejectedValue(error);

      Dropin.prototype._setUpThreeDSecure.call({
        _authorization: 'fake-auth',
        _model: testContext.model,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(ThreeDSecure.prototype.initialize).toBeCalledTimes(1);
      setTimeout(() => {
        expect(DropinModel.prototype.cancelInitialization).toBeCalled();
        done();
      }, 1000);
    });

    it('starts an async dependency', () => {
      function noop() {}
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');

      Dropin.prototype._setUpThreeDSecure.call({
        _authorization: 'fake-auth',
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        },
        _model: testContext.model
      }, noop);

      expect(DropinModel.prototype.asyncDependencyStarting).toBeCalledTimes(1);
    });
  });

  describe('teardown', () => {
    beforeEach(() => {
      testContext.instance = new Dropin(testContext.dropinOptions);
      testContext.container.appendChild(testContext.instance._dropinWrapper);
      testContext.instance._mainView = {
        teardown: jest.fn().mockResolvedValue()
      };
    });

    it('removes dropin node from page', done => {
      testContext.instance.teardown(() => {
        expect(testContext.container.contains(testContext.instance._dropinWrapper)).toBe(false);
        done();
      });
    });

    it('calls teardown on the mainView', done => {
      testContext.instance.teardown(() => {
        expect(testContext.instance._mainView.teardown).toBeCalledTimes(1);
        done();
      });
    });

    it('calls teardown on dataCollector', done => {
      testContext.instance._dataCollector = {
        teardown: jest.fn().mockResolvedValue()
      };

      testContext.instance.teardown(() => {
        expect(testContext.instance._dataCollector.teardown).toBeCalledTimes(1);
        done();
      });
    });

    it('calls teardown on 3D Secure', done => {
      testContext.instance._threeDSecure = {
        teardown: jest.fn().mockResolvedValue()
      };

      testContext.instance.teardown(() => {
        expect(testContext.instance._threeDSecure.teardown).toBeCalledTimes(1);
        done();
      });
    });

    it('passes errors from data collector teardown to callback', done => {
      const error = new Error('Data Collector failured');

      testContext.instance._dataCollector = {
        teardown: jest.fn().mockRejectedValue(error)
      };

      testContext.instance.teardown(err => {
        expect(err.message).toBe('Drop-in errored tearing down Data Collector.');
        done();
      });
    });

    it('passes errors from 3D Secure teardown to callback', done => {
      const error = new Error('3D Secure failured');

      testContext.instance._threeDSecure = {
        teardown: jest.fn().mockRejectedValue(error)
      };

      testContext.instance.teardown(err => {
        expect(err.message).toBe('Drop-in errored tearing down 3D Secure.');
        done();
      });
    });

    it('passes errors in mainView teardown to callback', done => {
      const error = new Error('Teardown Error');

      testContext.instance._mainView.teardown.mockRejectedValue(error);

      testContext.instance.teardown(err => {
        expect(err).toBe(error);
        done();
      });
    });
  });

  describe('requestPaymentMethod', () => {
    it('calls the requestPaymentMethod function of the MainView', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue({
          nonce: 'fake-nonce'
        });
        instance.requestPaymentMethod(() => {
          expect(instance._mainView.requestPaymentMethod).toBeCalledTimes(1);
          done();
        });
      });
    });

    it('returns a formatted payload', done => {
      const instance = new Dropin(testContext.dropinOptions);
      const fakePayload = {
        nonce: 'cool-nonce',
        details: {
          foo: 'bar'
        },
        type: 'cool-type',
        vaulted: true,
        deviceData: 'cool-device-data',
        binData: {
          bin: 'data'
        },
        rogueParameter: 'baz'
      };

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod((err, payload) => {
          expect(payload.nonce).toBe(fakePayload.nonce);
          expect(payload.details).toBe(fakePayload.details);
          expect(payload.type).toBe(fakePayload.type);
          expect(payload.vaulted).toBe(fakePayload.vaulted);
          expect(payload.deviceData).toBe(fakePayload.deviceData);
          expect(payload.binData).toBe(fakePayload.binData);

          expect(payload.rogueParameter).toBeFalsy();

          done();
        });
      });
    });

    it('includes rawPaymentData if a Google Pay payment method', done => {
      const instance = new Dropin(testContext.dropinOptions);
      const rawPaymentData = { foo: 'bar' };
      const fakePayload = {
        nonce: 'cool-nonce',
        details: {
          foo: 'bar'
        },
        rawPaymentData: rawPaymentData,
        type: 'AndroidPayCard',
        binData: {
          bin: 'data'
        },
        rogueParameter: 'baz'
      };

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod((err, payload) => {
          expect(payload.details.rawPaymentData).toBe(rawPaymentData);

          done();
        });
      });
    });

    it('includes rawPaymentData if an Apple Pay payment method', done => {
      const instance = new Dropin(testContext.dropinOptions);
      const rawPaymentData = { foo: 'bar' };
      const fakePayload = {
        nonce: 'cool-nonce',
        details: {
          foo: 'bar'
        },
        rawPaymentData: rawPaymentData,
        type: 'ApplePayCard',
        binData: {
          bin: 'data'
        },
        rogueParameter: 'baz'
      };

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod((err, payload) => {
          expect(payload.details.rawPaymentData).toBe(rawPaymentData);

          done();
        });
      });
    });

    it('does not call 3D Secure if it is not enabled', done => {
      const fakePayload = {
        nonce: 'cool-nonce'
      };
      const instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(ThreeDSecure.prototype, 'verify');

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod(() => {
          expect(ThreeDSecure.prototype.verify).not.toBeCalled();

          done();
        });
      });
    });

    it('does not call 3D Secure if payment method is not a credit card', done => {
      let instance;
      const fakePayload = {
        nonce: 'cool-nonce',
        type: 'PAYPAL_ACCOUNT'
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(ThreeDSecure.prototype, 'verify');

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod(() => {
          expect(ThreeDSecure.prototype.verify).not.toBeCalled();

          done();
        });
      });
    });

    it('does not call 3D Secure if payment method nonce payload contains liablity information', done => {
      let instance;
      const fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard',
        liabilityShifted: false
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(ThreeDSecure.prototype, 'verify');

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod(() => {
          expect(ThreeDSecure.prototype.verify).not.toBeCalled();

          done();
        });
      });
    });

    it('calls 3D Secure if payment method nonce payload is a credit card and does not contain liability info', done => {
      let instance;
      const fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);
        instance._threeDSecure = {
          verify: jest.fn().mockResolvedValue({
            nonce: 'new-nonce',
            liabilityShifted: true,
            liabilityShiftPossible: true
          })
        };

        instance.requestPaymentMethod(() => {
          expect(instance._threeDSecure.verify).toBeCalledTimes(1);
          expect(instance._threeDSecure.verify).toBeCalledWith(fakePayload, undefined); // eslint-disable-line no-undefined

          done();
        });
      });
    });

    it(
      'calls 3D Secure if payment method nonce payload is a non-network tokenized google pay and does not contain liability info',
      done => {
        let instance;
        const fakePayload = {
          nonce: 'cool-nonce',
          type: 'AndroidPayCard',
          details: {
            isNetworkTokenized: false
          }
        };

        testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(() => {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);
          instance._threeDSecure = {
            verify: jest.fn().mockResolvedValue({
              nonce: 'new-nonce',
              liabilityShifted: true,
              liabilityShiftPossible: true
            })
          };

          instance.requestPaymentMethod(() => {
            expect(instance._threeDSecure.verify).toBeCalledTimes(1);
            expect(instance._threeDSecure.verify).toBeCalledWith(fakePayload, undefined); // eslint-disable-line no-undefined

            done();
          });
        });
      }
    );

    it(
      'does not call 3D Secure if network tokenized google pay',
      done => {
        let instance;
        const fakePayload = {
          nonce: 'cool-nonce',
          type: 'AndroidPayCard',
          details: {
            isNetworkTokenized: true
          }
        };

        testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

        instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(ThreeDSecure.prototype, 'verify');

        instance._initialize(() => {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

          instance.requestPaymentMethod(() => {
            expect(ThreeDSecure.prototype.verify).not.toBeCalled();

            done();
          });
        });
      }
    );

    it('can pass additional 3ds info from merchant', done => {
      let instance;
      const fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };
      const threeDSInfo = {
        email: 'foo@example.com',
        billingAddress: {}
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);
        instance._threeDSecure = {
          verify: jest.fn().mockResolvedValue({
            nonce: 'new-nonce',
            liabilityShifted: true,
            liabilityShiftPossible: true
          })
        };

        instance.requestPaymentMethod({
          threeDSecure: threeDSInfo
        }, () => {
          expect(instance._threeDSecure.verify).toBeCalledTimes(1);
          expect(instance._threeDSecure.verify).toBeCalledWith(fakePayload, threeDSInfo);

          done();
        });
      });
    });

    it('replaces payload nonce with new 3ds nonce', done => {
      let instance;
      const fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);
        instance._threeDSecure = {
          verify: jest.fn().mockResolvedValue({
            nonce: 'new-nonce',
            liabilityShifted: true,
            liabilityShiftPossible: true,
            threeDSecureInfo: {
              threeDSecureAuthenticationId: 'id'
            }
          })
        };

        instance.requestPaymentMethod((err, payload) => {
          expect(payload.nonce).toBe('new-nonce');
          expect(payload.liabilityShifted).toBe(true);
          expect(payload.liabilityShiftPossible).toBe(true);
          expect(payload.liabilityShifted).toBe(true);
          expect(payload.liabilityShiftPossible).toBe(true);
          expect(payload.threeDSecureInfo.threeDSecureAuthenticationId).toBe('id');

          done();
        });
      });
    });
  });

  describe('isPaymentMethodRequestable', () => {
    it('returns the value of model.isPaymentMethodRequestable', () => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._model = {
        isPaymentMethodRequestable: jest.fn().mockReturnValue('foo')
      };

      expect(instance.isPaymentMethodRequestable()).toBe('foo');
    });
  });

  describe('updateConfiguration', () => {
    it('does not update if a non-editiable prop is used', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };

      instance._mainView = {
        getView: jest.fn().mockReturnValue(fakePayPalView)
      };

      instance.updateConfiguration('card', 'foo', 'bar');

      expect(instance._mainView.getView).not.toBeCalled();
    });

    it('does not update if view is not set up', () => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._mainView = {
        getView: jest.fn().mockReturnValue(null)
      };

      expect(() => {
        instance.updateConfiguration('paypal', 'foo', 'bar');
      }).not.toThrowError();
    });

    it('updates if view is paypal', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypal') {
          return fakePayPalView;
        }
      });

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    it('updates if view is paypalCredit', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypalCredit') {
          return fakePayPalView;
        }
      });

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      instance.updateConfiguration('paypalCredit', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    it('updates if view is applePay', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeApplePayView = {
        updateConfiguration: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'applePay') {
          return fakeApplePayView;
        }
      });

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      instance.updateConfiguration('applePay', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakeApplePayView.updateConfiguration).toBeCalledTimes(1);
      expect(fakeApplePayView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    it('updates if view is googlePay', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeGooglePayView = {
        updateConfiguration: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'googlePay') {
          return fakeGooglePayView;
        }
      });

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      instance.updateConfiguration('googlePay', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakeGooglePayView.updateConfiguration).toBeCalledTimes(1);
      expect(fakeGooglePayView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    it('updates if property is threeDSecure', () => {
      const instance = new Dropin(testContext.dropinOptions);

      instance._threeDSecure = {
        updateConfiguration: jest.fn()
      };
      instance._mainView = {
        getView: jest.fn()
      };

      instance.updateConfiguration('threeDSecure', 'amount', '15.00');

      expect(instance._threeDSecure.updateConfiguration).toBeCalledTimes(1);
      expect(instance._threeDSecure.updateConfiguration).toBeCalledWith('amount', '15.00');
      expect(instance._mainView.getView).not.toBeCalled();
    });

    it('does not update if property is threeDSecure, but there is no threeDSecure instance', () => {
      const instance = new Dropin(testContext.dropinOptions);

      expect(() => {
        instance.updateConfiguration('threeDSecure', 'amount', '15.00');
      }).not.toThrowError();
    });

    it('removes only saved paypal payment methods if they are not vaulted', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'PayPalAccount', vaulted: true },
          { nonce: '2', type: 'CreditCard', vaulted: true },
          { nonce: '3', type: 'PayPalAccount' },
          { nonce: '4', type: 'PayPalAccount', vaulted: true },
          { nonce: '5', type: 'PayPalAccount' }
        ]),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypal') {
          return fakePayPalView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._model.removeUnvaultedPaymentMethods).toBeCalledTimes(1);

      const filter = instance._model.removeUnvaultedPaymentMethods.mock.calls[0][0];

      expect(filter({
        type: 'PayPalAccount'
      })).toBe(true);

      expect(filter({
        type: 'CreditCard'
      })).toBe(false);
      expect(filter({
        type: 'AndroidPayCard'
      })).toBe(false);
      expect(filter({
        type: 'ApplePayCard'
      })).toBe(false);
      expect(filter({
        type: 'VenmoAccount'
      })).toBe(false);
    });

    it('removes only saved applePay payment methods if they are not vaulted', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeApplePayView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'ApplePayCard'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'ApplePayCard', vaulted: true },
          { nonce: '2', type: 'CreditCard', vaulted: true },
          { nonce: '3', type: 'ApplePayCard' },
          { nonce: '4', type: 'ApplePayCard', vaulted: true },
          { nonce: '5', type: 'ApplePayCard' }
        ]),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'applePay') {
          return fakeApplePayView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('applePay', 'foo', 'bar');

      expect(instance._model.removeUnvaultedPaymentMethods).toBeCalledTimes(1);

      const filter = instance._model.removeUnvaultedPaymentMethods.mock.calls[0][0];

      expect(filter({
        type: 'ApplePayCard'
      })).toBe(true);

      expect(filter({
        type: 'CreditCard'
      })).toBe(false);
      expect(filter({
        type: 'PayPalAccount'
      })).toBe(false);
      expect(filter({
        type: 'AndroidPayCard'
      })).toBe(false);
      expect(filter({
        type: 'VenmoAccount'
      })).toBe(false);
    });

    it('removes only saved googlePay payment methods if they are not vaulted', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeGooglePayView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'AndroidPayCard'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'AndroidPayCard', vaulted: true },
          { nonce: '2', type: 'CreditCard', vaulted: true },
          { nonce: '3', type: 'AndroidPayCard' },
          { nonce: '4', type: 'AndroidPayCard', vaulted: true },
          { nonce: '5', type: 'AndroidPayCard' }
        ]),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'googlePay') {
          return fakeGooglePayView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('googlePay', 'foo', 'bar');

      expect(instance._model.removeUnvaultedPaymentMethods).toBeCalledTimes(1);

      const filter = instance._model.removeUnvaultedPaymentMethods.mock.calls[0][0];

      expect(filter({
        type: 'AndroidPayCard'
      })).toBe(true);

      expect(filter({
        type: 'CreditCard'
      })).toBe(false);
      expect(filter({
        type: 'PayPalAccount'
      })).toBe(false);
      expect(filter({
        type: 'ApplePayCard'
      })).toBe(false);
      expect(filter({
        type: 'VenmoAccount'
      })).toBe(false);
    });

    it('sets primary view to options if on the methods view and there are no saved payment methods and supportedPaymentOptions is greater than 1', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        supportedPaymentOptions: ['paypal', 'card'],
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypal') {
          return fakePayPalView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
      expect(instance._mainView.setPrimaryView).toBeCalledWith('options');
    });

    it('sets primary view to available payment option view if on the methods view and there are not saved payment methods and only one payment option is available', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        supportedPaymentOptions: ['paypal'],
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypal') {
          return fakePayPalView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
      expect(instance._mainView.setPrimaryView).toBeCalledWith('paypal');
    });

    it('does not set primary view if current primary view is not methods', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'any-id-but-methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypal') {
          return fakePayPalView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).not.toBeCalled();
    });

    it('does not set primary view if there are saved payment methods', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakePayPalView = {
        updateConfiguration: jest.fn()
      };
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'CreditCard' }
        ]),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'paypal') {
          return fakePayPalView;
        } else if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).not.toBeCalled();
    });
  });

  describe('getAvailablePaymentOptions', () => {
    test('returns an array of payment options presented to the customer', (done) => {
      testContext.dropinOptions.merchantConfiguration.paypal = {
        flow: 'vault'
      };

      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        const result = instance.getAvailablePaymentOptions();

        expect(result).toEqual(['card', 'paypal']);

        done();
      });
    });
  });

  describe('getAvailablePaymentOptions', () => {
    test('returns an array of payment options presented to the customer', (done) => {
      testContext.dropinOptions.merchantConfiguration.paypal = {
        flow: 'vault'
      };

      const instance = new Dropin(testContext.dropinOptions);

      instance._initialize(() => {
        const result = instance.getAvailablePaymentOptions();

        expect(result).toEqual(['card', 'paypal']);

        done();
      });
    });
  });

  describe('clearSelectedPaymentMethod', () => {
    it('refreshes saved payment methods', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'PayPalAccount', vaulted: true },
          { nonce: '2', type: 'CreditCard', vaulted: true },
          { nonce: '3', type: 'CreditCard' },
          { nonce: '4', type: 'PayPalAccount' },
          { nonce: '5', type: 'PayPalAccount', vaulted: true }
        ]),
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._model.refreshPaymentMethods).toBeCalledTimes(1);
    });

    it('does not call removePaymentMethod if no non-vaulted paypal accounts are avaialble', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'PayPalAccount', vaulted: true },
          { nonce: '2', type: 'CreditCard', vaulted: true },
          { nonce: '3', type: 'PayPalAccount', vaulted: true }
        ]),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._model.removePaymentMethod).not.toBeCalled();
    });

    it('sets primary view to options if on the methods view and there are no saved payment methods and supportedPaymentOptions is greater than 1', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeActivePaymentMethod: jest.fn(),
        supportedPaymentOptions: ['paypal', 'card'],
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
      expect(instance._mainView.setPrimaryView).toBeCalledWith('options');
    });

    it('sets primary view to available payment option view if on the methods view and there are not saved payment methods and only one payment option is available', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeActivePaymentMethod: jest.fn(),
        supportedPaymentOptions: ['paypal'],
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
      expect(instance._mainView.setPrimaryView).toBeCalledWith('paypal');
    });

    it('does not set primary view if current primary view is not methods', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        primaryView: {
          ID: 'any-id-but-methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        getPaymentMethods: jest.fn().mockReturnValue([]),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).not.toBeCalled();
    });

    it('does not set primary view if there are saved payment methods', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'CreditCard' }
        ]),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).not.toBeCalled();
    });

    it('removes active payment method view', () => {
      const instance = new Dropin(testContext.dropinOptions);
      const getViewStub = jest.fn();
      const fakeMethodsView = {
        getPaymentMethod: jest.fn().mockReturnValue({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        showLoadingIndicator: jest.fn(),
        hideLoadingIndicator: jest.fn(),
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: jest.fn()
      };
      instance._model = {
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        getPaymentMethods: jest.fn().mockReturnValue([
          { nonce: '1', type: 'CreditCard' }
        ]),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn(),
        removeUnvaultedPaymentMethods: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._model.removeActivePaymentMethod).toBeCalledTimes(1);
    });
  });

  describe('payment method requestable events', () => {
    it('emits paymentMethodRequestable event when the model emits paymentMethodRequestable', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance.on('paymentMethodRequestable', event => {
        expect(event.type).toBe('Foo');

        done();
      });

      instance._initialize(() => {
        instance._model._emit('paymentMethodRequestable', { type: 'Foo' });
      });
    });

    it('emits noPaymentMethodRequestable events when the model emits noPaymentMethodRequestable', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance.on('noPaymentMethodRequestable', () => {
        done();
      });

      instance._initialize(() => {
        instance._model._emit('noPaymentMethodRequestable');
      });
    });
  });

  describe('payment option selected event', () => {
    it('emits paymentOptionSelected when the model emits paymentOptionSelected', done => {
      const instance = new Dropin(testContext.dropinOptions);

      instance.on('paymentOptionSelected', event => {
        expect(event.paymentOption).toBe('Foo');

        done();
      });

      instance._initialize(() => {
        instance._model._emit('paymentOptionSelected', { paymentOption: 'Foo' });
      });
    });
  });
});
