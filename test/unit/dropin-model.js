'use strict';

var DropinModel = require('../../src/dropin-model');

describe('DropinModel', function () {
  describe('Constructor', function () {
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
});
