'use strict';

var analytics = require('../lib/analytics');
var BaseView = require('./base-view');
var paymentMethodOptionHTML = require('../html/payment-option.html');
var paymentOptionIDs = require('../constants').paymentOptionIDs;

function PaymentOptionsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentOptionsView.prototype = Object.create(BaseView.prototype);
PaymentOptionsView.prototype.constructor = PaymentOptionsView;
PaymentOptionsView.ID = PaymentOptionsView.prototype.ID = 'options';

PaymentOptionsView.prototype._initialize = function () {
  this.container = this.getElementById('payment-options-container');

  this.model.supportedPaymentOptions.forEach(function (paymentOptionID) {
    this._addPaymentOption(paymentOptionID);
  }.bind(this));
};

PaymentOptionsView.prototype._addPaymentOption = function (paymentOptionID) {
  var div = document.createElement('div');
  var html = paymentMethodOptionHTML;

  div.className = 'braintree-option';

  switch (paymentOptionID) {
    case paymentOptionIDs.card:
      html = html.replace(/@ICON/g, 'iconCardFront');
      html = html.replace(/@OPTION_TITLE/g, this.strings.Card);
      break;
    case paymentOptionIDs.paypal:
      html = html.replace(/@ICON/g, 'logoPayPal');
      html = html.replace(/@OPTION_TITLE/g, this.strings.PayPal);
      break;
    default:
      break;
  }

  div.innerHTML = html;
  div.addEventListener('click', function () {
    this.mainView.setPrimaryView(paymentOptionID);
    analytics.sendEvent(this.client, 'selected.' + paymentOptionIDs[paymentOptionID]);
  }.bind(this));
  this.container.appendChild(div);
};

module.exports = PaymentOptionsView;
