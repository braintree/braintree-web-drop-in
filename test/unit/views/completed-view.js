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
      var termSlot = document.createElement('div');
      var descriptionSlot = document.createElement('div');

      document.body.appendChild(termSlot);
      document.body.appendChild(descriptionSlot);

      this.context = {
        paymentMethod: {
          nonce: 'originalNonce',
          type: 'originalType',
          details: {
            oldDetails: 'old'
          }
        },
        termSlot: termSlot,
        descriptionSlot: descriptionSlot
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

    it('updates view texts with new payment method for PayPal', function () {
      var fakePaymentMethod = {
        nonce: '123abc',
        type: 'PayPalAccount',
        details: {
          email: 'fake@email.biz'
        }
      };

      CompletedView.prototype.updatePaymentMethod.call(this.context, fakePaymentMethod);

      expect(this.context.termSlot.innerHTML).to.equal('fake@email.biz');
      expect(this.context.descriptionSlot.innerHTML).to.equal('PayPal');
    });

    it('updates view texts with new payment method for cards', function () {
      var fakePaymentMethod = {
        nonce: '123abc',
        type: 'CreditCard',
        details: {
          lastTwo: '66',
          cardType: 'A Card Type'
        }
      };

      CompletedView.prototype.updatePaymentMethod.call(this.context, fakePaymentMethod);

      expect(this.context.termSlot.innerHTML).to.equal('Ending in ••66');
      expect(this.context.descriptionSlot.innerHTML).to.equal('A Card Type');
    });
  });
});
