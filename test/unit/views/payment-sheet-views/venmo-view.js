jest.mock('../../../../src/lib/analytics');

/* eslint-disable no-new */

const btVenmo = require('braintree-web/venmo');
const BaseView = require('../../../../src/views/base-view');
const VenmoView = require('../../../../src/views/payment-sheet-views/venmo-view');
const fake = require('../../../helpers/fake');
const fs = require('fs');

const mainHTML = fs.readFileSync(`${__dirname}/../../../../src/html/main.html`, 'utf8');

describe('VenmoView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.model = fake.model();
    jest.spyOn(testContext.model, 'reportAppSwitchPayload').mockImplementation();
    jest.spyOn(testContext.model, 'reportAppSwitchError').mockImplementation();

    testContext.div = document.createElement('div');
    testContext.div.innerHTML = mainHTML;

    document.body.appendChild(testContext.div);

    testContext.model.merchantConfiguration.venmo = true;
    testContext.venmoViewOptions = {
      element: document.body.querySelector('.braintree-sheet.braintree-venmo'),
      model: testContext.model,
      strings: {}
    };

    testContext.fakeVenmoInstance = {
      tokenize: jest.fn().mockResolvedValue({
        type: 'VenmoAccount',
        nonce: 'fake-nonce'
      }),
      hasTokenizationResult: jest.fn().mockReturnValue(false)
    };
    jest.spyOn(btVenmo, 'create').mockResolvedValue(testContext.fakeVenmoInstance);
  });

  afterEach(() => {
    document.body.removeChild(testContext.div);
  });

  describe('Constructor', () => {
    it('inherits from BaseView', () => {
      expect(new VenmoView()).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      testContext.view = new VenmoView(testContext.venmoViewOptions);
    });

    test('notifies async dependency', () => {
      jest.spyOn(testContext.view.model, 'asyncDependencyReady').mockImplementation();

      return testContext.view.initialize().then(() => {
        expect(testContext.view.model.asyncDependencyReady).toBeCalledTimes(1);
        expect(testContext.view.model.asyncDependencyReady).toBeCalledWith('venmo');
      });
    });

    it('creates an Venmo component', () =>
      testContext.view.initialize().then(() => {
        expect(btVenmo.create).toBeCalledWith(expect.objectContaining({
          authorization: testContext.view.model.authorization
        }));
        expect(testContext.view.venmoInstance).toBe(testContext.fakeVenmoInstance);
      }));

    it('passes in merchant configuration when creating venmo component', () => {
      testContext.view.model.merchantConfiguration.venmo = { allowNewBrowserTab: false };

      return testContext.view.initialize().then(() => {
        expect(btVenmo.create).toBeCalledWith(expect.objectContaining({
          authorization: testContext.view.model.authorization,
          allowNewBrowserTab: false
        }));
      });
    });

    it('checks if there is a tokenization result on the page already', () =>
      testContext.view.initialize().then(() => {
        expect(testContext.fakeVenmoInstance.hasTokenizationResult).toBeCalledTimes(1);
      }));

    it('reports app switch payload if page has a successful tokenization result', () => {
      const payload = { type: 'VenmoAccount', nonce: 'fake-venmo-nonce' };

      testContext.fakeVenmoInstance.hasTokenizationResult.mockReturnValue(true);
      testContext.fakeVenmoInstance.tokenize.mockResolvedValue(payload);

      return testContext.view.initialize().then(() => {
        expect(testContext.fakeVenmoInstance.tokenize).toBeCalledTimes(1);
        expect(testContext.model.reportAppSwitchPayload).toBeCalledTimes(1);
        expect(testContext.model.reportAppSwitchPayload).toBeCalledWith(payload);
        expect(testContext.model.reportAppSwitchError).not.toBeCalled();
      });
    });

    it('reports app switch error if page has an unsuccessful tokenization result', () => {
      const error = new Error('failure');

      testContext.fakeVenmoInstance.hasTokenizationResult.mockReturnValue(true);
      testContext.fakeVenmoInstance.tokenize.mockRejectedValue(error);

      return testContext.view.initialize().then(() => {
        expect(testContext.fakeVenmoInstance.tokenize).toBeCalledTimes(1);
        expect(testContext.model.reportAppSwitchError).toBeCalledTimes(1);
        expect(testContext.model.reportAppSwitchError).toBeCalledWith('venmo', error);
        expect(testContext.model.reportAppSwitchPayload).not.toBeCalled();
      });
    });

    it('does not report app switch error for VENMO_APP_CANCELLED error', () => {
      const error = new Error('failure');

      error.code = 'VENMO_APP_CANCELED';

      testContext.fakeVenmoInstance.hasTokenizationResult.mockReturnValue(true);
      testContext.fakeVenmoInstance.tokenize.mockRejectedValue(error);

      return testContext.view.initialize().then(() => {
        expect(testContext.fakeVenmoInstance.tokenize).toBeCalledTimes(1);
        expect(testContext.model.reportAppSwitchError).not.toBeCalled();
        expect(testContext.model.reportAppSwitchPayload).not.toBeCalled();
      });
    });

    test(
      'does not report app switch error for VENMO_DESKTOP_CANCELLED error',
      () => {
        const error = new Error('failure');

        error.code = 'VENMO_DESKTOP_CANCELED';

        testContext.fakeVenmoInstance.hasTokenizationResult.mockReturnValue(true);
        testContext.fakeVenmoInstance.tokenize.mockRejectedValue(error);

        return testContext.view.initialize().then(() => {
          expect(testContext.fakeVenmoInstance.tokenize).toBeCalledTimes(1);
          expect(testContext.model.reportAppSwitchError).not.toBeCalled();
          expect(testContext.model.reportAppSwitchPayload).not.toBeCalled();
        });
      }
    );

    test(
      'calls asyncDependencyFailed when Venmo component creation fails',
      () => {
        const fakeError = new Error('A_FAKE_ERROR');

      jest.spyOn(testContext.view.model, 'asyncDependencyFailed').mockImplementation();
      btVenmo.create.mockRejectedValue(fakeError);

      return testContext.view.initialize().then(() => {
        const error = testContext.view.model.asyncDependencyFailed.mock.calls[0][0].error;

        expect(testContext.view.model.asyncDependencyFailed).toBeCalledTimes(1);
        expect(testContext.view.model.asyncDependencyFailed).toBeCalledWith(expect.objectContaining({
          view: 'venmo'
        }));

        expect(error.message).toBe(fakeError.message);
      });
    });

    it('sets up a button click handler', () => {
      const button = document.querySelector('[data-braintree-id="venmo-button"]');

      jest.spyOn(button, 'addEventListener');

      return testContext.view.initialize().then(() => {
        expect(button.addEventListener).toBeCalledTimes(1);
        expect(button.addEventListener).toBeCalledWith('click', expect.any(Function));
      });
    });

    describe('button click handler', () => {
      beforeEach(() => {
        const button = document.querySelector('[data-braintree-id="venmo-button"]');
        const view = new VenmoView(testContext.venmoViewOptions);

        jest.spyOn(testContext.model, 'addPaymentMethod').mockImplementation();
        jest.spyOn(testContext.model, 'reportError').mockImplementation();
        jest.spyOn(button, 'addEventListener');
        testContext.fakeEvent = {
          preventDefault: jest.fn()
        };

        return view.initialize().then(() => {
          testContext.clickHandler = button.addEventListener.mock.calls[0][1];
        });
      });

      it('tokenizes with venmo', () =>
        testContext.clickHandler(testContext.fakeEvent).then(() => {
          expect(testContext.fakeVenmoInstance.tokenize).toBeCalledTimes(1);
        }));

      it('adds payment method to model if tokenization is succesful succesful', () =>
        testContext.clickHandler(testContext.fakeEvent).then(() => {
          expect(testContext.model.addPaymentMethod).toBeCalledTimes(1);
          expect(testContext.model.addPaymentMethod).toBeCalledWith({
            type: 'VenmoAccount',
            nonce: 'fake-nonce'
          });
        }));

      it('reports error if tokenization fails', () => {
        const error = new Error('venmo failed');

        testContext.fakeVenmoInstance.tokenize.mockRejectedValue(error);

        return testContext.clickHandler(testContext.fakeEvent).then(() => {
          expect(testContext.model.reportError).toBeCalledTimes(1);
          expect(testContext.model.reportError).toBeCalledWith(error);
        });
      });

      it('ignores error if code is VENMO_APP_CANCELLED', () => {
        const error = new Error('venmo failed');

        error.code = 'VENMO_APP_CANCELED';

        testContext.fakeVenmoInstance.tokenize.mockRejectedValue(error);

        return testContext.clickHandler(testContext.fakeEvent).then(() => {
          expect(testContext.model.reportError).not.toBeCalled();
        });
      });
    });
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.options = {
        merchantConfiguration: testContext.model.merchantConfiguration
      };
      jest.spyOn(btVenmo, 'isBrowserSupported').mockReturnValue(true);
    });

    it('resolves with false when Venmo Pay is not enabled by merchant', () => {
      delete testContext.options.merchantConfiguration.venmo;

      return VenmoView.isEnabled(testContext.options).then(result => {
        expect(result).toBe(false);
      });
    });

    it('resolves with false when browser not supported by Venmo', () => {
      const merchantConfig = testContext.options.merchantConfiguration.venmo = {
        allowNewBrowserTab: false
      };

      btVenmo.isBrowserSupported.mockReturnValue(false);

      return VenmoView.isEnabled(testContext.options).then(result => {
        expect(btVenmo.isBrowserSupported).toBeCalledWith(merchantConfig);
        expect(result).toBe(false);
      });
    });

    it('resolves with true when everything is setup for Venmo', () =>
      expect(VenmoView.isEnabled(testContext.options)).resolves.toBe(true)
    );
  });
});
