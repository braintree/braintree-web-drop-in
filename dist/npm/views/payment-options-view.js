'use strict';

var analytics = require('../lib/analytics');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');
var BaseView = require('./base-view');

var paymentOptionIDs = require('../constants').paymentOptionIDs;

var paymentMethodOptionHTML = "<div class=\"braintree-option__logo\">\r\n  <svg width=\"48\" height=\"29\" class=\"@CLASSNAME\">\r\n    <use xlink:href=\"#@ICON\"></use>\r\n  </svg>\r\n</div>\r\n\r\n<div class=\"braintree-option__label\" aria-label=\"@OPTION_LABEL\">\r\n  @OPTION_TITLE\r\n  <div class=\"braintree-option__disabled-message\"></div>\r\n</div>\r\n";

function PaymentOptionsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentOptionsView.prototype = Object.create(BaseView.prototype);
PaymentOptionsView.prototype.constructor = PaymentOptionsView;
PaymentOptionsView.ID = PaymentOptionsView.prototype.ID = 'options';

PaymentOptionsView.prototype._initialize = function () {
  this.container = this.getElementById('payment-options-container');
  this.elements = {};

  this.model.supportedPaymentOptions.forEach(function (paymentOptionID) {
    this._addPaymentOption(paymentOptionID);
  }.bind(this));
};

PaymentOptionsView.prototype._addPaymentOption = function (paymentOptionID) {
  var paymentSource;
  var div = document.createElement('div');
  var html = paymentMethodOptionHTML;
  var clickHandler = function clickHandler() {
    this.mainView.setPrimaryView(paymentOptionID);
    this.model.selectPaymentOption(paymentOptionID);
    analytics.sendEvent(this.client, 'selected.' + paymentOptionIDs[paymentOptionID]);
  }.bind(this);

  // #RCA
  const bc_classes = "form-checklist-item optimizedCheckout-form-checklist-item"
  div.className = `${bc_classes} braintree-option braintree-option__${paymentOptionID}`;
  div.setAttribute('tabindex', '0');
  div.setAttribute('role', 'button');

  switch (paymentOptionID) {
    case paymentOptionIDs.applePay:
      paymentSource = this.strings['Apple Pay'];
      html = html.replace(/@ICON/g, 'logoApplePay');
      break;
    case paymentOptionIDs.card:
      paymentSource = this.strings.Card;
      html = html.replace(/@ICON/g, 'iconCardFront');
      html = html.replace(/@CLASSNAME/g, 'braintree-icon--bordered');
      break;
    case paymentOptionIDs.googlePay:
      paymentSource = this.strings['Google Pay'];
      html = html.replace(/@ICON/g, 'logoGooglePay');
      break;
    case paymentOptionIDs.paypal:
      paymentSource = this.strings.PayPal;
      html = html.replace(/@ICON/g, 'logoPayPal');
      break;
    case paymentOptionIDs.paypalCredit:
      paymentSource = this.strings['PayPal Credit'];
      html = html.replace(/@ICON/g, 'logoPayPalCredit');
      break;
    case paymentOptionIDs.venmo:
      paymentSource = this.strings.Venmo;
      html = html.replace(/@ICON/g, 'logoVenmo');
      break;
    default:
      break;
  }

  html = html.replace(/@OPTION_LABEL/g, this._generateOptionLabel(paymentSource));
  html = html.replace(/@OPTION_TITLE/g, paymentSource);
  html = html.replace(/@CLASSNAME/g, '');

  div.innerHTML = html;

  addSelectionEventHandler(div, clickHandler);

  this.container.appendChild(div);
  this.elements[paymentOptionID] = {
    div: div,
    clickHandler: clickHandler
  };
};

PaymentOptionsView.prototype._generateOptionLabel = function (paymentSourceString) {
  return this.strings.payingWith.replace('{{paymentSource}}', paymentSourceString);
};

module.exports = PaymentOptionsView;
