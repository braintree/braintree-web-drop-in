const analytics = require('../../../src/lib/analytics');
const BaseView = require('../../../src/views/base-view');
const fake = require('../../helpers/fake');
const PaymentMethodView = require('../../../src/views/payment-method-view');
const strings = require('../../../src/translations/en_US');

describe('PaymentMethodView', () => {
  let config;

  beforeEach(() => {
    config = {
      strings,
      paymentMethod: {
        type: 'foo',
        nonce: 'fake-nonce'
      }
    };
  });

  describe('Constructor', () => {
    test('inherits from BaseView', () => {
      expect(new PaymentMethodView(config)).toBeInstanceOf(BaseView);
    });

    test(
      'sets the inner HTML correctly when the paymentMethod is a credit card',
      () => {
        config.paymentMethod = {
          type: 'CreditCard',
          details: {
            cardType: 'Visa',
            lastFour: '1111'
          }
        };

        const view = new PaymentMethodView(config);

        const iconElement = view.element.querySelector('.braintree-method__logo use');
        const iconContainer = view.element.querySelector('.braintree-method__logo svg');
        const labelElement = view.element.querySelector('.braintree-method__label');

        expect(iconElement.getAttribute('xlink:href')).toBe('#icon-visa');
        expect(labelElement.textContent).toMatch('Ending in 1111');
        expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('Visa');
        expect(iconContainer.classList.contains('braintree-icon--bordered')).toBe(true);
      }
    );

    test(
      'sets the inner HTML correctly when the paymentMethod is a PayPal account',
      () => {
        config.paymentMethod = {
          type: 'PayPalAccount',
          details: {
            email: 'test@example.com'
          }
        };

        const view = new PaymentMethodView(config);

        const iconElement = view.element.querySelector('.braintree-method__logo use');
        const iconContainer = view.element.querySelector('.braintree-method__logo svg');
        const labelElement = view.element.querySelector('.braintree-method__label');

        expect(iconElement.getAttribute('xlink:href')).toBe('#logoPayPal');
        expect(labelElement.textContent).toMatch('test@example.com');
        expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('PayPal');
        expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
      }
    );

    test(
      'sets the inner HTML correctly when the paymentMethod is Google Pay',
      () => {
        config.paymentMethod = {
          type: 'AndroidPayCard',
          details: {
            cardType: 'Visa',
            dpanLastTwo: '92',
            paymentInstrumentName: 'Visa 0492'
          }
        };

        const view = new PaymentMethodView(config);

        const iconElement = view.element.querySelector('.braintree-method__logo use');
        const iconContainer = view.element.querySelector('.braintree-method__logo svg');
        const labelElement = view.element.querySelector('.braintree-method__label');

        expect(iconElement.getAttribute('xlink:href')).toBe('#logoGooglePay');
        expect(labelElement.textContent).toMatch('Google Pay');
        expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('');
        expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
      }
    );

    test(
      'sets the inner HTML correctly when the paymentMethod is Apple Pay',
      () => {
        config.paymentMethod = {
          type: 'ApplePayCard',
          details: {
            cardType: 'Visa',
            dpanLastTwo: '92',
            paymentInstrumentName: 'Visa 0492'
          }
        };

        const view = new PaymentMethodView(config);

        const iconElement = view.element.querySelector('.braintree-method__logo use');
        const iconContainer = view.element.querySelector('.braintree-method__logo svg');
        const labelElement = view.element.querySelector('.braintree-method__label');

        expect(iconElement.getAttribute('xlink:href')).toBe('#logoApplePay');
        expect(labelElement.textContent).toMatch('Apple Pay');
        expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('');
        expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
      }
    );

    test(
      'sets the inner HTML correctly when the paymentMethod is Venmo',
      () => {
        config.paymentMethod = {
          type: 'VenmoAccount',
          details: {
            username: '@name'
          }
        };

        const view = new PaymentMethodView(config);

        const iconElement = view.element.querySelector('.braintree-method__logo use');
        const iconContainer = view.element.querySelector('.braintree-method__logo svg');
        const labelElement = view.element.querySelector('.braintree-method__label');

        expect(iconElement.getAttribute('xlink:href')).toBe('#logoVenmo');
        expect(labelElement.textContent).toMatch('@name');
        expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('Venmo');
        expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
      }
    );
  });

  describe('setActive', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    test('adds braintree-method--active if setting active payment method', () => {
      const view = new PaymentMethodView(config);

      view.element.className = '';

      view.setActive(true);
      jest.advanceTimersByTime(1001);

      expect(view.element.classList.contains('braintree-method--active')).toBe(true);
    });

    test("doesn't change the class if braintree-method--active is already there", () => {
      const view = new PaymentMethodView(config);

      view.element.className = 'braintree-method--active';

      view.setActive(true);

      jest.advanceTimersByTime(1001);

      expect(view.element.classList.contains('braintree-method--active')).toBe(true);
    });

    test('removes braintree-method--active if setting active payment method', () => {
      const view = new PaymentMethodView(config);

      view.element.className = 'braintree-method--active';

      view.setActive(false);
      jest.advanceTimersByTime(1001);

      expect(view.element.classList.contains('braintree-method--active')).toBe(false);
    });

    test("doesn't remove the class if it wasn't there", () => {
      const view = new PaymentMethodView(config);

      view.element.className = '';

      view.setActive(false);
      jest.advanceTimersByTime(1001);

      expect(view.element.classList.contains('braintree-method--active')).toBe(false);
    });
  });

  describe('selecting payment methods', () => {
    let client, model;

    beforeEach(() => {
      client = fake.client();
      model = fake.model();
      jest.spyOn(analytics, 'sendEvent').mockImplementation();
    });

    test('sends an analytic event when a vaulted card is selected', () => {
      const view = new PaymentMethodView({
        client: client,
        model: model,
        strings: strings,
        paymentMethod: {
          type: 'CreditCard',
          nonce: 'nonce',
          vaulted: true,
          details: {
            lastFour: 1111
          }
        }
      });

      view._choosePaymentMethod();

      expect(analytics.sendEvent).toBeCalledWith(client, 'vaulted-card.select');
    });

    test(
      'sends an analytic event when a vaulted paypal payment method is selected',
      () => {
        const view = new PaymentMethodView({
          client: client,
          model: model,
          strings: strings,
          paymentMethod: {
            type: 'PayPalAccount',
            vaulted: true,
            details: {
              email: 'test@example.com'
            }
          }
        });

        view._choosePaymentMethod();

        expect(analytics.sendEvent).toBeCalledWith(client, 'vaulted-paypal.select');
      }
    );

    test(
      'does not send an analytic event when no payment is selected',
      () => {
        const view = new PaymentMethodView({
          client: client,
          model: model,
          strings: strings,
          paymentMethod: {}
        });

        view._choosePaymentMethod();

        expect(analytics.sendEvent).not.toBeCalledWith(client, 'vaulted-card.select');
      }
    );

    test(
      'does not send an analytic event when a non-vaulted PayPal payment method is selected',
      () => {
        const view = new PaymentMethodView({
          client: client,
          model: model,
          strings: strings,
          paymentMethod: {
            type: 'PayPalAccount',
            vaulted: false,
            details: {
              email: 'test@example.com'
            }
          }
        });

        view._choosePaymentMethod();

        expect(analytics.sendEvent).not.toBeCalledWith(client, 'vaulted-paypal.select');
      }
    );
  });

  describe('edit mode', () => {
    test(
      'does not call model.changeActivePaymentMethod in click handler when in edit mode',
      () => {
        const model = fake.model();
        const view = new PaymentMethodView({
          model: model,
          strings: strings,
          paymentMethod: {
            type: 'Foo',
            nonce: 'nonce'
          }
        });

        jest.spyOn(model, 'changeActivePaymentMethod').mockImplementation();
        jest.spyOn(model, 'isInEditMode').mockReturnValue(true);

        view._choosePaymentMethod();

        expect(view.model.changeActivePaymentMethod).not.toBeCalled();

        model.isInEditMode.mockReturnValue(false);
        view._choosePaymentMethod();

        expect(view.model.changeActivePaymentMethod).toBeCalledTimes(1);
      }
    );

    test(
      'calls model.confirmPaymentMethodDeletion when delete icon is clicked',
      () => {
        const fakeModel = {
          confirmPaymentMethodDeletion: jest.fn()
        };
        const paymentMethod = {
          type: 'Foo',
          nonce: 'nonce'
        };
        const view = new PaymentMethodView({
          model: fakeModel,
          strings: strings,
          paymentMethod: paymentMethod
        });

        view._selectDelete();

        expect(fakeModel.confirmPaymentMethodDeletion).toBeCalledTimes(1);
        expect(fakeModel.confirmPaymentMethodDeletion).toBeCalledWith(paymentMethod);
      }
    );
  });

  describe('teardown', () => {
    test('removes element from the container', () => {
      const paymentMethod = {
        type: 'Foo',
        nonce: 'nonce'
      };
      const view = new PaymentMethodView({
        model: {},
        strings: strings,
        paymentMethod: paymentMethod
      });

      document.body.appendChild(view.element);
      jest.spyOn(document.body, 'removeChild');

      view.teardown();

      expect(document.body.removeChild).toBeCalledTimes(1);
      expect(document.body.removeChild).toBeCalledWith(view.element);
    });
  });
});
