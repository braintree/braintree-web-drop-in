'use strict';

var Dropin = require('../../src/dropin/');
var DropinModel = require('../../src/dropin-model');
var EventEmitter = require('@braintree/event-emitter');
var assets = require('@braintree/asset-loader');
var analytics = require('../../src/lib/analytics');
var fake = require('../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');
var paypalCheckout = require('braintree-web/paypal-checkout');
var threeDSecure = require('braintree-web/three-d-secure');
var ThreeDSecure = require('../../src/lib/three-d-secure');
var vaultManager = require('braintree-web/vault-manager');
var DataCollector = require('../../src/lib/data-collector');
var Promise = require('../../src/lib/promise');
var CardView = require('../../src/views/payment-sheet-views/card-view');
var constants = require('../../src/constants');

function delay(amount) {
  amount = amount || 100;

  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, amount);
  });
}

describe('Dropin', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.client = fake.client();
    testContext.vaultManager = {
      fetchPaymentMethods: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(vaultManager, 'create').mockResolvedValue(testContext.vaultManager);

    testContext.container = document.createElement('div');
    testContext.container.id = 'foo';
    document.body.appendChild(testContext.container);

    testContext.dropinOptions = {
      client: testContext.client,
      merchantConfiguration: {
        container: '#foo',
        authorization: fake.tokenizationKey
      }
    };

    jest.spyOn(analytics, 'sendEvent').mockImplementation();
    jest.spyOn(CardView.prototype, 'getPaymentMethod').mockImplementation();
    jest.spyOn(hostedFields, 'create').mockResolvedValue(fake.hostedFieldsInstance);
    jest.spyOn(paypalCheckout, 'create').mockResolvedValue(fake.paypalInstance);
    jest.spyOn(threeDSecure, 'create').mockResolvedValue(fake.threeDSecureInstance);
  });

  afterEach(() => {
    var stylesheet = document.getElementById(constants.STYLESHEET_ID);

    if (document.body.querySelector('#foo')) {
      document.body.removeChild(testContext.container);
    }

    if (stylesheet) {
      stylesheet.parentNode.removeChild(stylesheet);
    }
  });

  describe('Constructor', () => {
    test('inherits from EventEmitter', () => {
      expect(new Dropin(testContext.dropinOptions)).toBeInstanceOf(EventEmitter);
    });
  });

  describe('_initialize', () => {
    beforeEach(() => {
      testContext.paypalCheckout = {
        FUNDING: {
          'PAYPAL': 'paypal'
        },
        Button: {
          render: jest.fn().mockResolvedValue()
        },
        setup: jest.fn()
      };

      jest.spyOn(assets, 'loadScript').mockImplementation(function () {
        global.paypal = testContext.paypalCheckout;

        return Promise.resolve();
      });
      jest.spyOn(console, 'error').mockImplementation();
    });

    test('errors out if no selector or container are given', done => {
      var instance;

      delete testContext.dropinOptions.merchantConfiguration.container;

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function (err) {
        expect(err.message).toBe('options.container is required.');
        expect(analytics.sendEvent).toBeCalledWith(instance._client, 'configuration-error');
        done();
      });
    });

    test('errors out if both a selector and container are given', done => {
      var instance;

      testContext.dropinOptions.merchantConfiguration.selector = {value: '#bar'};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function (err) {
        expect(err.message).toBe('Must only have one options.selector or options.container.');
        expect(analytics.sendEvent).toBeCalledWith(instance._client, 'configuration-error');
        done();
      });
    });

    test('errors out if all async dependencies fail', done => {
      var instance;
      var paypalError = new Error('PayPal Error');
      var hostedFieldsError = new Error('HostedFields Error');

      hostedFields.create.mockRejectedValue(hostedFieldsError);
      paypalCheckout.create.mockRejectedValue(paypalError);

      testContext.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('All payment options failed to load.');
        expect(instance._dropinWrapper.innerHTML).toBe('');
        expect(analytics.sendEvent).toBeCalledWith(instance._client, 'load-error');
        done();
      });
    });

    test(
      'does not error if at least one dependency is available',
      done => {
        var instance;
        var hostedFieldsError = new Error('HostedFields Error');

        hostedFields.create.mockRejectedValue(hostedFieldsError);
        testContext.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function (err) {
          expect(err).toBeFalsy();
          done();
        });
      }
    );

    test('presents payment option as disabled if it fails', done => {
      var instance;
      var paypalError = new Error('PayPal Error');

      paypalCheckout.create.mockRejectedValue(paypalError);
      testContext.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        var paypalOption = testContext.container.querySelector('.braintree-option__paypal');

        expect(paypalOption.className).toMatch('braintree-disabled');
        expect(paypalOption.innerHTML).toMatch('Developer Error: Something went wrong. Check the console for details.');
        done();
      });
    });

    test('logs specific error in the console', done => {
      var instance;
      var paypalError = new Error('PayPal Error');

      paypalCheckout.create.mockRejectedValue(paypalError);
      testContext.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(console.error).toBeCalledTimes(1); // eslint-disable-line no-console
        expect(console.error).toBeCalledWith(paypalError); // eslint-disable-line no-console
        done();
      });
    });

    test(
      'throws an error with a container that points to a nonexistent DOM node',
      done => {
        var instance;

        testContext.dropinOptions.merchantConfiguration.container = '#garbage';

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('options.selector or options.container must reference a valid DOM node.');
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'configuration-error');
          done();
        });
      }
    );

    test(
      'throws an error if merchant container from options.container is not empty',
      done => {
        var instance;
        var div = document.createElement('div');

        testContext.container.appendChild(div);

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('options.selector or options.container must reference an empty DOM node.');
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'configuration-error');
          done();
        });
      }
    );

    test(
      'throws an error if merchant container from options.container is not empty',
      done => {
        var instance;
        var div = document.createElement('div');

        testContext.container.appendChild(div);

        testContext.dropinOptions.merchantConfiguration.container = testContext.container;

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('options.selector or options.container must reference an empty DOM node.');
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'configuration-error');
          done();
        });
      }
    );

    test(
      'throws an error if merchant container from options.container is not a domNode-like object',
      done => {
        var instance;
        var fakeDiv = {appendChild: 'fake'};

        testContext.dropinOptions.merchantConfiguration.container = fakeDiv;

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('options.selector or options.container must reference a valid DOM node.');
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'configuration-error');
          done();
        });
      }
    );

    test(
      'inserts dropin into container if merchant container has white space',
      done => {
        var instance;

        testContext.container.innerHTML = ' ';

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(testContext.container.innerHTML).toMatch('class="braintree-dropin');

          done();
        });
      }
    );

    test('accepts a selector', done => {
      var instance;

      delete testContext.dropinOptions.merchantConfiguration.container;
      testContext.dropinOptions.merchantConfiguration.selector = '#foo';

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function (err) {
        expect(err).toBeFalsy();
        done();
      });
    });

    test('inserts dropin into container', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(testContext.container.innerHTML).toMatch('class="braintree-dropin');

        done();
      });
    });

    test('inserts svgs into container', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(testContext.container.innerHTML).toMatch('data-braintree-id="svgs"');

        done();
      });
    });

    test('injects stylesheet with correct id', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        var stylesheet = document.getElementById(constants.STYLESHEET_ID);

        expect(stylesheet).toBeDefined();
        expect(stylesheet.href).toMatch(/assets\.braintreegateway\.com/);

        done();
      });
    });

    test(
      'does not inject stylesheet if it already exists on the page',
      done => {
        var instance = new Dropin(testContext.dropinOptions);
        var stylesheetOnPage = document.createElement('link');

        stylesheetOnPage.id = constants.STYLESHEET_ID;
        stylesheetOnPage.href = '/customer/dropin.css';

        document.body.appendChild(stylesheetOnPage);

        instance._initialize(function () {
          var stylesheet = document.getElementById(constants.STYLESHEET_ID);

          expect(stylesheet).toBeDefined();
          expect(stylesheet.href).toMatch(/\/customer\/dropin\.css/);

          done();
        });
      }
    );

    test('requests payment methods if a customerId is provided', done => {
      var instance;

      testContext.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });

      testContext.vaultManager.fetchPaymentMethods.mockResolvedValue([]);

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        try {
          expect(vaultManager.create).toBeCalledTimes(1);
          expect(vaultManager.create).toBeCalledWith({
            client: testContext.client
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

    test(
      'does not fail if there is an error getting existing payment methods',
      done => {
        var instance;

        testContext.client.getConfiguration.mockReturnValue({
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        });
        testContext.client.request.mockRejectedValue(new Error('This failed'));

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(hostedFields.create).toBeCalled();
          expect(instance._model.getPaymentMethods()).toHaveLength(0);

          done();
        });
      }
    );

    test('creates a MainView a customerId exists', done => {
      var instance;
      var paymentMethodsPayload = {paymentMethods: []};

      testContext.client.getConfiguration.mockReturnValue({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      testContext.client.request.mockResolvedValue(paymentMethodsPayload);

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView).toBeDefined();

        done();
      });
    });

    test('creates a MainView a customerId does not exist', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView).toBeDefined();
        done();
      });
    });

    test(
      'calls the create callback when async dependencies are ready',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

        instance._initialize(function (err) {
          done(err);
        });

        delay().then(function () {
          instance._model.dependencySuccessCount = 1;
          instance._model._emit('asyncDependenciesReady');
        });
      }
    );

    test('returns to app switch view that reported an error', done => {
      var instance = new Dropin(testContext.dropinOptions);
      var error = new Error('error');

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'reportError').mockImplementation();

      instance._initialize(function () {
        expect(instance._model.reportError).toBeCalledTimes(1);
        expect(instance._model.reportError).toBeCalledWith(error);
        expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
        expect(instance._mainView.setPrimaryView).toBeCalledWith('view-id');
        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchError = {
          id: 'view-id',
          error: error
        };
        jest.spyOn(instance._mainView, 'setPrimaryView').mockImplementation();
        instance._model._emit('asyncDependenciesReady');
      });
    });

    test('adds payment method if app switch payload exists', done => {
      var instance = new Dropin(testContext.dropinOptions);
      var payload = {nonce: 'fake-nonce'};

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();
      jest.spyOn(DropinModel.prototype, 'addPaymentMethod').mockImplementation();

      instance._initialize(function () {
        expect(instance._model.addPaymentMethod).toBeCalledTimes(1);
        expect(instance._model.addPaymentMethod).toBeCalledWith(payload);
        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchPayload = payload;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    test(
      'sends web.dropin.appeared event when async dependencies are ready',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

        instance._initialize(function () {
          expect(analytics.sendEvent).toBeCalledTimes(1);
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'appeared');
          done();
        });

        delay().then(function () {
          instance._model.dependencySuccessCount = 2;
          instance._model._emit('asyncDependenciesReady');
        });
      }
    );

    test(
      'sends vaulted payment method appeared events for each vaulted payment method',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
          {type: 'CreditCard', details: {lastTwo: '11'}},
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
        ]);

        instance._initialize(function () {
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'vaulted-card.appear');
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'vaulted-paypal.appear');
          done();
        });
      }
    );

    test(
      'sends a single analytic event even when multiple vaulted payment methods of the same kind are available',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
          {type: 'CreditCard', details: {lastTwo: '11'}},
          {type: 'CreditCard', details: {lastTwo: '22'}},
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}},
          {type: 'PayPalAccount', details: {email: 'woah@example.com'}}
        ]);

        instance._initialize(function () {
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'vaulted-card.appear');
          expect(analytics.sendEvent).toBeCalledWith(instance._client, 'vaulted-paypal.appear');
          done();
        });
      }
    );

    test(
      'does not send payment method analytic event when app switch payload present',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
          {type: 'CreditCard', details: {lastTwo: '11'}},
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
        ]);
        jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

        instance._initialize(function () {
          expect(analytics.sendEvent).not.toBeCalledWith(instance._client, 'vaulted-card.appear');
          expect(analytics.sendEvent).not.toBeCalledWith(instance._client, 'vaulted-paypal.appear');

          done();
        });

        delay().then(function () {
          instance._model.dependencySuccessCount = 1;
          instance._model.appSwitchPayload = {
            nonce: 'a-nonce'
          };
          jest.spyOn(instance._mainView, 'setPrimaryView').mockImplementation();

          instance._model._emit('asyncDependenciesReady');
        });
      }
    );

    test(
      'does not send payment method analytic event when app switch error present',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
          {type: 'CreditCard', details: {lastTwo: '11'}},
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
        ]);
        jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady').mockImplementation();

        instance._initialize(function () {
          expect(analytics.sendEvent).not.toBeCalledWith(instance._client, 'vaulted-card.appear');
          expect(analytics.sendEvent).not.toBeCalledWith(instance._client, 'vaulted-paypal.appear');

          done();
        });

        delay().then(function () {
          instance._model.dependencySuccessCount = 1;
          instance._model.appSwitchError = {
            ID: 'view',
            error: new Error('error')
          };
          jest.spyOn(instance._mainView, 'setPrimaryView').mockImplementation();

          instance._model._emit('asyncDependenciesReady');
        });
      }
    );

    test(
      'does not send web.vaulted-card.appear analytic event when no vaulted cards appear',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(DropinModel.prototype, 'getVaultedPaymentMethods').mockResolvedValue([
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
        ]);

        instance._initialize(function () {
          expect(analytics.sendEvent).not.toBeCalledWith(instance._client, 'vaulted-card.appear');
          done();
        });
      }
    );

    test('loads strings by default', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
        done();
      });
    });

    test(
      'loads localized strings into mainView when options.locale is specified',
      done => {
        var instance;

        testContext.dropinOptions.merchantConfiguration.locale = 'es_ES';
        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(instance._mainView.strings.postalCodeLabel).toBe('Código postal');
          done();
        });
      }
    );

    test(
      'uses custom translations when options.translations is specified',
      done => {
        var instance;

        testContext.dropinOptions.merchantConfiguration.translations = {
          payingWith: 'You are paying with {{paymentSource}}',
          chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string'
        };
        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(instance._mainView.strings.payingWith).toBe('You are paying with {{paymentSource}}');
          expect(instance._mainView.strings.chooseAnotherWayToPay).toBe('My custom chooseAnotherWayToPay string');
          expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
          done();
        });
      }
    );

    test('sanitizes html in custom translations', done => {
      var instance;

      testContext.dropinOptions.merchantConfiguration.translations = {
        chooseAnotherWayToPay: '<script>alert()</script>'
      };
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.chooseAnotherWayToPay).toBe('&lt;script&gt;alert()&lt;/script&gt;');
        done();
      });
    });

    test('uses locale with custom translations', done => {
      var instance;

      testContext.dropinOptions.merchantConfiguration.locale = 'es_ES';
      testContext.dropinOptions.merchantConfiguration.translations = {
        payingWith: 'You are paying with {{paymentSource}}',
        chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string'
      };
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.payingWith).toBe('You are paying with {{paymentSource}}');
        expect(instance._mainView.strings.chooseAnotherWayToPay).toBe('My custom chooseAnotherWayToPay string');
        expect(instance._mainView.strings.postalCodeLabel).toBe('Código postal');
        done();
      });
    });

    test(
      'loads localized strings into mainView when options.locale is a supported locale ID',
      done => {
        var instance;

        testContext.dropinOptions.merchantConfiguration.locale = 'en_GB';
        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(instance._mainView.strings.postalCodeLabel).toBe('Postcode');
          done();
        });
      }
    );

    test(
      'loads supported localized strings into mainView when options.locale is a locale ID with an unsupported country',
      done => {
        var instance;

        testContext.dropinOptions.merchantConfiguration.locale = 'en_NA';
        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
          done();
        });
      }
    );

    test(
      'loads default strings into mainView when options.locale is unknown',
      done => {
        var instance;

        testContext.dropinOptions.merchantConfiguration.locale = 'foo';
        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(instance._mainView.strings.postalCodeLabel).toBe('Postal Code');
          done();
        });
      }
    );
  });

  describe('loads data collector', () => {
    beforeEach(() => {
      testContext.dropinOptions.merchantConfiguration.dataCollector = {kount: true};
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');
      jest.spyOn(Dropin.prototype, '_setUpDataCollector').mockImplementation();
    });

    test(
      'does not load Data Collector if Data Collector is not enabled',
      done => {
        var instance;

        delete testContext.dropinOptions.merchantConfiguration.dataCollector;
        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          expect(instance._setUpDataCollector).not.toBeCalled();

          done();
        });
      }
    );

    test('does load Data Collector if Data Collector is enabled', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
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

    test('does not load 3D Secure if 3D Secure is not enabled', done => {
      var instance;

      delete testContext.dropinOptions.merchantConfiguration.threeDSecure;
      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._setUpThreeDSecure).not.toBeCalled();

        done();
      });
    });

    test('does load 3D Secure if 3D Secure is enabled', done => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        expect(instance._setUpThreeDSecure).toBeCalled();

        done();
      });
    });
  });

  describe('_setUpDataCollector', () => {
    beforeEach(() => {
      testContext.model = fake.model({
        componentID: 'foo',
        client: testContext.client,
        merchantConfiguration: {
          container: '#foo',
          authorization: fake.tokenizationKey
        },
        paymentMethods: ['card']
      });
      jest.spyOn(DataCollector.prototype, 'initialize').mockResolvedValue();
    });

    test('sets up datacollector', () => {
      Dropin.prototype._setUpDataCollector.call({
        _client: testContext.client,
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

    test(
      'fails initialization when Data Collection creation fails',
      done => {
        var error = new Error('failed.');

        jest.spyOn(DropinModel.prototype, 'cancelInitialization');

        DataCollector.prototype.initialize.mockRejectedValue(error);

        Dropin.prototype._setUpDataCollector.call({
          _client: testContext.client,
          _model: testContext.model,
          _merchantConfiguration: {
            threeDSecure: {
              foo: 'bar'
            }
          }
        });

        expect(DataCollector.prototype.initialize).toBeCalledTimes(1);
        setTimeout(function () {
          expect(DropinModel.prototype.cancelInitialization).toBeCalled();
          done();
        }, 1000);
      }
    );

    test('starts an async dependency', () => {
      function noop() {}
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');

      Dropin.prototype._setUpDataCollector.call({
        _client: testContext.client,
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
        client: testContext.client,
        merchantConfiguration: {
          container: '#foo',
          authorization: fake.tokenizationKey
        },
        paymentMethods: ['card']
      });
      jest.spyOn(ThreeDSecure.prototype, 'initialize').mockResolvedValue();
    });

    test('sets up 3ds', () => {
      Dropin.prototype._setUpThreeDSecure.call({
        _client: testContext.client,
        _model: testContext.model,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(ThreeDSecure.prototype.initialize).toBeCalledTimes(1);
    });

    test('fails initialization when 3DS creation fails', done => {
      var error = new Error('failed.');

      jest.spyOn(DropinModel.prototype, 'cancelInitialization');

      ThreeDSecure.prototype.initialize.mockRejectedValue(error);

      Dropin.prototype._setUpThreeDSecure.call({
        _client: testContext.client,
        _model: testContext.model,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(ThreeDSecure.prototype.initialize).toBeCalledTimes(1);
      setTimeout(function () {
        expect(DropinModel.prototype.cancelInitialization).toBeCalled();
        done();
      }, 1000);
    });

    test('starts an async dependency', () => {
      function noop() {}
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');

      Dropin.prototype._setUpThreeDSecure.call({
        _client: testContext.client,
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

    test('removes dropin node from page', done => {
      testContext.instance.teardown(function () {
        expect(testContext.container.contains(testContext.instance._dropinWrapper)).toBe(false);
        done();
      });
    });

    test('calls teardown on the mainView', done => {
      testContext.instance.teardown(function () {
        expect(testContext.instance._mainView.teardown).toBeCalledTimes(1);
        done();
      });
    });

    test('calls teardown on dataCollector', done => {
      testContext.instance._dataCollector = {
        teardown: jest.fn().mockResolvedValue()
      };

      testContext.instance.teardown(function () {
        expect(testContext.instance._dataCollector.teardown).toBeCalledTimes(1);
        done();
      });
    });

    test('calls teardown on 3D Secure', done => {
      testContext.instance._threeDSecure = {
        teardown: jest.fn().mockResolvedValue()
      };

      testContext.instance.teardown(function () {
        expect(testContext.instance._threeDSecure.teardown).toBeCalledTimes(1);
        done();
      });
    });

    test(
      'passes errors from data collector teardown to callback',
      done => {
        var error = new Error('Data Collector failured');

        testContext.instance._dataCollector = {
          teardown: jest.fn().mockRejectedValue(error)
        };

        testContext.instance.teardown(function (err) {
          expect(err.message).toBe('Drop-in errored tearing down Data Collector.');
          done();
        });
      }
    );

    test('passes errors from 3D Secure teardown to callback', done => {
      var error = new Error('3D Secure failured');

      testContext.instance._threeDSecure = {
        teardown: jest.fn().mockRejectedValue(error)
      };

      testContext.instance.teardown(function (err) {
        expect(err.message).toBe('Drop-in errored tearing down 3D Secure.');
        done();
      });
    });

    test('passes errors in mainView teardown to callback', done => {
      var error = new Error('Teardown Error');

      testContext.instance._mainView.teardown.mockRejectedValue(error);

      testContext.instance.teardown(function (err) {
        expect(err).toBe(error);
        done();
      });
    });
  });

  describe('requestPaymentMethod', () => {
    test(
      'calls the requestPaymentMethod function of the MainView',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          jest.spyOn(instance._mainView, 'requestPaymentMethod');
          instance.requestPaymentMethod(function () {
            expect(instance._mainView.requestPaymentMethod).toBeCalledTimes(1);
            done();
          });
        });
      }
    );

    test('returns a formatted payload', done => {
      var instance = new Dropin(testContext.dropinOptions);
      var fakePayload = {
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

      instance._initialize(function () {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod(function (err, payload) {
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

    test(
      'includes rawPaymentData if a Google Pay payment method',
      done => {
        var instance = new Dropin(testContext.dropinOptions);
        var rawPaymentData = {foo: 'bar'};
        var fakePayload = {
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

        instance._initialize(function () {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

          instance.requestPaymentMethod(function (err, payload) {
            expect(payload.details.rawPaymentData).toBe(rawPaymentData);

            done();
          });
        });
      }
    );

    test(
      'includes rawPaymentData if an Apple Pay payment method',
      done => {
        var instance = new Dropin(testContext.dropinOptions);
        var rawPaymentData = {foo: 'bar'};
        var fakePayload = {
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

        instance._initialize(function () {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

          instance.requestPaymentMethod(function (err, payload) {
            expect(payload.details.rawPaymentData).toBe(rawPaymentData);

            done();
          });
        });
      }
    );

    test('does not call 3D Secure if it is not enabled', done => {
      var fakePayload = {
        nonce: 'cool-nonce'
      };
      var instance = new Dropin(testContext.dropinOptions);

      jest.spyOn(ThreeDSecure.prototype, 'verify');

      instance._initialize(function () {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

        instance.requestPaymentMethod(function () {
          expect(ThreeDSecure.prototype.verify).not.toBeCalled();

          done();
        });
      });
    });

    test(
      'does not call 3D Secure if payment method is not a credit card',
      done => {
        var instance;
        var fakePayload = {
          nonce: 'cool-nonce',
          type: 'PAYPAL_ACCOUNT'
        };

        testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

        instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(ThreeDSecure.prototype, 'verify');

        instance._initialize(function () {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

          instance.requestPaymentMethod(function () {
            expect(ThreeDSecure.prototype.verify).not.toBeCalled();

            done();
          });
        });
      }
    );

    test(
      'does not call 3D Secure if payment method nonce payload contains liablity information',
      done => {
        var instance;
        var fakePayload = {
          nonce: 'cool-nonce',
          type: 'CreditCard',
          liabilityShifted: false
        };

        testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

        instance = new Dropin(testContext.dropinOptions);

        jest.spyOn(ThreeDSecure.prototype, 'verify');

        instance._initialize(function () {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);

          instance.requestPaymentMethod(function () {
            expect(ThreeDSecure.prototype.verify).not.toBeCalled();

            done();
          });
        });
      }
    );

    test(
      'calls 3D Secure if payment method nonce payload is a credit card and does not contain liability info',
      done => {
        var instance;
        var fakePayload = {
          nonce: 'cool-nonce',
          type: 'CreditCard'
        };

        testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

        instance = new Dropin(testContext.dropinOptions);

        instance._initialize(function () {
          jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);
          instance._threeDSecure = {
            verify: jest.fn().mockResolvedValue({
              nonce: 'new-nonce',
              liabilityShifted: true,
              liabilityShiftPossible: true
            })
          };

          instance.requestPaymentMethod(function () {
            expect(instance._threeDSecure.verify).toBeCalledTimes(1);
            expect(instance._threeDSecure.verify).toBeCalledWith(fakePayload, undefined);

            done();
          });
        });
      }
    );

    test('can pass additional 3ds info from merchant', done => {
      var instance;
      var fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };
      var threeDSInfo = {
        email: 'foo@example.com',
        billingAddress: {}
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
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
        }, function () {
          expect(instance._threeDSecure.verify).toBeCalledTimes(1);
          expect(instance._threeDSecure.verify).toBeCalledWith(fakePayload, threeDSInfo);

          done();
        });
      });
    });

    test('replaces payload nonce with new 3ds nonce', done => {
      var instance;
      var fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };

      testContext.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(testContext.dropinOptions);

      instance._initialize(function () {
        jest.spyOn(instance._mainView, 'requestPaymentMethod').mockResolvedValue(fakePayload);
        instance._threeDSecure = {
          verify: jest.fn().mockResolvedValue({
            nonce: 'new-nonce',
            liabilityShifted: true,
            liabilityShiftPossible: true
          })
        };

        instance.requestPaymentMethod(function (err, payload) {
          expect(payload.nonce).toBe('new-nonce');
          expect(payload.liabilityShifted).toBe(true);
          expect(payload.liabilityShiftPossible).toBe(true);
          expect(fakePayload.nonce).toBe('new-nonce');
          expect(fakePayload.liabilityShifted).toBe(true);
          expect(fakePayload.liabilityShiftPossible).toBe(true);

          done();
        });
      });
    });
  });

  describe('isPaymentMethodRequestable', () => {
    test('returns the value of model.isPaymentMethodRequestable', () => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._model = {
        isPaymentMethodRequestable: jest.fn().mockReturnValue('foo')
      };

      expect(instance.isPaymentMethodRequestable()).toBe('foo');
    });
  });

  describe('updateConfiguration', () => {
    test('does not update if a non-editiable prop is used', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var fakePayPalView = {
        updateConfiguration: jest.fn()
      };

      instance._mainView = {
        getView: jest.fn().mockReturnValue(fakePayPalView)
      };

      instance.updateConfiguration('card', 'foo', 'bar');

      expect(instance._mainView.getView).not.toBeCalled();
    });

    test('does not update if view is not set up', () => {
      var instance = new Dropin(testContext.dropinOptions);

      instance._mainView = {
        getView: jest.fn().mockReturnValue(null)
      };

      expect(function () {
        instance.updateConfiguration('paypal', 'foo', 'bar');
      }).not.toThrowError();
    });

    test('updates if view is paypal', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var getViewStub = jest.fn();
      var fakePayPalView = {
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
        getPaymentMethods: jest.fn().mockReturnValue([])
      };

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    test('updates if view is paypalCredit', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var getViewStub = jest.fn();
      var fakePayPalView = {
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
        getPaymentMethods: jest.fn().mockReturnValue([])
      };

      instance.updateConfiguration('paypalCredit', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledTimes(1);
      expect(fakePayPalView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    test('updates if view is applePay', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var getViewStub = jest.fn();
      var fakeApplePayView = {
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
        getPaymentMethods: jest.fn().mockReturnValue([])
      };

      instance.updateConfiguration('applePay', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakeApplePayView.updateConfiguration).toBeCalledTimes(1);
      expect(fakeApplePayView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    test('updates if view is googlePay', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var getViewStub = jest.fn();
      var fakeGooglePayView = {
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
        getPaymentMethods: jest.fn().mockReturnValue([])
      };

      instance.updateConfiguration('googlePay', 'foo', 'bar');

      expect(instance._mainView.getView).toBeCalledTimes(1);
      expect(fakeGooglePayView.updateConfiguration).toBeCalledTimes(1);
      expect(fakeGooglePayView.updateConfiguration).toBeCalledWith('foo', 'bar');
    });

    test('updates if property is threeDSecure', () => {
      var instance = new Dropin(testContext.dropinOptions);

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

    test(
      'does not update if property is threeDSecure, but there is no threeDSecure instance',
      () => {
        var instance = new Dropin(testContext.dropinOptions);

        expect(function () {
          instance.updateConfiguration('threeDSecure', 'amount', '15.00');
        }).not.toThrowError();
      }
    );

    test(
      'removes saved paypal payment methods if they are not vaulted',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakePayPalView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
            {nonce: '1', type: 'PayPalAccount', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'PayPalAccount'},
            {nonce: '4', type: 'PayPalAccount', vaulted: true},
            {nonce: '5', type: 'PayPalAccount'}
          ]),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'paypal') {
            return fakePayPalView;
          } else if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.updateConfiguration('paypal', 'foo', 'bar');

        expect(instance._model.getPaymentMethods).toBeCalledTimes(1);
        expect(instance._model.removePaymentMethod).toBeCalledTimes(2);
        expect(instance._model.removePaymentMethod).toBeCalledWith({nonce: '3', type: 'PayPalAccount'});
        expect(instance._model.removePaymentMethod).toBeCalledWith({nonce: '5', type: 'PayPalAccount'});
      }
    );

    test(
      'does not call removePaymentMethod if no non-vaulted paypal accounts are avaialble',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakePayPalView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
          getPaymentMethod: jest.fn().mockReturnValue(null)
        };

        instance._mainView = {
          getView: getViewStub,
          primaryView: {
            ID: 'view'
          }
        };
        instance._model = {
          getPaymentMethods: jest.fn().mockReturnValue([
            {nonce: '1', type: 'PayPalAccount', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'PayPalAccount', vaulted: true}
          ]),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'paypal') {
            return fakePayPalView;
          } else if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.updateConfiguration('paypal', 'foo', 'bar');

        expect(instance._model.removePaymentMethod).not.toBeCalled();
      }
    );

    test(
      'removes saved applePay payment methods if they are not vaulted',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeApplePayView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
            {nonce: '1', type: 'ApplePayCard', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'ApplePayCard'},
            {nonce: '4', type: 'ApplePayCard', vaulted: true},
            {nonce: '5', type: 'ApplePayCard'}
          ]),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'applePay') {
            return fakeApplePayView;
          } else if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.updateConfiguration('applePay', 'foo', 'bar');

        expect(instance._model.getPaymentMethods).toBeCalledTimes(1);
        expect(instance._model.removePaymentMethod).toBeCalledTimes(2);
        expect(instance._model.removePaymentMethod).toBeCalledWith({nonce: '3', type: 'ApplePayCard'});
        expect(instance._model.removePaymentMethod).toBeCalledWith({nonce: '5', type: 'ApplePayCard'});
      }
    );

    test(
      'does not call removePaymentMethod if no non-vaulted applePay accounts are avaialble',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeApplePayView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
          getPaymentMethod: jest.fn().mockReturnValue(null)
        };

        instance._mainView = {
          getView: getViewStub,
          primaryView: {
            ID: 'view'
          }
        };
        instance._model = {
          getPaymentMethods: jest.fn().mockReturnValue([
            {nonce: '1', type: 'ApplePayCard', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'ApplePayCard', vaulted: true}
          ]),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'applePay') {
            return fakeApplePayView;
          } else if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.updateConfiguration('applePay', 'foo', 'bar');

        expect(instance._model.removePaymentMethod).not.toBeCalled();
      }
    );

    test(
      'removes saved googlePay payment methods if they are not vaulted',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeGooglePayView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
            {nonce: '1', type: 'AndroidPayCard', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'AndroidPayCard'},
            {nonce: '4', type: 'AndroidPayCard', vaulted: true},
            {nonce: '5', type: 'AndroidPayCard'}
          ]),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'googlePay') {
            return fakeGooglePayView;
          } else if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.updateConfiguration('googlePay', 'foo', 'bar');

        expect(instance._model.getPaymentMethods).toBeCalledTimes(1);
        expect(instance._model.removePaymentMethod).toBeCalledTimes(2);
        expect(instance._model.removePaymentMethod).toBeCalledWith({nonce: '3', type: 'AndroidPayCard'});
        expect(instance._model.removePaymentMethod).toBeCalledWith({nonce: '5', type: 'AndroidPayCard'});
      }
    );

    test(
      'does not call removePaymentMethod if no non-vaulted googlePay accounts are avaialble',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeGooglePayView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
          getPaymentMethod: jest.fn().mockReturnValue(null)
        };

        instance._mainView = {
          getView: getViewStub,
          primaryView: {
            ID: 'view'
          }
        };
        instance._model = {
          getPaymentMethods: jest.fn().mockReturnValue([
            {nonce: '1', type: 'AndroidPayCard', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'AndroidPayCard', vaulted: true}
          ]),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'googlePay') {
            return fakeGooglePayView;
          } else if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.updateConfiguration('googlePay', 'foo', 'bar');

        expect(instance._model.removePaymentMethod).not.toBeCalled();
      }
    );

    test(
      'sets primary view to options if on the methods view and there are no saved payment methods and supportedPaymentOptions is greater than 1',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakePayPalView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
          removePaymentMethod: jest.fn()
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
      }
    );

    test(
      'sets primary view to available payment option view if on the methods view and there are not saved payment methods and only one payment option is available',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakePayPalView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
          removePaymentMethod: jest.fn()
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
      }
    );

    test(
      'does not set primary view if current primary view is not methods',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakePayPalView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
          removePaymentMethod: jest.fn()
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
      }
    );

    test(
      'does not set primary view if there are saved payment methods',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakePayPalView = {
          updateConfiguration: jest.fn()
        };
        var fakeMethodsView = {
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
            {nonce: '1', type: 'CreditCard'}
          ]),
          removePaymentMethod: jest.fn()
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
      }
    );
  });

  describe('clearSelectedPaymentMethod', () => {
    test('refreshes saved payment methods', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var getViewStub = jest.fn();
      var fakeMethodsView = {
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
          {nonce: '1', type: 'PayPalAccount', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'CreditCard'},
          {nonce: '4', type: 'PayPalAccount'},
          {nonce: '5', type: 'PayPalAccount', vaulted: true}
        ]),
        refreshPaymentMethods: jest.fn().mockResolvedValue(),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn()
      };

      getViewStub.mockImplementation(arg => {
        if (arg === 'methods') {
          return fakeMethodsView;
        }
      });

      instance.clearSelectedPaymentMethod();

      expect(instance._model.refreshPaymentMethods).toBeCalledTimes(1);
    });

    test(
      'does not call removePaymentMethod if no non-vaulted paypal accounts are avaialble',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeMethodsView = {
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
            {nonce: '1', type: 'PayPalAccount', vaulted: true},
            {nonce: '2', type: 'CreditCard', vaulted: true},
            {nonce: '3', type: 'PayPalAccount', vaulted: true}
          ]),
          removeActivePaymentMethod: jest.fn(),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.clearSelectedPaymentMethod();

        expect(instance._model.removePaymentMethod).not.toBeCalled();
      }
    );

    test(
      'sets primary view to options if on the methods view and there are no saved payment methods and supportedPaymentOptions is greater than 1',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeMethodsView = {
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
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.clearSelectedPaymentMethod();

        expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
        expect(instance._mainView.setPrimaryView).toBeCalledWith('options');
      }
    );

    test(
      'sets primary view to available payment option view if on the methods view and there are not saved payment methods and only one payment option is available',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeMethodsView = {
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
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.clearSelectedPaymentMethod();

        expect(instance._mainView.setPrimaryView).toBeCalledTimes(1);
        expect(instance._mainView.setPrimaryView).toBeCalledWith('paypal');
      }
    );

    test(
      'does not set primary view if current primary view is not methods',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeMethodsView = {
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
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.clearSelectedPaymentMethod();

        expect(instance._mainView.setPrimaryView).not.toBeCalled();
      }
    );

    test(
      'does not set primary view if there are saved payment methods',
      () => {
        var instance = new Dropin(testContext.dropinOptions);
        var getViewStub = jest.fn();
        var fakeMethodsView = {
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
            {nonce: '1', type: 'CreditCard'}
          ]),
          removeActivePaymentMethod: jest.fn(),
          removePaymentMethod: jest.fn()
        };

        getViewStub.mockImplementation(arg => {
          if (arg === 'methods') {
            return fakeMethodsView;
          }
        });

        instance.clearSelectedPaymentMethod();

        expect(instance._mainView.setPrimaryView).not.toBeCalled();
      }
    );

    test('removes active payment method view', () => {
      var instance = new Dropin(testContext.dropinOptions);
      var getViewStub = jest.fn();
      var fakeMethodsView = {
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
          {nonce: '1', type: 'CreditCard'}
        ]),
        removeActivePaymentMethod: jest.fn(),
        removePaymentMethod: jest.fn()
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
    test(
      'emits paymentMethodRequestable event when the model emits paymentMethodRequestable',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        instance.on('paymentMethodRequestable', function (event) {
          expect(event.type).toBe('Foo');

          done();
        });

        instance._initialize(function () {
          instance._model._emit('paymentMethodRequestable', {type: 'Foo'});
        });
      }
    );

    test(
      'emits noPaymentMethodRequestable events when the model emits noPaymentMethodRequestable',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        instance.on('noPaymentMethodRequestable', function () {
          done();
        });

        instance._initialize(function () {
          instance._model._emit('noPaymentMethodRequestable');
        });
      }
    );
  });

  describe('payment option selected event', () => {
    test(
      'emits paymentOptionSelected when the model emits paymentOptionSelected',
      done => {
        var instance = new Dropin(testContext.dropinOptions);

        instance.on('paymentOptionSelected', function (event) {
          expect(event.paymentOption).toBe('Foo');

          done();
        });

        instance._initialize(function () {
          instance._model._emit('paymentOptionSelected', {paymentOption: 'Foo'});
        });
      }
    );
  });
});
