jest.mock('../../../../src/lib/analytics');

/* eslint-disable no-new */

// eslint-disable-next-line no-warning-comments
// TODO should we assert on some analytics?
//  const analytics = require('../../../../src/lib/analytics');
const BaseView = require('../../../../src/views/base-view');
const DropinModel = require('../../../../src/dropin-model');
const DropinError = require('../../../../src/lib/dropin-error');
const Promise = require('../../../../src/lib/promise');
const assets = require('@braintree/asset-loader');
const fake = require('../../../helpers/fake');
const fs = require('fs');
const PayPalCheckout = require('braintree-web/paypal-checkout');
const BasePayPalView = require('../../../../src/views/payment-sheet-views/base-paypal-view');

const mainHTML = fs.readFileSync(`${__dirname}/../../../../src/html/main.html`, 'utf8');

describe('BasePayPalView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
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
      tokenizePayment: jest.fn().mockResolvedValue()
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

    it('calls paypal.Button.render', () => {
      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledTimes(1);
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.any(Object), '[data-braintree-id="paypal-button"]');
      });
    });

    it('can style the PayPal button', () => {
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

    it('can style the PayPal Credit button', () => {
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

    it('cannot style label for PayPal Credit', () => {
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

    it('dissallows all non-paypal payment methods', () => {
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

    it('dissallows all funcing but credit for paypal credit', () => {
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

    it('can set user action to commit for the PayPal button', () => {
      testContext.view.model.merchantConfiguration.paypal.commit = true;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          commit: true
        }), expect.any(String));
      });
    });

    it('can set user action to continue for the PayPal button', () => {
      testContext.view.model.merchantConfiguration.paypal.commit = false;

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          commit: false
        }), expect.any(String));
      });
    });

    it('sets paypal-checkout.js environment to production when gatewayConfiguration is production', () => {
      testContext.view.model.environment = 'production';

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          env: 'production'
        }), expect.any(String));
      });
    });

    it('sets paypal-checkout.js environment to sandbox when gatewayConfiguration is not production', () => {
      testContext.view.model.environment = 'development';

      return testContext.view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          env: 'sandbox'
        }), expect.any(String));
      });
    });

    it('calls paypalInstance.createPayment with a locale if one is provided', () => {
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
    });

    it('calls paypal.Button.render with a locale if one is provided', () => {
      const localeCode = 'fr_FR';
      const model = testContext.model;
      const view = testContext.view;

      model.merchantConfiguration.locale = localeCode;

      return view.initialize().then(() => {
        expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
          locale: 'fr_FR'
        }), expect.any(String));
      });
    });

    it('docs not call paypalInstance.createPayment with locale when an invalid locale is provided', () => {
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
    });

    it('does not call paypal.Button.render with locale when an invalid locale is provided', () => {
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
    });

    it('docs not call paypalInstance.createPayment with locale when 2 character locale is provided', () => {
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
    });

    it('does not call paypal.Button.render with locale when 2 character locale is provided', () => {
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
    });

    it('reports errors from createPayment', () => {
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

    it('reports errors from paypal.Button.render', () => {
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

    it('calls addPaymentMethod when paypal is tokenized', done => {
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

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
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

        testContext.paypal.Button.render.mockResolvedValue();

        model.merchantConfiguration.paypal.vault = {
          autoVault: true
        };
        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
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

    it('does not add `vaulted: true` to the tokenization payload if flow is vault but global auto-vaulting is not enabled',
      done => {
        const paypalInstance = testContext.paypalInstance;
        const model = testContext.model;
        const fakePayload = {
          foo: 'bar'
        };

        model.vaultManagerConfig.autoVaultPaymentMethods = false;

        paypalInstance.tokenizePayment.mockResolvedValue(fakePayload);
        paypalInstance.paypalConfiguration = { flow: 'vault' };
        jest.spyOn(model, 'addPaymentMethod').mockImplementation();

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
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

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
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

        testContext.paypal.Button.render.mockResolvedValue();

        testContext.view.initialize().then(() => {
          const onAuthFunction = testContext.paypal.Button.render.mock.calls[0][0].onAuthorize;
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

    it('reports errors from paypal-checkout', () => {
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

    it('marks dependency as failed if error occurs before setup completes',
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
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.any(Object), '[data-braintree-id="paypal-button"]');
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

      it('uses the PayPal Credit button selector', () => {
        testContext.view._isPayPalCredit = true;

        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.any(Object), '[data-braintree-id="paypal-credit-button"]');
        });
      });

      it('includes credit style in button configuration', () => {
        testContext.view._isPayPalCredit = true;

        return testContext.view.initialize().then(() => {
          expect(testContext.paypal.Button.render).toBeCalledWith(expect.objectContaining({
            style: { label: 'credit' }
          }), expect.any(String));
        });
      });

      it('times out if the async dependency is never ready', done => {
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

      it('does not timeout if async dependency sets up', () => {
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

      it('does not timeout if async dependency failed early', () => {
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

    it('can set properties on paypal config', () => {
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

      testContext.configuration.gatewayConfiguration.paypalEnabled = true;
      global.paypal = {
        Button: {}
      };

      jest.spyOn(assets, 'loadScript').mockResolvedValue();
    });

    it('resolves true if global.paypal exists', () => {
      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(true);
      });
    });

    it('skips loading paypal script if global.paypal exists', () => {
      return BasePayPalView.isEnabled(testContext.options).then(() => {
        expect(assets.loadScript).not.toBeCalled();
      });
    });

    it('loads paypal script if global.paypal does not exist', () => {
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

    it('loads paypal script with merchant provided log level for paypal', () => {
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
    });

    it('loads paypal script with merchant provided log level for paypal credit', () => {
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
    });

    it('loads paypal script with merchant provided log level for paypal if both paypal and paypal credit options are available', () => {
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
    });

    it('resolves true after PayPal script is loaded', () => {
      delete global.paypal;

      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(result).toBe(true);
      });
    });

    it('resolves false if load script fails', () => {
      delete global.paypal;

      assets.loadScript.mockRejectedValue();

      return BasePayPalView.isEnabled(testContext.options).then(result => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(result).toBe(false);
      });
    });

    it('returns existing promise if already in progress', () => {
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
