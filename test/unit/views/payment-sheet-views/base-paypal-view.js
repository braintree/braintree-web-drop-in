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
    this.fakeClient = {
      getConfiguration: this.sandbox.stub().returns(this.configuration),
      request: this.sandbox.spy()
    };
    this.paypalViewOptions = {
      strings: {},
      element: this.element,
      model: this.model,
      client: this.fakeClient
    };
    this.paypalInstance = {
      createPayment: this.sandbox.stub().resolves(),
      tokenizePayment: this.sandbox.stub().resolves()
    };
    this.sandbox.stub(PayPalCheckout, 'create').resolves(this.paypalInstance);
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new BasePayPalView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.view = new BasePayPalView(this.paypalViewOptions);
    });

    it('starts async dependency', function () {
      this.sandbox.stub(this.view.model, 'asyncDependencyStarting');

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyStarting).to.be.calledOnce;
      }.bind(this));
    });

    it('notifies async dependency', function () {
      this.sandbox.stub(this.view.model, 'asyncDependencyReady');

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyReady).to.be.calledOnce;
      }.bind(this));
    });

    it('clones the PayPal config', function () {
      return this.view.initialize().then(function () {
        expect(this.view.paypalConfiguration.flow).to.equal(this.model.merchantConfiguration.paypal.flow);
        expect(this.view.paypalConfiguration).to.not.equal(this.model.merchantConfiguration.paypal);
      }.bind(this));
    });

    it('creates a PayPal Checkout component', function () {
      return this.view.initialize().then(function () {
        expect(PayPalCheckout.create).to.be.calledWith(this.sandbox.match({
          client: this.paypalViewOptions.client
        }));
        expect(this.view.paypalInstance).to.equal(this.paypalInstance);
      }.bind(this));
    });

    it('calls asyncDependencyFailed with an error when PayPal component creation fails', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');
      PayPalCheckout.create.rejects(fakeError);

      this.view.ID = 'fake-id';

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.view.model.asyncDependencyFailed).to.be.calledWith({
          view: 'fake-id',
          error: fakeError
        });
      }.bind(this));
    });

    it('calls asyncDependencyStarting when initializing', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      PayPalCheckout.create.rejects(fakeError);

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      this.view.initialize();

      expect(this.view.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('calls paypal.Button.render', function () {
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledOnce;
        expect(this.paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-button"]');
      }.bind(this));
    });

    it('can style the PayPal button', function () {
      this.view.model.merchantConfiguration.paypal.buttonStyle = {
        size: 'medium',
        color: 'orange',
        shape: 'rect'
      };
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          style: {
            size: 'medium',
            color: 'orange',
            shape: 'rect'
          }
        });
      }.bind(this));
    });

    it('can style the PayPal Credit button', function () {
      this.view.model.merchantConfiguration.paypalCredit = this.view.model.merchantConfiguration.paypal;
      this.view.model.merchantConfiguration.paypalCredit.buttonStyle = {
        size: 'medium',
        color: 'orange',
        shape: 'rect'
      };
      this.view._isPayPalCredit = true;
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          style: {
            size: 'medium',
            color: 'orange',
            shape: 'rect',
            label: 'credit'
          }
        });
      }.bind(this));
    });

    it('cannot style label for PayPal Credit', function () {
      this.view.model.merchantConfiguration.paypalCredit = this.view.model.merchantConfiguration.paypal;
      this.view.model.merchantConfiguration.paypalCredit.buttonStyle = {
        label: 'buynow'
      };
      this.view._isPayPalCredit = true;
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          style: {
            label: 'credit'
          }
        });
      }.bind(this));
    });

    it('can set user action to commit for the PayPal button', function () {
      this.view.model.merchantConfiguration.paypal.commit = true;
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          commit: true
        });
      }.bind(this));
    });

    it('can set user action to continue for the PayPal button', function () {
      this.view.model.merchantConfiguration.paypal.commit = false;
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          commit: false
        });
      }.bind(this));
    });

    it('sets paypal-checkout.js environment to production when gatewayConfiguration is production', function () {
      this.configuration.gatewayConfiguration.environment = 'production';
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          env: 'production'
        });
      }.bind(this));
    });

    it('sets paypal-checkout.js environment to sandbox when gatewayConfiguration is not production', function () {
      this.configuration.gatewayConfiguration.environment = 'development';
      return this.view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          env: 'sandbox'
        });
      }.bind(this));
    });

    it('calls paypalInstance.createPayment with a locale if one is provided', function () {
      var fakeLocaleCode = 'fake_LOCALE';
      var paypalInstance = this.paypalInstance;
      var model = this.model;

      model.merchantConfiguration.locale = fakeLocaleCode;

      this.paypal.Button.render.resolves();

      return this.view.initialize().then(function () {
        var paymentFunction = this.paypal.Button.render.getCall(0).args[0].payment;

        return paymentFunction().then(function () {
          expect(paypalInstance.createPayment).to.be.calledOnce;
          expect(paypalInstance.createPayment).to.be.calledWithMatch({
            locale: 'fake_LOCALE'
          });
        });
      }.bind(this));
    });

    it('calls paypal.Button.render with a locale if one is provided', function () {
      var fakeLocaleCode = 'fake_LOCALE';
      var model = this.model;
      var view = this.view;

      model.merchantConfiguration.locale = fakeLocaleCode;

      return view.initialize().then(function () {
        expect(this.paypal.Button.render).to.be.calledWithMatch({
          locale: 'fake_LOCALE'
        });
      }.bind(this));
    });

    it('reports errors from createPayment', function () {
      var model = this.model;
      var error = new Error('create payment error');

      this.paypalInstance.createPayment.rejects(error);

      this.paypal.Button.render.resolves();

      return this.view.initialize().then(function () {
        var paymentFunction = this.paypal.Button.render.getCall(0).args[0].payment;

        return paymentFunction().then(function () {
          expect(model.reportError).to.be.calledOnce;
          expect(model.reportError).to.be.calledWith(error);
        });
      }.bind(this));
    });

    it('reports errors from paypal.Button.render', function () {
      var error = new Error('setup error');

      this.sandbox.stub(this.model, 'asyncDependencyFailed');
      this.paypal.Button.render.rejects(error);

      return this.view.initialize().then(function () {
        expect(this.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.model.asyncDependencyFailed).to.be.calledWithMatch({
          view: this.view.ID,
          error: error
        });
      }.bind(this));
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

      this.view.initialize().then(function () {
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
      }.bind(this));
    });

    it('adds `vaulted: true` to the tokenization payload if flow is vault and is not guest checkout', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var fakePayload = {
        foo: 'bar',
        vaulted: true
      };

      model.isGuestCheckout = false;

      paypalInstance.tokenizePayment.resolves(fakePayload);
      paypalInstance.paypalConfiguration = {flow: 'vault'};
      this.sandbox.stub(model, 'addPaymentMethod');

      this.paypal.Button.render.resolves();

      this.view.initialize().then(function () {
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
      }.bind(this));
    });

    it('does not add `vaulted: true` to the tokenization payload if flow is vault but is guest checkout', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var fakePayload = {
        foo: 'bar'
      };

      model.isGuestCheckout = true;

      paypalInstance.tokenizePayment.resolves(fakePayload);
      paypalInstance.paypalConfiguration = {flow: 'vault'};
      this.sandbox.stub(model, 'addPaymentMethod');

      this.paypal.Button.render.resolves();

      this.view.initialize().then(function () {
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
      }.bind(this));
    });

    it('does not add `vaulted: true` to the tokenization payload if flow is checkout and is not guest checkout', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var fakePayload = {
        foo: 'bar'
      };

      model.isGuestCheckout = false;

      paypalInstance.tokenizePayment.resolves(fakePayload);
      paypalInstance.paypalConfiguration = {flow: 'checkout'};
      this.sandbox.stub(model, 'addPaymentMethod');

      this.paypal.Button.render.resolves();

      this.view.initialize().then(function () {
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
      }.bind(this));
    });

    it('reports errors from tokenizePayment', function (done) {
      var paypalInstance = this.paypalInstance;
      var model = this.model;
      var error = new Error('tokenize error');

      paypalInstance.tokenizePayment.rejects(error);
      this.sandbox.stub(model, 'addPaymentMethod');

      this.paypal.Button.render.resolves();

      this.view.initialize().then(function () {
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
      }.bind(this));
    });

    it('reports errors from paypal-checkout', function () {
      var model = this.model;

      this.paypal.Button.render.resolves();
      return this.view.initialize().then(function () {
        var onErrorFunction = this.paypal.Button.render.getCall(0).args[0].onError;
        var err = new Error('Some error');

        onErrorFunction(err);

        expect(model.reportError).to.be.calledOnce;
        expect(model.reportError).to.be.calledWith(err);
      }.bind(this));
    });

    it('marks dependency as failed if error occurs before setup completes', function (done) {
      var model = this.model;

      this.sandbox.stub(model, 'asyncDependencyFailed');
      this.paypal.Button.render.returns({
        then: this.sandbox.stub()
      });

      this.view.initialize();

      setTimeout(function () {
        var onErrorFunction = this.paypal.Button.render.getCall(0).args[0].onError;
        var err = new Error('Some error');

        onErrorFunction(err);

        expect(model.reportError).to.not.be.called;
        expect(model.asyncDependencyFailed).to.be.calledOnce;
        expect(model.asyncDependencyFailed).to.be.calledWithMatch({
          view: this.view.ID,
          error: err
        });
        done();
      }.bind(this), 10);
    });

    describe('with PayPal', function () {
      it('uses the PayPal merchant configuration', function () {
        this.model.merchantConfiguration.paypal = {
          flow: 'vault'
        };
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout'
        };

        return this.view.initialize().then(function () {
          expect(this.view.paypalConfiguration.flow).to.equal('vault');
        }.bind(this));
      });

      it('sets offerCredit to false in the PayPal Checkout configuration even if offerCredit is set to true in PayPal configuration', function () {
        this.model.merchantConfiguration.paypal = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD',
          offerCredit: true
        };

        return this.view.initialize().then(function () {
          expect(this.view.paypalConfiguration.offerCredit).to.equal(false);
        }.bind(this));
      });

      it('uses the PayPal button selector', function () {
        return this.view.initialize().then(function () {
          expect(this.paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-button"]');
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

        this.view._isPayPalCredit = true;
        this.view.initialize();

        expect(this.view.paypalConfiguration.flow).to.equal('checkout');
      });

      it('sets offerCredit to true in the PayPal Checkout configuration', function () {
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD'
        };

        this.view._isPayPalCredit = true;
        return this.view.initialize().then(function () {
          expect(this.view.paypalConfiguration).to.deep.equal({
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: true
          });
        }.bind(this));
      });

      it('sets offerCredit to true in the PayPal Checkout configuration even if the configuration sets offerCredit to false', function () {
        this.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD',
          offerCredit: false
        };

        this.view._isPayPalCredit = true;
        return this.view.initialize().then(function () {
          expect(this.view.paypalConfiguration).to.deep.equal({
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: true
          });
        }.bind(this));
      });

      it('uses the PayPal Credit button selector', function () {
        this.view._isPayPalCredit = true;
        return this.view.initialize().then(function () {
          expect(this.paypal.Button.render).to.be.calledWith(this.sandbox.match.object, '[data-braintree-id="paypal-credit-button"]');
        }.bind(this));
      });

      it('includes credit style in button configuration', function () {
        this.view._isPayPalCredit = true;

        return this.view.initialize().then(function () {
          expect(this.paypal.Button.render).to.be.calledWithMatch({
            style: {label: 'credit'}
          });
        }.bind(this));
      });

      it('times out if the async dependency is never ready', function (done) {
        var paypalError = new DropinError('There was an error connecting to PayPal.');

        this.sandbox.useFakeTimers();

        this.sandbox.stub(DropinModel.prototype, 'asyncDependencyFailed');

        this.paypal.Button.render.rejects();

        this.view.initialize().then(function () {
          expect(DropinModel.prototype.asyncDependencyFailed).to.be.calledWith(this.sandbox.match({
            view: this.view.ID,
            error: paypalError
          }));
          done();
        }.bind(this));

        this.sandbox.clock.tick(30001);
      });

      it('does not timeout if async dependency sets up', function () {
        this.sandbox.useFakeTimers();
        this.sandbox.stub(DropinModel.prototype, 'asyncDependencyFailed');

        PayPalCheckout.create.resolves(this.paypalInstance);
        this.paypal.Button.render.resolves();

        return this.view.initialize().then(function () {
          this.sandbox.clock.tick(10);

          this.sandbox.clock.tick(300001);

          expect(DropinModel.prototype.asyncDependencyFailed).to.not.be.called;
        }.bind(this));
      });

      it('does not timeout if async dependency failed early', function () {
        this.sandbox.useFakeTimers();
        this.sandbox.stub(DropinModel.prototype, 'asyncDependencyFailed');

        PayPalCheckout.create.resolves(this.paypalInstance);
        this.paypal.Button.render.rejects();

        return this.view.initialize().then(function () {
          this.sandbox.clock.tick(300500);

          expect(DropinModel.prototype.asyncDependencyFailed).to.be.calledOnce;
          expect(DropinModel.prototype.asyncDependencyFailed).to.not.be.calledWithMatch({
            err: new DropinError('There was an error connecting to PayPal.')
          });
        }.bind(this));
      });
    });
  });

  describe('updateConfiguration', function () {
    it('ignores offerCredit updates', function () {
      var view = new BasePayPalView();

      view.paypalConfiguration = {offerCredit: true};

      view.updateConfiguration('offerCredit', false);

      expect(view.paypalConfiguration.offerCredit).to.equal(true);
    });

    it('ignores locale updates', function () {
      var view = new BasePayPalView();

      view.paypalConfiguration = {locale: 'es'};

      view.updateConfiguration('locale', 'il');

      expect(view.paypalConfiguration.locale).to.equal('es');
    });

    it('can set properties on paypal config', function () {
      var view = new BasePayPalView();

      view.paypalConfiguration = {
        flow: 'vault',
        amount: '10.00'
      };

      view.updateConfiguration('flow', 'checkout');
      view.updateConfiguration('amount', '5.32');
      view.updateConfiguration('currency', 'USD');

      expect(view.paypalConfiguration).to.deep.equal({
        flow: 'checkout',
        amount: '5.32',
        currency: 'USD'
      });
    });
  });

  describe('isEnabled', function () {
    beforeEach(function () {
      this.options = {
        client: this.fakeClient
      };
    });

    it('resolves true if merchant has PayPal enabled on the gateway', function () {
      return BasePayPalView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(true);
      });
    });

    it('resolves false if merchant does not have PayPal enabled on the gateway', function () {
      this.configuration.gatewayConfiguration.paypalEnabled = false;

      return BasePayPalView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });
  });
});
