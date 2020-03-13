jest.mock('../../../src/lib/analytics');

const fs = require('fs');
const BaseView = require('../../../src/views/base-view');
const PaymentMethodView = require('../../../src/views/payment-method-view');
const analytics = require('../../../src/lib/analytics');
const fake = require('../../helpers/fake');
const strings = require('../../../src/translations/en_US');

const paymentMethodHTML = fs.readFileSync(`${__dirname}/../../../src/html/payment-method.html`, 'utf8');

describe('PaymentMethodView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.div = document.createElement('div');
    testContext.div.innerHTML = paymentMethodHTML;
    document.body.appendChild(testContext.div);
  });

  describe('Constructor', () => {
    beforeEach(() => {
      jest.spyOn(PaymentMethodView.prototype, '_initialize').mockImplementation();
    });

    it('inherits from BaseView', () => {
      expect(new PaymentMethodView({})).toBeInstanceOf(BaseView);
    });

    it('calls _initialize', () => {
      new PaymentMethodView({}); // eslint-disable-line no-new

      expect(PaymentMethodView.prototype._initialize).toBeCalledTimes(1);
    });
  });

  describe('_initialize', () => {
    beforeEach(() => {
      testContext.context = {
        strings: strings,
        _selectDelete: jest.fn(),
        _choosePaymentMethod: jest.fn()
      };
    });

    it('sets the inner HTML correctly when the paymentMethod is a credit card', () => {
      let iconElement, iconContainer, labelElement;
      const paymentMethod = {
        type: 'CreditCard',
        details: {
          cardType: 'Visa',
          lastFour: '1111'
        }
      };

      testContext.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(testContext.context);

      iconElement = testContext.context.element.querySelector('.braintree-method__logo use');
      iconContainer = testContext.context.element.querySelector('.braintree-method__logo svg');
      labelElement = testContext.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).toBe('#icon-visa');
      expect(labelElement.textContent).toMatch('Ending in 1111');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('Visa');
      expect(iconContainer.classList.contains('braintree-icon--bordered')).toBe(true);
    });

    it('sets the inner HTML correctly when the paymentMethod is a PayPal account', () => {
      let iconElement, iconContainer, labelElement;
      const paymentMethod = {
        type: 'PayPalAccount',
        details: {
          email: 'test@example.com'
        }
      };

      testContext.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(testContext.context);

      iconElement = testContext.context.element.querySelector('.braintree-method__logo use');
      iconContainer = testContext.context.element.querySelector('.braintree-method__logo svg');
      labelElement = testContext.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).toBe('#logoPayPal');
      expect(labelElement.textContent).toMatch('test@example.com');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('PayPal');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
    });

    it('sets the inner HTML correctly when the paymentMethod is Google Pay', () => {
      let iconElement, iconContainer, labelElement;
      const paymentMethod = {
        type: 'AndroidPayCard',
        details: {
          cardType: 'Visa',
          dpanLastTwo: '92',
          paymentInstrumentName: 'Visa 0492'
        }
      };

      testContext.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(testContext.context);

      iconElement = testContext.context.element.querySelector('.braintree-method__logo use');
      iconContainer = testContext.context.element.querySelector('.braintree-method__logo svg');
      labelElement = testContext.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).toBe('#logoGooglePay');
      expect(labelElement.textContent).toMatch('Google Pay');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
    });

    it('sets the inner HTML correctly when the paymentMethod is Apple Pay', () => {
      let iconElement, iconContainer, labelElement;
      const paymentMethod = {
        type: 'ApplePayCard',
        details: {
          cardType: 'Visa',
          dpanLastTwo: '92',
          paymentInstrumentName: 'Visa 0492'
        }
      };

      testContext.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(testContext.context);

      iconElement = testContext.context.element.querySelector('.braintree-method__logo use');
      iconContainer = testContext.context.element.querySelector('.braintree-method__logo svg');
      labelElement = testContext.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).toBe('#logoApplePay');
      expect(labelElement.textContent).toMatch('Apple Pay');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
    });

    it('sets the inner HTML correctly when the paymentMethod is Venmo', () => {
      let iconElement, iconContainer, labelElement;
      const paymentMethod = {
        type: 'VenmoAccount',
        details: {
          username: '@name'
        }
      };

      testContext.context.paymentMethod = paymentMethod;

      PaymentMethodView.prototype._initialize.call(testContext.context);

      iconElement = testContext.context.element.querySelector('.braintree-method__logo use');
      iconContainer = testContext.context.element.querySelector('.braintree-method__logo svg');
      labelElement = testContext.context.element.querySelector('.braintree-method__label');

      expect(iconElement.getAttribute('xlink:href')).toBe('#logoVenmo');
      expect(labelElement.textContent).toMatch('@name');
      expect(labelElement.querySelector('.braintree-method__label--small').textContent).toBe('Venmo');
      expect(iconContainer.classList.contains('braintree-method__logo@CLASSNAME')).toBe(false);
    });
  });

  describe('setActive', () => {
    beforeEach(() => {
      testContext.context = { element: document.createElement('div') };
      jest.useFakeTimers();
    });

    it('adds braintree-method--active if setting active payment method', () => {
      testContext.context.element.className = '';

      PaymentMethodView.prototype.setActive.call(testContext.context, true);
      jest.advanceTimersByTime(1001);

      expect(testContext.context.element.classList.contains('braintree-method--active')).toBe(true);
    });

    it('doesn\'t change the class if braintree-method--active is already there', () => {
      testContext.context.element.className = 'braintree-method--active';

      PaymentMethodView.prototype.setActive.call(testContext.context, true);
      jest.advanceTimersByTime(1001);

      expect(testContext.context.element.classList.contains('braintree-method--active')).toBe(true);
    });

    it('removes braintree-method--active if setting active payment method', () => {
      testContext.context.element.className = 'braintree-method--active';

      PaymentMethodView.prototype.setActive.call(testContext.context, false);
      jest.advanceTimersByTime(1001);

      expect(testContext.context.element.classList.contains('braintree-method--active')).toBe(false);
    });

    it('doesn\'t remove the class if it wasn\'t there', () => {
      testContext.context.element.className = '';

      PaymentMethodView.prototype.setActive.call(testContext.context, false);
      jest.advanceTimersByTime(1001);

      expect(testContext.context.element.classList.contains('braintree-method--active')).toBe(false);
    });
  });

  describe('selecting payment methods', () => {
    beforeEach(() => {
      testContext.model = fake.model();
    });

    it('sends an analytic event when a vaulted card is selected', () => {
      const view = new PaymentMethodView({
        model: testContext.model,
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

      expect(analytics.sendEvent).toBeCalledWith('vaulted-card.select');
    });

    it('sends an analytic event when a vaulted paypal payment method is selected', () => {
      const view = new PaymentMethodView({
        model: testContext.model,
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

      expect(analytics.sendEvent).toBeCalledWith('vaulted-paypal.select');
    });

    it('does not send an analytic event when no payment is selected', () => {
      const view = new PaymentMethodView({
        model: testContext.model,
        strings: strings,
        paymentMethod: {}
      });

      view._choosePaymentMethod();

      expect(analytics.sendEvent).not.toBeCalled();
    });

    it('does not send an analytic event when a non-vaulted PayPal payment method is selected', () => {
      const view = new PaymentMethodView({
        model: testContext.model,
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

      expect(analytics.sendEvent).not.toBeCalled();
    });
  });

  describe('edit mode', () => {
    it('does not call model.changeActivePaymentMethod in click handler when in edit mode', () => {
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
    });

    it('calls model.confirmPaymentMethodDeletion when delete icon is clicked', () => {
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
    });
  });
});
