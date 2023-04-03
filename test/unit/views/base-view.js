
const BaseView = require('../../../src/views/base-view');
const constants = require('../../../src/constants');
const Promise = require('../../../src/lib/promise');

describe('BaseView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  describe('Constructor', () => {
    test('does not require options to be passed', () => {
      expect(() => {
        new BaseView(); // eslint-disable-line no-new
      }).not.toThrowError();
    });

    test('takes properties from passed options', () => {
      const view = new BaseView({ foo: 'boo', yas: 'gaga' });

      expect(view.foo).toBe('boo');
      expect(view.yas).toBe('gaga');
    });
  });

  describe('teardown', () => {
    test('returns a resolved promise', () => {
      const view = new BaseView();
      const promise = view.teardown();

      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('requestPaymentMethod', () => {
    test('returns a rejected promise', () => {
      const view = new BaseView();

      return view.requestPaymentMethod().then(() => {
        throw new Error('should not resolve');
      }).catch(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(constants.errors.NO_PAYMENT_METHOD_ERROR);
      });
    });
  });

  describe('getPaymentMethod', () => {
    test(
      'returns undefined if there is no activeMethodView on instance',
      () => {
        const view = new BaseView();

        expect(view.getPaymentMethod()).toBeUndefined(); // eslint-disable-line no-undefined
      }
    );

    test(
      'returns undefined if activeMethodView does not have a payment method',
      () => {
        const view = new BaseView();

        view.activeMethodView = {};

        expect(view.getPaymentMethod()).toBeUndefined(); // eslint-disable-line no-undefined
      }
    );

    test(
      'returns the payment method object if there is an activeMethodView with a payment method object',
      () => {
        const view = new BaseView();
        const paymentMethod = {};

        view.activeMethodView = {
          paymentMethod: paymentMethod
        };

        expect(view.getPaymentMethod()).toBe(paymentMethod);
      }
    );
  });

  describe('onSelection', () => {
    test('is a noop function', () => {
      const view = new BaseView();

      expect(view.onSelection).toBeInstanceOf(Function);
    });
  });

  describe('preventUserAction', () => {
    beforeEach(() => {
      testContext.element = global.document.createElement('div');
      testContext.model = {
        preventUserAction: jest.fn()
      };
    });

    test('adds a loading class to view element', () => {
      const view = new BaseView({
        element: testContext.element,
        model: testContext.model
      });

      view.preventUserAction();

      expect(testContext.element.classList.contains('braintree-sheet--loading')).toBe(true);
    });

    test('calls preventUserAction on model', () => {
      const view = new BaseView({
        model: testContext.model
      });

      view.preventUserAction();

      expect(testContext.model.preventUserAction).toBeCalledTimes(1);
    });
  });

  describe('allowUserAction', () => {
    beforeEach(() => {
      testContext.element = global.document.createElement('div');
      testContext.model = {
        allowUserAction: jest.fn()
      };
    });

    test('removes a loading class from view element', () => {
      const view = new BaseView({
        element: testContext.element,
        model: testContext.model
      });

      testContext.element.classList.add('braintree-sheet--loading');

      view.allowUserAction();

      expect(testContext.element.classList.contains('braintree-sheet--loading')).toBe(false);
    });

    test('calls allowUserAction on model', () => {
      const view = new BaseView({
        model: testContext.model
      });

      view.allowUserAction();

      expect(testContext.model.allowUserAction).toBeCalledTimes(1);
    });
  });
});
