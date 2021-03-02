
/* eslint-disable no-new */

const BaseView = require('../../../../src/views/base-view');
const ApplePayView = require('../../../../src/views/payment-sheet-views/apple-pay-view');
const btApplePay = require('braintree-web/apple-pay');
const isHTTPS = require('../../../../src/lib/is-https');
const fake = require('../../../helpers/fake');
const fs = require('fs');

const mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('ApplePayView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.model = fake.model();

    return testContext.model.initialize().then(() => {
      testContext.fakeClient = fake.client();

      testContext.div = document.createElement('div');

      testContext.fakeApplePaySession = {
        begin: jest.fn(),
        completeMerchantValidation: jest.fn(),
        completePayment: jest.fn()
      };

      global.ApplePaySession = jest.fn().mockReturnValue(testContext.fakeApplePaySession);
      global.ApplePaySession.canMakePayments = jest.fn().mockReturnValue(true);
      global.ApplePaySession.supportsVersion = jest.fn().mockReturnValue(true);
      global.ApplePaySession.STATUS_FAILURE = 'failure';
      global.ApplePaySession.STATUS_SUCCESS = 'success';
      testContext.div.innerHTML = mainHTML;
      document.body.appendChild(testContext.div);

      testContext.fakePaymentRequest = {
        countryCode: 'defined',
        currencyCode: 'defined',
        merchantCapabilities: ['defined'],
        supportedNetworks: ['defined']
      };
      testContext.model.merchantConfiguration.applePay = {
        paymentRequest: testContext.fakePaymentRequest,
        displayName: 'Unit Test Display Name'
      };
      testContext.applePayViewOptions = {
        client: testContext.fakeClient,
        element: document.body.querySelector('.braintree-sheet.braintree-applePay'),
        model: testContext.model,
        strings: {}
      };

      testContext.fakeApplePayInstance = {
        createPaymentRequest: jest.fn().mockReturnValue({}),
        performValidation: jest.fn().mockResolvedValue(),
        tokenize: jest.fn().mockResolvedValue()
      };
      jest.spyOn(btApplePay, 'create').mockResolvedValue(testContext.fakeApplePayInstance);
    });
  });

  afterEach(() => {
    document.body.removeChild(testContext.div);
  });

  describe('Constructor', () => {
    test('inherits from BaseView', () => {
      expect(new ApplePayView()).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      testContext.view = new ApplePayView(testContext.applePayViewOptions);
    });

    test('notifies async dependency', () => {
      jest.spyOn(testContext.view.model, 'asyncDependencyReady').mockImplementation();

      return testContext.view.initialize().then(() => {
        expect(testContext.view.model.asyncDependencyReady).toBeCalledTimes(1);
        expect(testContext.view.model.asyncDependencyReady).toBeCalledWith('applePay');
      });
    });

    test('creates an ApplePay component', () => {
      return testContext.view.initialize().then(() => {
        expect(btApplePay.create).toBeCalledWith(expect.objectContaining({
          client: testContext.view.client
        }));
        expect(testContext.view.applePayInstance).toBe(testContext.fakeApplePayInstance);
      });
    });

    test('defaults Apple Pay session to 2', () => {
      return testContext.view.initialize().then(() => {
        expect(testContext.view.applePaySessionVersion).toBe(2);
      });
    });

    test('can set Apple Pay session', () => {
      testContext.model.merchantConfiguration.applePay.applePaySessionVersion = 5;

      return testContext.view.initialize().then(() => {
        expect(testContext.view.applePaySessionVersion).toBe(5);
      });
    });

    test(
      'calls asyncDependencyFailed when Apple Pay component creation fails',
      () => {
        const fakeError = new Error('A_FAKE_ERROR');

        jest.spyOn(testContext.view.model, 'asyncDependencyFailed').mockImplementation();
        btApplePay.create.mockRejectedValue(fakeError);

        return testContext.view.initialize().then(() => {
          const error = testContext.view.model.asyncDependencyFailed.mock.calls[0][0].error;

          expect(testContext.view.model.asyncDependencyFailed).toBeCalledTimes(1);
          expect(testContext.view.model.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
            view: 'applePay'
          }));

          expect(error.message).toBe(fakeError.message);
        });
      }
    );

    test('defaults the Apple Pay button style to black', () => {
      return testContext.view.initialize().then(() => {
        const button = document.querySelector('[data-braintree-id="apple-pay-button"]');

        expect(button.style['-apple-pay-button-style']).toBe('black');
      });
    });

    test('allows the Apple Pay button style to be customized', () => {
      testContext.view.model.merchantConfiguration.applePay.buttonStyle = 'white';

      return testContext.view.initialize().then(() => {
        const button = document.querySelector('[data-braintree-id="apple-pay-button"]');

        expect(button.style['-apple-pay-button-style']).toBe('white');
      });
    });

    test('sets up a button click handler', () => {
      return testContext.view.initialize().then(() => {
        const button = document.querySelector('[data-braintree-id="apple-pay-button"]');

        expect(typeof button.onclick).toBe('function');
      });
    });

    describe('button click handler', () => {
      beforeEach(() => {
        testContext.view = new ApplePayView(testContext.applePayViewOptions);

        return testContext.view.initialize().then(() => {
          const button = document.querySelector('[data-braintree-id="apple-pay-button"]');

          testContext.buttonClickHandler = button.onclick;
        });
      });

      test('creates an ApplePaySession with the payment request', () => {
        testContext.view.applePayInstance.createPaymentRequest = jest.fn().mockReturnValue(testContext.fakePaymentRequest);

        testContext.buttonClickHandler();

        expect(testContext.view.applePayInstance.createPaymentRequest).toBeCalledWith(testContext.fakePaymentRequest);
        expect(global.ApplePaySession).toBeCalledWith(2, testContext.fakePaymentRequest);
      });

      test('can set which version of ApplePaySession to use', () => {
        testContext.view.applePaySessionVersion = 3;
        testContext.view.applePayInstance.createPaymentRequest = jest.fn().mockReturnValue(testContext.fakePaymentRequest);

        testContext.buttonClickHandler();

        expect(testContext.view.applePayInstance.createPaymentRequest).toBeCalledWith(testContext.fakePaymentRequest);
        expect(global.ApplePaySession).toBeCalledWith(3, testContext.fakePaymentRequest);
      });

      test('begins the ApplePaySession', () => {
        testContext.view.applePayInstance.createPaymentRequest = jest.fn().mockReturnValue(testContext.fakePaymentRequest);

        testContext.buttonClickHandler();

        expect(testContext.fakeApplePaySession.begin).toBeCalledTimes(1);
      });

      describe('session.onvalidatemerchant', () => {
        test('performs merchant validation', () => {
          const stubEvent = { validationURL: 'fake' };

          testContext.buttonClickHandler();
          testContext.fakeApplePaySession.onvalidatemerchant(stubEvent);

          expect(testContext.view.applePayInstance.performValidation).toBeCalledWith({
            validationURL: stubEvent.validationURL,
            displayName: 'Unit Test Display Name'
          });
        });

        test(
          'completes merchant validation when validation succeeds',
          done => {
            const fakeValidationData = {};

            testContext.fakeApplePayInstance.performValidation.mockResolvedValue(fakeValidationData);
            testContext.fakeApplePaySession.completeMerchantValidation = data => {
              expect(data).toBe(fakeValidationData);
              done();
            };

            testContext.buttonClickHandler();
            testContext.fakeApplePaySession.onvalidatemerchant({ validationURL: 'fake' });
          }
        );

        test(
          'aborts session and reports an error when validation fails',
          done => {
            const fakeError = new Error('fail.');

            jest.spyOn(testContext.view.model, 'reportError').mockImplementation();
            testContext.fakeApplePayInstance.performValidation.mockRejectedValue(fakeError);
            testContext.fakeApplePaySession.abort = () => {
              expect(testContext.view.model.reportError).toBeCalledWith(fakeError);
              done();
            };

            testContext.buttonClickHandler();
            testContext.fakeApplePaySession.onvalidatemerchant({ validationURL: 'fake' });
          }
        );
      });

      describe('session.onpaymentauthorized', () => {
        test('calls tokenize with the Apple Pay token', () => {
          const stubEvent = {
            payment: { token: 'foo' }
          };

          testContext.buttonClickHandler();
          testContext.fakeApplePaySession.onpaymentauthorized(stubEvent);

          expect(testContext.fakeApplePayInstance.tokenize).toBeCalledWith({ token: 'foo' });
        });

        describe('on tokenization success', () => {
          test(
            'completes payment on ApplePaySession with status success',
            done => {
              testContext.fakeApplePayInstance.tokenize.mockResolvedValue({ foo: 'bar' });
              testContext.fakeApplePaySession.completePayment = status => {
                expect(status).toBe(global.ApplePaySession.STATUS_SUCCESS);

                setTimeout(() => {
                  done();
                }, 200);
              };

              testContext.buttonClickHandler();
              testContext.fakeApplePaySession.onpaymentauthorized({
                payment: { token: 'foo' }
              });
            }
          );

          test('adds payment method to model', done => {
            testContext.fakeApplePayInstance.tokenize.mockResolvedValue({
              nonce: 'fake-nonce',
              type: 'ApplePayCard'
            });
            testContext.view.model.addPaymentMethod = payload => {
              expect(payload.nonce).toBe('fake-nonce');
              expect(payload.type).toBe('ApplePayCard');
              expect(payload.rawPaymentData.shippingContact).not.toBeDefined();
              expect(payload.rawPaymentData.billingContact).not.toBeDefined();
              done();
            };

            testContext.buttonClickHandler();
            testContext.fakeApplePaySession.onpaymentauthorized({
              payment: { token: 'foo' }
            });
          });

          test(
            'provides shipping and billing contact in payment method when present in ApplePayPayment',
            done => {
              const fakeShippingContact = { hey: 'now' };
              const fakeBillingContact = { you: 'are an all-star' };

              testContext.fakeApplePayInstance.tokenize.mockResolvedValue({
                nonce: 'fake-nonce',
                type: 'ApplePayCard'
              });
              testContext.view.model.addPaymentMethod = payload => {
                expect(payload.rawPaymentData.shippingContact).toBe(fakeShippingContact);
                expect(payload.rawPaymentData.billingContact).toBe(fakeBillingContact);
                done();
              };

              testContext.buttonClickHandler();
              testContext.fakeApplePaySession.onpaymentauthorized({
                payment: {
                  token: 'foo',
                  shippingContact: fakeShippingContact,
                  billingContact: fakeBillingContact
                }
              });
            }
          );
        });

        describe('on tokenization failure', () => {
          test(
            'completes payment on ApplePaySession with status failure and reports the error',
            done => {
              const fakeError = new Error('fail.');

              jest.spyOn(testContext.view.model, 'reportError').mockImplementation();
              testContext.fakeApplePayInstance.tokenize.mockRejectedValue(fakeError);
              testContext.fakeApplePaySession.completePayment = status => {
                expect(testContext.view.model.reportError).toBeCalledTimes(1);
                expect(testContext.view.model.reportError).toBeCalledWith(fakeError);
                expect(status).toBe(global.ApplePaySession.STATUS_FAILURE);
                done();
              };

              testContext.buttonClickHandler();
              testContext.fakeApplePaySession.onpaymentauthorized({
                payment: { token: 'foo' }
              });
            }
          );
        });
      });
    });
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.options = {
        client: testContext.fakeClient,
        merchantConfiguration: testContext.model.merchantConfiguration
      };
      jest.spyOn(isHTTPS, 'isHTTPS').mockReturnValue(true);
    });

    test(
      'resolves with false when Apple Pay is not enabled on the gateway',
      () => {
        const configuration = fake.configuration();

        delete configuration.gatewayConfiguration.applePayWeb;

        testContext.fakeClient.getConfiguration.mockReturnValue(configuration);

        return ApplePayView.isEnabled(testContext.options).then(result => {
          expect(result).toBe(false);
        });
      }
    );

    test(
      'resolves with false when Apple Pay is not enabled by merchant',
      () => {
        delete testContext.options.merchantConfiguration.applePay;

        return ApplePayView.isEnabled(testContext.options).then(result => {
          expect(result).toBe(false);
        });
      }
    );

    test('resolves with false when Apple Pay Session does not exist', () => {
      delete global.ApplePaySession;

      return ApplePayView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves with false when not https', () => {
      isHTTPS.isHTTPS.mockReturnValue(false);

      return ApplePayView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves with false when device cannot make payments', () => {
      global.ApplePaySession.canMakePayments.mockReturnValue(false);

      return ApplePayView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test(
      'resolves with false when device does not support the version of the apple pay session',
      () => {
        global.ApplePaySession.supportsVersion.mockReturnValue(false);

        return ApplePayView.isEnabled(testContext.options).then(result => {
          expect(result).toBe(false);
        });
      }
    );

    test('defaults ApplePaySession version to 2', () => {
      return ApplePayView.isEnabled(testContext.options).then(() => {
        expect(global.ApplePaySession.supportsVersion).toBeCalledTimes(1);
        expect(global.ApplePaySession.supportsVersion).toBeCalledWith(2);
      });
    });

    test('can set ApplePaySession version', () => {
      testContext.options.merchantConfiguration.applePay.applePaySessionVersion = 3;

      return ApplePayView.isEnabled(testContext.options).then(() => {
        expect(global.ApplePaySession.supportsVersion).toBeCalledTimes(1);
        expect(global.ApplePaySession.supportsVersion).toBeCalledWith(3);
      });
    });

    test('resolves with true when everything is setup for Apple Pay', () => {
      return ApplePayView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(true);
      });
    });
  });
});
