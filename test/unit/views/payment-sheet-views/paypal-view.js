'use strict';
/* eslint-disable no-new */

var Promise = require('../../../../src/lib/promise');
var BaseView = require('../../../../src/views/base-view');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var mainHTML = require('../../../../src/html/main.html');
var PayPalCheckout = require('braintree-web/paypal-checkout');
var paypal = require('paypal-checkout');
var PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

describe('PayPalView', function () {
  beforeEach(function () {
    this.model = new DropinModel(fake.modelOptions());

    this.div = document.createElement('div');
    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-sheet.braintree-paypal');

    this.model.supportedPaymentOptions = ['card', 'paypal'];
    this.model.merchantConfiguration.paypal = {flow: 'vault'};

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
        createPayment: this.sandbox.stub(),
        tokenizePayment: this.sandbox.stub()
      };

      this.sandbox.stub(PayPalCheckout, 'create').yields(null, this.paypalInstance);
      this.sandbox.stub(paypal.Button, 'render').returns(Promise.resolve());
    });

    it('starts async dependency', function () {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');

      payPalView = new PayPalView(this.paypalViewOptions);

      expect(payPalView.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('notifies async dependency', function () {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      payPalView = new PayPalView(this.paypalViewOptions);

      expect(payPalView.model.asyncDependencyReady).to.be.calledOnce;
    });

    it('creates a PayPal component', function () {
      var payPalView = new PayPalView(this.paypalViewOptions);

      expect(PayPalCheckout.create).to.be.calledWith(this.sandbox.match({
        client: this.paypalViewOptions.client
      }), this.sandbox.match.func);

      expect(payPalView.paypalInstance).to.equal(this.paypalInstance);
    });

    it('console errors when PayPal component creation fails', function () {
      var paypalView;
      var fakeError = {type: 'MERCHANT'};

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      PayPalCheckout.create.yields(fakeError);
      this.sandbox.stub(console, 'error');

      paypalView = new PayPalView(this.paypalViewOptions);

      expect(console.error).to.be.calledWith(fakeError);
      expect(paypalView.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('calls paypal.Button.render', function () {
      new PayPalView(this.paypalViewOptions);

      expect(paypal.Button.render).to.be.calledOnce;
      expect(paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-button"]');
    });

    it('sets paypal-checkout.js environment to production when gatewayConfiguration is production', function () {
      this.configuration.gatewayConfiguration.environment = 'production';
      new PayPalView(this.paypalViewOptions);

      expect(paypal.Button.render).to.be.calledWithMatch({
        env: 'production'
      });
    });

    it('sets paypal-checkout.js environment to sandbox when gatewayConfiguration is not production', function () {
      this.configuration.gatewayConfiguration.environment = 'development';
      new PayPalView(this.paypalViewOptions);

      expect(paypal.Button.render).to.be.calledWithMatch({
        env: 'sandbox'
      });
    });

    it('sets locale from merchantConfig.paypal passed into Drop-in', function () {
      this.model.merchantConfiguration.paypal.locale = 'LOCALE_VALUE';
      new PayPalView(this.paypalViewOptions);

      expect(paypal.Button.render).to.be.calledWithMatch({
        locale: 'LOCALE_VALUE'
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

          expect(paypalInstance.createPayment).to.be.calledOnce;
          expect(paypalInstance.createPayment).to.be.calledWith(model.merchantConfiguration.paypal);

          done();
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

          expect(paypalInstance.tokenizePayment).to.be.calledOnce;
          expect(paypalInstance.tokenizePayment).to.be.calledWith(tokenizeOptions);

          expect(model.addPaymentMethod).to.be.calledOnce;
          expect(model.addPaymentMethod).to.be.calledWith(fakePayload);

          done();
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });

    it('reports errors from paypal-checkout', function (done) {
      var model = this.model;

      this.sandbox.stub(model, 'reportError');

      paypal.Button.render.returns(Promise.resolve().then(function () {
        // for some reason, this needs to be in a set timeout to grab the args from render
        setTimeout(function () {
          var onErrorFunction = paypal.Button.render.getCall(0).args[0].onError;
          var err = new Error('Some error');

          onErrorFunction(err);

          expect(model.reportError).to.be.calledOnce;
          expect(model.reportError).to.be.calledWith(err);

          done();
        }, 0);
      }));

      new PayPalView(this.paypalViewOptions);
    });
  });
});
