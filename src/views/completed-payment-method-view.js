'use strict';

var BaseView = require('./base-view');
var paymentMethodCardTypes = require('../constants').paymentMethodCardTypes;
var paymentMethodHTML = require('../html/completed-payment-method.html');

function CompletedPaymentMethodView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

CompletedPaymentMethodView.prototype = Object.create(BaseView.prototype);
CompletedPaymentMethodView.prototype.constructor = CompletedPaymentMethodView;
CompletedPaymentMethodView.ID = CompletedPaymentMethodView.prototype.ID = 'completed-payment-method';

CompletedPaymentMethodView.prototype._initialize = function () {
  this.element = document.createElement('div');

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

module.exports = CompletedPaymentMethodView;
