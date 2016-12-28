'use strict';

var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var mainHTML = require('../../../src/html/main.html');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var DropinModel = require('../../../src/dropin-model');
var strings = require('../../../src/translations/en');
var fake = require('../../helpers/fake');

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
    });

    it('adds a Card option', function () {
      var paymentOptionsView = new PaymentOptionsView({
        element: this.element,
        mainView: {},
        model: modelThatSupports(['card']),
        strings: strings
      });
      var label = paymentOptionsView.container.querySelector('.braintree-option__label');
      var icon = paymentOptionsView.container.querySelector('use');

      expect(label.innerHTML).to.equal(strings.Card);
      expect(icon.href.baseVal).to.equal('#iconCardFront');
    });

    it('adds a PayPal option', function () {
      var paymentOptionsView = new PaymentOptionsView({
        element: this.element,
        mainView: {},
        model: modelThatSupports(['paypal']),
        strings: strings
      });
      var label = paymentOptionsView.container.querySelector('.braintree-option__label');
      var icon = paymentOptionsView.container.querySelector('use');

      expect(label.innerHTML).to.equal(strings.PayPal);
      expect(icon.href.baseVal).to.equal('#logoPayPal');
    });

    it('sets the primary view to the payment option when clicked', function () {
      var mainViewStub = {setPrimaryView: this.sandbox.stub()};
      var paymentOptionsView = new PaymentOptionsView({
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
});

function modelThatSupports(supportedPaymentOptions) {
  var result = new DropinModel(fake.modelOptions());

  result.supportedPaymentOptions = supportedPaymentOptions;

  return result;
}
