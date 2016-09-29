'use strict';

var DropinModel = require('../../src/dropin-model');
var EventEmitter = require('../../src/lib/event-emitter');

describe('DropinModel', function () {
  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      expect(new DropinModel({})).to.be.an.instanceOf(EventEmitter);
    });

    it('sets existing payment methods as _paymentMethods', function () {
      var model = new DropinModel({paymentMethods: ['foo']});

      expect(model._paymentMethods).to.deep.equal(['foo']);
    });

    it('_paymentMethods is null if no existing payment methods', function () {
      var model = new DropinModel();

      expect(model._paymentMethods).to.deep.equal([]);
    });

    it('sets active payment method if there are existing payment methods', function () {
      var paymentMethods = [{foo: 'bar'}, {boo: 'far'}];
      var model = new DropinModel({paymentMethods: paymentMethods});

      expect(model._activePaymentMethod).to.deep.equal(paymentMethods[0]);
    });

    it('does not set active payment method if there are no existing payment methods', function () {
      var model = new DropinModel();

      expect(model._activePaymentMethod).to.not.exist;
    });
  });

  describe('addPaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel();
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
      var model = new DropinModel();

      model._paymentMethods = 'these are my payment methods';

      expect(model.getPaymentMethods()).to.equal('these are my payment methods');
    });
  });

  describe('changeActivePaymentMethod', function () {
    beforeEach(function () {
      this.model = new DropinModel();
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
      var model = new DropinModel();

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

  describe('asyncDependencyReady', function () {
    beforeEach(function () {
      this.context = {callback: this.sandbox.stub()};
    });

    it('decrements dependenciesInitializing by one', function () {
      this.context.dependenciesInitializing = 2;

      DropinModel.prototype.asyncDependencyReady.call(this.context);

      expect(this.context.dependenciesInitializing).to.equal(1);
      expect(this.context.callback).to.not.be.called;
    });

    it('emits asyncDependenciesReady event when there are no dependencies initializing', function (done) {
      var model = new DropinModel();

      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');

      model.on('asyncDependenciesReady', function () {
        expect(DropinModel.prototype.asyncDependencyReady).to.have.been.calledOnce;
        done();
      });

      model.asyncDependencyStarting();
      model.asyncDependencyReady();
    });
  });

  describe('beginLoading', function () {
    it('emits a loadBegin event', function (done) {
      var model = new DropinModel();

      model.on('loadBegin', function () {
        done();
      });

      model.beginLoading();
    });
  });

  describe('endLoading', function () {
    it('emits a loadEnd event', function (done) {
      var model = new DropinModel();

      model.on('loadEnd', function () {
        done();
      });

      model.endLoading();
    });
  });

  describe('reportError', function () {
    it('emits an errorOccurred event with the error', function (done) {
      var dropinModel = new DropinModel();
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
      var dropinModel = new DropinModel();

      dropinModel.on('errorCleared', function () {
        done();
      });

      dropinModel.clearError();
    });
  });
});
