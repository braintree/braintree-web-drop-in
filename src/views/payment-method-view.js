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
  this.element = document.createElement('div');
  this.element.className = 'braintree-method';

  this.element.addEventListener('click', function () {
    this.model.changeActivePaymentMethod(this.paymentMethod);
  }.bind(this));

  this.html = paymentMethodHTML;
  switch (this.paymentMethod.type) {
    case 'CreditCard':
      this.html = this.html.replace(/@ICON/g, 'icon-' + paymentMethodCardTypes[this.paymentMethod.details.cardType]);
      this.html = this.html.replace(/@TITLE/g, this.strings.endingIn + this.paymentMethod.details.lastTwo);
      this.html = this.html.replace(/@SUBTITLE/g, this.strings[this.paymentMethod.details.cardType]);
      break;
    case 'PayPalAccount':
      this.html = this.html.replace(/@ICON/g, 'logoPayPal');
      this.html = this.html.replace(/@TITLE/g, this.paymentMethod.details.email);
      this.html = this.html.replace(/@SUBTITLE/g, this.strings.PayPal);
      break;
    default:
      break;
  }

  this.element.innerHTML = this.html;
};

PaymentMethodView.prototype.setActive = function (isActive) {
  if (isActive) {
    classlist.add(this.element, 'braintree-method--active');
    return;
  }
  classlist.remove(this.element, 'braintree-method--active');
};

module.exports = PaymentMethodView;
