'use strict';

var vaultManager = require('braintree-web/vault-manager');
var analytics = require('../../src/lib/analytics');
var DropinModel = require('../../src/dropin-model');
var ApplePayView = require('../../src/views/payment-sheet-views/apple-pay-view');
var CardView = require('../../src/views/payment-sheet-views/card-view');
var GooglePayView = require('../../src/views/payment-sheet-views/google-pay-view');
var PayPalView = require('../../src/views/payment-sheet-views/paypal-view');
var PayPalCreditView = require('../../src/views/payment-sheet-views/paypal-credit-view');
var VenmoView = require('../../src/views/payment-sheet-views/venmo-view');
var EventEmitter = require('../../src/lib/event-emitter');
var isHTTPS = require('../../src/lib/is-https');
var fake = require('../helpers/fake');
var throwIfResolves = require('../helpers/throw-if-resolves');

describe('DropinModel', function () {
  beforeEach(function () {
    this.configuration = fake.configuration();

    this.vaultManager = {
      fetchPaymentMethods: this.sandbox.stub().resolves([]),
      deletePaymentMethod: this.sandbox.stub().resolves()
    };
    this.sandbox.stub(vaultManager, 'create').resolves(this.vaultManager);
    this.modelOptions = {
      client: fake.client(this.configuration),
      componentID: 'foo123',
      merchantConfiguration: {
        authorization: fake.clientToken,
        paypal: {},
        venmo: {}
      },
      paymentMethods: []
    };
    this.sandbox.stub(analytics, 'sendEvent');

    this.sandbox.stub(isHTTPS, 'isHTTPS').returns(true);
    global.ApplePaySession = this.sandbox.stub().returns({});
    global.ApplePaySession.canMakePayments = this.sandbox.stub().returns(true);
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

  describe('initialize', function () {
    beforeEach(function () {
      this.sandbox.stub(ApplePayView, 'isEnabled').resolves(true);
      this.sandbox.stub(CardView, 'isEnabled').resolves(true);
      this.sandbox.stub(GooglePayView, 'isEnabled').resolves(true);
      this.sandbox.stub(PayPalView, 'isEnabled').resolves(true);
      this.sandbox.stub(PayPalCreditView, 'isEnabled').resolves(true);
      this.sandbox.stub(VenmoView, 'isEnabled').resolves(true);
    });

    it('creates a vault manager', function () {
      var model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(vaultManager.create).to.be.calledOnce;
        expect(vaultManager.create).to.be.calledWith({
          client: this.modelOptions.client
        });
      }.bind(this));
    });

    it('sets existing payment methods as _paymentMethods', function () {
      var model = new DropinModel(this.modelOptions);

      model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.resolves([{type: 'CreditCard', details: {lastTwo: '11'}}]);

      return model.initialize().then(function () {
        expect(model._paymentMethods).to.deep.equal([{type: 'CreditCard', details: {lastTwo: '11'}, vaulted: true}]);
      });
    });

    it('_paymentMethods is empty if no existing payment methods', function () {
      var model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(model._paymentMethods).to.deep.equal([]);
      });
    });

    it('ignores valid, but disabled payment methods', function () {
      var model = new DropinModel(this.modelOptions);

      model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);
      PayPalView.isEnabled.resolves(false);
      PayPalCreditView.isEnabled.resolves(false);

      return model.initialize().then(function () {
        expect(model._paymentMethods).to.deep.equal([
          {type: 'CreditCard', details: {lastTwo: '11'}, vaulted: true}
        ]);
      });
    });

    it('ignores payment methods that have errored when calling isEnabled', function () {
      var model = new DropinModel(this.modelOptions);

      model.isGuestCheckout = false;
      this.sandbox.stub(console, 'error');
      this.vaultManager.fetchPaymentMethods.resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      PayPalView.isEnabled.rejects(new Error('fail'));
      PayPalCreditView.isEnabled.resolves(false);

      return model.initialize().then(function () {
        expect(model._paymentMethods).to.deep.equal([
          {type: 'CreditCard', details: {lastTwo: '11'}, vaulted: true}
        ]);
      });
    });

    it('calls console.error with error if isEnabled errors', function () {
      var model = new DropinModel(this.modelOptions);
      var error = new Error('fail');

      this.sandbox.stub(console, 'error');
      this.vaultManager.fetchPaymentMethods.resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}}
      ]);

      PayPalView.isEnabled.rejects(error);
      PayPalCreditView.isEnabled.resolves(false);

      return model.initialize().then(function () {
        expect(console.error).to.be.calledTwice; // eslint-disable-line no-console
        expect(console.error).to.be.calledWith('paypal view errored when checking if it was supported.'); // eslint-disable-line no-console
        expect(console.error).to.be.calledWith(error); // eslint-disable-line no-console
      });
    });

    it('rejects with an error when there are no payment options', function () {
      var model = new DropinModel(this.modelOptions);

      ApplePayView.isEnabled.resolves(false);
      CardView.isEnabled.resolves(false);
      GooglePayView.isEnabled.resolves(false);
      PayPalView.isEnabled.resolves(false);
      PayPalCreditView.isEnabled.resolves(false);
      VenmoView.isEnabled.resolves(false);

      return model.initialize().then(throwIfResolves).catch(function (err) {
        expect(err.message).to.equal('No valid payment options available.');
      });
    });

    it('throws an error when paymentOptionPriority is an empty array', function () {
      var model;

      this.configuration.gatewayConfiguration.paypalEnabled = true;
      this.modelOptions.merchantConfiguration.paypal = true;
      this.modelOptions.merchantConfiguration.paymentOptionPriority = [];

      model = new DropinModel(this.modelOptions);

      return model.initialize().then(throwIfResolves).catch(function (err) {
        expect(err.message).to.equal('No valid payment options available.');
      });
    });

    it('supports cards, PayPal, PayPal Credit, Venmo, Apple Pay and Google Pay and defaults to showing them in correct paymentOptionPriority', function () {
      var model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(model.supportedPaymentOptions).to.deep.equal(['card', 'paypal', 'paypalCredit', 'venmo', 'applePay', 'googlePay']);
      });
    });

    it('marks payment method as unsupported if isEnabled rejects', function () {
      var model = new DropinModel(this.modelOptions);

      GooglePayView.isEnabled.rejects(new Error('no google pay'));

      return model.initialize().then(function () {
        expect(model.supportedPaymentOptions).to.deep.equal(['card', 'paypal', 'paypalCredit', 'venmo', 'applePay']);
      });
    });

    it('uses custom paymentOptionPriority of payment options', function () {
      var model;

      this.configuration.gatewayConfiguration.paypalEnabled = true;
      this.modelOptions.merchantConfiguration.paypal = true;
      this.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'card'];

      model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(model.supportedPaymentOptions).to.deep.equal(['paypal', 'card']);
      });
    });

    it('ignores duplicates', function () {
      var model;

      this.configuration.gatewayConfiguration.paypalEnabled = true;
      this.modelOptions.merchantConfiguration.paypal = true;
      this.modelOptions.merchantConfiguration.paymentOptionPriority = ['paypal', 'paypal', 'card'];

      model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(model.supportedPaymentOptions).to.deep.equal(['paypal', 'card']);
      });
    });

    it('calls isEnabled on payment method view to determine if payment method is available', function () {
      var model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(ApplePayView.isEnabled).to.be.calledOnce;
        expect(ApplePayView.isEnabled).to.be.calledWith({
          client: this.modelOptions.client,
          merchantConfiguration: this.modelOptions.merchantConfiguration
        });
        expect(CardView.isEnabled).to.be.calledOnce;
        expect(CardView.isEnabled).to.be.calledWith({
          client: this.modelOptions.client,
          merchantConfiguration: this.modelOptions.merchantConfiguration
        });
        expect(GooglePayView.isEnabled).to.be.calledOnce;
        expect(GooglePayView.isEnabled).to.be.calledWith({
          client: this.modelOptions.client,
          merchantConfiguration: this.modelOptions.merchantConfiguration
        });
        expect(PayPalView.isEnabled).to.be.calledOnce;
        expect(PayPalView.isEnabled).to.be.calledWith({
          client: this.modelOptions.client,
          merchantConfiguration: this.modelOptions.merchantConfiguration
        });
        expect(PayPalCreditView.isEnabled).to.be.calledOnce;
        expect(PayPalCreditView.isEnabled).to.be.calledWith({
          client: this.modelOptions.client,
          merchantConfiguration: this.modelOptions.merchantConfiguration
        });
        expect(VenmoView.isEnabled).to.be.calledOnce;
        expect(VenmoView.isEnabled).to.be.calledWith({
          client: this.modelOptions.client,
          merchantConfiguration: this.modelOptions.merchantConfiguration
        });
      }.bind(this));
    });

    it('rejects with an error when an unrecognized payment option is specified', function () {
      var model;

      this.configuration.gatewayConfiguration.paypalEnabled = true;
      this.modelOptions.merchantConfiguration.paypal = true;
      this.modelOptions.merchantConfiguration.paymentOptionPriority = ['foo', 'paypal', 'card'];

      model = new DropinModel(this.modelOptions);

      return model.initialize().then(throwIfResolves).catch(function (err) {
        expect(err.message).to.equal('paymentOptionPriority: Invalid payment option specified.');
      });
    });
  });

  describe('addPaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      return this.model.initialize();
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

  describe('removePaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      return this.model.initialize();
    });

    it('removes a payment method from _paymentMethods', function () {
      var paymentMethod = {foo: 'bar'};

      this.model.addPaymentMethod(paymentMethod);

      this.model.removePaymentMethod(paymentMethod);

      expect(this.model._paymentMethods).to.deep.equal([]);
    });

    it('does not remove a payment method from _paymentMethods if it only deep equals the existing payment method', function () {
      var paymentMethod = {foo: 'bar'};

      this.model.addPaymentMethod(paymentMethod);

      this.model.removePaymentMethod({foo: 'bar'});

      expect(this.model._paymentMethods[0]).to.equal(paymentMethod);
    });

    it('emits onRemovePaymentMethod event with new payment method', function (done) {
      var paymentMethod = {foo: 'bar'};

      this.model.addPaymentMethod(paymentMethod);
      this.model.on('removePaymentMethod', function (emittedPaymentMethod) {
        expect(emittedPaymentMethod).to.equal(paymentMethod);
        done();
      });

      this.model.removePaymentMethod(paymentMethod);
    });

    it('does not emit onRemovePaymentMethod event when payment method does not exist', function () {
      var paymentMethod = {foo: 'bar'};

      this.sandbox.spy(this.model, '_emit');
      this.model.addPaymentMethod(paymentMethod);

      this.model.removePaymentMethod({someother: 'paymentMethod'});

      expect(this.model._emit).to.not.be.calledWith('removePaymentMethod');
    });
  });

  describe('getPaymentMethods', function () {
    it('returns a copy of the _paymentMethods array', function () {
      var model = new DropinModel(this.modelOptions);

      model._paymentMethods = ['these are my payment methods'];

      expect(model.getPaymentMethods()).to.not.equal(model._paymentMethods);
      expect(model.getPaymentMethods()).to.deep.equal(model._paymentMethods);
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

  describe('removeActivePaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);
      this.sandbox.stub(this.model, '_emit');
      this.sandbox.stub(this.model, 'setPaymentMethodRequestable');
    });

    it('sets active payment method to null', function () {
      this.model._activePaymentMethod = {foo: 'bar'};

      this.model.removeActivePaymentMethod();

      expect(this.model._activePaymentMethod).to.not.exist;
    });

    it('emits removeActivePaymentMethod event', function () {
      this.model.removeActivePaymentMethod();

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('removeActivePaymentMethod');
    });

    it('sets payment method to not be requestable', function () {
      this.model.removeActivePaymentMethod();

      expect(this.model.setPaymentMethodRequestable).to.be.calledOnce;
      expect(this.model.setPaymentMethodRequestable).to.be.calledWith({
        isRequestable: false
      });
    });
  });

  describe('getActivePaymentMethod', function () {
    it('returns _activePaymentMethod', function () {
      var model = new DropinModel(this.modelOptions);

      model._activePaymentMethod = 'this is my active payment method';

      expect(model.getActivePaymentMethod()).to.equal('this is my active payment method');
    });
  });

  describe('reportAppSwitchPayload', function () {
    it('saves app switch payload to instance', function () {
      var model = new DropinModel(this.modelOptions);
      var payload = {nonce: 'fake-nonce'};

      model.reportAppSwitchPayload(payload);

      expect(model.appSwitchPayload).to.equal(payload);
    });
  });

  describe('reportAppSwitchError', function () {
    it('saves app switch error and view id', function () {
      var model = new DropinModel(this.modelOptions);
      var error = new Error('Error');

      model.reportAppSwitchError('view-id', error);

      expect(model.appSwitchError.id).to.equal('view-id');
      expect(model.appSwitchError.error).to.equal(error);
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

    it('ignores error if failure was already reported', function () {
      var err = new Error('a bad error');
      var ignoredError = new Error('a different error');

      this.model.asyncDependencyFailed({
        view: 'id',
        error: err
      });
      this.model.asyncDependencyFailed({
        view: 'id',
        error: ignoredError
      });

      expect(this.model.failedDependencies.id).to.not.equal(ignoredError);
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

  describe('cancelInitialization', function () {
    it('emits cancelInitialization event wth the error', function (done) {
      var dropinModel = new DropinModel(this.modelOptions);
      var fakeError = {foo: 'boo'};

      dropinModel.on('cancelInitialization', function (error) {
        expect(error).to.deep.equal(fakeError);
        done();
      });

      dropinModel.cancelInitialization(fakeError);
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

  describe('isPaymentMethodRequestable', function () {
    it('returns false initially if no payment methods are passed in', function () {
      var model = new DropinModel(this.modelOptions);

      return model.initialize().then(function () {
        expect(model.isPaymentMethodRequestable()).to.equal(false);
      });
    });

    it('returns true initially if customer has saved payment methods', function () {
      var model = new DropinModel(this.modelOptions);

      model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.resolves([{type: 'CreditCard', details: {lastTwo: '11'}}]);

      return model.initialize().then(function () {
        expect(model.isPaymentMethodRequestable()).to.equal(true);
      });
    });
  });

  describe('setPaymentMethodRequestable', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.sandbox.stub(this.model, '_emit');
    });

    it('sets isPaymentMethodRequestable to true when isRequestable is true', function () {
      expect(this.model.isPaymentMethodRequestable()).to.equal(false);

      this.model.setPaymentMethodRequestable({
        isRequestable: true
      });

      expect(this.model.isPaymentMethodRequestable()).to.equal(true);
    });

    it('emits paymentMethodRequestable with type when isRequestable is true', function () {
      this.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'card'
      });

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('paymentMethodRequestable', {
        type: 'card',
        paymentMethodIsSelected: false
      });
    });

    it('sets isPaymentMethodRequestable to false when isRequestable is false', function () {
      this.model._paymentMethodIsRequestable = true;

      expect(this.model.isPaymentMethodRequestable()).to.equal(true);

      this.model.setPaymentMethodRequestable({
        isRequestable: false
      });

      expect(this.model.isPaymentMethodRequestable()).to.equal(false);
    });

    it('emits noPaymentMethodRequestable with type when isRequestable is false', function () {
      this.model._paymentMethodIsRequestable = true;
      this.model.setPaymentMethodRequestable({
        isRequestable: false
      });

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('noPaymentMethodRequestable');
    });

    it('does not emit when isRequestable state and type state does not change', function () {
      this.model._paymentMethodIsRequestable = false;
      this.model.setPaymentMethodRequestable({
        isRequestable: false
      });

      expect(this.model._emit).to.not.be.called;

      this.model._paymentMethodIsRequestable = true;
      this.model._paymentMethodRequestableType = 'TYPE';
      this.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'TYPE'
      });

      expect(this.model._emit).to.not.be.called;
    });

    it('does not emit when isRequestable state is false and type has changed', function () {
      this.model._paymentMethodIsRequestable = false;
      this.model.setPaymentMethodRequestable({
        isRequestable: false
      });

      expect(this.model._emit).to.not.be.called;

      this.model._paymentMethodRequestableType = 'TYPE';
      this.model.setPaymentMethodRequestable({
        isRequestable: false,
        type: 'ANOTHER_TYPE'
      });

      expect(this.model._emit).to.not.be.called;
    });

    it('does emit when isRequestable state has not changed, but type state does', function () {
      this.model._paymentMethodIsRequestable = true;
      this.model._paymentMethodRequestableType = 'TYPE';
      this.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'ANOTHER_TYPE'
      });

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('paymentMethodRequestable', {
        type: 'ANOTHER_TYPE',
        paymentMethodIsSelected: false
      });
    });

    it('ignores type if isRequestable is false', function () {
      this.model._paymentMethodRequestableType = 'SOMETHING';
      this.model.setPaymentMethodRequestable({
        isRequestable: false,
        type: 'SOME_TYPE'
      });

      expect(this.model._paymentMethodRequestableType).to.not.exist;
    });

    it('includes the paymentMethodIsSelected as true if Drop-in displays a selected payment method', function () {
      var selectedPaymentMethod = {foo: 'bar'};

      this.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'TYPE',
        selectedPaymentMethod: selectedPaymentMethod
      });

      expect(this.model._emit).to.be.calledWith('paymentMethodRequestable', {
        type: 'TYPE',
        paymentMethodIsSelected: true
      });
    });

    it('includes the paymentMethodIsSelected as false if no payment method is actively selected', function () {
      this.model.setPaymentMethodRequestable({
        isRequestable: true,
        type: 'TYPE'
      });

      expect(this.model._emit).to.be.calledWith('paymentMethodRequestable', {
        type: 'TYPE',
        paymentMethodIsSelected: false
      });
    });
  });

  describe('selectPaymentOption', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.sandbox.stub(this.model, '_emit');
    });

    it('emits a paymentOptionSelected event with the id of the payment option that was selected', function () {
      this.model.selectPaymentOption('card');

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('paymentOptionSelected', {
        paymentOption: 'card'
      });
    });
  });

  describe('preventUserAction', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.sandbox.stub(this.model, '_emit');
    });

    it('emits a preventUserAction event', function () {
      this.model.preventUserAction('card');

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('preventUserAction');
    });
  });

  describe('allowUserAction', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.sandbox.stub(this.model, '_emit');
    });

    it('emits a allowUserAction event', function () {
      this.model.allowUserAction('card');

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('allowUserAction');
    });
  });

  describe('Edit mode', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.sandbox.stub(this.model, '_emit');
    });

    it('model.enableEditMode emits an enableEditMode event', function () {
      this.model.enableEditMode();

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('enableEditMode');
    });

    it('model.enableEditMode sets isInEditMode to true', function () {
      expect(this.model.isInEditMode()).to.equal(false);

      this.model.enableEditMode();

      expect(this.model.isInEditMode()).to.equal(true);
    });

    it('model.disableEditMode emits a disableEditMode event', function () {
      this.model.disableEditMode();

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('disableEditMode');
    });

    it('model.disableEditMode sets isInEditMode to false', function () {
      this.model.enableEditMode();

      expect(this.model.isInEditMode()).to.equal(true);

      this.model.disableEditMode();

      expect(this.model.isInEditMode()).to.equal(false);
    });

    it('model.confirmPaymentMethodDeletion emits a confirmPaymentMethodDeletion event', function () {
      var paymentMethod = {
        nonce: '123-fake-nonce'
      };

      this.model.confirmPaymentMethodDeletion(paymentMethod);

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('confirmPaymentMethodDeletion', paymentMethod);
    });
  });

  describe('deleteVaultedPaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.model._paymentMethodWaitingToBeDeleted = {
        nonce: 'a-nonce'
      };
      this.sandbox.stub(this.model, '_emit');

      return this.model.initialize();
    });

    it('emits a startVaultedPaymentMethodDeletion event', function () {
      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.model._emit).to.be.calledWith('startVaultedPaymentMethodDeletion');
      }.bind(this));
    });

    it('removes stored payment method variable', function () {
      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.model._paymentMethodWaitingToBeDeleted).to.not.exist;
      }.bind(this));
    });

    it('uses vault manager to delete payment method', function () {
      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.vaultManager.deletePaymentMethod).to.be.calledOnce;
        expect(this.vaultManager.deletePaymentMethod).to.be.calledWith('a-nonce');
      }.bind(this));
    });

    it('emits finishVaultedPaymentMethodDeletion event when deletion is succesful', function () {
      this.vaultManager.deletePaymentMethod.resolves();

      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.model._emit).to.be.calledWith('finishVaultedPaymentMethodDeletion');
      }.bind(this));
    });

    it('emits finishVaultedPaymentMethodDeletion event when deletion is unsuccesful', function () {
      var error = new Error('aaaaaaah!');

      this.vaultManager.deletePaymentMethod.rejects(error);

      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.model._emit).to.be.calledWith('finishVaultedPaymentMethodDeletion');
      }.bind(this));
    });

    it('calls reportError when deletion is unsuccesful', function () {
      var error = new Error('aaaaaaah!');

      this.vaultManager.deletePaymentMethod.rejects(error);

      this.sandbox.stub(this.model, 'reportError');

      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.model.reportError).to.be.calledOnce;
        expect(this.model.reportError).to.be.calledWith(error);
      }.bind(this));
    });

    it('refetches payment methods', function () {
      var paymentMethods = [{type: 'CreditCard', nonce: 'a-nonce'}];

      this.sandbox.stub(this.model, 'getVaultedPaymentMethods').resolves(paymentMethods);

      return this.model.deleteVaultedPaymentMethod().then(function () {
        expect(this.model.getVaultedPaymentMethods).to.be.calledOnce;
        expect(this.model.getPaymentMethods()).to.deep.equal(paymentMethods);
      }.bind(this));
    });
  });

  describe('cancelDeleteVaultedPaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.model._paymentMethodWaitingToBeDeleted = {
        nonce: 'a-nonce'
      };
      this.sandbox.stub(this.model, '_emit');
    });

    it('emits a cancelVaultedPaymentMethodDeletion event', function () {
      this.model.cancelDeleteVaultedPaymentMethod();

      expect(this.model._emit).to.be.calledOnce;
      expect(this.model._emit).to.be.calledWith('cancelVaultedPaymentMethodDeletion');
    });

    it('removes stored payment method variable', function () {
      this.model.cancelDeleteVaultedPaymentMethod();

      expect(this.model._paymentMethodWaitingToBeDeleted).to.not.exist;
    });
  });

  describe('getVaultedPaymentMethods', function () {
    beforeEach(function () {
      this.model = new DropinModel(this.modelOptions);

      this.sandbox.stub(ApplePayView, 'isEnabled').resolves(true);
      this.sandbox.stub(CardView, 'isEnabled').resolves(true);
      this.sandbox.stub(GooglePayView, 'isEnabled').resolves(true);
      this.sandbox.stub(PayPalView, 'isEnabled').resolves(true);
      this.sandbox.stub(PayPalCreditView, 'isEnabled').resolves(true);
      this.sandbox.stub(VenmoView, 'isEnabled').resolves(true);

      return this.model.initialize().then(function () {
        this.model.isGuestCheckout = false;
      }.bind(this));
    });

    it('resolves with payment methods as empty array when vault manager errors', function () {
      this.model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.rejects(new Error('error'));

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(this.vaultManager.fetchPaymentMethods).to.be.calledWith({
          defaultFirst: true
        });
        expect(paymentMethods).to.deep.equal([]);
      }.bind(this));
    });

    it('resolves with payment methods as empty array when in guest checkout', function () {
      this.model.isGuestCheckout = true;

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(paymentMethods).to.deep.equal([]);
      });
    });

    it('resolves with payment methods from vault manager when not in guest checkout', function () {
      this.model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.resolves([{
        nonce: '1-nonce',
        type: 'CreditCard'
      }, {
        nonce: '2-nonce',
        type: 'PayPalAccount'
      }]);

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(this.vaultManager.fetchPaymentMethods).to.be.calledWith({
          defaultFirst: true
        });
        expect(paymentMethods).to.deep.equal([{
          nonce: '1-nonce',
          type: 'CreditCard',
          vaulted: true
        }, {
          nonce: '2-nonce',
          type: 'PayPalAccount',
          vaulted: true
        }]);
      }.bind(this));
    });

    it('only resolves supported payment method types', function () {
      this.model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.resolves([{
        nonce: '1-nonce',
        type: 'CreditCard'
      }, {
        nonce: '2-nonce',
        type: 'FooPay'
      }]);

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(paymentMethods).to.deep.equal([{
          nonce: '1-nonce',
          type: 'CreditCard',
          vaulted: true
        }]);
      });
    });

    it('includes vaulted property on payment method objects', function () {
      this.model.isGuestCheckout = false;
      this.vaultManager.fetchPaymentMethods.resolves([{
        nonce: '1-nonce',
        type: 'CreditCard'
      }, {
        nonce: '2-nonce',
        type: 'PayPalAccount'
      }, {
        nonce: '3-nonce',
        type: 'CreditCard'
      }]);

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(this.vaultManager.fetchPaymentMethods).to.be.calledWith({
          defaultFirst: true
        });
        expect(paymentMethods[0].vaulted).to.equal(true);
        expect(paymentMethods[1].vaulted).to.equal(true);
        expect(paymentMethods[2].vaulted).to.equal(true);
      }.bind(this));
    });

    it('ignores invalid payment methods', function () {
      this.vaultManager.fetchPaymentMethods.resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}},
        {type: 'InvalidMethod', details: {}},
        {type: 'AlsoInvalidMethod', details: {}}
      ]);
      this.model.merchantConfiguration.paypal = {flow: 'vault'};

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(paymentMethods).to.deep.equal([
          {type: 'CreditCard', details: {lastTwo: '11'}, vaulted: true},
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}, vaulted: true}
        ]);
      });
    });

    it('ignores vaulted payment methods that cannot be used client side', function () {
      this.vaultManager.fetchPaymentMethods.resolves([
        {type: 'CreditCard', details: {lastTwo: '11'}},
        {type: 'PayPalAccount', details: {email: 'wow@example.com'}},
        {type: 'ApplePayCard', details: {}},
        {type: 'AndroidPayCard', details: {}},
        {type: 'VenmoAccount', details: {}}
      ]);

      return this.model.getVaultedPaymentMethods().then(function (paymentMethods) {
        expect(paymentMethods).to.deep.equal([
          {type: 'CreditCard', details: {lastTwo: '11'}, vaulted: true},
          {type: 'PayPalAccount', details: {email: 'wow@example.com'}, vaulted: true}
        ]);
      });
    });
  });
});
