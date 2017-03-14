'use strict';

var DropinModel = require('../../src/dropin-model');
var EventEmitter = require('../../src/lib/event-emitter');
var fake = require('../helpers/fake');

describe('DropinModel', function () {
  beforeEach(function () {
    this.configuration = fake.configuration();

    this.modelOptions = {
      client: {
        getConfiguration: function () {
          return this.configuration;
        }.bind(this)
      },
      componentID: 'foo123',
      merchantConfiguration: {
        authorization: fake.clientToken
      },
      paymentMethods: []
    };
  });

  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      expect(new DropinModel(this.modelOptions)).to.be.an.instanceOf(EventEmitter);
    });

    it('sets componentID', function () {
      var model = new DropinModel(this.modelOptions);

      expect(model.componentID).to.equal(this.modelOptions.componentID);
    });

    it('sets merchantConfiguration', function () {
      var model = new DropinModel(this.modelOptions);

      expect(model.merchantConfiguration).to.equal(this.modelOptions.merchantConfiguration);
    });

    describe('payment methods', function () {
      it('sets existing payment methods as _paymentMethods', function () {
        var model;

        this.modelOptions.paymentMethods = ['foo'];

        model = new DropinModel(this.modelOptions);

        expect(model._paymentMethods).to.deep.equal(['foo']);
      });

      it('_paymentMethods is empty if no existing payment methods', function () {
        var model = new DropinModel(this.modelOptions);

        expect(model._paymentMethods).to.deep.equal([]);
      });
    });

    describe('supported payment options', function () {
      it('throws an error when there are no payment options', function () {
        this.configuration.gatewayConfiguration.creditCards.supportedCardTypes = [];

        expect(function () {
          new DropinModel(this.modelOptions); // eslint-disable-line no-new
        }.bind(this)).to.throw('No valid payment options available.');
      });

      it('throws an error when paymentOptionPriority is an empty array', function () {
        this.configuration.gatewayConfiguration.paypalEnabled = true;
        this.modelOptions.merchantConfiguration.paypal = true;
        this.modelOptions.merchantConfiguration.paymentOptionPriority = [];

        expect(function () {
          new DropinModel(this.modelOptions); // eslint-disable-line no-new
        }.bind(this)).to.throw('No valid payment options available.');
      });

      it('supports cards', function () {
        expect(new DropinModel(this.modelOptions).supportedPaymentOptions).to.deep.equal([
          'card'
        ]);
      });

      it('supports cards and paypal and defaults to showing them in correct paymentOptionPriority', function () {
        var model;

        this.configuration.gatewayConfiguration.paypalEnabled = true;
        this.modelOptions.merchantConfiguration.paypal = true;

        model = new DropinModel(this.modelOptions);

        expect(model.supportedPaymentOptions).to.deep.equal(['card', 'paypal']);
      });

      it('uses custom paymentOptionPriority of payment options', function () {
        var model;

        this.configuration.gatewayConfiguration.paypalEnabled = true;
        this.modelOptions.merchantConfiguration.paypal = true;
        this.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'card'];

        model = new DropinModel(this.modelOptions);

        expect(model.supportedPaymentOptions).to.deep.equal(['paypal', 'card']);
      });

      it('ignores duplicates', function () {
        var model;

        this.configuration.gatewayConfiguration.paypalEnabled = true;
        this.modelOptions.merchantConfiguration.paypal = true;
        this.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'paypal', 'card'];

        model = new DropinModel(this.modelOptions);

        expect(model.supportedPaymentOptions).to.deep.equal(['paypal', 'card']);
      });

      it('throws an error when an unrecognized payment option is specified', function () {
        this.configuration.gatewayConfiguration.paypalEnabled = true;
        this.modelOptions.merchantConfiguration.paypal = true;
        this.modelOptions.merchantConfiguration.paymentOptionPriority = ['foo', 'paypal', 'card'];

        expect(function () {
          new DropinModel(this.modelOptions); // eslint-disable-line no-new
        }.bind(this)).to.throw('paymentOptionPriority: Invalid payment option specified.');
      });
    });

    describe('isGuestCheckout', function () {
      it('is true when given a tokenization key', function () {
        var model;

        this.configuration.authorization = fake.tokenizationKey;
        this.configuration.authorizationType = 'TOKENIZATION_KEY';

        model = new DropinModel(this.modelOptions);

        expect(model.isGuestCheckout).to.equal(true);
      });

      it('is true when given a client token without a customer ID', function () {
        var model;

        this.configuration.authorization = fake.clientToken;
        this.configuration.authorizationType = 'CLIENT_TOKEN';

        model = new DropinModel(this.modelOptions);

        expect(model.isGuestCheckout).to.equal(true);
      });

      it('is false when given a client token with a customer ID', function () {
        var model;

        this.configuration.authorization = fake.clientTokenWithCustomerID;
        this.configuration.authorizationType = 'CLIENT_TOKEN';

        model = new DropinModel(this.modelOptions);

        expect(model.isGuestCheckout).to.equal(false);
      });
    });
  });

  describe('addPaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);
    });

    it('adds a new payment method to _paymentMethods', function () {
      var paymentMethod = {foo: 'bar'};

      this.model.addPaymentMethod(paymentMethod);

      expect(this.model._paymentMethods[0]).to.equal(paymentMethod);
    });

    it('emits onAddPaymentMethod event with new payment method', function (done) {
      var paymentMethod = {foo: 'bar'};

      this.model.on('addPaymentMethod', function (emittedPaymentMethod) {
        expect(emittedPaymentMethod).to.equal(paymentMethod);
        done();
      });

      this.model.addPaymentMethod(paymentMethod);
    });

    it('changes active payment method to active payment method', function () {
      var paymentMethod = {foo: 'bar'};

      this.model.addPaymentMethod(paymentMethod);

      expect(this.model._activePaymentMethod).to.equal(paymentMethod);
    });
  });

  describe('getPaymentMethods', function () {
    it('returns _paymentMethods', function () {
      var model = new DropinModel(this.modelOptions);

      model._paymentMethods = 'these are my payment methods';

      expect(model.getPaymentMethods()).to.equal('these are my payment methods');
    });
  });

  describe('changeActivePaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);
    });

    it('sets new payment method to _activePaymentMethod', function () {
      var paymentMethod = {foo: 'bar'};

      this.model.changeActivePaymentMethod(paymentMethod);

      expect(this.model._activePaymentMethod).to.equal(paymentMethod);
    });

    it('emits changeActivePaymentMethod event with active payment method', function (done) {
      var paymentMethod = {foo: 'bar'};

      this.model.on('changeActivePaymentMethod', function (emittedPaymentMethod) {
        expect(emittedPaymentMethod).to.equal(paymentMethod);
        done();
      });

      this.model.changeActivePaymentMethod(paymentMethod);
    });
  });

  describe('getActivePaymentMethod', function () {
    it('returns _activePaymentMethod', function () {
      var model = new DropinModel(this.modelOptions);

      model._activePaymentMethod = 'this is my active payment method';

      expect(model.getActivePaymentMethod()).to.equal('this is my active payment method');
    });
  });

  describe('asyncDependencyStarting', function () {
    beforeEach(function () {
      this.context = {
        dependenciesInitializing: 0
      };
    });

    it('increments dependenciesInitializing by one', function () {
      DropinModel.prototype.asyncDependencyStarting.call(this.context);
      expect(this.context.dependenciesInitializing).to.equal(1);
    });
  });

  describe('asyncDependencyFailed', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);
    });

    it('adds an error to the failedDependencies object', function () {
      var err = new Error('a bad error');

      this.model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      expect(this.model.failedDependencies.id).to.equal(err);
    });

    it('emits asyncDependenciesReady event when there are no dependencies initializing', function (done) {
      var model = new DropinModel(this.modelOptions);

      model.on('asyncDependenciesReady', function () {
        done();
      });

      model.asyncDependencyStarting();
      model.asyncDependencyFailed({
        view: 'id',
        error: new Error('fake error')
      });
    });
  });

  describe('asyncDependencyReady', function () {
    beforeEach(function () {
      this.context = {callback: this.sandbox.stub()};
    });

    it('decrements dependenciesInitializing by one', function () {
      var model = new DropinModel(this.modelOptions);

      model.dependenciesInitializing = 2;

      model.asyncDependencyReady();

      expect(model.dependenciesInitializing).to.equal(1);
    });

    it('emits asyncDependenciesReady event when there are no dependencies initializing', function (done) {
      var model = new DropinModel(this.modelOptions);

      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');

      model.on('asyncDependenciesReady', function () {
        expect(DropinModel.prototype.asyncDependencyReady).to.have.been.calledOnce;
        done();
      });

      model.asyncDependencyStarting();
      model.asyncDependencyReady();
    });

    it('emits asyncDependenciesReady event with prior errors', function () {
      var model = new DropinModel(this.modelOptions);
      var err = new Error('an earlier dependency failed');

      this.sandbox.spy(model, '_emit');

      model.asyncDependencyStarting();
      model.asyncDependencyStarting();
      model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      model.asyncDependencyReady();

      expect(model._emit).to.have.been.calledWith('asyncDependenciesReady');
    });
  });

  describe('reportError', function () {
    it('emits an errorOccurred event with the error', function (done) {
      var dropinModel = new DropinModel(this.modelOptions);
      var fakeError = {foo: 'boo'};

      dropinModel.on('errorOccurred', function (error) {
        expect(error).to.deep.equal(fakeError);
        done();
      });

      dropinModel.reportError(fakeError);
    });
  });

  describe('clearError', function () {
    it('emits an errorCleared event', function (done) {
      var dropinModel = new DropinModel(this.modelOptions);

      dropinModel.on('errorCleared', function () {
        done();
      });

      dropinModel.clearError();
    });
  });
});
