'use strict';

var BasePickerView = require('./base-picker-view');
var completedHTML = require('../../html/completed-picker.html');

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
  var html = completedHTML;

  BasePickerView.prototype._initialize.apply(this, arguments);

  this.element.addEventListener('click', function () {
    this.mainView.updateActivePaymentMethod(this.paymentMethod, true);
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
