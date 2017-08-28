'use strict';

var Dropin = require('../../src/dropin/');
var DropinModel = require('../../src/dropin-model');
var EventEmitter = require('../../src/lib/event-emitter');
var analytics = require('../../src/lib/analytics');
var fake = require('../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');
var paypalCheckout = require('braintree-web/paypal-checkout');
var dataCollector = require('braintree-web/data-collector');
var MainView = require('../../src/views/main-view');
var CardView = require('../../src/views/payment-sheet-views/card-view');
var constants = require('../../src/constants');
var checkoutJsSource = constants.CHECKOUT_JS_SOURCE;

describe('Dropin', function () {
  beforeEach(function () {
    this.client = {
      request: this.sandbox.stub(),
      _request: this.sandbox.stub(),
      getConfiguration: fake.configuration
    };

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

    this.sandbox.stub(CardView.prototype, 'getPaymentMethod');
    this.sandbox.stub(hostedFields, 'create').resolves(fake.hostedFieldsInstance);
    this.sandbox.stub(paypalCheckout, 'create').resolves(fake.paypalInstance);
  });

  afterEach(function () {
    var stylesheet = document.getElementById(constants.STYLESHEET_ID);

    if (document.body.querySelector('#foo')) {
      document.body.removeChild(this.container);
    }

    if (stylesheet) {
      stylesheet.parentNode.removeChild(stylesheet);
    }

    delete global.paypal;
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

      this.sandbox.stub(Dropin.prototype, '_loadPayPalScript').callsFake(function (callback) {
        global.paypal = this.paypalCheckout;

        callback();
      }.bind(this));
    });

    it('errors out if no selector or container are given', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.container;

      this.sandbox.stub(analytics, 'sendEvent');

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

      this.sandbox.stub(analytics, 'sendEvent');

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

      this.sandbox.stub(analytics, 'sendEvent');
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
        expect(paypalOption.innerHTML).to.include('PayPal Error');
        done();
      }.bind(this));
    });

    it('shows PayPal linked sandbox error in option', function (done) {
      var instance;
      var paypalError = new Error('PayPal Error');

      paypalError.code = 'PAYPAL_SANDBOX_ACCOUNT_NOT_LINKED';

      paypalCheckout.create.rejects(paypalError);
      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        var paypalOption = this.container.querySelector('.braintree-option__paypal');

        setTimeout(function () {
          expect(paypalOption.className).to.include('braintree-disabled');
          expect(paypalOption.innerHTML).to.include(constants.errors.PAYPAL_NON_LINKED_SANDBOX);
          done();
        }, 100);
      }.bind(this));
    });

    it('throws an error with a container that points to a nonexistent DOM node', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.container = '#garbage';

      this.sandbox.stub(analytics, 'sendEvent');

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

      this.sandbox.stub(analytics, 'sendEvent');

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

      this.sandbox.stub(analytics, 'sendEvent');

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

      this.sandbox.stub(analytics, 'sendEvent');

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
      var paymentMethodsPayload = {paymentMethods: []};

      this.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      this.client.request.yields(null, paymentMethodsPayload);

      this.sandbox.stub(analytics, 'sendEvent');

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(this.client.request).to.have.been.calledOnce;
        expect(this.client.request).to.have.been.calledWith(this.sandbox.match({
          endpoint: 'payment_methods',
          method: 'get',
          data: {
            defaultFirst: 1
          }
        }), this.sandbox.match.func);

        done();
      }.bind(this));
    });

    it('does not request payment methods if a customerId is not provided', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(analytics, 'sendEvent');

      instance._initialize(function () {
        expect(this.client.request).to.not.have.been.calledWith(this.sandbox.match({endpoint: 'payment_methods'}));

        done();
      }.bind(this));
    });

    it('does not fail if there is an error getting existing payment methods', function (done) {
      var instance;

      this.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      this.client.request.yields(new Error('This failed'));

      this.sandbox.stub(analytics, 'sendEvent');

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(hostedFields.create).to.be.called;
        expect(instance._model.getPaymentMethods()).to.have.a.lengthOf(0);

        done();
      });
    });

    it('formats existing payment method payload', function (done) {
      var instance;
      var fakePaymentMethod = {
        nonce: 'nonce',
        details: {lastTwo: '11'},
        type: 'CreditCard',
        garbage: 'garbage'
      };
      var paymentMethodsPayload = {paymentMethods: [fakePaymentMethod]};

      this.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      this.client.request.yields(null, paymentMethodsPayload);

      this.sandbox.stub(analytics, 'sendEvent');

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        var existingPaymentMethod = instance._model.getPaymentMethods()[0];

        expect(existingPaymentMethod.nonce).to.equal('nonce');
        expect(existingPaymentMethod.details).to.deep.equal({lastTwo: '11'});
        expect(existingPaymentMethod.type).to.equal('CreditCard');
        expect(existingPaymentMethod.vaulted).to.equal(true);
        expect(existingPaymentMethod.garbage).to.not.exist;
        done();
      });
    });

    it('creates a MainView a customerId exists', function (done) {
      var instance;
      var paymentMethodsPayload = {paymentMethods: []};

      this.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      this.client.request.yields(null, paymentMethodsPayload);

      this.sandbox.stub(analytics, 'sendEvent');

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

    it('creates a MainView if checkout.js is not required', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView).to.exist;
        done();
      });
    });

    it('creates a MainView if checkout.js is required', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance._initialize(function (err, returned) {
        expect(returned._mainView).to.exist;

        done();
      });
    });

    it('does not load checkout.js if PayPal is not required', function (done) {
      var script;
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        script = document.querySelector('script[src="' + checkoutJsSource + '"]');
        expect(script).to.not.exist;
        expect(global.paypal).to.not.exist;
        done();
      });
    });

    it('does not load checkout.js if script tag with paypal checkout id is already on the page', function (done) {
      var instance = new Dropin(this.dropinOptions);
      var script = document.createElement('script');

      global.paypal = this.paypalCheckout;

      script.id = 'braintree-dropin-paypal-checkout-script';
      document.body.appendChild(script);

      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance._initialize(function () {
        expect(instance._loadPayPalScript).to.not.have.been.called;
        document.body.removeChild(script);

        done();
      });
    });

    it('loads checkout.js if PayPal is enabled', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.dropinOptions.merchantConfiguration.paypal = {flow: 'vault'};

      instance._initialize(function () {
        expect(instance._loadPayPalScript).to.have.been.called;

        done();
      });
    });

    it('loads checkout.js if PayPal Credit is enabled', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.dropinOptions.merchantConfiguration.paypalCredit = {flow: 'vault'};

      instance._initialize(function () {
        expect(instance._loadPayPalScript).to.have.been.called;

        done();
      });
    });

    it('calls the create callback when async dependencies are ready', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      instance._initialize(function () {
        done();
      });

      instance._model._emit('asyncDependenciesReady');
    });

    it('sends web.dropin.appeared event when async dependencies are ready', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');
      this.sandbox.stub(analytics, 'sendEvent');

      instance._initialize(function () {
        expect(analytics.sendEvent).to.be.calledOnce;
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'appeared');
        done();
      });

      instance._model.dependencySuccessCount = 2;
      instance._model._emit('asyncDependenciesReady');
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

  describe('data collector', function () {
    beforeEach(function () {
      this.deviceData = {correlationId: '123'};
      this.dropinOptions.merchantConfiguration.dataCollector = {kount: true};
      this.sandbox.stub(dataCollector, 'create').resolves({
        deviceData: this.deviceData
      });
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');
    });

    it('does not setup data collector if data collector is not enabled', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.dataCollector;
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(dataCollector.create).to.not.be.called;

        done();
      });
    });

    it('sets up data collector when enabled', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(dataCollector.create).to.be.calledOnce;
        expect(dataCollector.create).to.be.calledWith({
          client: instance._client,
          kount: true
        });

        done();
      });
    });

    it('starts an async dependency', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        // once for card view
        // second time for data collector
        expect(instance._model.asyncDependencyStarting).to.be.calledTwice;
        expect(instance._model.asyncDependencyReady).to.be.calledTwice;

        done();
      });
    });

    it('fails initialization when data collector fails to create', function (done) {
      var instance = new Dropin(this.dropinOptions);
      var dataCollectorError = new Error('data collector failed');

      dataCollector.create.rejects(dataCollectorError);

      instance._initialize(function (err) {
        expect(err.message).to.equal('Data Collector failed to set up.');
        expect(err._braintreeWebError).to.equal(dataCollectorError);

        done();
      });
    });

    it('passes along device data when requesting payment method', function (done) {
      var instance = new Dropin(this.dropinOptions);
      var deviceData = this.deviceData;

      this.sandbox.stub(MainView.prototype, 'requestPaymentMethod').resolves({
        nonce: 'a-nonce'
      });

      instance._initialize(function () {
        instance.requestPaymentMethod(function (err, payload) {
          expect(payload.nonce).to.equal('a-nonce');
          expect(payload.deviceData).to.equal(deviceData);
          done();
        });
      });
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
      this.instance._dataCollectorInstance = {
        teardown: this.sandbox.stub().resolves()
      };

      this.instance.teardown(function () {
        expect(this.instance._dataCollectorInstance.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('passes errors from data collector teardown to callback', function (done) {
      var error = new Error('Data Collector failured');

      this.instance._dataCollectorInstance = {
        teardown: this.sandbox.stub().rejects(error)
      };

      this.instance.teardown(function (err) {
        expect(err.message).to.equal('Drop-in errored tearing down Data Collector.');
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
    it('does not update if a prop other than paypal or paypalCredit is used', function () {
      var instance = new Dropin(this.dropinOptions);

      instance._mainView = {
        getView: this.sandbox.stub()
      };

      instance.updateConfiguration('card', 'foo', 'bar');

      expect(instance._mainView.getView).to.not.be.called;
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
    it('removes saved payment methods if they are not vaulted', function () {
      var instance = new Dropin(this.dropinOptions);
      var getViewStub = this.sandbox.stub();
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
          {nonce: '3', type: 'CreditCard'},
          {nonce: '4', type: 'PayPalAccount'},
          {nonce: '5', type: 'PayPalAccount', vaulted: true}
        ]),
        removeActivePaymentMethod: this.sandbox.stub(),
        removePaymentMethod: this.sandbox.stub()
      };

      getViewStub.withArgs('methods').returns(fakeMethodsView);

      instance.clearSelectedPaymentMethod();

      expect(instance._model.removePaymentMethod).to.be.calledTwice;
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '3', type: 'CreditCard'});
      expect(instance._model.removePaymentMethod).to.be.calledWith({nonce: '4', type: 'PayPalAccount'});
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
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
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
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
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
        primaryView: {
          ID: 'any-id-but-methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
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
        primaryView: {
          ID: 'methods'
        },
        setPrimaryView: this.sandbox.stub()
      };
      instance._model = {
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

  describe('_loadPayPalScript', function () {
    function noop() {}

    beforeEach(function () {
      this.fakeDropinWrapper = {
        appendChild: this.sandbox.stub()
      };
      this.fakeScript = {
        addEventListener: this.sandbox.stub(),
        setAttribute: this.sandbox.stub()
      };

      this.sandbox.stub(document, 'createElement').returns(this.fakeScript);
    });

    it('adds script to document to load checkout.js', function () {
      Dropin.prototype._loadPayPalScript.call({
        _dropinWrapper: this.fakeDropinWrapper,
        _merchantConfiguration: {
          paypal: {}
        }
      }, noop);

      expect(this.fakeScript.src).to.equal(constants.CHECKOUT_JS_SOURCE);
      expect(this.fakeScript.async).to.equal(true);
      expect(this.fakeScript.addEventListener).to.be.calledWith('load', noop);
      expect(this.fakeScript.setAttribute).to.be.calledWith('data-log-level', 'warn');
      expect(this.fakeDropinWrapper.appendChild).to.be.calledWith(this.fakeScript);
    });

    it('uses loglevel from merchantConfiguration.paypal', function () {
      Dropin.prototype._loadPayPalScript.call({
        _dropinWrapper: this.fakeDropinWrapper,
        _merchantConfiguration: {
          paypal: {
            logLevel: 'customLogLevel'
          }
        }
      }, noop);

      expect(this.fakeScript.setAttribute).to.be.calledWith('data-log-level', 'customLogLevel');
    });
  });
});
