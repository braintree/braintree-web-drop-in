'use strict';

var Dropin = require('../../src/dropin/');
var EventEmitter = require('../../src/lib/event-emitter');
var fake = require('../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');

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
      setTimeout(function () {
        cb(null, {on: function () {}});
      }, 100);
    });
  });

  afterEach(function () {
    if (document.body.querySelector('#foo')) {
      document.body.removeChild(this.container);
    }
  });

  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      var instance = new Dropin(this.dropinOptions);

      expect(instance).to.be.an.instanceof(EventEmitter);
    });
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
        expect(instance.mainView.existingPaymentMethods).to.have.a.lengthOf(0);

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
        var existingPaymentMethod = instance.mainView.existingPaymentMethods[0];

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
  });

  describe('requestPaymentMethod', function () {
    it('calls callback with paymentMethod returned from mainView.requestPaymentMethod', function (done) {
      var instance = new Dropin(this.dropinOptions);

      instance.mainView = {
        requestPaymentMethod: this.sandbox.stub().yields(null, {paymentMethod: 'foo'})
      };

      instance.requestPaymentMethod(function (err, data) {
        expect(err).to.not.exist;
        expect(data.paymentMethod).to.equal('foo');
        expect(instance.mainView.requestPaymentMethod).to.be.calledOnce;

        done();
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
