'use strict';

var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var strings = require('../../../src/translations/en_US');
var fake = require('../../helpers/fake');
var fs = require('fs');
var analytics = require('../../../src/lib/analytics');

var mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

var paymentOptionAttributes = {
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

    Object.keys(paymentOptionAttributes).forEach(function (optionName) {
      var option = paymentOptionAttributes[optionName];

      test('adds a ' + option.paymentOptionID + ' option', () => {
        var paymentOptionsView = new PaymentOptionsView({
          client: testContext.client,
          element: testContext.element,
          mainView: {},
          model: modelThatSupports([option.paymentOptionID]),
          strings: strings
        });
        var label = paymentOptionsView.container.querySelector('.braintree-option__label');
        var icon = paymentOptionsView.container.querySelector('use');
        var iconContainer = icon.parentElement;
        var optionElement = paymentOptionsView.elements[option.paymentOptionID];

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
      var mainViewStub = {setPrimaryView: jest.fn()};
      var paymentOptionsView = new PaymentOptionsView({
        client: testContext.client,
        element: testContext.element,
        mainView: mainViewStub,
        model: modelThatSupports(['card']),
        strings: strings
      });
      var option = paymentOptionsView.container.querySelector('.braintree-option');

      option.click();

      expect(mainViewStub.setPrimaryView).toBeCalledWith(CardView.ID);
    });

    test(
      'calls model.selectPaymentOption when payment option is clicked',
      () => {
        var mainViewStub = {setPrimaryView: jest.fn()};
        var paymentOptionsView = new PaymentOptionsView({
          client: testContext.client,
          element: testContext.element,
          mainView: mainViewStub,
          model: modelThatSupports(['card']),
          strings: strings
        });
        var option = paymentOptionsView.container.querySelector('.braintree-option');

        jest.spyOn(paymentOptionsView.model, 'selectPaymentOption').mockImplementation();

        option.click();

        expect(paymentOptionsView.model.selectPaymentOption).toBeCalledWith(CardView.ID);
      }
    );
  });

  describe('sends analytics events', () => {
    beforeEach(() => {
      var wrapper = document.createElement('div');

      wrapper.innerHTML = mainHTML;

      testContext.element = wrapper.querySelector('[data-braintree-id="' + PaymentOptionsView.ID + '"]');

      testContext.viewConfiguration = {
        client: testContext.client,
        element: testContext.element,
        mainView: {setPrimaryView: function () {}},
        strings: strings
      };
    });

    Object.keys(paymentOptionAttributes).forEach(function (optionName) {
      var option = paymentOptionAttributes[optionName];

      test(
        'when the ' + option.paymentOptionID + ' option is selected',
        () => {
          var optionElement, paymentOptionsView;
          var model = modelThatSupports([option.paymentOptionID]);
          var viewConfiguration = testContext.viewConfiguration;
          var eventName = 'selected.' + option.paymentOptionID;

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
  var result = fake.model();

  result.supportedPaymentOptions = supportedPaymentOptions;

  return result;
}
