'use strict';

var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var mainHTML = require('../../../src/html/main.html');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var DropinModel = require('../../../src/dropin-model');
var strings = require('../../../src/translations/en');
var fake = require('../../helpers/fake');
var analytics = require('../../../src/lib/analytics');

describe('PaymentOptionsView', function () {
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
      this.client = {
        getConfiguration: fake.configuration,
        request: function () {},
        _request: function () {}
      };
    });

    it('adds a Card option', function () {
      var paymentOptionsView = new PaymentOptionsView({
        client: this.client,
        element: this.element,
        mainView: {},
        model: modelThatSupports(['card']),
        strings: strings
      });
      var label = paymentOptionsView.container.querySelector('.braintree-option__label');
      var icon = paymentOptionsView.container.querySelector('use');
      var iconContainer = icon.parentElement.parentElement;

      expect(label.innerHTML).to.equal(strings.Card);
      expect(icon.href.baseVal).to.equal('#iconCardFront');
      expect(iconContainer.classList.contains('braintree-icon--bordered')).to.be.true;
    });

    it('adds a PayPal option', function () {
      var paymentOptionsView = new PaymentOptionsView({
        client: this.client,
        element: this.element,
        mainView: {},
        model: modelThatSupports(['paypal']),
        strings: strings
      });
      var label = paymentOptionsView.container.querySelector('.braintree-option__label');
      var icon = paymentOptionsView.container.querySelector('use');
      var iconContainer = icon.parentElement.parentElement;

      expect(label.innerHTML).to.equal(strings.PayPal);
      expect(icon.href.baseVal).to.equal('#logoPayPal');
      expect(iconContainer.classList.contains('braintree-option__logo@CLASSNAME')).to.be.false;
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
        element: this.element,
        mainView: {setPrimaryView: function () {}},
        strings: strings
      };
    });

    it('when the Card option is selected', function () {
      var option, paymentOptionsView;
      var model = modelThatSupports(['card']);
      var viewConfiguration = this.viewConfiguration;

      this.sandbox.stub(analytics, 'sendEvent');

      viewConfiguration.model = model;
      paymentOptionsView = new PaymentOptionsView(viewConfiguration);
      option = paymentOptionsView.container.querySelector('.braintree-option');

      option.click();

      expect(analytics.sendEvent).to.have.been.calledWith(paymentOptionsView.client, 'selected.card');
    });

    it('when the PayPal option is selected', function () {
      var option, paymentOptionsView;
      var model = modelThatSupports(['paypal']);
      var viewConfiguration = this.viewConfiguration;

      this.sandbox.stub(analytics, 'sendEvent');

      viewConfiguration.model = model;
      paymentOptionsView = new PaymentOptionsView(viewConfiguration);
      option = paymentOptionsView.container.querySelector('.braintree-option');

      option.click();

      expect(analytics.sendEvent).to.have.been.calledWith(paymentOptionsView.client, 'selected.paypal');
    });
  });
});

function modelThatSupports(supportedPaymentOptions) {
  var result = new DropinModel(fake.modelOptions());

  result.supportedPaymentOptions = supportedPaymentOptions;

  return result;
}
