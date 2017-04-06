'use strict';

var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var DropinModel = require('../../../src/dropin-model');
var strings = require('../../../src/translations/en');
var fake = require('../../helpers/fake');
var fs = require('fs');
var analytics = require('../../../src/lib/analytics');

var mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

var paymentOptionAttributes = {
  card: {
    className: 'braintree-icon--bordered',
    icon: '#iconCardFront',
    optionTitle: strings.Card,
    paymentOptionID: 'card'
  },
  paypal: {
    icon: '#logoPayPal',
    optionTitle: strings.PayPal,
    paymentOptionID: 'paypal'
  },
  // TODO update when we have PayPal credit logo
  paypalCredit: {
    icon: '#logoPayPal',
    optionTitle: strings.PayPalCredit,
    paymentOptionID: 'paypalCredit'
  }
};

describe('PaymentOptionsView', function () {
  beforeEach(function () {
    this.client = {
      getConfiguration: fake.configuration,
      request: function () {},
      _request: function () {}
    };
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentOptionsView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new PaymentOptionsView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new PaymentOptionsView({}); // eslint-disable-line no-new

      expect(PaymentOptionsView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.wrapper = document.createElement('div');
      this.wrapper.innerHTML = mainHTML;

      this.element = this.wrapper.querySelector('[data-braintree-id="' + PaymentOptionsView.ID + '"]');
    });

    Object.keys(paymentOptionAttributes).forEach(function (optionName) {
      var option = paymentOptionAttributes[optionName];

      it('adds a ' + option.paymentOptionID + ' option', function () {
        var paymentOptionsView = new PaymentOptionsView({
          client: this.client,
          element: this.element,
          mainView: {},
          model: modelThatSupports([option.paymentOptionID]),
          strings: strings
        });
        var label = paymentOptionsView.container.querySelector('.braintree-option__label');
        var icon = paymentOptionsView.container.querySelector('use');
        var iconContainer = icon.parentElement;
        var optionElement = paymentOptionsView.elements[option.paymentOptionID];

        expect(label.innerHTML).to.contain(option.optionTitle);
        expect(icon.href.baseVal).to.equal(option.icon);
        expect(optionElement.div).to.exist;
        expect(optionElement.clickHandler).to.be.a('function');

        if (option.className) {
          expect(iconContainer.classList.contains(option.className)).to.be.true;
        } else {
          expect(iconContainer.classList.contains('braintree-option__logo@CLASSNAME')).to.be.false;
        }
      });
    });

    it('sets the primary view to the payment option when clicked', function () {
      var mainViewStub = {setPrimaryView: this.sandbox.stub()};
      var paymentOptionsView = new PaymentOptionsView({
        client: this.client,
        element: this.element,
        mainView: mainViewStub,
        model: modelThatSupports(['card']),
        strings: strings
      });
      var option = paymentOptionsView.container.querySelector('.braintree-option');

      option.click();

      expect(mainViewStub.setPrimaryView).to.have.been.calledWith(CardView.ID);
    });
  });

  describe('sends analytics events', function () {
    beforeEach(function () {
      var wrapper = document.createElement('div');

      wrapper.innerHTML = mainHTML;

      this.element = wrapper.querySelector('[data-braintree-id="' + PaymentOptionsView.ID + '"]');

      this.viewConfiguration = {
        client: this.client,
        element: this.element,
        mainView: {setPrimaryView: function () {}},
        strings: strings
      };
    });

    Object.keys(paymentOptionAttributes).forEach(function (optionName) {
      var option = paymentOptionAttributes[optionName];

      it('when the ' + option.paymentOptionID + ' option is selected', function () {
        var optionElement, paymentOptionsView;
        var model = modelThatSupports([option.paymentOptionID]);
        var viewConfiguration = this.viewConfiguration;
        var eventName = 'selected.' + option.paymentOptionID;

        this.sandbox.stub(analytics, 'sendEvent');

        viewConfiguration.model = model;
        paymentOptionsView = new PaymentOptionsView(viewConfiguration);
        optionElement = paymentOptionsView.container.querySelector('.braintree-option');

        optionElement.click();

        expect(analytics.sendEvent).to.have.been.calledWith(paymentOptionsView.client, eventName);
      });
    });
  });
});

function modelThatSupports(supportedPaymentOptions) {
  var result = new DropinModel(fake.modelOptions());

  result.supportedPaymentOptions = supportedPaymentOptions;

  return result;
}
