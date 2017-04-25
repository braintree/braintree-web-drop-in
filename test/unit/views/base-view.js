'use strict';

var BaseView = require('../../../src/views/base-view');
var constants = require('../../../src/constants');

describe('BaseView', function () {
  describe('Constructor', function () {
    it('does not require options to be passed', function () {
      expect(function () {
        new BaseView(); // eslint-disable-line no-new
      }).not.to.throw();
    });

    it('takes properties from passed options', function () {
      var view = new BaseView({foo: 'boo', yas: 'gaga'});

      expect(view.foo).to.equal('boo');
      expect(view.yas).to.equal('gaga');
    });
  });

  describe('teardown', function () {
    it('calls callback immediately', function (done) {
      var view = new BaseView();

      view.teardown(done);
    });
  });

  describe('requestPaymentMethod', function () {
    it('calls callback with an error', function (done) {
      var view = new BaseView();

      view.requestPaymentMethod(function (err, payload) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal(constants.errors.NO_PAYMENT_METHOD_ERROR);
        expect(payload).to.not.exist;
        done();
      });
    });
  });

  describe('getPaymentMethod', function () {
    it('returns undefined if there is no activeMethodView on instance', function () {
      var view = new BaseView();

      expect(view.getPaymentMethod()).to.equal(undefined); // eslint-disable-line no-undefined
    });

    it('returns undefined if activeMethodView does not have a payment method', function () {
      var view = new BaseView();

      view.activeMethodView = {};

      expect(view.getPaymentMethod()).to.equal(undefined); // eslint-disable-line no-undefined
    });

    it('returns the payment method object if there is an activeMethodView with a payment method object', function () {
      var view = new BaseView();
      var paymentMethod = {};

      view.activeMethodView = {
        paymentMethod: paymentMethod
      };

      expect(view.getPaymentMethod()).to.equal(paymentMethod);
    });
  });

  describe('onSelection', function () {
    it('is a noop function', function () {
      var view = new BaseView();

      expect(view.onSelection).to.be.a('function');
    });
  });
});
