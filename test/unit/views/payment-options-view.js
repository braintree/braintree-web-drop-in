'use strict';

const BaseView = require('../../../src/views/base-view');
const CardView = require('../../../src/views/payment-sheet-views/card-view');
const PaymentOptionsView = require('../../../src/views/payment-options-view');
const strings = require('../../../src/translations/en_US');
const fake = require('../../helpers/fake');
const fs = require('fs');
const analytics = require('../../../src/lib/analytics');

const mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

const paymentOptionAttributes = {
  applePay: {
    icon: '#logoApplePay',
    optionLabel: 'Paying with Apple Pay',
    optionTitle: strings['Apple Pay'],
    paymentOptionID: 'applePay'
  },
  card: {
    className: 'braintree-icon--bordered',
    icon: '#iconCardFront',
    optionLabel: 'Paying with Card',
    optionTitle: strings.Card,
    paymentOptionID: 'card'
  },
  googlePay: {
    icon: '#logoGooglePay',
    optionLabel: 'Paying with Google Pay',
    optionTitle: strings['Google Pay'],
    paymentOptionID: 'googlePay'
  },
  paypal: {
    icon: '#logoPayPal',
    optionLabel: 'Paying with PayPal',
    optionTitle: strings.PayPal,
    paymentOptionID: 'paypal'
  },
  paypalCredit: {
    icon: '#logoPayPalCredit',
    optionLabel: 'Paying with PayPal Credit',
    optionTitle: strings['PayPal Credit'],
    paymentOptionID: 'paypalCredit'
  },
  venmo: {
    icon: '#logoVenmo',
    optionLabel: 'Paying with Venmo',
    optionTitle: strings.Venmo,
    paymentOptionID: 'venmo'
  }
};

describe('PaymentOptionsView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.client = fake.client();
  });

  describe('Constructor', () => {
    beforeEach(() => {
      jest.spyOn(PaymentOptionsView.prototype, '_initialize').mockImplementation();
    });

    test('inherits from BaseView', () => {
      expect(new PaymentOptionsView({})).toBeInstanceOf(BaseView);
    });

    test('calls _initialize', () => {
      new PaymentOptionsView({}); // eslint-disable-line no-new

      expect(PaymentOptionsView.prototype._initialize).toBeCalledTimes(1);
    });
  });

  describe('_initialize', () => {
    beforeEach(() => {
      testContext.wrapper = document.createElement('div');
      testContext.wrapper.innerHTML = mainHTML;

      testContext.element = testContext.wrapper.querySelector('[data-braintree-id="' + PaymentOptionsView.ID + '"]');
    });

    afterEach(() => {

    });

    Object.keys(paymentOptionAttributes).forEach(optionName => {
      const option = paymentOptionAttributes[optionName];

      test('adds a ' + option.paymentOptionID + ' option', () => {
        const paymentOptionsView = new PaymentOptionsView({
          client: testContext.client,
          element: testContext.element,
          mainView: {},
          model: modelThatSupports([option.paymentOptionID]),
          strings: strings
        });
        const label = paymentOptionsView.container.querySelector('.braintree-option__label');
        const icon = paymentOptionsView.container.querySelector('use');
        const iconContainer = icon.parentElement;
        const optionElement = paymentOptionsView.elements[option.paymentOptionID];

        expect(label.getAttribute('aria-label')).toBe(option.optionLabel);
        expect(label.innerHTML).toMatch(option.optionTitle);
        expect(icon.getAttribute('xlink:href')).toBe(option.icon);
        expect(optionElement.div).toBeDefined();
        expect(optionElement.clickHandler).toBeInstanceOf(Function);

        if (option.className) {
          expect(iconContainer.classList.contains(option.className)).toBe(true);
        } else {
          expect(iconContainer.classList.contains('braintree-option__logo@CLASSNAME')).toBe(false);
        }
      });
    });

    test('sets the primary view to the payment option when clicked', () => {
      const mainViewStub = {setPrimaryView: jest.fn()};
      const paymentOptionsView = new PaymentOptionsView({
        client: testContext.client,
        element: testContext.element,
        mainView: mainViewStub,
        model: modelThatSupports(['card']),
        strings: strings
      });
      const option = paymentOptionsView.container.querySelector('.braintree-option');

      option.click();

      expect(mainViewStub.setPrimaryView).toBeCalledWith(CardView.ID);
    });

    test(
      'calls model.selectPaymentOption when payment option is clicked',
      () => {
        const mainViewStub = {setPrimaryView: jest.fn()};
        const paymentOptionsView = new PaymentOptionsView({
          client: testContext.client,
          element: testContext.element,
          mainView: mainViewStub,
          model: modelThatSupports(['card']),
          strings: strings
        });
        const option = paymentOptionsView.container.querySelector('.braintree-option');

        jest.spyOn(paymentOptionsView.model, 'selectPaymentOption').mockImplementation();

        option.click();

        expect(paymentOptionsView.model.selectPaymentOption).toBeCalledWith(CardView.ID);
      }
    );
  });

  describe('sends analytics events', () => {
    beforeEach(() => {
      const wrapper = document.createElement('div');

      wrapper.innerHTML = mainHTML;

      testContext.element = wrapper.querySelector('[data-braintree-id="' + PaymentOptionsView.ID + '"]');

      testContext.viewConfiguration = {
        client: testContext.client,
        element: testContext.element,
        mainView: {setPrimaryView: function () {}},
        strings: strings
      };
    });

    Object.keys(paymentOptionAttributes).forEach(optionName => {
      const option = paymentOptionAttributes[optionName];

      test(
        'when the ' + option.paymentOptionID + ' option is selected',
        () => {
          let optionElement, paymentOptionsView;
          const model = modelThatSupports([option.paymentOptionID]);
          const viewConfiguration = testContext.viewConfiguration;
          const eventName = 'selected.' + option.paymentOptionID;

          jest.spyOn(analytics, 'sendEvent').mockImplementation();

          viewConfiguration.model = model;
          paymentOptionsView = new PaymentOptionsView(viewConfiguration);
          optionElement = paymentOptionsView.container.querySelector('.braintree-option');

          optionElement.click();

          expect(analytics.sendEvent).toBeCalledWith(paymentOptionsView.client, eventName);
        }
      );
    });
  });
});

function modelThatSupports(supportedPaymentOptions) {
  const result = fake.model();

  result.supportedPaymentOptions = supportedPaymentOptions;

  return result;
}
