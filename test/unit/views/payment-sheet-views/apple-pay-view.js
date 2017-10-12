'use strict';
/* eslint-disable no-new */

var BaseView = require('../../../../src/views/base-view');
var ApplePayView = require('../../../../src/views/payment-sheet-views/apple-pay-view');
var btApplePay = require('braintree-web/apple-pay');
var DropinModel = require('../../../../src/dropin-model');
var DropinError = require('../../../../src/lib/dropin-error');
var fake = require('../../../helpers/fake');
var fs = require('fs');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('ApplePayView', function () {
  beforeEach(function () {
    var model = new DropinModel(fake.modelOptions());
    var fakeClient = {
      getConfiguration: this.sandbox.stub().returns(fake.configuration()),
      getVersion: function () {}
    };

    this.div = document.createElement('div');

    this.fakeApplePaySession = {
      begin: this.sandbox.stub(),
      completeMerchantValidation: this.sandbox.stub(),
      completePayment: this.sandbox.stub()
    };

    global.ApplePaySession = this.sandbox.stub().returns(this.fakeApplePaySession);
    global.ApplePaySession.canMakePayments = function () { return true; };
    global.ApplePaySession.canMakePaymentsWithActiveCard = this.sandbox.stub().resolves(true);
    global.ApplePaySession.STATUS_FAILURE = 'failure';
    global.ApplePaySession.STATUS_SUCCESS = 'success';
    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);

    this.fakePaymentRequest = {
      countryCode: 'defined',
      currencyCode: 'defined',
      merchantCapabilities: ['defined'],
      supportedNetworks: ['defined']
    };
    model.merchantConfiguration.applePay = {
      paymentRequest: this.fakePaymentRequest,
      displayName: 'Unit Test Display Name'
    };
    this.applePayViewOptions = {
      client: fakeClient,
      element: document.body.querySelector('.braintree-sheet.braintree-applePay'),
      model: model,
      strings: {}
    };

    this.fakeApplePayInstance = {
      createPaymentRequest: this.sandbox.stub().returns({}),
      performValidation: this.sandbox.stub().resolves(),
      tokenize: this.sandbox.stub().resolves()
    };
    this.sandbox.stub(btApplePay, 'create').resolves(this.fakeApplePayInstance);
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new ApplePayView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.view = new ApplePayView(this.applePayViewOptions);
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

    it('calls asyncDependencyFailed with an error when an ApplePaySession is not present', function () {
      var error, viewID;

      global.ApplePaySession = null;
      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');

      this.view.initialize();

      expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
      viewID = this.view.model.asyncDependencyFailed.getCall(0).args[0].view;
      error = this.view.model.asyncDependencyFailed.getCall(0).args[0].error;
      expect(viewID).to.equal(this.view.ID);
      expect(error).to.be.an.instanceof(DropinError);
      expect(error.message).to.equal('applePayBrowserNotSupported');
    });

    it('calls asyncDependencyFailed with an error when ApplePaySession.canMakePayments is false', function () {
      var error, viewID;

      global.ApplePaySession.canMakePayments = function () { return false; };
      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');

      this.view.initialize();

      expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
      viewID = this.view.model.asyncDependencyFailed.getCall(0).args[0].view;
      error = this.view.model.asyncDependencyFailed.getCall(0).args[0].error;
      expect(viewID).to.equal(this.view.ID);
      expect(error).to.be.an.instanceof(DropinError);
      expect(error.message).to.equal('applePayBrowserNotSupported');
    });

    it('creates an ApplePay component', function () {
      return this.view.initialize().then(function () {
        expect(btApplePay.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client
        }));
        expect(this.view.applePayInstance).to.equal(this.fakeApplePayInstance);
      }.bind(this));
    });

    it('calls asyncDependencyFailed when Apple Pay component creation fails', function () {
      var fakeError = new DropinError('A_FAKE_ERROR');

      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');
      btApplePay.create.rejects(fakeError);

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.view.model.asyncDependencyFailed).to.be.calledWith(this.sandbox.match({
          error: fakeError,
          view: 'applePay'
        }));
      }.bind(this));
    });

    it('calls canMakePaymentsWithActiveCard with merchantIdentifier when active payment view is changed to Apple Pay', function () {
      return this.view.initialize().then(function () {
        this.view.model.changeActivePaymentView(this.view.ID);

        expect(global.ApplePaySession.canMakePaymentsWithActiveCard).to.be.calledOnce;
        expect(global.ApplePaySession.canMakePaymentsWithActiveCard).to.be.calledWith(this.fakeApplePayInstance.merchantIdentifier);
      }.bind(this));
    });

    it('reports error when canMakePaymentsWithActiveCard returns false', function (done) {
      global.ApplePaySession.canMakePaymentsWithActiveCard = this.sandbox.stub().resolves(false);

      this.view.initialize().then(function () {
        this.view.model.reportError = function (err) {
          expect(err).to.equal('applePayActiveCardError');
          done();
        };
        this.view.model.changeActivePaymentView(this.view.ID);
      }.bind(this));
    });

    it('defaults the Apple Pay button style to black', function () {
      return this.view.initialize().then(function () {
        var button = document.querySelector('[data-braintree-id="apple-pay-button"]');

        expect(button.classList.contains('apple-pay-button-black')).to.be.true;
      });
    });

    it('allows the Apple Pay button style to be customized', function () {
      this.view.model.merchantConfiguration.applePay.buttonStyle = 'white';
      return this.view.initialize().then(function () {
        var button = document.querySelector('[data-braintree-id="apple-pay-button"]');

        expect(button.classList.contains('apple-pay-button-white')).to.be.true;
      });
    });

    it('sets up a button click handler', function () {
      return this.view.initialize().then(function () {
        var button = document.querySelector('[data-braintree-id="apple-pay-button"]');

        expect(typeof button.onclick).to.equal('function');
      });
    });

    describe('button click handler', function () {
      beforeEach(function () {
        var self = this;

        this.view = new ApplePayView(this.applePayViewOptions);

        return this.view.initialize().then(function () {
          var button = document.querySelector('[data-braintree-id="apple-pay-button"]');

          self.buttonClickHandler = button.onclick;
        });
      });

      it('creates an ApplePaySession with the payment request', function () {
        this.view.applePayInstance.createPaymentRequest = this.sandbox.stub().returns(this.fakePaymentRequest);

        this.buttonClickHandler();

        expect(this.view.applePayInstance.createPaymentRequest).to.be.calledWith(this.fakePaymentRequest);
        expect(global.ApplePaySession).to.be.calledWith(2, this.fakePaymentRequest);
      });

      it('begins the ApplePaySession', function () {
        this.view.applePayInstance.createPaymentRequest = this.sandbox.stub().returns(this.fakePaymentRequest);

        this.buttonClickHandler();

        expect(this.fakeApplePaySession.begin).to.be.calledOnce;
      });

      describe('session.onvalidatemerchant', function () {
        it('performs merchant validation', function () {
          var stubEvent = {validationURL: 'fake'};

          this.buttonClickHandler();
          this.fakeApplePaySession.onvalidatemerchant(stubEvent);

          expect(this.view.applePayInstance.performValidation).to.be.calledWith({
            validationURL: stubEvent.validationURL,
            displayName: 'Unit Test Display Name'
          });
        });

        it('completes merchant validation when validation succeeds', function (done) {
          var fakeValidationData = {};

          this.fakeApplePayInstance.performValidation.resolves(fakeValidationData);
          this.fakeApplePaySession.completeMerchantValidation = function (data) {
            expect(data).to.equal(fakeValidationData);
            done();
          };

          this.buttonClickHandler();
          this.fakeApplePaySession.onvalidatemerchant({validationURL: 'fake'});
        });

        it('aborts session and reports an error when validation fails', function (done) {
          var fakeError = new Error('fail.');

          this.sandbox.stub(this.view.model, 'reportError');
          this.fakeApplePayInstance.performValidation.rejects(fakeError);
          this.fakeApplePaySession.abort = function () {
            expect(this.view.model.reportError).to.be.calledWith(fakeError);
            done();
          }.bind(this);

          this.buttonClickHandler();
          this.fakeApplePaySession.onvalidatemerchant({validationURL: 'fake'});
        });
      });

      describe('session.onpaymentauthorized', function () {
        it('calls tokenize with the Apple Pay token', function () {
          var stubEvent = {
            payment: {token: 'foo'}
          };

          this.buttonClickHandler();
          this.fakeApplePaySession.onpaymentauthorized(stubEvent);

          expect(this.fakeApplePayInstance.tokenize).to.be.calledWith({token: 'foo'});
        });

        context('on tokenization success', function () {
          it('completes payment on ApplePaySession with status success', function (done) {
            this.fakeApplePayInstance.tokenize.resolves({foo: 'bar'});
            this.fakeApplePaySession.completePayment = function (status) {
              expect(status).to.equal(global.ApplePaySession.STATUS_SUCCESS);
              done();
            };

            this.buttonClickHandler();
            this.fakeApplePaySession.onpaymentauthorized({
              payment: {token: 'foo'}
            });
          });

          it('adds payment method to model', function (done) {
            this.fakeApplePayInstance.tokenize.resolves({
              nonce: 'fake-nonce',
              type: 'ApplePayCard'
            });
            this.view.model.addPaymentMethod = function (payload) {
              expect(payload.nonce).to.equal('fake-nonce');
              expect(payload.type).to.equal('ApplePayCard');
              expect(payload.payment.shippingContact).not.to.exist;
              expect(payload.payment.billingContact).not.to.exist;
              done();
            };

            this.buttonClickHandler();
            this.fakeApplePaySession.onpaymentauthorized({
              payment: {token: 'foo'}
            });
          });

          it('provides shipping and billing contact in payment method when present in ApplePayPayment', function (done) {
            var fakeShippingContact = {hey: 'now'};
            var fakeBillingContact = {you: 'are an all-star'};

            this.fakeApplePayInstance.tokenize.resolves({
              nonce: 'fake-nonce',
              type: 'ApplePayCard'
            });
            this.view.model.addPaymentMethod = function (payload) {
              expect(payload.payment.shippingContact).to.equal(fakeShippingContact);
              expect(payload.payment.billingContact).to.equal(fakeBillingContact);
              done();
            };

            this.buttonClickHandler();
            this.fakeApplePaySession.onpaymentauthorized({
              payment: {
                token: 'foo',
                shippingContact: fakeShippingContact,
                billingContact: fakeBillingContact
              }
            });
          });
        });

        context('on tokenization failure', function () {
          it('completes payment on ApplePaySession with status failure and reports the error', function (done) {
            var fakeError = new Error('fail.');

            this.sandbox.stub(this.view.model, 'reportError');
            this.fakeApplePayInstance.tokenize.rejects(fakeError);
            this.fakeApplePaySession.completePayment = function (status) {
              expect(this.view.model.reportError).to.be.calledOnce;
              expect(this.view.model.reportError).to.be.calledWith(fakeError);
              expect(status).to.equal(global.ApplePaySession.STATUS_FAILURE);
              done();
            }.bind(this);

            this.buttonClickHandler();
            this.fakeApplePaySession.onpaymentauthorized({
              payment: {token: 'foo'}
            });
          });
        });
      });
    });
  });
});
