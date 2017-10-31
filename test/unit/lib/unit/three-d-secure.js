'use strict';

var fake = require('../../../helpers/fake');
var threeDSecure = require('braintree-web/three-d-secure');
var classlist = require('../../../../src/lib/classlist');
var Promise = require('../../../../src/lib/promise');
var ThreeDSecure = require('../../../../src/lib/three-d-secure');

describe('ThreeDSecure', function () {
  beforeEach(function () {
    this.threeDSecureInstance = fake.threeDSecureInstance;
    this.sandbox.stub(this.threeDSecureInstance, 'verifyCard');
    this.sandbox.stub(this.threeDSecureInstance, 'cancelVerifyCard');

    this.sandbox.stub(classlist, 'add');
    this.sandbox.stub(classlist, 'remove');
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.sandbox.stub(threeDSecure, 'create').resolves(this.threeDSecureInstance);
    });

    it('sets up three d secure', function () {
      var config = {};
      var tds = new ThreeDSecure(config, 'Card Verification');

      return tds.initialize().then(function () {
        expect(threeDSecure.create).to.be.calledOnce;
        expect(threeDSecure.create).to.be.calledWith(config);
        expect(tds._instance).to.equal(this.threeDSecureInstance);
      }.bind(this));
    });
  });

  describe('verify', function () {
    beforeEach(function () {
      this.config = {
        client: {},
        showLoader: false,
        amount: '10.00'
      };

      this.tds = new ThreeDSecure(this.config, 'Card Verification');
      this.tds._instance = this.threeDSecureInstance;

      this.sandbox.stub(document.body, 'appendChild');
      this.threeDSecureInstance.verifyCard.resolves({
        nonce: 'a-nonce',
        liabilityShifted: true,
        liablityShiftPossible: true
      });
    });

    it('appends 3ds modal to body', function () {
      return this.tds.verify('old-nonce').then(function () {
        expect(document.body.appendChild).to.be.calledOnce;
        expect(document.body.appendChild).to.be.calledWith(this.tds._modal);
      }.bind(this));
    });

    it('calls verifyCard', function () {
      return this.tds.verify('old-nonce').then(function (payload) {
        expect(this.threeDSecureInstance.verifyCard).to.be.calledOnce;
        expect(this.threeDSecureInstance.verifyCard).to.be.calledWith({
          nonce: 'old-nonce',
          amount: '10.00',
          showLoader: false,
          addFrame: this.sandbox.match.func,
          removeFrame: this.sandbox.match.func
        });

        expect(payload.nonce).to.equal('a-nonce');
        expect(payload.liabilityShifted).to.equal(true);
        expect(payload.liablityShiftPossible).to.equal(true);
      }.bind(this));
    });

    it('adds iframe to dom', function () {
      var appendChildSpy = this.sandbox.spy();

      this.tds._modal = {
        querySelector: this.sandbox.stub().returns({
          appendChild: appendChildSpy,
          style: {
            opacity: 0
          }
        })
      };

      return this.tds.verify('old-nonce').then(function () {
        var addFrameFunction = this.threeDSecureInstance.verifyCard.args[0][0].addFrame;
        var iframe = {};

        addFrameFunction(null, iframe);

        expect(appendChildSpy).to.be.calledWith(iframe);
      }.bind(this));
    });

    it('removes iframe from dom', function () {
      var removeChildSpy = this.sandbox.spy();
      var fakeIframe = {
        parentNode: {
          removeChild: this.sandbox.stub()
        },
        style: {}
      };

      this.tds._modal = {
        querySelector: this.sandbox.stub().returns(fakeIframe),
        parentNode: {
          removeChild: removeChildSpy
        }
      };

      return this.tds.verify('old-nonce').then(function () {
        var removeFrameFunction = this.threeDSecureInstance.verifyCard.args[0][0].removeFrame;
        var clock = this.sandbox.useFakeTimers();

        removeFrameFunction();

        // allow setTimeout to run for animation
        clock.tick(500);
        clock.restore();
      }.bind(this)).then(function () {
        expect(fakeIframe.parentNode.removeChild).to.be.calledWith(fakeIframe);
        expect(removeChildSpy).to.be.calledWith(this.tds._modal);
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

    it('resolves if 3ds is cancelled', function (done) {
      this.threeDSecureInstance.cancelVerifyCard.resolves({
        liabilityShifted: false,
        liabilityShiftPossible: true,
        nonce: 'a-nonce'
      });
      this.threeDSecureInstance.verifyCard = this.sandbox.stub().returns({
        then: function () {
          return new Promise(function () {});
        }
      });

      this.tds.verify('old-nonce').then(function (payload) {
        expect(payload.liabilityShifted).to.equal(false);
        expect(payload.liabilityShiftPossible).to.equal(true);
        expect(payload.nonce).to.equal('a-nonce');
        done();
      });

      this.tds.cancel();
    });
  });

  describe('cancel', function () {
    beforeEach(function () {
      this.tds = new ThreeDSecure({}, 'Card Verification');
      this.tds._instance = this.threeDSecureInstance;
      this.tds._rejectThreeDSecure = this.sandbox.stub();
      this.tds._cleanupModal = this.sandbox.stub();
    });

    it('calls cancelVerifyCard', function () {
      this.threeDSecureInstance.cancelVerifyCard.resolves({
        nonce: 'new-nonce',
        liabilityShifted: false,
        liabilityShiftPossible: true
      });

      return this.tds.cancel().then(function () {
        expect(this.threeDSecureInstance.cancelVerifyCard).to.be.calledOnce;
      }.bind(this));
    });

    it('calls rejectThreeDSecure', function () {
      this.threeDSecureInstance.cancelVerifyCard.resolves({
        nonce: 'new-nonce',
        liabilityShifted: false,
        liabilityShiftPossible: true
      });

      return this.tds.cancel().then(function () {
        expect(this.tds._rejectThreeDSecure).to.be.calledOnce;
        expect(this.tds._rejectThreeDSecure).to.be.calledWith({
          type: 'THREE_D_SECURE_CANCELLED',
          payload: {
            nonce: 'new-nonce',
            liabilityShifted: false,
            liabilityShiftPossible: true
          }
        });
      }.bind(this));
    });

    it('cleans up modal', function () {
      this.threeDSecureInstance.cancelVerifyCard.resolves({
        nonce: 'new-nonce',
        liabilityShifted: false,
        liabilityShiftPossible: true
      });

      return this.tds.cancel().then(function () {
        expect(this.tds._cleanupModal).to.be.calledOnce;
      }.bind(this));
    });

    it('ignores errors', function () {
      this.threeDSecureInstance.cancelVerifyCard.rejects(new Error('fail'));

      return this.tds.cancel().then(function () {
        expect(this.tds._rejectThreeDSecure).to.not.be.called;
        expect(this.tds._cleanupModal).to.not.be.called;
      }.bind(this));
    });
  });

  describe('teardown', function () {
    it('calls teardown on 3ds instance', function () {
      var tds = new ThreeDSecure({}, 'Card Verification');

      tds._instance = this.threeDSecureInstance;
      this.sandbox.stub(this.threeDSecureInstance, 'teardown').resolves();

      return tds.teardown().then(function () {
        expect(this.threeDSecureInstance.teardown).to.be.calledOnce;
      }.bind(this));
    });
  });
});
