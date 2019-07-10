'use strict';

var fake = require('../../helpers/fake');
var threeDSecure = require('braintree-web/three-d-secure');
var classList = require('@braintree/class-list');
var ThreeDSecure = require('../../../src/lib/three-d-secure');

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
      return this.tds.verify('old-nonce').then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          amount: '10.00',
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

      return this.tds.verify('old-nonce').then(function () {
        throw new Error('should not get here');
      }).catch(function (err) {
        expect(err.message).to.equal('A message');
      });
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
