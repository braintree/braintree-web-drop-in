'use strict';
/* eslint-disable no-new */

var BaseView = require('../../../../src/views/base-view');
var GooglePayView = require('../../../../src/views/payment-sheet-views/google-pay-view');
var btGooglePay = require('braintree-web/google-payment');
var DropinError = require('../../../../src/lib/dropin-error');
var analytics = require('../../../../src/lib/analytics');
var assets = require('@braintree/asset-loader');
var Promise = require('../../../../src/lib/promise');
var fake = require('../../../helpers/fake');
var fs = require('fs');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('GooglePayView', function () {
  beforeEach(function () {
    var googlePayButton = document.createElement('button');

    this.model = fake.model();
    this.fakeClient = fake.client();

    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);

    this.model.merchantConfiguration.googlePay = {
      merchantId: 'merchant-id',
      transactionInfo: {
        currencyCode: 'USD',
        totalPriceStatus: 'FINAL',
        totalPrice: '100.00'
      }
    };
    this.googlePayViewOptions = {
      client: this.fakeClient,
      element: document.body.querySelector('.braintree-sheet.braintree-googlePay'),
      model: this.model,
      strings: {}
    };

    this.fakeGooglePayInstance = {
      createPaymentDataRequest: this.sandbox.stub().returns({
        merchantId: 'merchant-id',
        transactionInfo: {
          currencyCode: 'USD',
          totalPriceStatus: 'FINAL',
          totalPrice: '100.00'
        },
        allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
      }),
      parseResponse: this.sandbox.stub().resolves({
        type: 'AndroidPayCard',
        nonce: 'google-pay-nonce'
      })
    };
    this.fakeLoadPaymentDataResponse = {
      cardInfo: {
        cardNetwork: 'VISA',
        cardDetails: '1111',
        cardDescription: 'Visa •••• 1111',
        cardClass: 'DEBIT'
      },
      paymentMethodToken: {
        tokenizationType: 'PAYMENT_GATEWAY',
        token: '{"androidPayCards":[{"type":"AndroidPayCard","nonce":"google-pay-nonce","description":"Android Pay","consumed":false,"details":{"cardType":"Visa","lastTwo":"11","lastFour":"1111"},"binData":{"prepaid":"No","healthcare":"Unknown","debit":"Unknown","durbinRegulated":"Unknown","commercial":"Unknown","payroll":"Unknown","issuingBank":"Unknown","countryOfIssuance":"","productId":"Unknown"}}]}'
      },
      email: 'foo@example.com'
    };
    this.sandbox.stub(btGooglePay, 'create').resolves(this.fakeGooglePayInstance);
    this.sandbox.stub(analytics, 'sendEvent');

    this.FakePaymentClient = function FakePayment() {};
    this.FakePaymentClient.prototype.isReadyToPay = this.sandbox.stub().resolves({result: true});
    this.FakePaymentClient.prototype.loadPaymentData = this.sandbox.stub().resolves(this.fakeLoadPaymentDataResponse);
    this.FakePaymentClient.prototype.prefetchPaymentData = this.sandbox.stub().resolves();
    this.FakePaymentClient.prototype.createButton = this.sandbox.stub().returns(googlePayButton);

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

    it('creates a GooglePayment component', function () {
      return this.view.initialize().then(function () {
        expect(btGooglePay.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client
        }));
        expect(this.view.googlePayInstance).to.equal(this.fakeGooglePayInstance);
      }.bind(this));
    });

    it('can configure GooglePayment component with googleApiVersion', function () {
      this.model.merchantConfiguration.googlePay.googlePayVersion = 2;

      return this.view.initialize().then(function () {
        expect(btGooglePay.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client,
          googlePayVersion: 2
        }));
        expect(this.view.googlePayInstance).to.equal(this.fakeGooglePayInstance);
      }.bind(this));
    });

    it('can configure GooglePayment component with googleMerchantId', function () {
      this.model.merchantConfiguration.googlePay.merchantId = 'foobar';

      return this.view.initialize().then(function () {
        expect(btGooglePay.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client,
          googleMerchantId: 'foobar'
        }));
        expect(this.view.googlePayInstance).to.equal(this.fakeGooglePayInstance);
      }.bind(this));
    });

    it('creates a Google payments client', function () {
      return this.view.initialize().then(function () {
        expect(this.view.paymentsClient).to.be.an.instanceof(this.FakePaymentClient);
      }.bind(this));
    });

    it('configures payemnts client with PRODUCTION environment in production', function () {
      var configuration = fake.configuration();

      configuration.gatewayConfiguration.environment = 'production';
      this.fakeClient.getConfiguration.returns(configuration);
      this.sandbox.spy(global.google.payments.api, 'PaymentsClient');

      return this.view.initialize().then(function () {
        expect(global.google.payments.api.PaymentsClient).to.be.calledWith({
          environment: 'PRODUCTION'
        });
      });
    });

    it('configures payemnts client with TEST environment in non-production', function () {
      var configuration = fake.configuration();

      configuration.gatewayConfiguration.environment = 'sandbox';
      this.fakeClient.getConfiguration.returns(configuration);
      this.sandbox.spy(global.google.payments.api, 'PaymentsClient');

      return this.view.initialize().then(function () {
        expect(global.google.payments.api.PaymentsClient).to.be.calledWith({
          environment: 'TEST'
        });
      });
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

    it('sets up button to tokenize Google Pay', function () {
      this.sandbox.stub(this.view, 'tokenize').resolves();

      return this.view.initialize().then(function () {
        var handler = this.FakePaymentClient.prototype.createButton.getCall(0).args[0].onClick;

        expect(this.FakePaymentClient.prototype.createButton).to.be.calledOnce;
        expect(this.FakePaymentClient.prototype.createButton).to.be.calledWith({
          buttonType: 'short',
          onClick: this.sandbox.match.func
        });

        handler({preventDefault: this.sandbox.stub()});

        expect(this.view.tokenize).to.be.calledOnce;
      }.bind(this));
    });

    it('can initialize buttons with custom settings', function () {
      this.model.merchantConfiguration.googlePay.button = {
        buttonType: 'long',
        buttonColor: 'white'
      };

      return this.view.initialize().then(function () {
        expect(this.FakePaymentClient.prototype.createButton).to.be.calledOnce;
        expect(this.FakePaymentClient.prototype.createButton).to.be.calledWith({
          buttonType: 'long',
          buttonColor: 'white',
          onClick: this.sandbox.match.func
        });
      }.bind(this));
    });

    it('cannot override onClick function for button', function () {
      this.model.merchantConfiguration.googlePay.button = {
        onClick: function () {
          throw new Error('Should never call this error');
        }
      };
      this.sandbox.stub(this.view, 'tokenize').resolves();

      return this.view.initialize().then(function () {
        var handler = this.FakePaymentClient.prototype.createButton.getCall(0).args[0].onClick;

        expect(this.FakePaymentClient.prototype.createButton).to.be.calledOnce;
        expect(this.FakePaymentClient.prototype.createButton).to.be.calledWith({
          buttonType: 'short',
          onClick: this.sandbox.match.func
        });

        expect(function () {
          handler({preventDefault: this.sandbox.stub()});
          expect(this.view.tokenize).to.be.calledOnce;
        }.bind(this)).to.not.throw();
      }.bind(this));
    });
  });

  describe('tokenize', function () {
    beforeEach(function () {
      this.view = new GooglePayView(this.googlePayViewOptions);
      this.sandbox.stub(this.view.model, 'addPaymentMethod');
      this.sandbox.stub(this.view.model, 'reportError');

      return this.view.initialize();
    });

    it('creates a paymentDataRequest from googlePayConfiguration', function () {
      return this.view.tokenize().then(function () {
        expect(this.fakeGooglePayInstance.createPaymentDataRequest).to.be.calledOnce;
        expect(this.fakeGooglePayInstance.createPaymentDataRequest).to.be.calledWith({
          transactionInfo: {
            currencyCode: 'USD',
            totalPriceStatus: 'FINAL',
            totalPrice: '100.00'
          }
        });
      }.bind(this));
    });

    it('calls loadPaymentData with paymentDataRequest', function () {
      return this.view.tokenize().then(function () {
        expect(this.FakePaymentClient.prototype.loadPaymentData).to.be.calledOnce;
        expect(this.FakePaymentClient.prototype.loadPaymentData).to.be.calledWith({
          merchantId: 'merchant-id',
          transactionInfo: {
            currencyCode: 'USD',
            totalPriceStatus: 'FINAL',
            totalPrice: '100.00'
          },
          allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
        });
      }.bind(this));
    });

    it('parses the response from loadPaymentData', function () {
      return this.view.tokenize().then(function () {
        expect(this.fakeGooglePayInstance.parseResponse).to.be.calledOnce;
        expect(this.fakeGooglePayInstance.parseResponse).to.be.calledWith(this.fakeLoadPaymentDataResponse);
      }.bind(this));
    });

    it('adds PaymentMethod to model', function () {
      return this.view.tokenize().then(function () {
        expect(this.view.model.addPaymentMethod).to.be.calledOnce;
        expect(this.view.model.addPaymentMethod).to.be.calledWith({
          type: 'AndroidPayCard',
          nonce: 'google-pay-nonce',
          rawPaymentData: this.fakeLoadPaymentDataResponse
        });
      }.bind(this));
    });

    it('reports error as developerError if error statusCode is DEVELOPER_ERROR', function () {
      var error = new Error('loadPaymentData error');

      this.sandbox.stub(console, 'error');
      error.statusCode = 'DEVELOPER_ERROR';
      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(this.view.model.reportError).to.be.calledOnce;
        expect(this.view.model.reportError).to.be.calledWith('developerError');
      }.bind(this));
    });

    it('prints detailed error on console if error statusCode is DEVELOPER_ERROR', function () {
      var error = new Error('loadPaymentData error');

      this.sandbox.stub(console, 'error');
      error.statusCode = 'DEVELOPER_ERROR';
      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(console.error).to.be.calledOnce; // eslint-disable-line no-console
        expect(console.error).to.be.calledWith(error); // eslint-disable-line no-console
      });
    });

    it('sends analytics when loadPaymentData call fails', function () {
      var error = new Error('loadPaymentData error');

      error.statusCode = 'CODE';
      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(analytics.sendEvent).to.be.calledOnce;
        expect(analytics.sendEvent).to.be.calledWith(this.fakeClient, 'googlepay.loadPaymentData.failed');
      }.bind(this));
    });

    it('does not report erorr if statusCode is CANCELLED', function () {
      var error = new Error('loadPaymentData error');

      error.statusCode = 'CANCELED';
      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(this.view.model.reportError).to.not.be.called;
      }.bind(this));
    });

    it('sends cancelled event for Google Pay cancelation', function () {
      var error = new Error('loadPaymentData error');

      error.statusCode = 'CANCELED';
      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(analytics.sendEvent).to.be.calledOnce;
        expect(analytics.sendEvent).to.be.calledWith(this.fakeClient, 'googlepay.loadPaymentData.canceled');
      }.bind(this));
    });

    it('does not send analytics event for developer error', function () {
      var error = new Error('loadPaymentData error');

      this.sandbox.stub(console, 'error');
      error.statusCode = 'DEVELOPER_ERROR';
      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(analytics.sendEvent).to.not.be.called;
      });
    });

    it('does not send analytics event for errors without a statusCode', function () {
      var error = new Error('error');

      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(analytics.sendEvent).to.not.be.called;
      });
    });

    it('reports error if loadPaymentData rejects', function () {
      var error = new Error('loadPaymentData error');

      this.FakePaymentClient.prototype.loadPaymentData.rejects(error);

      return this.view.tokenize().then(function () {
        expect(this.view.model.reportError).to.be.calledOnce;
        expect(this.view.model.reportError).to.be.calledWith(error);
      }.bind(this));
    });

    it('reports error if parseResponse rejects', function () {
      var error = new Error('parseResponse error');

      this.fakeGooglePayInstance.parseResponse.rejects(error);

      return this.view.tokenize().then(function () {
        expect(this.view.model.reportError).to.be.calledOnce;
        expect(this.view.model.reportError).to.be.calledWith(error);
      }.bind(this));
    });
  });

  describe('updateConfiguration', function () {
    beforeEach(function () {
      this.view = new GooglePayView(this.googlePayViewOptions);

      return this.view.initialize();
    });

    it('updates values in googlePayConfiguration', function () {
      var newTransactionInfo = {
        currencyCode: 'EU',
        totalPriceStatus: 'FINAL',
        totalPrice: '200.00'
      };

      expect(this.view.googlePayConfiguration.transactionInfo).to.deep.equal({
        currencyCode: 'USD',
        totalPriceStatus: 'FINAL',
        totalPrice: '100.00'
      });

      this.view.updateConfiguration('transactionInfo', newTransactionInfo);

      expect(this.view.googlePayConfiguration.transactionInfo).to.deep.equal(newTransactionInfo);
    });
  });

  describe('isEnabled', function () {
    beforeEach(function () {
      this.sandbox.stub(assets, 'loadScript').resolves();
      this.fakeOptions = {
        client: this.fakeClient,
        merchantConfiguration: this.model.merchantConfiguration
      };
    });

    it('resolves with false when gatewayConfiguration does not have android pay', function () {
      var configuration = fake.configuration();

      delete configuration.gatewayConfiguration.androidPay;

      this.fakeOptions.client.getConfiguration.returns(configuration);

      return GooglePayView.isEnabled(this.fakeOptions).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves with false when merhcantConfiguration does not specify Google Pay', function () {
      delete this.fakeOptions.merchantConfiguration.googlePay;

      return GooglePayView.isEnabled(this.fakeOptions).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('loads Google Payment script file when google global does not exist', function () {
      var storedFakeGoogle = global.google;

      delete global.google;

      assets.loadScript.callsFake(function () {
        global.google = storedFakeGoogle;

        return Promise.resolve();
      });

      return GooglePayView.isEnabled(this.fakeOptions).then(function () {
        expect(assets.loadScript).to.be.calledOnce;
        expect(assets.loadScript).to.be.calledWith({
          crossorigin: 'anonymous',
          id: 'braintree-dropin-google-payment-script',
          src: 'https://pay.google.com/gp/p/js/pay.js'
        });
      });
    });

    it('loads Google Payment script file when the payment client on google global does not exist', function () {
      var storedFakeGoogle = global.google;

      delete global.google;
      global.google = {
        payments: {
          api: {}
        }
      };

      assets.loadScript.callsFake(function () {
        global.google = storedFakeGoogle;

        return Promise.resolve();
      });

      return GooglePayView.isEnabled(this.fakeOptions).then(function () {
        expect(assets.loadScript).to.be.calledOnce;
        expect(assets.loadScript).to.be.calledWith({
          crossorigin: 'anonymous',
          id: 'braintree-dropin-google-payment-script',
          src: 'https://pay.google.com/gp/p/js/pay.js'
        });
      });
    });

    it('does not load Google Payment script file if global google pay object already exists', function () {
      return GooglePayView.isEnabled(this.fakeOptions).then(function () {
        expect(assets.loadScript).to.not.be.called;
      });
    });

    it('calls isReadyToPay to check device compatibility', function () {
      return GooglePayView.isEnabled(this.fakeOptions).then(function () {
        expect(this.FakePaymentClient.prototype.isReadyToPay).to.be.calledOnce;
        expect(this.FakePaymentClient.prototype.isReadyToPay).to.be.calledWith({
          allowedPaymentMethods: ['CARD', 'TOKENIZED_CARD']
        });
      }.bind(this));
    });

    it('resolves with false when isReadyToPay is not successful', function () {
      this.FakePaymentClient.prototype.isReadyToPay.resolves({result: false});

      return GooglePayView.isEnabled(this.fakeOptions).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves with true when isReadyToPay is successful', function () {
      this.FakePaymentClient.prototype.isReadyToPay.resolves({result: true});

      return GooglePayView.isEnabled(this.fakeOptions).then(function (result) {
        expect(result).to.equal(true);
      });
    });
  });
});
