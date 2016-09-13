'use strict';

var BasePickerView = require('./base-picker-view');
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
  var html = paymentMethodHTML;

  BasePickerView.prototype._initialize.apply(this, arguments);
  classlist.add(div, 'braintree-dropin__completed-picker-view');

  this.element.addEventListener('click', function () {
    this.model.changeActivePaymentMethod(this.paymentMethod);
  }.bind(this));

  switch (this.paymentMethod.type) {
    case 'CreditCard':
      html = html.replace(/@ICON/g, this.paymentMethod.details.cardType);
      html = html.replace(/@DETAIL/g, 'Ending in ••' + this.paymentMethod.details.lastTwo);
      html = html.replace(/@TYPE/g, this.paymentMethod.details.cardType);
      break;
    case 'PayPalAccount':
      html = html.replace(/@ICON/g, 'paypal');
      html = html.replace(/@DETAIL/g, this.paymentMethod.details.email);
      html = html.replace(/@TYPE/g, 'PayPal');
      break;
    default:
      break;
  }

  div.innerHTML = html;
  this.element.appendChild(div);
};

module.exports = CompletedPickerView;
