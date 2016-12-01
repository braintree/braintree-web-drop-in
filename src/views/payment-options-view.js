'use strict';

var BaseView = require('./base-view');
var paymentMethodOptionHTML = require('../html/payment-option.html');

function PaymentOptionsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentOptionsView.prototype = Object.create(BaseView.prototype);
PaymentOptionsView.prototype.constructor = PaymentOptionsView;
PaymentOptionsView.ID = PaymentOptionsView.prototype.ID = 'payment-options';

PaymentOptionsView.prototype._initialize = function () {
  this.container = this.getElementById('payment-options-container');

  this.paymentOptionIDs.forEach(function (paymentOptionID) {
    this._addPaymentOption(paymentOptionID);
  }.bind(this));
};

PaymentOptionsView.prototype._addPaymentOption = function (paymentOptionID) {
  var div = document.createElement('div');
  var html = paymentMethodOptionHTML;

  div.className = 'braintree-option';

  switch (paymentOptionID) {
    case 'pay-with-card':
      html = html.replace(/@ICON/g, 'iconCardFront');
      html = html.replace(/@OPTION_TITLE/g, this.strings.Card);
      break;
    case 'paypal':
      html = html.replace(/@ICON/g, 'logoPayPal');
      html = html.replace(/@OPTION_TITLE/g, this.strings.PayPal);
      break;
    default:
      break;
  }

  div.innerHTML = html;
  div.addEventListener('click', function () {
    this.mainView.setActiveView(paymentOptionID);
  }.bind(this));
  this.container.appendChild(div);
};

module.exports = PaymentOptionsView;
