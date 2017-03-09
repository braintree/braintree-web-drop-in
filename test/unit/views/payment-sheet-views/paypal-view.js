'use strict';
/* eslint-disable no-new */

var Promise = require('../../../../src/lib/promise');
var BaseView = require('../../../../src/views/base-view');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var PayPalCheckout = require('braintree-web/paypal-checkout');
var paypal = require('paypal-checkout');
var fs = require('fs');
var PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

function waitForInitialize(func) {
  setTimeout(func, 100);
}

describe('PayPalView', function () {
  beforeEach(function () {
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
      element: this.element,
      model: this.model,
      client: {
        getConfiguration: this.sandbox.stub().returns(this.configuration),
        request: this.sandbox.spy()
      }
    };
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PayPalView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new PayPalView();

      expect(PayPalView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new PayPalView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.paypalInstance = {
        createPayment: this.sandbox.stub().returns(Promise.resolve()),
        tokenizePayment: this.sandbox.stub().returns(Promise.resolve())
      };

      this.sandbox.stub(PayPalCheckout, 'create').yieldsAsync(null, this.paypalInstance);
      this.sandbox.stub(paypal.Button, 'render').returns(Promise.resolve());
    });

    it('starts async dependency', function (done) {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');

      payPalView = new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(payPalView.model.asyncDependencyStarting).to.be.calledOnce;
        done();
      });
    });

    it('notifies async dependency', function (done) {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      payPalView = new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(payPalView.model.asyncDependencyReady).to.be.calledOnce;
        done();
      });
    });

    it('calls setLogLevel', function () {
      this.sandbox.stub(PayPalView.prototype, 'setLogLevel');

      new PayPalView(this.paypalViewOptions);

      expect(PayPalView.prototype.setLogLevel).to.be.calledOnce;
      expect(PayPalView.prototype.setLogLevel).to.be.calledWith(paypal);
    });

    it('creates a PayPal component', function (done) {
      var payPalView = new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(PayPalCheckout.create).to.be.calledWith(this.sandbox.match({
          client: this.paypalViewOptions.client
        }), this.sandbox.match.func);

        expect(payPalView.paypalInstance).to.equal(this.paypalInstance);
        done();
      }.bind(this));
    });

    it('calls asyncDependencyFailed with an error when PayPal component creation fails', function (done) {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      PayPalCheckout.create.yields(fakeError);
      this.sandbox.stub(this.model, 'asyncDependencyFailed');

      new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(this.model.asyncDependencyFailed).to.be.calledWith(fakeError);
        done();
      }.bind(this));
    });

    it('calls asyncDependencyStarting when initializing', function (done) {
      var paypalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      paypalView = new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(paypalView.model.asyncDependencyStarting).to.be.calledOnce;
        done();
      });
    });

    it('calls paypal.Button.render', function (done) {
      new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(paypal.Button.render).to.be.calledOnce;
        expect(paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-button"]');
        done();
      }.bind(this));
    });

    it('sets paypal-checkout.js environment to production when gatewayConfiguration is production', function (done) {
      this.configuration.gatewayConfiguration.environment = 'production';
      new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(paypal.Button.render).to.be.calledWithMatch({
          env: 'production'
        });
        done();
      });
    });

    it('sets paypal-checkout.js environment to sandbox when gatewayConfiguration is not production', function (done) {
      this.configuration.gatewayConfiguration.environment = 'development';
      new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(paypal.Button.render).to.be.calledWithMatch({
          env: 'sandbox'
        });
        done();
      });
    });

    it('sets locale from merchantConfig.paypal passed into Drop-in', function (done) {
      this.model.merchantConfiguration.paypal.locale = 'LOCALE_VALUE';
      new PayPalView(this.paypalViewOptions);

      waitForInitialize(function () {
        expect(paypal.Button.render).to.be.calledWithMatch({
          locale: 'LOCALE_VALUE'
        });
        done();
      });
    });

    it('calls payalInstance.createPayment with merchant config when checkout.js payment function is called', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;

      paypal.Button.render.returns(Promise.resolve().then(function () {
        // for some reason, this needs to be in a set timeout to grab the args from render
        setTimeout(function () {
          var paymentFunction = paypal.Button.render.getCall(0).args[0].payment;

          paymentFunction();

          waitForInitialize(function () {
            expect(paypalInstance.createPayment).to.be.calledOnce;
            expect(paypalInstance.createPayment).to.be.calledWith(model.merchantConfiguration.paypal);

            done();
          });
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });

    it('reports errors from createPayment', function (done) {
      var model = this.model;
      var error = new Error('create payment error');

      this.paypalInstance.createPayment.returns(Promise.reject(error));

      paypal.Button.render.returns(Promise.resolve().then(function () {
        // for some reason, this needs to be in a set timeout to grab the args from render
        setTimeout(function () {
          var paymentFunction = paypal.Button.render.getCall(0).args[0].payment;

          paymentFunction().then(function () {
            waitForInitialize(function () {
              expect(model.reportError).to.be.calledOnce;
              expect(model.reportError).to.be.calledWith(error);
              done();
            });
          });
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });

    it('calls addPaymentMethod when paypal is tokenized', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var fakePayload = {
        foo: 'bar'
      };

      paypalInstance.tokenizePayment.returns(Promise.resolve(fakePayload));
      this.sandbox.stub(model, 'addPaymentMethod');

      paypal.Button.render.returns(Promise.resolve().then(function () {
        // for some reason, this needs to be in a set timeout to grab the args from render
        setTimeout(function () {
          var onAuthFunction = paypal.Button.render.getCall(0).args[0].onAuthorize;
          var tokenizeOptions = {
            foo: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          waitForInitialize(function () {
            expect(paypalInstance.tokenizePayment).to.be.calledOnce;
            expect(paypalInstance.tokenizePayment).to.be.calledWith(tokenizeOptions);

            expect(model.addPaymentMethod).to.be.calledOnce;
            expect(model.addPaymentMethod).to.be.calledWith(fakePayload);

            done();
          });
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });

    it('reports errors from tokenizePayment', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var error = new Error('tokenize error');

      paypalInstance.tokenizePayment.returns(Promise.reject(error));
      this.sandbox.stub(model, 'addPaymentMethod');

      paypal.Button.render.returns(Promise.resolve().then(function () {
        // for some reason, this needs to be in a set timeout to grab the args from render
        setTimeout(function () {
          var onAuthFunction = paypal.Button.render.getCall(0).args[0].onAuthorize;
          var tokenizeOptions = {
            foo: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          waitForInitialize(function () {
            expect(model.reportError).to.be.calledOnce;
            expect(model.reportError).to.be.calledWith(error);

            done();
          });
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });

    it('reports errors from paypal-checkout', function (done) {
      var model = this.model;

      paypal.Button.render.returns(Promise.resolve().then(function () {
        // for some reason, this needs to be in a set timeout to grab the args from render
        setTimeout(function () {
          var onErrorFunction = paypal.Button.render.getCall(0).args[0].onError;
          var err = new Error('Some error');

          onErrorFunction(err);

          waitForInitialize(function () {
            expect(model.reportError).to.be.calledOnce;
            expect(model.reportError).to.be.calledWith(err);

            done();
          });
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });
  });

  describe('setLogLevel', function () {
    beforeEach(function () {
      this.context = {
        model: {
          merchantConfiguration: {
            paypal: {}
          }
        }
      };
      this.fakePayPal = {
        setup: this.sandbox.stub()
      };
    });

    it('sets log level to a default value of "warn"', function () {
      PayPalView.prototype.setLogLevel.call(this.context, this.fakePayPal);

      expect(this.fakePayPal.setup).to.be.calledOnce;
      expect(this.fakePayPal.setup).to.be.calledWith({
        logLevel: 'warn'
      });
    });

    it('sets log level to value set in merchant configuration', function () {
      this.context.model.merchantConfiguration.paypal.logLevel = 'debug';
      PayPalView.prototype.setLogLevel.call(this.context, this.fakePayPal);

      expect(this.fakePayPal.setup).to.be.calledOnce;
      expect(this.fakePayPal.setup).to.be.calledWith({
        logLevel: 'debug'
      });
    });
  });
});
