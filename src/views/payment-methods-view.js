'use strict';

var BaseView = require('./base-view');
var PaymentMethodView = require('./payment-method-view');

var PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING = {
  CreditCard: 'Card',
  PayPalAccount: 'PayPal'
};

function PaymentMethodsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodsView.prototype = Object.create(BaseView.prototype);
PaymentMethodsView.prototype.constructor = PaymentMethodsView;
PaymentMethodsView.ID = PaymentMethodsView.prototype.ID = 'methods';

PaymentMethodsView.prototype._initialize = function () {
  var i;
  var paymentMethods = this.model.getPaymentMethods();

  this.views = [];
  this.container = this.getElementById('methods-container');
  this._headingLabel = this.getElementById('methods-label');

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));

  for (i = paymentMethods.length - 1; i >= 0; i--) {
    this._addPaymentMethod(paymentMethods[i]);
  }
};

PaymentMethodsView.prototype._getPaymentMethodString = function () {
  var stringKey = PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING[this.activeMethodView.paymentMethod.type];
  var paymentMethodTypeString = this.strings[stringKey];

  return this.strings.payingWith.replace('{{paymentSource}}', paymentMethodTypeString);
};

PaymentMethodsView.prototype._addPaymentMethod = function (paymentMethod) {
  var paymentMethodView = new PaymentMethodView({
    model: this.model,
    paymentMethod: paymentMethod,
    strings: this.strings
  });

  if (this.model.isGuestCheckout && this.container.firstChild) {
    this.container.removeChild(this.container.firstChild);
    this.views.pop();
  }

  if (this.container.firstChild) {
    this.container.insertBefore(paymentMethodView.element, this.container.firstChild);
  } else {
    this.container.appendChild(paymentMethodView.element);
  }

  this.views.push(paymentMethodView);
};

PaymentMethodsView.prototype._changeActivePaymentMethodView = function (paymentMethod) {
  var i;
  var previousActiveMethodView = this.activeMethodView;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      this.activeMethodView = this.views[i];
      this._headingLabel.textContent = this._getPaymentMethodString();
      break;
    }
  }

  if (previousActiveMethodView) {
    previousActiveMethodView.setActive(false);
  }
  this.activeMethodView.setActive(true);
};

PaymentMethodsView.prototype.requestPaymentMethod = function (callback) {
  callback(null, this.activeMethodView.paymentMethod);
};

module.exports = PaymentMethodsView;
