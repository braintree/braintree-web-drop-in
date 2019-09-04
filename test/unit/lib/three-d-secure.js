'use strict';

var fake = require('../../helpers/fake');
var threeDSecure = require('braintree-web/three-d-secure');
var classList = require('@braintree/class-list');
var ThreeDSecure = require('../../../src/lib/three-d-secure');
var throwIfResolves = require('../../helpers/throw-if-resolves');

describe('ThreeDSecure', function () {
  beforeEach(function () {
    this.threeDSecureInstance = fake.threeDSecureInstance;
    this.sandbox.stub(this.threeDSecureInstance, 'verifyCard');
    this.sandbox.stub(this.threeDSecureInstance, 'cancelVerifyCard');

    this.sandbox.stub(classList, 'add');
    this.sandbox.stub(classList, 'remove');
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.sandbox.stub(threeDSecure, 'create').resolves(this.threeDSecureInstance);
    });

    it('sets up three d secure', function () {
      var config = {};
      var client = {};
      var tds = new ThreeDSecure(client, config, 'Card Verification');

      return tds.initialize().then(function () {
        expect(threeDSecure.create).to.be.calledOnce;
        expect(threeDSecure.create).to.be.calledWith({
          client: client,
          version: 2
        });
        expect(tds._instance).to.equal(this.threeDSecureInstance);
      }.bind(this));
    });
  });

  describe('verify', function () {
    beforeEach(function () {
      this.config = {
        client: {},
        amount: '10.00'
      };

      this.tds = new ThreeDSecure({}, this.config, 'Card Verification');
      this.tds._instance = this.threeDSecureInstance;

      this.sandbox.stub(document.body, 'appendChild');
      this.threeDSecureInstance.verifyCard.resolves({
        nonce: 'a-nonce',
        liabilityShifted: true,
        liablityShiftPossible: true
      });
    });

    it('calls verifyCard', function () {
      return this.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }).then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            acsWindowSize: '03'
          },
          onLookupComplete: this.sandbox.match.func
        });

        expect(payload.nonce).to.equal('a-nonce');
        expect(payload.liabilityShifted).to.equal(true);
        expect(payload.liablityShiftPossible).to.equal(true);
      }.bind(this));
    });

    it('rejects if verifyCard rejects', function () {
      this.threeDSecureInstance.verifyCard.rejects({
        message: 'A message'
      });

      return this.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }).then(throwIfResolves).catch(function (err) {
        expect(err.message).to.equal('A message');
      });
    });

    it('can pass additional data along', function () {
      var billingAddress = {
        foo: 'bar'
      };

      return this.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        email: 'foo@example.com',
        billingAddress: billingAddress,
        additionalInformation: {
          shippingMethod: '01'
        }
      }).then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            shippingMethod: '01',
            acsWindowSize: '03'
          },
          onLookupComplete: this.sandbox.match.func,
          billingAddress: billingAddress,
          email: 'foo@example.com'
        });

        expect(payload.nonce).to.equal('a-nonce');
        expect(payload.liabilityShifted).to.equal(true);
        expect(payload.liablityShiftPossible).to.equal(true);
      }.bind(this));
    });

    it('additional config cannot override nonce or bin', function () {
      return this.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        nonce: 'bad-nonce',
        bin: 'bad-bin'
      }).then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            acsWindowSize: '03'
          },
          onLookupComplete: this.sandbox.match.func
        });

        expect(payload.nonce).to.equal('a-nonce');
        expect(payload.liabilityShifted).to.equal(true);
        expect(payload.liablityShiftPossible).to.equal(true);
      }.bind(this));
    });

    it('additional config can override amount', function () {
      return this.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        amount: '3.00'
      }).then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '3.00',
          additionalInformation: {
            acsWindowSize: '03'
          },
          onLookupComplete: this.sandbox.match.func
        });

        expect(payload.nonce).to.equal('a-nonce');
        expect(payload.liabilityShifted).to.equal(true);
        expect(payload.liablityShiftPossible).to.equal(true);
      }.bind(this));
    });

    it('additional config can override acsWindowSize', function () {
      return this.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        additionalInformation: {
          acsWindowSize: '01'
        }
      }).then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            acsWindowSize: '01'
          },
          onLookupComplete: this.sandbox.match.func
        });

        expect(payload.nonce).to.equal('a-nonce');
        expect(payload.liabilityShifted).to.equal(true);
        expect(payload.liablityShiftPossible).to.equal(true);
      }.bind(this));
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.tds = new ThreeDSecure({}, {}, 'Card Verification');

      this.tds._instance = this.threeDSecureInstance;
      this.sandbox.stub(this.threeDSecureInstance, 'teardown').resolves();
    });

    it('calls teardown on 3ds instance', function () {
      return this.tds.teardown().then(function () {
        expect(this.threeDSecureInstance.teardown).to.be.calledOnce;
      }.bind(this));
    });
  });

  describe('udpateConfiguration', function () {
    it('updates configuration', function () {
      var tds = new ThreeDSecure({}, {amount: '10.00', foo: 'bar'}, 'Card Verification');

      tds.updateConfiguration('amount', '23.45');

      expect(tds._config).to.deep.equal({amount: '23.45', foo: 'bar'});
    });
  });
});
