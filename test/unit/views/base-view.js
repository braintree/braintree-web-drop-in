jest.mock('../../../src/lib/analytics');

const BaseView = require('../../../src/views/base-view');
const constants = require('../../../src/constants');
const classList = require('@braintree/class-list');

describe('BaseView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  describe('Constructor', () => {
    it('does not require options to be passed', () => {
      expect(() => {
        new BaseView(); // eslint-disable-line no-new
      }).not.toThrowError();
    });

    it('takes properties from passed options', () => {
      const view = new BaseView({ foo: 'boo', yas: 'gaga' });

      expect(view.foo).toBe('boo');
      expect(view.yas).toBe('gaga');
    });
  });

  describe('teardown', () => {
    it('resolves immediately with no result', () => {
      const view = new BaseView();

      return view.teardown().then(res => {
        expect(res).not.toBeDefined();
      });
    });
  });

  describe('requestPaymentMethod', () => {
    it('returns a rejected promise', () => {
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
    it('returns undefined if there is no activeMethodView on instance', () => {
      const view = new BaseView();

      expect(view.getPaymentMethod()).toBeUndefined();
    });

    it('returns undefined if activeMethodView does not have a payment method', () => {
      const view = new BaseView();

      view.activeMethodView = {};

      expect(view.getPaymentMethod()).toBeUndefined();
    });

    it('returns the payment method object if there is an activeMethodView with a payment method object', () => {
      const view = new BaseView();
      const paymentMethod = {};

      view.activeMethodView = {
        paymentMethod
      };

      expect(view.getPaymentMethod()).toBe(paymentMethod);
    });
  });

  describe('onSelection', () => {
    it('is a noop function', () => {
      const view = new BaseView();

      expect(view.onSelection).toBeInstanceOf(Function);
    });
  });

  describe('preventUserAction', () => {
    beforeEach(() => {
      jest.spyOn(classList, 'add').mockImplementation();
      testContext.element = global.document.createElement('div');
      testContext.model = {
        preventUserAction: jest.fn()
      };
    });

    it('adds a loading class to view element', () => {
      const view = new BaseView({
        element: testContext.element,
        model: testContext.model
      });

      view.preventUserAction();

      expect(classList.add).toBeCalledTimes(1);
      expect(classList.add).toBeCalledWith(testContext.element, 'braintree-sheet--loading');
    });

    it('ignores adding class if no element is provided', () => {
      const view = new BaseView({
        model: testContext.model
      });

      view.preventUserAction();

      expect(classList.add).not.toBeCalled();
    });

    it('calls preventUserAction on model', () => {
      const view = new BaseView({
        model: testContext.model
      });

      view.preventUserAction();

      expect(testContext.model.preventUserAction).toBeCalledTimes(1);
    });
  });

  describe('allowUserAction', () => {
    beforeEach(() => {
      jest.spyOn(classList, 'remove').mockImplementation();
      testContext.element = global.document.createElement('div');
      testContext.model = {
        allowUserAction: jest.fn()
      };
    });

    it('adds a loading class to view element', () => {
      const view = new BaseView({
        element: testContext.element,
        model: testContext.model
      });

      view.allowUserAction();

      expect(classList.remove).toBeCalledTimes(1);
      expect(classList.remove).toBeCalledWith(testContext.element, 'braintree-sheet--loading');
    });

    it('ignores adding class if no element is provided', () => {
      const view = new BaseView({
        model: testContext.model
      });

      view.allowUserAction();

      expect(classList.remove).not.toBeCalled();
    });

    it('calls allowUserAction on model', () => {
      const view = new BaseView({
        model: testContext.model
      });

      view.allowUserAction();

      expect(testContext.model.allowUserAction).toBeCalledTimes(1);
    });
  });
});
