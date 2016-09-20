'use strict';

var Dropin = require('../../src/dropin/');
var deferred = require('../../src/lib/deferred');
var DropinModel = require('../../src/dropin-model');
var fake = require('../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');
var PaymentMethodPickerView = require('../../src/views/payment-method-picker-view');

describe('Dropin', function () {
  beforeEach(function () {
    this.client = {
      request: this.sandbox.stub(),
      getConfiguration: fake.configuration
    };

    this.container = document.createElement('div');
    this.container.id = 'foo';
    document.body.appendChild(this.container);

    this.dropinOptions = {
      client: this.client,
      selector: '#foo',
      authorization: fake.tokenizationKey
    };

    this.sandbox.stub(hostedFields, 'create', function (options, cb) {
      deferred(cb)(null, {on: function () {}});
    });
  });

  afterEach(function () {
    if (document.body.querySelector('#foo')) {
      document.body.removeChild(this.container);
    }
  });

  describe('initialize', function () {
    it('errors out if no selector given', function (done) {
      var instance;

      delete this.dropinOptions.selector;

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector is required.');
        done();
      });
    });

    it('throws an error with a selector that points to a nonexistent DOM node', function (done) {
      var instance;

      this.dropinOptions.selector = '#garbage';

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector must reference a valid DOM node.');
        done();
      });
    });

    it('throws an error if merchant container is not empty', function (done) {
      var instance;
      var div = document.createElement('div');

      this.container.appendChild(div);

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('options.selector must reference an empty DOM node.');
        done();
      });
    });

    it('inserts dropin into container if merchant container has only white space', function (done) {
      var instance;

      this.container.innerHTML = ' ';

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
        expect(this.container.innerHTML).to.include('class="braintree-dropin');

        done();
      }.bind(this));
    });

    it('inserts dropin into container', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
        expect(this.container.innerHTML).to.include('class="braintree-dropin');

        done();
      }.bind(this));
    });

    it('inserts svgs into container', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
        expect(this.container.innerHTML).to.include('data-braintree-id="svgs"');

        done();
      }.bind(this));
    });

    it('requests payment methods if a customerId is provided', function (done) {
      var instance;
      var fakeClientToken = fake.configuration().gatewayConfiguration;
      var paymentMethodsPayload = {paymentMethods: []};

      fakeClientToken.authorizationFingerprint = 'auth_fingerprint&customer_id=abc123';
      fakeClientToken = btoa(JSON.stringify(fakeClientToken));

      this.dropinOptions.authorization = fakeClientToken;
      this.client.request.yields(null, paymentMethodsPayload);

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
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

      instance.initialize(function () {
        expect(this.client.request).to.not.have.been.called;

        done();
      }.bind(this));
    });

    it('does not fail if there is an error getting existing payment methods', function (done) {
      var instance;
      var fakeClientToken = fake.configuration().gatewayConfiguration;

      fakeClientToken.authorizationFingerprint = 'auth_fingerprint&customer_id=abc123';
      fakeClientToken = btoa(JSON.stringify(fakeClientToken));

      this.dropinOptions.authorization = fakeClientToken;
      this.client.request.yields(new Error('This failed'));

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
        expect(hostedFields.create).to.be.called;
        expect(instance._model.getPaymentMethods()).to.have.a.lengthOf(0);

        done();
      });
    });

    it('formats existing payment method payload', function (done) {
      var instance;
      var fakeClientToken = fake.configuration().gatewayConfiguration;
      var fakePaymentMethod = {
        nonce: 'nonce',
        details: {},
        type: 'type',
        garbage: 'garbage'
      };
      var paymentMethodsPayload = {paymentMethods: [fakePaymentMethod]};

      fakeClientToken.authorizationFingerprint = 'auth_fingerprint&customer_id=abc123';
      fakeClientToken = btoa(JSON.stringify(fakeClientToken));

      this.dropinOptions.authorization = fakeClientToken;
      this.client.request.yields(null, paymentMethodsPayload);

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
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
      var fakeClientToken = fake.configuration().gatewayConfiguration;
      var paymentMethodsPayload = {paymentMethods: []};

      fakeClientToken.authorizationFingerprint = 'auth_fingerprint&customer_id=abc123';
      fakeClientToken = btoa(JSON.stringify(fakeClientToken));

      this.dropinOptions.authorization = fakeClientToken;
      this.client.request.yields(null, paymentMethodsPayload);

      instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
        expect(instance.mainView).to.exist;
        done();
      });
    });

    it('creates a MainView a customerId does not exist', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.initialize(function () {
        expect(instance.mainView).to.exist;
        done();
      });
    });

    it('calls the create callback when async dependencies are ready', function (done) {
      var instance = new Dropin(this.dropinOptions);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      instance.initialize(function () {
        done();
      });

      instance._model._emit('asyncDependenciesReady');
    });
  });

  describe('requestPaymentMethod', function () {
    it('calls callback with active payment method if available', function (done) {
      var dropin;

      this.sandbox.stub(PaymentMethodPickerView.prototype, 'setActivePaymentMethod');

      dropin = new Dropin(this.dropinOptions);

      dropin.initialize(function (err, instance) {
        instance._model.changeActivePaymentMethod('active payment method');

        instance.requestPaymentMethod(function (err2, data) {
          expect(err2).to.not.exist;
          expect(data).to.equal('active payment method');

          done();
        });
      });
    });

    it('calls callback with error if no payment method is available', function (done) {
      var dropin = new Dropin(this.dropinOptions);

      dropin.initialize(function (err, instance) {
        instance.requestPaymentMethod(function (err2, data) {
          expect(err2).to.be.an.instanceOf(Error);
          expect(err2.message).to.equal('No payment method available.');
          expect(data).to.not.exist;

          done();
        });
      });
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.instance = new Dropin(this.dropinOptions);
      this.container.appendChild(this.instance._dropinWrapper);
      this.instance.mainView = {
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
        expect(this.instance.mainView.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('passes errors in mainView teardown to callback', function (done) {
      var error = new Error('Teardown Error');

      this.instance.mainView.teardown.yields(error);

      this.instance.teardown(function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
