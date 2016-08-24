'use strict';

var CompletedView = require('../../../src/views/completed-view');
var BaseView = require('../../../src/views/base-view');

describe('CompletedView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CompletedView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new CompletedView(); // eslint-disable-line no-new

      expect(CompletedView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new CompletedView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('requestPaymentMethod', function () {
    it('calls callback with payment method', function () {
      var callback = this.sandbox.stub();
      var context = {
        paymentMethod: {
          nonce: '123acb',
          type: 'FooPayAccount',
          details: {}
        }
      };

      CompletedView.prototype.requestPaymentMethod.call(context, callback);
      expect(callback).to.have.been.calledWith(null, this.sandbox.match(context.paymentMethod));
    });
  });

  describe('updatePaymentMethod', function () {
    beforeEach(function () {
      var typeSlot = document.createElement('div');
      var nonceSlot = document.createElement('div');

      document.body.appendChild(typeSlot);
      document.body.appendChild(nonceSlot);

      this.context = {
        paymentMethod: {
          nonce: 'originalNonce',
          type: 'originalType',
          details: {
            oldDetails: 'old'
          }
        },
        typeSlot: typeSlot,
        nonceSlot: nonceSlot
      };
    });

    it('sets the new payment method', function () {
      var fakePaymentMethod = {
        nonce: '123abc',
        type: 'FooPayAccount',
        details: {
          newDetails: 'new'
        }
      };

      CompletedView.prototype.updatePaymentMethod.call(this.context, fakePaymentMethod);

      expect(this.context.paymentMethod.nonce).to.equal('123abc');
      expect(this.context.paymentMethod.type).to.equal('FooPayAccount');
      expect(this.context.paymentMethod.details.newDetails).to.equal('new');
    });

    it('updates view texts with new payment method', function () {
      var fakePaymentMethod = {
        nonce: '123abc',
        type: 'FooPayAccount'
      };

      CompletedView.prototype.updatePaymentMethod.call(this.context, fakePaymentMethod);

      expect(this.context.nonceSlot.innerHTML).to.equal('123abc');
      expect(this.context.typeSlot.innerHTML).to.equal('FooPayAccount');
    });
  });
});
