'use strict';
/* eslint-disable no-new */

var BaseView = require('../../../../src/views/base-view');
var GooglePayView = require('../../../../src/views/payment-sheet-views/google-pay-view');
var btGooglePay = require('braintree-web/google-payment');
var DropinModel = require('../../../../src/dropin-model');
var DropinError = require('../../../../src/lib/dropin-error');
var assets = require('../../../../src/lib/assets');
var fake = require('../../../helpers/fake');
var fs = require('fs');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('GooglePayView', function () {
  beforeEach(function () {
    var model = new DropinModel(fake.modelOptions());
    var fakeClient = {
      getConfiguration: this.sandbox.stub().returns(fake.configuration()),
      getVersion: function () {}
    };

    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);

    model.merchantConfiguration.googlePay = {
      paymentRequest: this.fakePaymentRequest,
      displayName: 'Unit Test Display Name'
    };
    this.googlePayViewOptions = {
      client: fakeClient,
      element: document.body.querySelector('.braintree-sheet.braintree-googlePay'),
      model: model,
      strings: {}
    };

    this.fakeGooglePayInstance = {
      createPaymentDataRequest: this.sandbox.stub().returns({
        allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
      }),
      parseResponse: this.sandbox.stub().resolves({
        type: 'AndroidPayCard',
        nonce: 'google-pay-nonce'
      })
    };
    this.sandbox.stub(btGooglePay, 'create').resolves(this.fakeGooglePayInstance);
    this.sandbox.stub(assets, 'loadScript').resolves();

    this.FakePaymentClient = function FakePayment() {};
    this.FakePaymentClient.prototype.isReadyToPay = this.sandbox.stub().resolves({result: true});
    this.FakePaymentClient.prototype.loadPaymentData = this.sandbox.stub().resolves({});
    this.FakePaymentClient.prototype.prefetchPaymentData = this.sandbox.stub().resolves();

    global.google = {
      payments: {
        api: {
          PaymentsClient: this.FakePaymentClient
        }
      }
    };
  });

  afterEach(function () {
    document.body.removeChild(this.div);
    delete global.google;
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new GooglePayView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.view = new GooglePayView(this.googlePayViewOptions);
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

    it('loads Google Payment script file when google global does not exist', function () {
      delete global.google;

      return this.view.initialize().then(function () {
        expect(assets.loadScript).to.be.calledOnce;
        expect(assets.loadScript).to.be.calledWith(this.view.element, {
          id: 'braintree-dropin-google-payment-script',
          src: 'https://payments.developers.google.com/js/apis/pay.js'
        });
      }.bind(this));
    });

    it('does not load Google Payment script file if global google pay object already exists', function () {
      return this.view.initialize().then(function () {
        expect(assets.loadScript).to.not.be.called;
      });
    });

    it('creates a GooglePay component', function () {
      return this.view.initialize().then(function () {
        expect(btGooglePay.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client
        }));
        expect(this.view.googlePayInstance).to.equal(this.fakeGooglePayInstance);
      }.bind(this));
    });

    it('calls isReadyToPay to check device compatibility', function () {
      return this.view.initialize().then(function () {
        expect(this.FakePaymentClient.prototype.isReadyToPay).to.be.calledOnce;
        expect(this.FakePaymentClient.prototype.isReadyToPay).to.be.calledWith({
          allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
        });
      }.bind(this));
    });

    it('calls asyncDependencyFailed when Google Pay component creation fails', function () {
      var fakeError = new DropinError('A_FAKE_ERROR');

      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');
      btGooglePay.create.rejects(fakeError);

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.view.model.asyncDependencyFailed).to.be.calledWith(this.sandbox.match({
          error: fakeError,
          view: 'googlePay'
        }));
      }.bind(this));
    });
  });
});
