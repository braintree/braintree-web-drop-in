
/* eslint-disable no-new */

const analytics = require('../../../../src/lib/analytics');
const browserDetection = require('../../../../src/lib/browser-detection');
const BaseView = require('../../../../src/views/base-view');
const DropinModel = require('../../../../src/dropin-model');
const DropinError = require('../../../../src/lib/dropin-error');
const Promise = require('../../../../src/lib/promise');
const assets = require('@braintree/asset-loader');
const fake = require('../../../helpers/fake');
const fs = require('fs');
const PayPalCheckout = require('braintree-web/paypal-checkout');
const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');

const mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('BasePayPalView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.paypal = {
      Button: {
        render: jest.fn().mockResolvedValue()
      },
      setup: jest.fn(),
      FUNDING: {
        FOO: 'foo',
        VENMO: 'venmo',
        PAYPAL: 'paypal',
        CREDIT: 'credit'
      }
    };
    jest.spyOn(analytics, 'sendEvent').mockImplementation();

    global.paypal = testContext.paypal;

    testContext.model = fake.model();

    testContext.div = document.createElement('div');
    testContext.div.innerHTML = mainHTML;
    document.body.appendChild(testContext.div);
    testContext.element = document.body.querySelector('.braintree-sheet.braintree-paypal');

    testContext.model.supportedPaymentOptions = ['card', 'paypal'];
    testContext.model.merchantConfiguration.paypal = { flow: 'vault' };
    jest.spyOn(testContext.model, 'reportError').mockImplementation();

    testContext.configuration = fake.configuration();
    testContext.fakeClient = fake.client(testContext.configuration);
    testContext.paypalViewOptions = {
      strings: {},
      element: testContext.element,
      model: testContext.model,
      client: testContext.fakeClient
    };
    testContext.paypalInstance = {
      createPayment: jest.fn().mockResolvedValue(),
      tokenizePayment: jest.fn().mockResolvedValue()
    };
    jest.spyOn(PayPalCheckout, 'create').mockResolvedValue(testContext.paypalInstance);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    test('inherits from BaseView', () => {
      expect(new BasePayPalView()).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      testContext.view = new BasePayPalView(testContext.paypalViewOptions);
    });

    test('notifies async dependency ready for paypal', () => {
      jest.spyOn(testContext.view.model, 'asyncDependencyReady').mockImplementation();

      return testContext.view.initialize().then(() => {
        expect(testContext.view.model.asyncDependencyReady).toBeCalledTimes(1);
        expect(testContext.view.model.asyncDependencyReady).toBeCalledWith('paypal');
      });
    });

    test('notifies async dependency ready for paypalCredit', () => {
      jest.spyOn(testContext.view.model, 'asyncDependencyReady').mockImplementation();

      testContext.view.model.merchantConfiguration.paypalCredit = testContext.view.model.merchantConfiguration.paypal;
      testContext.view._isPayPalCredit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.view.model.asyncDependencyReady).toBeCalledTimes(1);
        expect(testContext.view.model.asyncDependencyReady).toBeCalledWith('paypalCredit');
      });
    });

    test('clones the PayPal config', () => {
      return testContext.view.initialize().then(() => {
        expect(testContext.view.paypalConfiguration.flow).toBe(testContext.model.merchantConfiguration.paypal.flow);
        expect(testContext.view.paypalConfiguration).not.toBe(testContext.model.merchantConfiguration.paypal);
      });
    });

    test('creates a PayPal Checkout component', () => {
      return testContext.view.initialize().then(() => {
        expect(PayPalCheckout.create).toBeCalledWith(expect.objectContaining({
          client: testContext.paypalViewOptions.client
        }));
        expect(testContext.view.paypalInstance).toBe(testContext.paypalInstance);
      });
    });

    test(
      'calls asyncDependencyFailed with an error when PayPal component creation fails',
      () => {
        const fakeError = {
          code: 'A_REAL_ERROR_CODE'
        };

        jest.spyOn(testContext.view.model, 'asyncDependencyFailed').mockImplementation();
        PayPalCheckout.create.mockRejectedValue(fakeError);

        testContext.view.ID = 'fake-id';

        return testContext.view.initialize().then(() => {
          expect(testContext.view.model.asyncDependencyFailed).toBeCalledTimes(1);
          expect(testContext.view.model.asyncDependencyFailed).toBeCalledWith({
            view: 'fake-id',
            error: fakeError
          });
        });
      }
    );

    test('calls paypal.Button.render', () => {
      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledTimes(1);
        expect(testContext.paypal.Button.render).toBeCalledWith(
          expect.any(Object),
          expect.stringMatching(/#braintree--dropin__.*\[data-braintree-id="paypal-button"\]/)
        );
      });
    });

    test('can style the PayPal button', () => {
      testContext.view.model.merchantConfiguration.paypal.buttonStyle = {
        size: 'medium',
        color: 'orange',
        shape: 'rect'
      };

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          style: {
            size: 'medium',
            color: 'orange',
            shape: 'rect'
          }
        }), expect.any(String));
      });
    });

    test('can style the PayPal Credit button', () => {
      testContext.view.model.merchantConfiguration.paypalCredit = testContext.view.model.merchantConfiguration.paypal;
      testContext.view.model.merchantConfiguration.paypalCredit.buttonStyle = {
        size: 'medium',
        color: 'orange',
        shape: 'rect'
      };
      testContext.view._isPayPalCredit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          style: {
            size: 'medium',
            color: 'orange',
            shape: 'rect',
            label: 'credit'
          }
        }), expect.any(String));
      });
    });

    test('cannot style label for PayPal Credit', () => {
      testContext.view.model.merchantConfiguration.paypalCredit = testContext.view.model.merchantConfiguration.paypal;
      testContext.view.model.merchantConfiguration.paypalCredit.buttonStyle = {
        label: 'buynow'
      };
      testContext.view._isPayPalCredit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          style: {
            label: 'credit'
          }
        }), expect.any(String));
      });
    });

    test('dissallows all non-paypal payment methods', () => {
      testContext.view.model.merchantConfiguration.paypal = testContext.view.model.merchantConfiguration.paypal;
      testContext.view._isPayPalCredit = false;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          funding: {
            disallowed: [
              'foo',
              'venmo',
              'credit'
            ]
          }
        }), expect.any(String));
      });
    });

    test('dissallows all funcing but credit for paypal credit', () => {
      testContext.view.model.merchantConfiguration.paypalCredit = testContext.view.model.merchantConfiguration.paypal;
      testContext.view._isPayPalCredit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          funding: {
            disallowed: [
              'foo',
              'venmo'
            ]
          }
        }), expect.any(String));
      });
    });

    test('can set user action to commit for the PayPal button', () => {
      testContext.view.model.merchantConfiguration.paypal.commit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          commit: true
        }), expect.any(String));
      });
    });

    test('can set user action to continue for the PayPal button', () => {
      testContext.view.model.merchantConfiguration.paypal.commit = false;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          commit: false
        }), expect.any(String));
      });
    });

    test(
      'sets paypal-checkout.js environment to production when gatewayConfiguration is production',
      () => {
        testContext.configuration.gatewayConfiguration.environment = 'production';

        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
            env: 'production'
          }), expect.any(String));
        });
      }
    );

    test(
      'sets paypal-checkout.js environment to sandbox when gatewayConfiguration is not production',
      () => {
        testContext.configuration.gatewayConfiguration.environment = 'development';

        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
            env: 'sandbox'
          }), expect.any(String));
        });
      }
    );

    test(
      'calls paypalInstance.createPayment with a locale if one is provided',
      () => {
        const localeCode = 'fr_FR';
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;

        model.merchantConfiguration.locale = localeCode;

        testContext.paypal.Button.render.mockResolvedValue();

        return testContext.view.initialize().then(() => {
          const paymentFunction = testContext.paypal.Button.render.mock.calls[0][0].payment;

          return paymentFunction().then(() => {
            expect(paypalInstance.createPayment).toBeCalledTimes(1);
            expect(paypalInstance.createPayment).toBeCalledWith(expect.objectContaining({
              locale: 'fr_FR'
            }));
          });
        });
      }
    );

    test(
      'calls paypal.Button.render with a locale if one is provided',
      () => {
        const localeCode = 'fr_FR';
        const model = testContext.model;
        const view = testContext.view;

        model.merchantConfiguration.locale = localeCode;

        return view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
            locale: 'fr_FR'
          }), expect.any(String));
        });
      }
    );

    test(
      'docs not call paypalInstance.createPayment with locale when an invalid locale is provided',
      () => {
        const invalidLocaleCode = 'en_FOO';
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;

        model.merchantConfiguration.locale = invalidLocaleCode;

        testContext.paypal.Button.render.mockResolvedValue();

        return testContext.view.initialize().then(() => {
          const paymentFunction = testContext.paypal.Button.render.mock.calls[0][0].payment;

          return paymentFunction().then(() => {
            expect(paypalInstance.createPayment).toBeCalledTimes(1);
            expect(paypalInstance.createPayment).not.toBeCalledWith(expect.objectContaining({
              locale: invalidLocaleCode
            }));
          });
        });
      }
    );

    test(
      'does not call paypal.Button.render with locale when an invalid locale is provided',
      () => {
        const invalidLocaleCode = 'en_FOO';
        const model = testContext.model;
        const view = testContext.view;

        model.merchantConfiguration.locale = invalidLocaleCode;

        return view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledTimes(1);
          expect(testContext.paypal.Button.render).not.toBeCalledWith(expect.objectContaining({
            locale: invalidLocaleCode
          }));
        });
      }
    );

    test(
      'docs not call paypalInstance.createPayment with locale when 2 character locale is provided',
      () => {
        const invalidLocaleCode = 'fr';
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;

        model.merchantConfiguration.locale = invalidLocaleCode;

        testContext.paypal.Button.render.mockResolvedValue();

        return testContext.view.initialize().then(() => {
          const paymentFunction = testContext.paypal.Button.render.mock.calls[0][0].payment;

          return paymentFunction().then(() => {
            expect(paypalInstance.createPayment).toBeCalledTimes(1);
            expect(paypalInstance.createPayment).not.toBeCalledWith(expect.objectContaining({
              locale: invalidLocaleCode
            }));
          });
        });
      }
    );

    test(
      'does not call paypal.Button.render with locale when 2 character locale is provided',
      () => {
        const invalidLocaleCode = 'fr';
        const model = testContext.model;
        const view = testContext.view;

        model.merchantConfiguration.locale = invalidLocaleCode;

        return view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledTimes(1);
          expect(testContext.paypal.Button.render).not.toBeCalledWith(expect.objectContaining({
            locale: invalidLocaleCode
          }));
        });
      }
    );

    test('reports errors from createPayment', () => {
      const model = testContext.model;
      const error = new Error('create payment error');

      testContext.paypalInstance.createPayment.mockRejectedValue(error);

      testContext.paypal.Button.render.mockResolvedValue();

      return testContext.view.initialize().then(() => {
        const paymentFunction = testContext.paypal.Button.render.mock.calls[0][0].payment;

        return paymentFunction().then(() => {
          expect(model.reportError).toBeCalledTimes(1);
          expect(model.reportError).toBeCalledWith(error);
        });
      });
    });

    test('reports errors from paypal.Button.render', () => {
      const error = new Error('setup error');

      jest.spyOn(testContext.model, 'asyncDependencyFailed').mockImplementation();
      testContext.paypal.Button.render.mockRejectedValue(error);

      return testContext.view.initialize().then(() => {
        expect(testContext.model.asyncDependencyFailed).toBeCalledTimes(1);
        expect(testContext.model.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
          view: testContext.view.ID,
          error: error
        }));
      });
    });

    test('calls addPaymentMethod when paypal is tokenized', done => {
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;
      const fakePayload = {
        foo: 'bar'
      };

      paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
      jest.spyOn(model, 'addPaymentMethod').mockImplementation();

      testContext.paypal.Button.render.mockResolvedValue();

      testContext.view.initialize().then(() => {
        const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
        const tokenizeOptions = {
          foo: 'bar'
        };

        onAuthFunction(tokenizeOptions);

        expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
        expect(paypalInstance.tokenizePayment).toBeCalledWith(tokenizeOptions);

        setTimeout(() => {
          expect(model.addPaymentMethod).toBeCalledTimes(1);
          expect(model.addPaymentMethod).toBeCalledWith(fakePayload);

          done();
        }, 1);
      });
    });

    test(
      'adds `vaulted: true` to the tokenization payload if flow is vault and is not guest checkout',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar',
          vaulted: true
        };

        model.isGuestCheckout = false;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = { flow: 'vault' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
          const tokenizeOptions = {
            foo: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith(tokenizeOptions);

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith(fakePayload);

            done();
          }, 1);
        });
      }
    );

    test(
      'does not add `vaulted: true` to the tokenization payload if flow is vault but is guest checkout',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.isGuestCheckout = true;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = { flow: 'vault' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
          const tokenizeOptions = {
            foo: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith(tokenizeOptions);

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith(fakePayload);

            done();
          }, 100);
        });
      }
    );

    test(
      'does not add `vaulted: true` to the tokenization payload if flow is checkout and is not guest checkout',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.isGuestCheckout = false;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = { flow: 'checkout' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
          const tokenizeOptions = {
            foo: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith(tokenizeOptions);

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith(fakePayload);

            done();
          }, 100);
        });
      }
    );

    test('reports errors from tokenizePayment', done => {
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;
      const error = new Error('tokenize error');

      paypalInstance.tokenizePayment.mockRejectedValue(error);
      jest.spyOn(model, 'addPaymentMethod').mockImplementation();

      testContext.paypal.Button.render.mockResolvedValue();

      testContext.view.initialize().then(() => {
        const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
        const tokenizeOptions = {
          foo: 'bar'
        };

        onAuthFunction(tokenizeOptions);

        setTimeout(() => {
          expect(model.reportError).toBeCalledTimes(1);
          expect(model.reportError).toBeCalledWith(error);

          done();
        }, 100);
      });
    });

    test('reports errors from paypal-checkout', () => {
      const model = testContext.model;

      testContext.paypal.Button.render.mockResolvedValue();

      return testContext.view.initialize().then(() => {
        const onErrorFunction = testContext.paypal.Button.render.mock.calls[0][0].onError;
        const err = new Error('Some error');

        onErrorFunction(err);

        expect(model.reportError).toBeCalledTimes(1);
        expect(model.reportError).toBeCalledWith(err);
      });
    });

    test(
      'marks dependency as failed if error occurs before setup completes',
      done => {
        const model = testContext.model;

        jest.spyOn(model, 'asyncDependencyFailed').mockImplementation();
        testContext.paypal.Button.render.mockReturnValue({
          then: jest.fn()
        });

        testContext.view.initialize();

        setTimeout(() => {
          const onErrorFunction = testContext.paypal.Button.render.mock.calls[0][0].onError;
          const err = new Error('Some error');

          onErrorFunction(err);

          expect(model.reportError).not.toBeCalled();
          expect(model.asyncDependencyFailed).toBeCalledTimes(1);
          expect(model.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
            view: testContext.view.ID,
            error: err
          }));
          done();
        }, 10);
      }
    );

    describe('with PayPal', () => {
      test('uses the PayPal merchant configuration', () => {
        testContext.model.merchantConfiguration.paypal = {
          flow: 'vault'
        };
        testContext.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout'
        };

        return testContext.view.initialize().then(() => {
          expect(testContext.view.paypalConfiguration.flow).toBe('vault');
        });
      });

      test(
        'sets offerCredit to false in the PayPal Checkout configuration even if offerCredit is set to true in PayPal configuration',
        () => {
          testContext.model.merchantConfiguration.paypal = {
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: true
          };

          return testContext.view.initialize().then(() => {
            expect(testContext.view.paypalConfiguration.offerCredit).toBe(false);
          });
        }
      );

      test('uses the PayPal button selector', () => {
        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(
            expect.any(Object),
            expect.stringMatching(/#braintree--dropin__.*\[data-braintree-id="paypal-button"\]/)
          );
        });
      });
    });

    describe('with PayPal Credit', () => {
      test('uses the PayPal Credit merchant configuration', () => {
        testContext.model.merchantConfiguration.paypal = {
          flow: 'vault'
        };
        testContext.model.merchantConfiguration.paypalCredit = {
          flow: 'checkout'
        };

        testContext.view._isPayPalCredit = true;
        testContext.view.initialize();

        expect(testContext.view.paypalConfiguration.flow).toBe('checkout');
      });

      test(
        'sets offerCredit to true in the PayPal Checkout configuration',
        () => {
          testContext.model.merchantConfiguration.paypalCredit = {
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD'
          };

          testContext.view._isPayPalCredit = true;

          return testContext.view.initialize().then(() => {
            expect(testContext.view.paypalConfiguration).toEqual({
              flow: 'checkout',
              amount: '10.00',
              currency: 'USD',
              offerCredit: true
            });
          });
        }
      );

      test(
        'sets offerCredit to true in the PayPal Checkout configuration even if the configuration sets offerCredit to false',
        () => {
          testContext.model.merchantConfiguration.paypalCredit = {
            flow: 'checkout',
            amount: '10.00',
            currency: 'USD',
            offerCredit: false
          };

          testContext.view._isPayPalCredit = true;

          return testContext.view.initialize().then(() => {
            expect(testContext.view.paypalConfiguration).toEqual({
              flow: 'checkout',
              amount: '10.00',
              currency: 'USD',
              offerCredit: true
            });
          });
        }
      );

      test('uses the PayPal Credit button selector', () => {
        testContext.view._isPayPalCredit = true;

        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(
            expect.any(Object),
            expect.stringMatching(/#braintree--dropin__.*\[data-braintree-id="paypal-credit-button"\]/)
          );
        });
      });

      test('includes credit style in button configuration', () => {
        testContext.view._isPayPalCredit = true;

        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
            style: { label: 'credit' }
          }), expect.any(String));
        });
      });

      test('times out if the async dependency is never ready', done => {
        const paypalError = new DropinError('There was an error connecting to PayPal.');

        jest.useFakeTimers();

        jest.spyOn(DropinModel.prototype, 'asyncDependencyFailed').mockImplementation();

        testContext.paypal.Button.render.mockRejectedValue();

        testContext.view.initialize().then(() => {
          expect(DropinModel.prototype.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
            view: testContext.view.ID,
            error: paypalError
          }));
        }).then(() => {
          jest.runAllTimers();
          done();
        });

        jest.advanceTimersByTime(30001);
      });

      test('does not timeout if async dependency sets up', () => {
        jest.useFakeTimers();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyFailed').mockImplementation();

        PayPalCheckout.create.mockResolvedValue(testContext.paypalInstance);
        testContext.paypal.Button.render.mockResolvedValue();

        return testContext.view.initialize().then(() => {
          jest.advanceTimersByTime(10);

          jest.advanceTimersByTime(300001);

          expect(DropinModel.prototype.asyncDependencyFailed).not.toBeCalled();
        }).then(() => {
          jest.runAllTimers();
        });
      });

      test('does not timeout if async dependency failed early', () => {
        jest.useFakeTimers();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyFailed').mockImplementation();

        PayPalCheckout.create.mockResolvedValue(testContext.paypalInstance);
        testContext.paypal.Button.render.mockRejectedValue();

        return testContext.view.initialize().then(() => {
          jest.advanceTimersByTime(300500);

          expect(DropinModel.prototype.asyncDependencyFailed).toBeCalledTimes(1);
          expect(DropinModel.prototype.asyncDependencyFailed).not.toBeCalledWith(expect.objectContaining({
            err: new DropinError('There was an error connecting to PayPal.')
          }));
        }).then(() => {
          jest.runAllTimers();
        });
      });
    });
  });

  describe('updateConfiguration', () => {
    test('ignores offerCredit updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { offerCredit: true };

      view.updateConfiguration('offerCredit', false);

      expect(view.paypalConfiguration.offerCredit).toBe(true);
    });

    test('ignores locale updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { locale: 'es' };

      view.updateConfiguration('locale', 'il');

      expect(view.paypalConfiguration.locale).toBe('es');
    });

    test('can set properties on paypal config', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = {
        flow: 'vault',
        amount: '10.00'
      };

      view.updateConfiguration('flow', 'checkout');
      view.updateConfiguration('amount', '5.32');
      view.updateConfiguration('currency', 'USD');

      expect(view.paypalConfiguration).toEqual({
        flow: 'checkout',
        amount: '5.32',
        currency: 'USD'
      });
    });
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.options = {
        client: testContext.fakeClient,
        merchantConfiguration: {
          paypal: {}
        }
      };

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      global.paypal = {
        Button: {}
      };

      jest.spyOn(assets, 'loadScript').mockResolvedValue();
    });

    test(
      'resolves false if merchant does not have PayPal enabled on the gateway',
      () => {
        testContext.configuration.gatewayConfiguration.paypalEnabled = false;

        return BasePayPalView.isEnabled(testContext.options).then(result => {
          expect(result).toBe(false);
        });
      }
    );

    test('resolves false if browser is IE9', () => {
      jest.spyOn(browserDetection, 'isIe9').mockReturnValue(true);

      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves false if browser is IE10', () => {
      jest.spyOn(browserDetection, 'isIe10').mockReturnValue(true);

      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    test('resolves true if global.paypal exists', () => {
      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(true);
      });
    });

    test('skips loading paypal script if global.paypal exists', () => {
      return BasePayPalView.isEnabled(testContext.options).then(() => {
        expect(assets.loadScript).not.toBeCalled();
      });
    });

    test('loads paypal script if global.paypal does not exist', () => {
      delete global.paypal;

      return BasePayPalView.isEnabled(testContext.options).then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: 'https://www.paypalobjects.com/api/checkout.min.js',
          id: 'braintree-dropin-paypal-checkout-script',
          dataAttributes: {
            'log-level': 'warn'
          }
        });
      });
    });

    test(
      'loads paypal script with merchant provided log level for paypal',
      () => {
        delete global.paypal;

        testContext.options.merchantConfiguration.paypal.logLevel = 'error';

        return BasePayPalView.isEnabled(testContext.options).then(() => {
          expect(assets.loadScript).toBeCalledTimes(1);
          expect(assets.loadScript).toBeCalledWith({
            src: 'https://www.paypalobjects.com/api/checkout.min.js',
            id: 'braintree-dropin-paypal-checkout-script',
            dataAttributes: {
              'log-level': 'error'
            }
          });
        });
      }
    );

    test(
      'loads paypal script with merchant provided log level for paypal credit',
      () => {
        delete global.paypal;

        delete testContext.options.merchantConfiguration.paypal;
        testContext.options.merchantConfiguration.paypalCredit = {
          flow: 'vault',
          logLevel: 'error'
        };

        return BasePayPalView.isEnabled(testContext.options).then(() => {
          expect(assets.loadScript).toBeCalledTimes(1);
          expect(assets.loadScript).toBeCalledWith({
            src: 'https://www.paypalobjects.com/api/checkout.min.js',
            id: 'braintree-dropin-paypal-checkout-script',
            dataAttributes: {
              'log-level': 'error'
            }
          });
        });
      }
    );

    test(
      'loads paypal script with merchant provided log level for paypal if both paypal and paypal credit options are available',
      () => {
        delete global.paypal;

        testContext.options.merchantConfiguration.paypal.logLevel = 'error';
        testContext.options.merchantConfiguration.paypalCredit = {
          flow: 'vault',
          logLevel: 'not-error'
        };

        return BasePayPalView.isEnabled(testContext.options).then(() => {
          expect(assets.loadScript).toBeCalledTimes(1);
          expect(assets.loadScript).toBeCalledWith({
            src: 'https://www.paypalobjects.com/api/checkout.min.js',
            id: 'braintree-dropin-paypal-checkout-script',
            dataAttributes: {
              'log-level': 'error'
            }
          });
        });
      }
    );

    test('resolves true after PayPal script is loaded', () => {
      delete global.paypal;

      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(result).toBe(true);
      });
    });

    test('resolves false if load script fails', () => {
      delete global.paypal;

      assets.loadScript.mockRejectedValue();

      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(result).toBe(false);
      });
    });

    test('returns existing promise if already in progress', () => {
      let firstPromise, secondPromise;

      jest.useFakeTimers();
      delete global.paypal;

      assets.loadScript.mockImplementation(() => {
        return new Promise(resolve => {
          jest.advanceTimersByTime(10);
          global.paypal = testContext.paypal;
          resolve();
        });
      });

      firstPromise = BasePayPalView.isEnabled(testContext.options);
      secondPromise = BasePayPalView.isEnabled(testContext.options);

      expect(firstPromise).toEqual(secondPromise);

      return secondPromise.then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
      });
    });
  });

  describe('requestPaymentMethod', () => {
    test('always rejects', () => {
      const view = new BasePayPalView(testContext.paypalViewOptions);

      return view.requestPaymentMethod().then(() => {
        throw new Error('should not resolve');
      }).catch(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('No payment method is available.');
      });
    });
  });
});
