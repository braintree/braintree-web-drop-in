'use strict';
/* eslint-disable no-new */

var BaseView = require('../../../../src/views/base-view');
var DropinModel = require('../../../../src/dropin-model');
var DropinError = require('../../../../src/lib/dropin-error');
var fake = require('../../../helpers/fake');
var fs = require('fs');
var PayPalCheckout = require('braintree-web/paypal-checkout');
var BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

function waitForInitialize(func) {
  setTimeout(func, 100);
}

describe('BasePayPalView', function () {
  beforeEach(function () {
    this.paypal = {
      Button: {
        render: this.sandbox.stub().resolves()
      },
      setup: this.sandbox.stub()
    };

    global.paypal = this.paypal;

    this.model = new DropinModel(fake.modelOptions());

    this.div = document.createElement('div');
    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-sheet.braintree-paypal');

    this.model.supportedPaymentOptions = ['card', 'paypal'];
    this.model.merchantConfiguration.paypal = {flow: 'vault'};
    this.sandbox.stub(this.model, 'reportError');

    this.configuration = fake.configuration();
    this.paypalViewOptions = {
      strings: {},
      element: this.element,
      model: this.model,
      client: {
        getConfiguration: this.sandbox.stub().returns(this.configuration),
        request: this.sandbox.spy()
      }
    };
    this.paypalInstance = {
      createPayment: this.sandbox.stub().resolves(),
      tokenizePayment: this.sandbox.stub().resolves()
    };
    this.sandbox.stub(PayPalCheckout, 'create').yieldsAsync(null, this.paypalInstance);
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new BasePayPalView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.view = new BasePayPalView(this.paypalViewOptions);
    });

    it('starts async dependency', function (done) {
      this.sandbox.stub(this.view.model, 'asyncDependencyStarting');

      this.view._initialize();

      waitForInitialize(function () {
        expect(this.view.model.asyncDependencyStarting).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('notifies async dependency', function (done) {
      this.sandbox.stub(this.view.model, 'asyncDependencyReady');

      this.view._initialize();

      waitForInitialize(function () {
        expect(this.view.model.asyncDependencyReady).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('clones the PayPal config', function () {
      this.view._initialize();

      expect(this.view.paypalConfiguration.flow).to.equal(this.model.merchantConfiguration.paypal.flow);
      expect(this.view.paypalConfiguration).to.not.equal(this.model.merchantConfiguration.paypal);
    });

    it('creates a PayPal Checkout component', function (done) {
      this.view._initialize();

      waitForInitialize(function () {
        expect(PayPalCheckout.create).to.be.calledWith(this.sandbox.match({
          client: this.paypalViewOptions.client
        }), this.sandbox.match.func);
        expect(this.view.paypalInstance).to.equal(this.paypalInstance);
        done();
      }.bind(this));
    });

    it('calls asyncDependencyFailed with an error when PayPal component creation fails', function (done) {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');
      PayPalCheckout.create.yieldsAsync(fakeError);

      this.view.ID = 'fake-id';

      this.view._initialize();

      waitForInitialize(function () {
        expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.view.model.asyncDependencyFailed).to.be.calledWith({
          view: 'fake-id',
          error: fakeError
        });
        done();
      }.bind(this));
    });

    it('calls asyncDependencyStarting when initializing', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      PayPalCheckout.create.yieldsAsync(fakeError);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.view._initialize();

      expect(this.view.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('calls paypal.Button.render', function (done) {
      this.view._initialize();

      waitForInitialize(function () {
        expect(this.paypal.Button.render).to.be.calledOnce;
        expect(this.paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-button"]');
        done();
      }.bind(this));
    });

    it('sets paypal-checkout.js environment to production when gatewayConfiguration is production', function (done) {
      this.configuration.gatewayConfiguration.environment = 'production';
      this.view._initialize();

      waitForInitialize(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          env: 'production'
        });
        done();
      });
    });

    it('sets paypal-checkout.js environment to sandbox when gatewayConfiguration is not production', function (done) {
      this.configuration.gatewayConfiguration.environment = 'development';
      this.view._initialize();

      waitForInitialize(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          env: 'sandbox'
        });
        done();
      });
    });

    it('calls paypalInstance.createPayment with a locale if one is provided', function (done) {
      var fakeLocaleCode = 'fake_LOCALE';
      var paypalInstance = this.paypalInstance;
      var model = this.model;

      model.merchantConfiguration.locale = fakeLocaleCode;

      this.paypal.Button.render.resolves();

      this.view._initialize();

      waitForInitialize(function () {
        var paymentFunction = this.paypal.Button.render.getCall(0).args[0].payment;

        paymentFunction().then(function () {
          expect(paypalInstance.createPayment).to.be.calledOnce;
          expect(paypalInstance.createPayment).to.be.calledWithMatch({
            locale: 'fake_LOCALE'
          });
          done();
        });
      });
    });

    it('calls paypal.Button.render with a locale if one is provided', function (done) {
      var fakeLocaleCode = 'fake_LOCALE';
      var model = this.model;
      var view = this.view;

      model.merchantConfiguration.locale = fakeLocaleCode;

      view._initialize();

      waitForInitialize(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          locale: 'fake_LOCALE'
        });
        done();
      });
    });

    it('reports errors from createPayment', function (done) {
      var model = this.model;
      var error = new Error('create payment error');

      this.paypalInstance.createPayment.rejects(error);

      this.paypal.Button.render.resolves();

      this.view._initialize();

      waitForInitialize(function () {
        var paymentFunction = this.paypal.Button.render.getCall(0).args[0].payment;

        paymentFunction().then(function () {
          expect(model.reportError).to.be.calledOnce;
          expect(model.reportError).to.be.calledWith(error);
          done();
        });
      });
    });

    it('calls addPaymentMethod when paypal is tokenized', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var fakePayload = {
        foo: 'bar'
      };

      paypalInstance.tokenizePayment.resolves(fakePayload);
      this.sandbox.stub(model, 'addPaymentMethod');

      this.paypal.Button.render.resolves();

      this.view._initialize();

      waitForInitialize(function () {
        var onAuthFunction = this.paypal.Button.render.getCall(0).args[0].onAuthorize;
        var tokenizeOptions = {
          foo: 'bar'
        };

        onAuthFunction(tokenizeOptions);

        expect(paypalInstance.tokenizePayment).to.be.calledOnce;
        expect(paypalInstance.tokenizePayment).to.be.calledWith(tokenizeOptions);

        setTimeout(function () {
          expect(model.addPaymentMethod).to.be.calledOnce;
          expect(model.addPaymentMethod).to.be.calledWith(fakePayload);

          done();
        }, 100);
      });
    });

    it('reports errors from tokenizePayment', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var error = new Error('tokenize error');

      paypalInstance.tokenizePayment.rejects(error);
      this.sandbox.stub(model, 'addPaymentMethod');

      this.paypal.Button.render.resolves();

      this.view._initialize();

      waitForInitialize(function () {
        var onAuthFunction = this.paypal.Button.render.getCall(0).args[0].onAuthorize;
        var tokenizeOptions = {
          foo: 'bar'
        };

        onAuthFunction(tokenizeOptions);

        setTimeout(function () {
          expect(model.reportError).to.be.calledOnce;
          expect(model.reportError).to.be.calledWith(error);

          done();
        }, 100);
      });
    });

    it('reports errors from paypal-checkout', function (done) {
      var model = this.model;

      this.paypal.Button.render.resolves();
      this.view._initialize();

      waitForInitialize(function () {
        var onErrorFunction = this.paypal.Button.render.getCall(0).args[0].onError;
        var err = new Error('Some error');

        onErrorFunction(err);

        expect(model.reportError).to.be.calledOnce;
        expect(model.reportError).to.be.calledWith(err);

        done();
      });
    });

    describe('with PayPal', function () {
      it('uses the PayPal merchant configuration', function () {
        this.model.merchantConfiguration.paypal = {
          flow: 'vault'
        };
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout'
        };

        this.view._initialize(false);

        expect(this.view.paypalConfiguration.flow).to.equal('vault');
      });

      it('sets offerCredit to false in the PayPal Checkout configuration even if offerCredit is set to true in PayPal configuration', function (done) {
        this.model.merchantConfiguration.paypal = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD',
          offerCredit: true
        };

        this.view._initialize(false);

        waitForInitialize(function () {
          expect(this.view.paypalConfiguration).to.deep.equal({
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: false
          });
          done();
        }.bind(this));
      });

      it('uses the PayPal button selector', function (done) {
        this.view._initialize(false);

        waitForInitialize(function () {
          expect(this.paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-button"]');
          done();
        }.bind(this));
      });
    });

    describe('with PayPal Credit', function () {
      it('uses the PayPal Credit merchant configuration', function () {
        this.model.merchantConfiguration.paypal = {
          flow: 'vault'
        };
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout'
        };

        this.view._initialize(true);

        expect(this.view.paypalConfiguration.flow).to.equal('checkout');
      });

      it('sets offerCredit to true in the PayPal Checkout configuration', function (done) {
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD'
        };

        this.view._initialize(true);

        waitForInitialize(function () {
          expect(this.view.paypalConfiguration).to.deep.equal({
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: true
          });
          done();
        }.bind(this));
      });

      it('sets offerCredit to true in the PayPal Checkout configuration even if the configuration sets offerCredit to false', function (done) {
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD',
          offerCredit: false
        };

        this.view._initialize(true);

        waitForInitialize(function () {
          expect(this.view.paypalConfiguration).to.deep.equal({
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: true
          });
          done();
        }.bind(this));
      });

      it('uses the PayPal Credit button selector', function (done) {
        this.view._initialize(true);

        waitForInitialize(function () {
          expect(this.paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-credit-button"]');
          done();
        }.bind(this));
      });

      it('includes credit style in button configuration', function (done) {
        this.view._initialize(true);

        waitForInitialize(function () {
          expect(this.paypal.Button.render).to.be.calledWithMatch({
            style: {label: 'credit'}
          });
          done();
        });
      });

      it('times out if the async dependency is never ready', function () {
        var paypalError = new DropinError('There was an error connecting to PayPal.');

        this.sandbox.useFakeTimers();

        this.sandbox.stub(DropinModel.prototype, 'asyncDependencyFailed');

        this.paypal.Button.render.rejects();
        this.view._initialize();

        this.sandbox.clock.tick(30001);

        expect(DropinModel.prototype.asyncDependencyFailed).to.be.calledWith(this.sandbox.match({
          view: this.view.ID,
          error: paypalError
        }));
      });

      it('does not timeout if async dependency sets up', function () {
        this.sandbox.useFakeTimers();
        this.sandbox.stub(DropinModel.prototype, 'asyncDependencyFailed');
        PayPalCheckout.create.yields(null, this.paypalInstance);
        // promises can't resolve while using fake timers
        // so we make a fake promise
        this.paypal.Button.render.returns({
          then: this.sandbox.stub().yields()
        });

        this.view._initialize();
        this.sandbox.clock.tick(10);

        this.sandbox.clock.tick(300001);

        expect(DropinModel.prototype.asyncDependencyFailed).to.not.be.called;
      });
    });
  });
});
