'use strict';

var BasePickerView = require('./base-picker-view');
var cardTypes = require('../../constants').cardTypes;
var classlist = require('../../lib/classlist');
var paymentMethodHTML = require('../../html/payment-method.html');

function CompletedPickerView() {
  BasePickerView.apply(this, arguments);
}

CompletedPickerView.isEnabled = function () {
  return true;
};

CompletedPickerView.prototype = Object.create(BasePickerView.prototype);
CompletedPickerView.prototype.constructor = CompletedPickerView;

CompletedPickerView.prototype._initialize = function () {
  var div = document.createElement('div');

  this.html = paymentMethodHTML;
  BasePickerView.prototype._initialize.apply(this, arguments);
  classlist.add(div, 'braintree-dropin__completed-picker-view');

  switch (this.paymentMethod.type) {
    case 'CreditCard':
      this.html = this.html.replace(/@ICON/g, 'icon-' + cardTypes[this.paymentMethod.details.cardType]);
      this.html = this.html.replace(/@DETAIL/g, 'Ending in ••' + this.paymentMethod.details.lastTwo);
      this.html = this.html.replace(/@TYPE/g, this.paymentMethod.details.cardType);
      break;
    case 'PayPalAccount':
      this.html = this.html.replace(/@ICON/g, 'logoPayPal');
      this.html = this.html.replace(/@DETAIL/g, this.paymentMethod.details.email);
      this.html = this.html.replace(/@TYPE/g, 'PayPal');
      break;
    default:
      break;
  }

  div.innerHTML = this.html;
  this.element.appendChild(div);
  this.checkIcon = this.element.querySelector('.braintree-dropin__check-container');
};

CompletedPickerView.prototype._onSelect = function () {
  this.model.changeActivePaymentMethod(this.paymentMethod);
};

module.exports = CompletedPickerView;
