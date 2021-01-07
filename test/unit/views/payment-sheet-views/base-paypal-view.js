jest.mock('../../../../src/lib/analytics');

/* eslint-disable no-new */

// TODO should we assert on some analytics?
// const analytics = require('../../../../src/lib/analytics');
const BaseView = require('../../../../src/views/base-view');
const DropinModel = require('../../../../src/dropin-model');
const DropinError = require('../../../../src/lib/dropin-error');
const assets = require('@braintree/asset-loader');
const fake = require('../../../helpers/fake');
const fs = require('fs');
const PayPalCheckout = require('braintree-web/paypal-checkout');
const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');

const mainHTML = fs.readFileSync(`${__dirname}/../../../../src/html/main.html`, 'utf8');

describe('BasePayPalView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {
      render: jest.fn().mockResolvedValue(),
      isEligible: jest.fn().mockReturnValue(true)
    };
    testContext.paypal = {
      Buttons: jest.fn().mockReturnValue({
        isEligible: testContext.isEligible,
        render: testContext.render
      }),
      setup: jest.fn(),
      FUNDING: {
        FOO: 'foo',
        VENMO: 'venmo',
        PAYPAL: 'paypal',
        CREDIT: 'credit'
      }
    };

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
    testContext.paypalViewOptions = {
      strings: {},
      element: testContext.element,
      model: testContext.model
    };
    testContext.paypalInstance = {
      createPayment: jest.fn().mockResolvedValue(),
      tokenizePayment: jest.fn().mockResolvedValue(),
      getClientId: jest.fn().mockResolvedValue('client-id')
    };
    jest.spyOn(PayPalCheckout, 'create').mockResolvedValue(testContext.paypalInstance);

    return testContext.model.initialize();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    it('inherits from BaseView', () => {
      expect(new BasePayPalView()).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      testContext.view = new BasePayPalView(testContext.paypalViewOptions);
      jest.spyOn(assets, 'loadScript').mockResolvedValue();
    });

    afterEach(() => {
      BasePayPalView.resetPayPalScriptPromise();
    });

    it('starts async dependency', () => {
      jest.spyOn(testContext.view.model, 'asyncDependencyStarting').mockImplementation();

      return testContext.view.initialize().then(() => {
        expect(testContext.view.model.asyncDependencyStarting).toBeCalledTimes(1);
      });
    });

    it('notifies async dependency', () => {
      jest.spyOn(testContext.view.model, 'asyncDependencyReady').mockImplementation();

      return testContext.view.initialize().then(() => {
        expect(testContext.view.model.asyncDependencyReady).toBeCalledTimes(1);
      });
    });

    it('clones the PayPal config', () => {
      return testContext.view.initialize().then(() => {
        expect(testContext.view.paypalConfiguration.flow).toBe(testContext.model.merchantConfiguration.paypal.flow);
        expect(testContext.view.paypalConfiguration).not.toBe(testContext.model.merchantConfiguration.paypal);
      });
    });

    it('creates a PayPal Checkout component', () => {
      return testContext.view.initialize().then(() => {
        expect(PayPalCheckout.create).toBeCalledWith(expect.objectContaining({
          authorization: testContext.view.model.authorization
        }));
        expect(testContext.view.paypalInstance).toBe(testContext.paypalInstance);
      });
    });

    it('adds PayPal SDK to page', () => {
      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: expect.stringMatching('https://www.paypal.com/sdk/js\\?client-id=client-id&components=buttons'),
          id: 'braintree-dropin-paypal-sdk-script'
        });
      });
    });

    it('adds vault param when using vault flow', () => {
      testContext.model.merchantConfiguration.paypal.flow = 'vault';

      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: 'https://www.paypal.com/sdk/js?client-id=client-id&components=buttons&vault=true',
          id: 'braintree-dropin-paypal-sdk-script'
        });
      });
    });

    it('adds default intent PayPal SDK to page when using checkout flow', () => {
      testContext.model.merchantConfiguration.paypal.flow = 'checkout';

      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: 'https://www.paypal.com/sdk/js?client-id=client-id&components=buttons&intent=authorize',
          id: 'braintree-dropin-paypal-sdk-script'
        });
      });
    });

    it('can override default intent in PayPal SDK', () => {
      testContext.model.merchantConfiguration.paypal.flow = 'checkout';
      testContext.model.merchantConfiguration.paypal.intent = 'sale';

      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: 'https://www.paypal.com/sdk/js?client-id=client-id&components=buttons&intent=sale',
          id: 'braintree-dropin-paypal-sdk-script'
        });
      });
    });

    it.each([
      ['commit', true],
      ['currency', 'usd'],
      ['intent', 'sale']
    ])('adds %s param to PayPal SDK script if provided', (param, value) => {
      testContext.model.merchantConfiguration.paypal[param] = value;

      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: expect.stringMatching(`&${param}=${value}`),
          id: 'braintree-dropin-paypal-sdk-script'
        });
      });
    });

    it('passes locale from merchant configuration', () => {
      testContext.model.merchantConfiguration.locale = 'da_DK';

      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: 'https://www.paypal.com/sdk/js?client-id=client-id&components=buttons&vault=true&locale=da_DK',
          id: 'braintree-dropin-paypal-sdk-script'
        });

        expect(testContext.view.paypalConfiguration.locale).toBe('da_DK');
      });
    });

    it('only passes locale if it is a suported locale', () => {
      testContext.model.merchantConfiguration.locale = 'foo';

      return testContext.view.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: 'https://www.paypal.com/sdk/js?client-id=client-id&components=buttons&vault=true',
          id: 'braintree-dropin-paypal-sdk-script'
        });

        expect(testContext.view.paypalConfiguration.locale).toBeUndefined();
      });
    });

    it('only attempts to load PayPal SDK once', () => {
      return Promise.all([
        testContext.view.initialize(),
        testContext.view.initialize(),
        testContext.view.initialize()
      ]).then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
      });
    });

    it('calls asyncDependencyFailed with an error when PayPal component creation fails', () => {
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
    });

    it('calls asyncDependencyStarting when initializing', () => {
      const fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      PayPalCheckout.create.mockRejectedValue(fakeError);

      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting').mockImplementation();
      testContext.view.initialize();

      expect(testContext.view.model.asyncDependencyStarting).toBeCalledTimes(1);
    });

    it('renders the PayPal button', () => {
      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Buttons).toBeCalledTimes(1);
        expect(testContext.paypal.Buttons).toBeCalledWith(expect.objectContaining({
          fundingSource: 'paypal'
        }));
        expect(testContext.render).toBeCalledTimes(1);
        expect(testContext.render).toBeCalledWith(
          expect.stringMatching(/#braintree--dropin__.*\[data-braintree-id="paypal-button"\]/)
        );
      });
    });

    it('renders the PayPal credit button', () => {
      testContext.model.merchantConfiguration.paypalCredit = {
        flow: 'checkout',
        amount: '10.00',
        currency: 'USD',
        offerCredit: false
      };
      testContext.view._isPayPalCredit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Buttons).toBeCalledTimes(1);
        expect(testContext.paypal.Buttons).toBeCalledWith(expect.objectContaining({
          fundingSource: 'credit'
        }));
        expect(testContext.render).toBeCalledTimes(1);
        expect(testContext.render).toBeCalledWith(
          expect.stringMatching(/#braintree--dropin__.*\[data-braintree-id="paypal-credit-button"\]/)
        );
      });
    });

    it('docs not call paypalInstance.createPayment with locale when an invalid locale is provided', () => {
      const invalidLocaleCode = 'en_FOO';
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;

      model.merchantConfiguration.locale = invalidLocaleCode;

      testContext.render.mockResolvedValue();

      return testContext.view.initialize().then(() => {
        const paymentFunction = testContext.paypal.Buttons.mock.calls[0][0].createBillingAgreement;

        return paymentFunction().then(() => {
          expect(paypalInstance.createPayment).toBeCalledTimes(1);
          expect(paypalInstance.createPayment).not.toBeCalledWith(expect.objectContaining({
            locale: invalidLocaleCode
          }));
        });
      });
    });

    it('docs not call paypalInstance.createPayment with locale when 2 character locale is provided', () => {
      const invalidLocaleCode = 'fr';
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;

      model.merchantConfiguration.locale = invalidLocaleCode;

      testContext.render.mockResolvedValue();

      return testContext.view.initialize().then(() => {
        const paymentFunction = testContext.paypal.Buttons.mock.calls[0][0].createBillingAgreement;

        return paymentFunction().then(() => {
          expect(paypalInstance.createPayment).toBeCalledTimes(1);
          expect(paypalInstance.createPayment).not.toBeCalledWith(expect.objectContaining({
            locale: invalidLocaleCode
          }));
        });
      });
    });

    it.each([
      ['createBillingAgreement', 'vault'],
      ['createOrder', 'checkout']
    ], 'reports errors from %s', (functionName, flow) => {
      const model = testContext.model;
      const error = new Error('create payment error');

      testContext.paypalInstance.createPayment.mockRejectedValue(error);
      model.merchantConfiguration.paypal.flow = flow;

      testContext.render.mockResolvedValue();

      return testContext.view.initialize().then(() => {
        const paymentFunction = testContext.paypal.Buttons.mock.calls[0][0][functionName];

        return paymentFunction().then(() => {
          expect(model.reportError).toBeCalledTimes(1);
          expect(model.reportError).toBeCalledWith(error);
        });
      });
    });

    it('reports errors from render', () => {
      const error = new Error('setup error');

      jest.spyOn(testContext.model, 'asyncDependencyFailed').mockImplementation();
      testContext.render.mockRejectedValue(error);

      return testContext.view.initialize().then(() => {
        expect(testContext.model.asyncDependencyFailed).toBeCalledTimes(1);
        expect(testContext.model.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
          view: testContext.view.ID,
          error: error
        }));
      });
    });

    it('reports errors from button not being eligible', () => {
      jest.spyOn(testContext.model, 'asyncDependencyFailed').mockImplementation();
      testContext.isEligible.mockReturnValue(false);

      return testContext.view.initialize().then(() => {
        expect(testContext.model.asyncDependencyFailed).toBeCalledTimes(1);
        expect(testContext.model.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
          view: testContext.view.ID,
          error: expect.objectContaining({
            message: 'Merchant not eligible for PayPal'
          })
        }));
      });
    });

    it('calls addPaymentMethod when paypal is tokenized', done => {
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;
      const fakePayload = {
        foo: 'bar'
      };

      paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
      jest.spyOn(model, 'addPaymentMethod').mockImplementation();

      testContext.render.mockResolvedValue();

      testContext.view.initialize().then(() => {
        const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
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

    it('vaults and adds `vaulted: true` to the tokenization payload if flow is vault and global autovaulting iis enabled',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.vaultManagerConfig.autoVaultPaymentMethods = true;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = { flow: 'vault' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
          const tokenizeOptions = {
            data: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith({
            data: 'bar',
            vault: true
          });

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith({
              foo: 'bar',
              vaulted: true
            });

            done();
          }, 1);
        });
      });

    it('vaults and adds `vaulted: true` to the tokenization payload if flow is vault and global autovaulting is not enabled but local autovaulting is',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.vaultManagerConfig.autoVaultPaymentMethods = false;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = {
          flow: 'vault'
        };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.render.mockResolvedValue();

        model.merchantConfiguration.paypal.vault = {
          autoVault: true
        };
        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
          const tokenizeOptions = {
            data: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith({
            data: 'bar',
            vault: true
          });

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith({
              foo: 'bar',
              vaulted: true
            });

            done();
          }, 1);
        });
      });

    it('does not add `vaulted: true` to the tokenization payload if flow is vault but global auto-vaulting is not enabled', done => {
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;
      const fakePayload = {
        foo: 'bar'
      };

      model.vaultManagerConfig.autoVaultPaymentMethods = false;

      paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
      paypalInstance.paypalConfiguration = { flow: 'vault' };
      jest.spyOn(model, 'addPaymentMethod').mockImplementation();

      testContext.render.mockResolvedValue();

      testContext.view.initialize().then(() => {
        const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
        const tokenizeOptions = {
          data: 'bar'
        };

        onAuthFunction(tokenizeOptions);

        expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
        expect(paypalInstance.tokenizePayment).toBeCalledWith({
          data: 'bar',
          vault: false
        });

        setTimeout(() => {
          expect(model.addPaymentMethod).toBeCalledTimes(1);
          expect(model.addPaymentMethod).toBeCalledWith({
            foo: 'bar'
          });

          done();
        }, 100);
      });
    });

    it('does not add `vaulted: true` to the tokenization payload if flow is vault and global auto-vaulting is enabled enabled but local autoVault setting is false',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.vaultManagerConfig.autoVaultPaymentMethods = true;
        model.merchantConfiguration.paypal.vault = {
          autoVault: false
        };

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = { flow: 'vault' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
          const tokenizeOptions = {
            data: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith({
            data: 'bar',
            vault: false
          });

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith(fakePayload);

            done();
          }, 100);
        });
      });

    it('does not add `vaulted: true` to the tokenization payload if flow is checkout',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.vaultManagerConfig.autoVaultPaymentMethods = true;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        model.merchantConfiguration.paypal = { flow: 'checkout' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
          const tokenizeOptions = {
            data: 'bar'
          };

          onAuthFunction(tokenizeOptions);

          expect(paypalInstance.tokenizePayment).toBeCalledTimes(1);
          expect(paypalInstance.tokenizePayment).toBeCalledWith({
            data: 'bar',
            vault: false
          });

          setTimeout(() => {
            expect(model.addPaymentMethod).toBeCalledTimes(1);
            expect(model.addPaymentMethod).toBeCalledWith(fakePayload);

            done();
          }, 100);
        });
      });

    it('reports errors from tokenizePayment', done => {
      const paypalInstance = testContext.paypalInstance;
      const model = testContext.model;
      const error = new Error('tokenize error');

      paypalInstance.tokenizePayment.mockRejectedValue(error);
      jest.spyOn(model, 'addPaymentMethod').mockImplementation();

      testContext.render.mockResolvedValue();

      testContext.view.initialize().then(() => {
        const onAuthFunction = testContext.paypal.Buttons.mock.calls[0][0].onApprove;
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

    it('reports errors from paypal-checkout', () => {
      const model = testContext.model;

      testContext.render.mockResolvedValue();

      return testContext.view.initialize().then(() => {
        const onErrorFunction = testContext.paypal.Buttons.mock.calls[0][0].onError;
        const err = new Error('Some error');

        onErrorFunction(err);

        expect(model.reportError).toBeCalledTimes(1);
        expect(model.reportError).toBeCalledWith(err);
      });
    });

    it('marks dependency as failed if error occurs before setup completes',
      done => {
        const model = testContext.model;

        jest.spyOn(model, 'asyncDependencyFailed').mockImplementation();
        testContext.render.mockReturnValue({
          then: jest.fn()
        });

        testContext.view.initialize();

        setTimeout(() => {
          const onErrorFunction = testContext.paypal.Buttons.mock.calls[0][0].onError;
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
      });

    describe('with PayPal', () => {
      it('uses the PayPal merchant configuration', () => {
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

      it('sets offerCredit to false in the PayPal Checkout configuration even if offerCredit is set to true in PayPal configuration', () => {
        testContext.model.merchantConfiguration.paypal = {
          flow: 'checkout',
          amount: '10.00',
          currency: 'USD',
          offerCredit: true
        };

        return testContext.view.initialize().then(() => {
          expect(testContext.view.paypalConfiguration.offerCredit).toBe(false);
        });
      });

      it('uses the PayPal button selector', () => {
        return testContext.view.initialize().then(() => {
          expect(testContext.render).toBeCalledWith(
            expect.stringMatching(/#braintree--dropin__.*\[data-braintree-id="paypal-button"\]/)
          );
        });
      });
    });

    describe('with PayPal Credit', () => {
      it('uses the PayPal Credit merchant configuration', () => {
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

      it('sets offerCredit to true in the PayPal Checkout configuration', () => {
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
      });

      it('sets offerCredit to true in the PayPal Checkout configuration even if the configuration sets offerCredit to false', () => {
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
      });

      it('times out if the async dependency is never ready', done => {
        const paypalError = new DropinError('There was an error connecting to PayPal.');

        jest.useFakeTimers();

        jest.spyOn(DropinModel.prototype, 'asyncDependencyFailed').mockImplementation();

        testContext.render.mockRejectedValue();

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

      it('does not timeout if async dependency sets up', () => {
        jest.useFakeTimers();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyFailed').mockImplementation();

        PayPalCheckout.create.mockResolvedValue(testContext.paypalInstance);
        testContext.render.mockResolvedValue();

        return testContext.view.initialize().then(() => {
          jest.advanceTimersByTime(10);

          jest.advanceTimersByTime(300001);

          expect(DropinModel.prototype.asyncDependencyFailed).not.toBeCalled();
        }).then(() => {
          jest.runAllTimers();
        });
      });

      it('does not timeout if async dependency failed early', () => {
        jest.useFakeTimers();
        jest.spyOn(DropinModel.prototype, 'asyncDependencyFailed').mockImplementation();

        PayPalCheckout.create.mockResolvedValue(testContext.paypalInstance);
        testContext.render.mockRejectedValue();

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
    it('ignores offerCredit updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { offerCredit: true };

      view.updateConfiguration('offerCredit', false);

      expect(view.paypalConfiguration.offerCredit).toBe(true);
    });

    it('ignores locale updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { locale: 'es' };

      view.updateConfiguration('locale', 'il');

      expect(view.paypalConfiguration.locale).toBe('es');
    });

    it('ignores flow updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { flow: 'vault' };

      view.updateConfiguration('flow', 'checkout');

      expect(view.paypalConfiguration.flow).toBe('vault');
    });

    it('ignores commit updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { commit: true };

      view.updateConfiguration('commit', false);

      expect(view.paypalConfiguration.commit).toBe(true);
    });

    it('ignores currency updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { currency: 'usd' };

      view.updateConfiguration('currency', 'eur');

      expect(view.paypalConfiguration.currency).toBe('usd');
    });

    it('ignores intent updates', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = { intent: 'sale' };

      view.updateConfiguration('intent', 'capture');

      expect(view.paypalConfiguration.intent).toBe('sale');
    });

    it('can set properties on paypal config', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = {
        flow: 'vault',
        amount: '10.00'
      };

      view.updateConfiguration('amount', '5.32');

      expect(view.paypalConfiguration).toEqual({
        flow: 'vault',
        amount: '5.32'
      });
    });

    it('can set properties on vault config', () => {
      const view = new BasePayPalView();

      view.paypalConfiguration = {
        flow: 'vault',
        amount: '10.00'
      };
      view.vaultConfig = {
        autoVault: true
      };

      view.updateConfiguration('vault', {
        autoVault: false,
        foo: 'bar'
      });

      expect(view.vaultConfig).toEqual({
        autoVault: false,
        foo: 'bar'
      });
      expect(view.paypalConfiguration).toEqual({
        flow: 'vault',
        amount: '10.00'
      });
    });
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.options = {
        merchantConfiguration: {
          paypal: {}
        }
      };
    });

    it('resolves true', () => {
      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('requestPaymentMethod', () => {
    it('always rejects', () => {
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
