'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var paymentMethodCardTypes = require('../constants').paymentMethodCardTypes;
var paymentMethodHTML = require('../html/payment-method.html');

function PaymentMethodView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodView.prototype = Object.create(BaseView.prototype);
PaymentMethodView.prototype.constructor = PaymentMethodView;

PaymentMethodView.prototype._initialize = function () {
  var html = paymentMethodHTML;

  this.element = document.createElement('div');
  this.element.className = 'braintree-method';

  this.element.addEventListener('click', function () {
    this.model.changeActivePaymentMethod(this.paymentMethod);
  }.bind(this));

  switch (this.paymentMethod.type) {
    case 'CreditCard':
      html = html.replace(/@ICON/g, 'icon-' + paymentMethodCardTypes[this.paymentMethod.details.cardType])
        .replace(/@TITLE/g, this.strings.endingIn + this.paymentMethod.details.lastTwo)
        .replace(/@SUBTITLE/g, this.strings[this.paymentMethod.details.cardType]);
      break;
    case 'PayPalAccount':
      html = html.replace(/@ICON/g, 'logoPayPal')
        .replace(/@TITLE/g, this.paymentMethod.details.email)
        .replace(/@SUBTITLE/g, this.strings.PayPal);
      break;
    default:
      break;
  }

  this.element.innerHTML = html;
};

PaymentMethodView.prototype.setActive = function (isActive) {
  if (isActive) {
    classlist.add(this.element, 'braintree-method--active');
    return;
  }
  classlist.remove(this.element, 'braintree-method--active');
};

module.exports = PaymentMethodView;
