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

describe('Dropin', function () {
  beforeEach(function () {
    this.client = fake.client();
    this.vaultManager = {
      fetchPaymentMethods: this.sandbox.stub().resolves([])
    };
    this.sandbox.stub(vaultManager, 'create').resolves(this.vaultManager);

    this.container = document.createElement('div');
    this.container.id = 'foo';
    document.body.appendChild(this.container);

    this.dropinOptions = {
      client: this.client,
      merchantConfiguration: {
        container: '#foo',
        authorization: fake.tokenizationKey
      }
    };

    this.sandbox.stub(analytics, 'sendEvent');
    this.sandbox.stub(CardView.prototype, 'getPaymentMethod');
    this.sandbox.stub(hostedFields, 'create').resolves(fake.hostedFieldsInstance);
    this.sandbox.stub(paypalCheckout, 'create').resolves(fake.paypalInstance);
    this.sandbox.stub(threeDSecure, 'create').resolves(fake.threeDSecureInstance);
  });

  afterEach(function () {
    var stylesheet = document.getElementById(constants.STYLESHEET_ID);

    if (document.body.querySelector('#foo')) {
      document.body.removeChild(this.container);
    }

    if (stylesheet) {
      stylesheet.parentNode.removeChild(stylesheet);
    }
  });

  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      expect(new Dropin(this.dropinOptions)).to.be.an.instanceOf(EventEmitter);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.paypalCheckout = {
        Button: {
          render: this.sandbox.stub().resolves()
        },
        setup: this.sandbox.stub()
      };

      this.sandbox.stub(assets, 'loadScript').callsFake(function () {
        global.paypal = this.paypalCheckout;

        return Promise.resolve();
      }.bind(this));
      this.sandbox.stub(console, 'error');
    });

    it('errors out if no selector or container are given', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.container;

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err.message).to.equal('options.container is required.');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'configuration-error');
        done();
      });
    });

    it('errors out if both a selector and container are given', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.selector = {value: '#bar'};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err.message).to.equal('Must only have one options.selector or options.container.');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'configuration-error');
        done();
      });
    });

    it('errors out if all async dependencies fail', function (done) {
      var instance;
      var paypalError = new Error('PayPal Error');
      var hostedFieldsError = new Error('HostedFields Error');

      hostedFields.create.rejects(hostedFieldsError);
      paypalCheckout.create.rejects(paypalError);

      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('All payment options failed to load.');
        expect(instance._dropinWrapper.innerHTML).to.equal('');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'load-error');
        done();
      });
    });

    it('does not error if at least one dependency is available', function (done) {
      var instance;
      var hostedFieldsError = new Error('HostedFields Error');

      hostedFields.create.rejects(hostedFieldsError);
      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.not.exist;
        done();
      });
    });

    it('presents payment option as disabled if it fails', function (done) {
      var instance;
      var paypalError = new Error('PayPal Error');

      paypalCheckout.create.rejects(paypalError);
      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        var paypalOption = this.container.querySelector('.braintree-option__paypal');

        expect(paypalOption.className).to.include('braintree-disabled');
        expect(paypalOption.innerHTML).to.include('Developer Error: Something went wrong. Check the console for details.');
        done();
      }.bind(this));
    });

    it('logs specific error in the console', function (done) {
      var instance;
      var paypalError = new Error('PayPal Error');

      paypalCheckout.create.rejects(paypalError);
      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(console.error).to.be.calledOnce; // eslint-disable-line no-console
        expect(console.error).to.be.calledWith(paypalError); // eslint-disable-line no-console
        done();
      });
    });

    it('throws an error with a container that points to a nonexistent DOM node', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.container = '#garbage';

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector or options.container must reference a valid DOM node.');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'configuration-error');
        done();
      });
    });

    it('throws an error if merchant container from options.container is not empty', function (done) {
      var instance;
      var div = document.createElement('div');

      this.container.appendChild(div);

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector or options.container must reference an empty DOM node.');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'configuration-error');
        done();
      });
    });

    it('throws an error if merchant container from options.container is not empty', function (done) {
      var instance;
      var div = document.createElement('div');

      this.container.appendChild(div);

      this.dropinOptions.merchantConfiguration.container = this.container;

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector or options.container must reference an empty DOM node.');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'configuration-error');
        done();
      });
    });

    it('throws an error if merchant container from options.container is not a domNode-like object', function (done) {
      var instance;
      var fakeDiv = {appendChild: 'fake'};

      this.dropinOptions.merchantConfiguration.container = fakeDiv;

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector or options.container must reference a valid DOM node.');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'configuration-error');
        done();
      });
    });

    it('inserts dropin into container if merchant container has white space', function (done) {
      var instance;

      this.container.innerHTML = ' ';

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(this.container.innerHTML).to.include('class="braintree-dropin');

        done();
      }.bind(this));
    });

    it('accepts a selector', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.container;
      this.dropinOptions.merchantConfiguration.selector = '#foo';

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.not.exist;
        done();
      });
    });

    it('inserts dropin into container', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(this.container.innerHTML).to.include('class="braintree-dropin');

        done();
      }.bind(this));
    });

    it('inserts svgs into container', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(this.container.innerHTML).to.include('data-braintree-id="svgs"');

        done();
      }.bind(this));
    });

    it('injects stylesheet with correct id', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        var stylesheet = document.getElementById(constants.STYLESHEET_ID);

        expect(stylesheet).to.exist;
        expect(stylesheet.href).to.match(/assets\.braintreegateway\.com/);

        done();
      });
    });

    it('does not inject stylesheet if it already exists on the page', function (done) {
      var instance = new Dropin(this.dropinOptions);
      var stylesheetOnPage = document.createElement('link');

      stylesheetOnPage.id = constants.STYLESHEET_ID;
      stylesheetOnPage.href = '/customer/dropin.css';

      document.body.appendChild(stylesheetOnPage);

      instance._initialize(function () {
        var stylesheet = document.getElementById(constants.STYLESHEET_ID);

        expect(stylesheet).to.exist;
        expect(stylesheet.href).to.match(/\/customer\/dropin\.css/);

        done();
      });
    });

    it('requests payment methods if a customerId is provided', function (done) {
      var instance;

      this.client.getConfiguration.returns({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });

      this.vaultManager.fetchPaymentMethods.resolves([]);

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        try {
          expect(vaultManager.create).to.be.calledOnce;
          expect(vaultManager.create).to.be.calledWith({
            client: this.client
          });
          expect(this.vaultManager.fetchPaymentMethods).to.have.been.calledOnce;
          expect(this.vaultManager.fetchPaymentMethods).to.have.been.calledWith(this.sandbox.match({
            defaultFirst: true
          }));
        } catch (e) {
          done(e);
        }

        done();
      }.bind(this));
    });

    it('does not fail if there is an error getting existing payment methods', function (done) {
      var instance;

      this.client.getConfiguration.returns({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      this.client.request.rejects(new Error('This failed'));

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(hostedFields.create).to.be.called;
        expect(instance._model.getPaymentMethods()).to.have.a.lengthOf(0);

        done();
      });
    });

    it('creates a MainView a customerId exists', function (done) {
      var instance;
      var paymentMethodsPayload = {paymentMethods: []};

      this.client.getConfiguration.returns({
        authorization: fake.clientTokenWithCustomerID,
        authorizationType: 'CLIENT_TOKEN',
        gatewayConfiguration: fake.configuration().gatewayConfiguration
      });
      this.client.request.resolves(paymentMethodsPayload);

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView).to.exist;

        done();
      });
    });

    it('creates a MainView a customerId does not exist', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView).to.exist;
        done();
      });
    });

    it('calls the create callback when async dependencies are ready', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      instance._initialize(function (err) {
        done(err);
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('returns to app switch view that reported an error', function (done) {
      var instance = new Dropin(this.dropinOptions);
      var error = new Error('error');

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');
      this.sandbox.stub(DropinModel.prototype, 'reportError');

      instance._initialize(function () {
        expect(instance._model.reportError).to.be.calledOnce;
        expect(instance._model.reportError).to.be.calledWith(error);
        expect(instance._mainView.setPrimaryView).to.be.calledOnce;
        expect(instance._mainView.setPrimaryView).to.be.calledWith('view-id');
        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchError = {
          id: 'view-id',
          error: error
        };
        this.sandbox.stub(instance._mainView, 'setPrimaryView');
        instance._model._emit('asyncDependenciesReady');
      }.bind(this));
    });

    it('adds payment method if app switch payload exists', function (done) {
      var instance = new Dropin(this.dropinOptions);
      var payload = {nonce: 'fake-nonce'};

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');
      this.sandbox.stub(DropinModel.prototype, 'addPaymentMethod');

      instance._initialize(function () {
        expect(instance._model.addPaymentMethod).to.be.calledOnce;
        expect(instance._model.addPaymentMethod).to.be.calledWith(payload);
        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchPayload = payload;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('sends web.dropin.appeared event when async dependencies are ready', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      instance._initialize(function () {
        expect(analytics.sendEvent).to.be.calledOnce;
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'appeared');
        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 2;
        instance._model._emit('asyncDependenciesReady');
      });
    });

    it('sends vaulted payment method appeared events for each vaulted payment method', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'getVaultedPaymentMethods').resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      instance._initialize(function () {
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'vaulted-card.appear');
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'vaulted-paypal.appear');
        done();
      });
    });

    it('sends a single analytic event even when multiple vaulted payment methods of the same kind are available', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'getVaultedPaymentMethods').resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'CreditCard', details: {lastTwo: '22'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}},
        {type: 'PayPalAccount', details: {email: 'woah@example.com'}}
      ]);

      instance._initialize(function () {
        expect(analytics.sendEvent.withArgs(instance._client, 'vaulted-card.appear')).to.be.calledOnce;
        expect(analytics.sendEvent.withArgs(instance._client, 'vaulted-paypal.appear')).to.be.calledOnce;
        done();
      });
    });

    it('does not send payment method analytic event when app switch payload present', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'getVaultedPaymentMethods').resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      instance._initialize(function () {
        expect(analytics.sendEvent).to.not.be.calledWith(instance._client, 'vaulted-card.appear');
        expect(analytics.sendEvent).to.not.be.calledWith(instance._client, 'vaulted-paypal.appear');

        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchPayload = {
          nonce: 'a-nonce'
        };
        this.sandbox.stub(instance._mainView, 'setPrimaryView');

        instance._model._emit('asyncDependenciesReady');
      }.bind(this));
    });

    it('does not send payment method analytic event when app switch error present', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'getVaultedPaymentMethods').resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      instance._initialize(function () {
        expect(analytics.sendEvent).to.not.be.calledWith(instance._client, 'vaulted-card.appear');
        expect(analytics.sendEvent).to.not.be.calledWith(instance._client, 'vaulted-paypal.appear');

        done();
      });

      delay().then(function () {
        instance._model.dependencySuccessCount = 1;
        instance._model.appSwitchError = {
          ID: 'view',
          error: new Error('error')
        };
        this.sandbox.stub(instance._mainView, 'setPrimaryView');

        instance._model._emit('asyncDependenciesReady');
      }.bind(this));
    });

    it('does not send web.vaulted-card.appear analytic event when no vaulted cards appear', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'getVaultedPaymentMethods').resolves([
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      instance._initialize(function () {
        expect(analytics.sendEvent).to.not.be.calledWith(instance._client, 'vaulted-card.appear');
        done();
      });
    });

    it('loads strings by default', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Postal Code');
        done();
      });
    });

    it('loads localized strings into mainView when options.locale is specified', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.locale = 'es_ES';
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Código postal');
        done();
      });
    });

    it('uses custom translations when options.translations is specified', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.translations = {
        payingWith: 'You are paying with {{paymentSource}}',
        chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string'
      };
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.payingWith).to.equal('You are paying with {{paymentSource}}');
        expect(instance._mainView.strings.chooseAnotherWayToPay).to.equal('My custom chooseAnotherWayToPay string');
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Postal Code');
        done();
      });
    });

    it('sanitizes html in custom translations', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.translations = {
        chooseAnotherWayToPay: '<script>alert()</script>'
      };
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.chooseAnotherWayToPay).to.equal('&lt;script&gt;alert()&lt;/script&gt;');
        done();
      });
    });

    it('uses locale with custom translations', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.locale = 'es_ES';
      this.dropinOptions.merchantConfiguration.translations = {
        payingWith: 'You are paying with {{paymentSource}}',
        chooseAnotherWayToPay: 'My custom chooseAnotherWayToPay string'
      };
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.payingWith).to.equal('You are paying with {{paymentSource}}');
        expect(instance._mainView.strings.chooseAnotherWayToPay).to.equal('My custom chooseAnotherWayToPay string');
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Código postal');
        done();
      });
    });

    it('loads localized strings into mainView when options.locale is a supported locale ID', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.locale = 'en_GB';
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Postcode');
        done();
      });
    });

    it('loads supported localized strings into mainView when options.locale is a locale ID with an unsupported country', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.locale = 'en_NA';
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Postal Code');
        done();
      });
    });

    it('loads default strings into mainView when options.locale is unknown', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.locale = 'foo';
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Postal Code');
        done();
      });
    });
  });

  describe('loads data collector', function () {
    beforeEach(function () {
      this.dropinOptions.merchantConfiguration.dataCollector = {kount: true};
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');
      this.sandbox.stub(Dropin.prototype, '_setUpDataCollector');
    });

    it('does not load Data Collector if Data Collector is not enabled', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.dataCollector;
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._setUpDataCollector).to.not.be.called;

        done();
      });
    });

    it('does load Data Collector if Data Collector is enabled', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._setUpDataCollector).to.be.called;

        done();
      });
    });
  });

  describe('loads 3D Secure', function () {
    beforeEach(function () {
      this.dropinOptions.merchantConfiguration.threeDSecure = {};
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');
      this.sandbox.stub(Dropin.prototype, '_setUpThreeDSecure');
    });

    it('does not load 3D Secure if 3D Secure is not enabled', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.threeDSecure;
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._setUpThreeDSecure).to.not.be.called;

        done();
      });
    });

    it('does load 3D Secure if 3D Secure is enabled', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._setUpThreeDSecure).to.be.called;

        done();
      });
    });
  });

  describe('_setUpDataCollector', function () {
    beforeEach(function () {
      this.model = fake.model({
        componentID: 'foo',
        client: this.client,
        merchantConfiguration: {
          container: '#foo',
          authorization: fake.tokenizationKey
        },
        paymentMethods: ['card']
      });
      this.sandbox.stub(DataCollector.prototype, 'initialize').resolves();
    });

    it('sets up datacollector', function () {
      Dropin.prototype._setUpDataCollector.call({
        _client: this.client,
        _model: this.model,
        _strings: {},
        _merchantConfiguration: {
          dataCollector: {
            kount: true
          }
        }
      });

      expect(DataCollector.prototype.initialize).to.be.calledOnce;
    });

    it('fails initialization when Data Collection creation fails', function (done) {
      var error = new Error('failed.');

      this.sandbox.spy(DropinModel.prototype, 'cancelInitialization');

      DataCollector.prototype.initialize.rejects(error);

      Dropin.prototype._setUpDataCollector.call({
        _client: this.client,
        _model: this.model,
        _strings: {
          cardVerification: 'Card Verification'
        },
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(DataCollector.prototype.initialize).to.be.calledOnce;
      setTimeout(function () {
        expect(DropinModel.prototype.cancelInitialization).to.be.called;
        done();
      }, 1000);
    });

    it('starts an async dependency', function () {
      function noop() {}
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');

      Dropin.prototype._setUpDataCollector.call({
        _client: this.client,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        },
        _model: this.model,
        _strings: {
          cardVerification: 'Card Verification'
        }
      }, noop);

      expect(DropinModel.prototype.asyncDependencyStarting).to.be.calledOnce;
    });
  });

  describe('_setUpThreeDSecure', function () {
    beforeEach(function () {
      this.model = fake.model({
        componentID: 'foo',
        client: this.client,
        merchantConfiguration: {
          container: '#foo',
          authorization: fake.tokenizationKey
        },
        paymentMethods: ['card']
      });
      this.sandbox.stub(ThreeDSecure.prototype, 'initialize').resolves();
    });

    it('sets up 3ds', function () {
      Dropin.prototype._setUpThreeDSecure.call({
        _client: this.client,
        _model: this.model,
        _strings: {
          cardVerification: 'Card Verification'
        },
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(ThreeDSecure.prototype.initialize).to.be.calledOnce;
    });

    it('fails initialization when 3DS creation fails', function (done) {
      var error = new Error('failed.');

      this.sandbox.spy(DropinModel.prototype, 'cancelInitialization');

      ThreeDSecure.prototype.initialize.rejects(error);

      Dropin.prototype._setUpThreeDSecure.call({
        _client: this.client,
        _model: this.model,
        _strings: {
          cardVerification: 'Card Verification'
        },
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        }
      });

      expect(ThreeDSecure.prototype.initialize).to.be.calledOnce;
      setTimeout(function () {
        expect(DropinModel.prototype.cancelInitialization).to.be.called;
        done();
      }, 1000);
    });

    it('starts an async dependency', function () {
      function noop() {}
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');

      Dropin.prototype._setUpThreeDSecure.call({
        _client: this.client,
        _merchantConfiguration: {
          threeDSecure: {
            foo: 'bar'
          }
        },
        _model: this.model,
        _strings: {
          cardVerification: 'Card Verification'
        }
      }, noop);

      expect(DropinModel.prototype.asyncDependencyStarting).to.be.calledOnce;
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.instance = new Dropin(this.dropinOptions);
      this.container.appendChild(this.instance._dropinWrapper);
      this.instance._mainView = {
        teardown: this.sandbox.stub().resolves()
      };
    });

    it('removes dropin node from page', function (done) {
      this.instance.teardown(function () {
        expect(this.container.contains(this.instance._dropinWrapper)).to.be.false;
        done();
      }.bind(this));
    });

    it('calls teardown on the mainView', function (done) {
      this.instance.teardown(function () {
        expect(this.instance._mainView.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('calls teardown on dataCollector', function (done) {
      this.instance._dataCollector = {
        teardown: this.sandbox.stub().resolves()
      };

      this.instance.teardown(function () {
        expect(this.instance._dataCollector.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('calls teardown on 3D Secure', function (done) {
      this.instance._threeDSecure = {
        teardown: this.sandbox.stub().resolves()
      };

      this.instance.teardown(function () {
        expect(this.instance._threeDSecure.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('passes errors from data collector teardown to callback', function (done) {
      var error = new Error('Data Collector failured');

      this.instance._dataCollector = {
        teardown: this.sandbox.stub().rejects(error)
      };

      this.instance.teardown(function (err) {
        expect(err.message).to.equal('Drop-in errored tearing down Data Collector.');
        done();
      });
    });

    it('passes errors from 3D Secure teardown to callback', function (done) {
      var error = new Error('3D Secure failured');

      this.instance._threeDSecure = {
        teardown: this.sandbox.stub().rejects(error)
      };

      this.instance.teardown(function (err) {
        expect(err.message).to.equal('Drop-in errored tearing down 3D Secure.');
        done();
      });
    });

    it('passes errors in mainView teardown to callback', function (done) {
      var error = new Error('Teardown Error');

      this.instance._mainView.teardown.rejects(error);

      this.instance.teardown(function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });

  describe('requestPaymentMethod', function () {
    it('calls the requestPaymentMethod function of the MainView', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        this.sandbox.spy(instance._mainView, 'requestPaymentMethod');
        instance.requestPaymentMethod(function () {
          expect(instance._mainView.requestPaymentMethod).to.have.been.calledOnce;
          done();
        });
      }.bind(this));
    });

    it('returns a formatted payload', function (done) {
      var instance = new Dropin(this.dropinOptions);
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
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);

        instance.requestPaymentMethod(function (err, payload) {
          expect(payload.nonce).to.equal(fakePayload.nonce);
          expect(payload.details).to.equal(fakePayload.details);
          expect(payload.type).to.equal(fakePayload.type);
          expect(payload.vaulted).to.equal(fakePayload.vaulted);
          expect(payload.deviceData).to.equal(fakePayload.deviceData);
          expect(payload.binData).to.equal(fakePayload.binData);

          expect(payload.rogueParameter).to.not.exist;

          done();
        });
      }.bind(this));
    });

    it('includes rawPaymentData if a Google Pay payment method', function (done) {
      var instance = new Dropin(this.dropinOptions);
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
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);

        instance.requestPaymentMethod(function (err, payload) {
          expect(payload.details.rawPaymentData).to.equal(rawPaymentData);

          done();
        });
      }.bind(this));
    });

    it('includes rawPaymentData if an Apple Pay payment method', function (done) {
      var instance = new Dropin(this.dropinOptions);
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
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);

        instance.requestPaymentMethod(function (err, payload) {
          expect(payload.details.rawPaymentData).to.equal(rawPaymentData);

          done();
        });
      }.bind(this));
    });

    it('does not call 3D Secure if it is not enabled', function (done) {
      var fakePayload = {
        nonce: 'cool-nonce'
      };
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(ThreeDSecure.prototype, 'verify');

      instance._initialize(function () {
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);

        instance.requestPaymentMethod(function () {
          expect(ThreeDSecure.prototype.verify).to.not.be.called;

          done();
        });
      }.bind(this));
    });

    it('does not call 3D Secure if payment method is not a credit card', function (done) {
      var instance;
      var fakePayload = {
        nonce: 'cool-nonce',
        type: 'PAYPAL_ACCOUNT'
      };

      this.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(ThreeDSecure.prototype, 'verify');

      instance._initialize(function () {
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);

        instance.requestPaymentMethod(function () {
          expect(ThreeDSecure.prototype.verify).to.not.be.called;

          done();
        });
      }.bind(this));
    });

    it('does not call 3D Secure if payment method nonce payload contains liablity information', function (done) {
      var instance;
      var fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard',
        liabilityShifted: false
      };

      this.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(ThreeDSecure.prototype, 'verify');

      instance._initialize(function () {
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);

        instance.requestPaymentMethod(function () {
          expect(ThreeDSecure.prototype.verify).to.not.be.called;

          done();
        });
      }.bind(this));
    });

    it('calls 3D Secure if payment method nonce payload is a credit card and does not contain liability info', function (done) {
      var instance;
      var fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };

      this.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);
        instance._threeDSecure = {
          verify: this.sandbox.stub().resolves({
            nonce: 'new-nonce',
            liabilityShifted: true,
            liabilityShiftPossible: true
          })
        };

        instance.requestPaymentMethod(function () {
          expect(instance._threeDSecure.verify).to.be.calledOnce;
          expect(instance._threeDSecure.verify).to.be.calledWith('cool-nonce');

          done();
        });
      }.bind(this));
    });

    it('replaces payload nonce with new 3ds nonce', function (done) {
      var instance;
      var fakePayload = {
        nonce: 'cool-nonce',
        type: 'CreditCard'
      };

      this.dropinOptions.merchantConfiguration.threeDSecure = {};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        this.sandbox.stub(instance._mainView, 'requestPaymentMethod').resolves(fakePayload);
        instance._threeDSecure = {
          verify: this.sandbox.stub().resolves({
            nonce: 'new-nonce',
            liabilityShifted: true,
            liabilityShiftPossible: true
          })
        };

        instance.requestPaymentMethod(function (err, payload) {
          expect(payload.nonce).to.equal('new-nonce');
          expect(payload.liabilityShifted).to.equal(true);
          expect(payload.liabilityShiftPossible).to.equal(true);
          expect(fakePayload.nonce).to.equal('new-nonce');
          expect(fakePayload.liabilityShifted).to.equal(true);
          expect(fakePayload.liabilityShiftPossible).to.equal(true);

          done();
        });
      }.bind(this));
    });
  });

  describe('isPaymentMethodRequestable', function () {
    it('returns the value of model.isPaymentMethodRequestable', function () {
      var instance = new Dropin(this.dropinOptions);

      instance._model = {
        isPaymentMethodRequestable: this.sandbox.stub().returns('foo')
      };

      expect(instance.isPaymentMethodRequestable()).to.equal('foo');
    });
  });

  describe('updateConfiguration', function () {
    it('does not update if a non-editiable prop is used', function () {
      var instance = new Dropin(this.dropinOptions);
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };

      instance._mainView = {
        getView: this.sandbox.stub().returns(fakePayPalView)
      };

      instance.updateConfiguration('card', 'foo', 'bar');

      expect(instance._mainView.getView).to.not.be.called;
    });

    it('does not update if view is not set up', function () {
      var instance = new Dropin(this.dropinOptions);

      instance._mainView = {
        getView: this.sandbox.stub().returns(null)
      };

      expect(function () {
        instance.updateConfiguration('paypal', 'foo', 'bar');
      }).to.not.throw();
    });

    it('updates if view is paypal', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([])
      };

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.getView).to.be.calledOnce;
      expect(fakePayPalView.updateConfiguration).to.be.calledOnce;
      expect(fakePayPalView.updateConfiguration).to.be.calledWith('foo', 'bar');
    });

    it('updates if view is paypalCredit', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };

      getViewStub.withArgs('paypalCredit').returns(fakePayPalView);

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([])
      };

      instance.updateConfiguration('paypalCredit', 'foo', 'bar');

      expect(instance._mainView.getView).to.be.calledOnce;
      expect(fakePayPalView.updateConfiguration).to.be.calledOnce;
      expect(fakePayPalView.updateConfiguration).to.be.calledWith('foo', 'bar');
    });

    it('updates if view is applePay', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeApplePayView = {
        updateConfiguration: this.sandbox.stub()
      };

      getViewStub.withArgs('applePay').returns(fakeApplePayView);

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([])
      };

      instance.updateConfiguration('applePay', 'foo', 'bar');

      expect(instance._mainView.getView).to.be.calledOnce;
      expect(fakeApplePayView.updateConfiguration).to.be.calledOnce;
      expect(fakeApplePayView.updateConfiguration).to.be.calledWith('foo', 'bar');
    });

    it('updates if view is googlePay', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeGooglePayView = {
        updateConfiguration: this.sandbox.stub()
      };

      getViewStub.withArgs('googlePay').returns(fakeGooglePayView);

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([])
      };

      instance.updateConfiguration('googlePay', 'foo', 'bar');

      expect(instance._mainView.getView).to.be.calledOnce;
      expect(fakeGooglePayView.updateConfiguration).to.be.calledOnce;
      expect(fakeGooglePayView.updateConfiguration).to.be.calledWith('foo', 'bar');
    });

    it('updates if property is threeDSecure', function () {
      var instance = new Dropin(this.dropinOptions);

      instance._threeDSecure = {
        updateConfiguration: this.sandbox.stub()
      };
      instance._mainView = {
        getView: this.sandbox.stub()
      };

      instance.updateConfiguration('threeDSecure', 'amount', '15.00');

      expect(instance._threeDSecure.updateConfiguration).to.be.calledOnce;
      expect(instance._threeDSecure.updateConfiguration).to.be.calledWith('amount', '15.00');
      expect(instance._mainView.getView).to.not.be.called;
    });

    it('does not update if property is threeDSecure, but there is no threeDSecure instance', function () {
      var instance = new Dropin(this.dropinOptions);

      expect(function () {
        instance.updateConfiguration('threeDSecure', 'amount', '15.00');
      }).to.not.throw();
    });

    it('removes saved paypal payment methods if they are not vaulted', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
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
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'PayPalAccount', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'PayPalAccount'},
          {nonce: '4', type: 'PayPalAccount', vaulted: true},
          {nonce: '5', type: 'PayPalAccount'}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._model.getPaymentMethods).to.be.calledOnce;
      expect(instance._model.removePaymentMethod).to.be.calledTwice;
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '3', type: 'PayPalAccount'});
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '5', type: 'PayPalAccount'});
    });

    it('does not call removePaymentMethod if no non-vaulted paypal accounts are avaialble', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns(null)
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'PayPalAccount', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'PayPalAccount', vaulted: true}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._model.removePaymentMethod).to.not.be.called;
    });

    it('removes saved applePay payment methods if they are not vaulted', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeApplePayView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
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
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'ApplePayCard', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'ApplePayCard'},
          {nonce: '4', type: 'ApplePayCard', vaulted: true},
          {nonce: '5', type: 'ApplePayCard'}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('applePay').returns(fakeApplePayView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('applePay', 'foo', 'bar');

      expect(instance._model.getPaymentMethods).to.be.calledOnce;
      expect(instance._model.removePaymentMethod).to.be.calledTwice;
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '3', type: 'ApplePayCard'});
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '5', type: 'ApplePayCard'});
    });

    it('does not call removePaymentMethod if no non-vaulted applePay accounts are avaialble', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeApplePayView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns(null)
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'ApplePayCard', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'ApplePayCard', vaulted: true}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('applePay').returns(fakeApplePayView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('applePay', 'foo', 'bar');

      expect(instance._model.removePaymentMethod).to.not.be.called;
    });

    it('removes saved googlePay payment methods if they are not vaulted', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeGooglePayView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
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
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'AndroidPayCard', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'AndroidPayCard'},
          {nonce: '4', type: 'AndroidPayCard', vaulted: true},
          {nonce: '5', type: 'AndroidPayCard'}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('googlePay').returns(fakeGooglePayView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('googlePay', 'foo', 'bar');

      expect(instance._model.getPaymentMethods).to.be.calledOnce;
      expect(instance._model.removePaymentMethod).to.be.calledTwice;
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '3', type: 'AndroidPayCard'});
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '5', type: 'AndroidPayCard'});
    });

    it('does not call removePaymentMethod if no non-vaulted googlePay accounts are avaialble', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeGooglePayView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns(null)
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'AndroidPayCard', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'AndroidPayCard', vaulted: true}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('googlePay').returns(fakeGooglePayView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('googlePay', 'foo', 'bar');

      expect(instance._model.removePaymentMethod).to.not.be.called;
    });

    it('sets primary view to options if on the methods view and there are no saved payment methods and supportedPaymentOptions is greater than 1', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([]),
        supportedPaymentOptions: ['paypal', 'card'],
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).to.be.calledOnce;
      expect(instance._mainView.setPrimaryView).to.be.calledWith('options');
    });

    it('sets primary view to available payment option view if on the methods view and there are not saved payment methods and only one payment option is available', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([]),
        supportedPaymentOptions: ['paypal'],
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).to.be.calledOnce;
      expect(instance._mainView.setPrimaryView).to.be.calledWith('paypal');
    });

    it('does not set primary view if current primary view is not methods', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'any-id-but-methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).to.not.be.called;
    });

    it('does not set primary view if there are saved payment methods', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakePayPalView = {
        updateConfiguration: this.sandbox.stub()
      };
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'CreditCard'}
        ]),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('paypal').returns(fakePayPalView);
      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.updateConfiguration('paypal', 'foo', 'bar');

      expect(instance._mainView.setPrimaryView).to.not.be.called;
    });
  });

  describe('clearSelectedPaymentMethod', function () {
    it('refreshes saved payment methods', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'PayPalAccount', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'CreditCard'},
          {nonce: '4', type: 'PayPalAccount'},
          {nonce: '5', type: 'PayPalAccount', vaulted: true}
        ]),
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        removeActivePaymentMethod: this.sandbox.stub(),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._model.refreshPaymentMethods).to.be.calledOnce;
    });

    it('does not call removePaymentMethod if no non-vaulted paypal accounts are avaialble', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        primaryView: {
          ID: 'view'
        }
      };
      instance._model = {
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'PayPalAccount', vaulted: true},
          {nonce: '2', type: 'CreditCard', vaulted: true},
          {nonce: '3', type: 'PayPalAccount', vaulted: true}
        ]),
        removeActivePaymentMethod: this.sandbox.stub(),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._model.removePaymentMethod).to.not.be.called;
    });

    it('sets primary view to options if on the methods view and there are no saved payment methods and supportedPaymentOptions is greater than 1', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        getPaymentMethods: this.sandbox.stub().returns([]),
        removeActivePaymentMethod: this.sandbox.stub(),
        supportedPaymentOptions: ['paypal', 'card'],
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).to.be.calledOnce;
      expect(instance._mainView.setPrimaryView).to.be.calledWith('options');
    });

    it('sets primary view to available payment option view if on the methods view and there are not saved payment methods and only one payment option is available', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        getPaymentMethods: this.sandbox.stub().returns([]),
        removeActivePaymentMethod: this.sandbox.stub(),
        supportedPaymentOptions: ['paypal'],
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).to.be.calledOnce;
      expect(instance._mainView.setPrimaryView).to.be.calledWith('paypal');
    });

    it('does not set primary view if current primary view is not methods', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        primaryView: {
          ID: 'any-id-but-methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        getPaymentMethods: this.sandbox.stub().returns([]),
        removeActivePaymentMethod: this.sandbox.stub(),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).to.not.be.called;
    });

    it('does not set primary view if there are saved payment methods', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        getView: getViewStub,
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'CreditCard'}
        ]),
        removeActivePaymentMethod: this.sandbox.stub(),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._mainView.setPrimaryView).to.not.be.called;
    });

    it('removes active payment method view', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
      var fakeMethodsView = {
        getPaymentMethod: this.sandbox.stub().returns({
          type: 'PayPalAccount'
        })
      };

      instance._mainView = {
        showLoadingIndicator: this.sandbox.stub(),
        hideLoadingIndicator: this.sandbox.stub(),
        getView: getViewStub,
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
        refreshPaymentMethods: this.sandbox.stub().resolves(),
        getPaymentMethods: this.sandbox.stub().returns([
          {nonce: '1', type: 'CreditCard'}
        ]),
        removeActivePaymentMethod: this.sandbox.stub(),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._model.removeActivePaymentMethod).to.be.calledOnce;
    });
  });

  describe('payment method requestable events', function () {
    it('emits paymentMethodRequestable event when the model emits paymentMethodRequestable', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.on('paymentMethodRequestable', function (event) {
        expect(event.type).to.equal('Foo');

        done();
      });

      instance._initialize(function () {
        instance._model._emit('paymentMethodRequestable', {type: 'Foo'});
      });
    });

    it('emits noPaymentMethodRequestable events when the model emits noPaymentMethodRequestable', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.on('noPaymentMethodRequestable', function () {
        done();
      });

      instance._initialize(function () {
        instance._model._emit('noPaymentMethodRequestable');
      });
    });
  });

  describe('payment option selected event', function () {
    it('emits paymentOptionSelected when the model emits paymentOptionSelected', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.on('paymentOptionSelected', function (event) {
        expect(event.paymentOption).to.equal('Foo');

        done();
      });

      instance._initialize(function () {
        instance._model._emit('paymentOptionSelected', {paymentOption: 'Foo'});
      });
    });
  });
});
