'use strict';

var Dropin = require('../../src/dropin/');
var deferred = require('../../src/lib/deferred');
var DropinModel = require('../../src/dropin-model');
var EventEmitter = require('../../src/lib/event-emitter');
var analytics = require('../../src/lib/analytics');
var fake = require('../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');

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
        selector: '#foo',
        authorization: fake.tokenizationKey
      }
    };

    this.sandbox.stub(hostedFields, 'create', function (options, cb) {
      deferred(cb)(null, fake.hostedFieldsInstance);
    });
  });

  afterEach(function () {
    if (document.body.querySelector('#foo')) {
      document.body.removeChild(this.container);
    }
  });

  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      expect(new Dropin(this.dropinOptions)).to.be.an.instanceOf(EventEmitter);
    });

    it('clones merchant configuration', function () {
      var instance = new Dropin(this.dropinOptions);

      this.dropinOptions.merchantConfiguration.selector = '#bar';

      expect(instance._merchantConfiguration.selector).to.equal('#foo');
    });
  });

  describe('_initialize', function () {
    it('errors out if no selector given', function (done) {
      var instance;

      delete this.dropinOptions.merchantConfiguration.selector;

      this.sandbox.stub(analytics, 'sendEvent');

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector is required.');
        expect(analytics.sendEvent).to.be.calledWith(instance.client, 'configuration-error');
        done();
      });
    });

    it('throws an error with a selector that points to a nonexistent DOM node', function (done) {
      var instance;

      this.dropinOptions.merchantConfiguration.selector = '#garbage';

      this.sandbox.stub(analytics, 'sendEvent');

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector must reference a valid DOM node.');
        expect(analytics.sendEvent).to.be.calledWith(instance.client, 'configuration-error');
        done();
      });
    });

    it('throws an error if merchant container is not empty', function (done) {
      var instance;
      var div = document.createElement('div');

      this.container.appendChild(div);

      this.sandbox.stub(analytics, 'sendEvent');

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector must reference an empty DOM node.');
        expect(analytics.sendEvent).to.be.calledWith(instance.client, 'configuration-error');
        done();
      });
    });

    it('inserts dropin into container if merchant container has only white space', function (done) {
      var instance;

      this.container.innerHTML = ' ';

      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(this.container.innerHTML).to.include('class="braintree-dropin');

        done();
      }.bind(this));
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
        details: {},
        type: 'type',
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
        expect(existingPaymentMethod.details).to.deep.equal({});
        expect(existingPaymentMethod.type).to.equal('type');
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
        expect(analytics.sendEvent).to.be.calledWith(instance._client, 'appeared');
        done();
      });

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

      this.dropinOptions.merchantConfiguration.locale = 'es';
      instance = new Dropin(this.dropinOptions);

      instance._initialize(function () {
        expect(instance._mainView.strings.postalCodeLabel).to.equal('Código Postal');
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

  describe('teardown', function () {
    beforeEach(function () {
      this.instance = new Dropin(this.dropinOptions);
      this.container.appendChild(this.instance._dropinWrapper);
      this.instance._mainView = {
        teardown: this.sandbox.stub().yields()
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

    it('passes errors in mainView teardown to callback', function (done) {
      var error = new Error('Teardown Error');

      this.instance._mainView.teardown.yields(error);

      this.instance.teardown(function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });

  describe('setPayPalOption', function () {
    beforeEach(function () {
      this.dropinOptions.merchantConfiguration.paypal = {
        flow: 'checkout',
        amount: '28.00',
        currency: 'USD'
      };
    });

    it('throws an error if PayPal is not enabled', function () {
      var instance;

      delete this.dropinOptions.merchantConfiguration.paypal;
      instance = new Dropin(this.dropinOptions);

      expect(function () {
        instance.setPayPalOption('amount', '10.00');
      }).to.throw('PayPal not enabled.');
    });

    it('sets PayPal option to provided value', function () {
      var instance = new Dropin(this.dropinOptions);

      instance.setPayPalOption('amount', '10.00');

      expect(instance._merchantConfiguration.paypal.amount).to.equal('10.00');
    });

    it('removes PayPal option when value provided is null', function () {
      var instance = new Dropin(this.dropinOptions);

      instance.setPayPalOption('amount', null);

      expect(instance._merchantConfiguration.paypal.amount).to.be.undefined;
    });

    it('removes PayPal option when value provided is undefined', function () {
      var instance = new Dropin(this.dropinOptions);

      instance.setPayPalOption('amount');

      expect(instance._merchantConfiguration.paypal.amount).to.be.undefined;
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
  });
});
