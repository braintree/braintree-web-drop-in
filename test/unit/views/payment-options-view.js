'use strict';

var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-sheet-views/card-view');
var mainHTML = require('../../../src/html/main.html');
var PaymentOptionsView = require('../../../src/views/payment-options-view');
var PayPalView = require('../../../src/views/payment-sheet-views/paypal-view');
var strings = require('../../../src/translations/en');

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
        paymentOptionIDs: [CardView.ID],
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
        paymentOptionIDs: [PayPalView.ID],
        strings: strings
      });
      var label = paymentOptionsView.container.querySelector('.braintree-option__label');
      var icon = paymentOptionsView.container.querySelector('use');

      expect(label.innerHTML).to.equal(strings.PayPal);
      expect(icon.href.baseVal).to.equal('#logoPayPal');
    });

    // TODO fix when the payment options view css is cleaned up
    xit('sets the primary view to the payment option when clicked', function () {
      var mainViewStub = {setPrimaryView: this.sandbox.stub()};
      var paymentOptionsView = new PaymentOptionsView({
        element: this.element,
        mainView: mainViewStub,
        paymentOptionIDs: [CardView.ID],
        strings: strings
      });
      var option = paymentOptionsView.container.querySelector('.braintree-option');

      option.click();

      expect(mainViewStub.setPrimaryView).to.have.been.calledWith(CardView.ID);
    });
  });
});
