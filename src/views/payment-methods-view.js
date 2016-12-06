'use strict';

var BaseView = require('./base-view');
var CompletedPaymentMethodView = require('./completed-payment-method-view');
var isGuestCheckout = require('../lib/is-guest-checkout');

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
  this.isGuestCheckout = isGuestCheckout(this.options.authorization);

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));

  if (paymentMethods.length > 0) {
    for (i = paymentMethods.length - 1; i >= 0; i--) {
      this._addPaymentMethod(paymentMethods[i]);
    }
  }
};

PaymentMethodsView.prototype._addPaymentMethod = function (paymentMethod) {
  var completedPaymentMethodView = new CompletedPaymentMethodView({
    model: this.model,
    paymentMethod: paymentMethod,
    strings: this.strings
  });

  if (this.isGuestCheckout && this.container.firstChild) {
    this.container.removeChild(this.container.firstChild);
    this.views.pop();
  }

  if (this.container.firstChild) {
    this.container.insertBefore(completedPaymentMethodView.element, this.container.firstChild);
  } else {
    this.container.appendChild(completedPaymentMethodView.element);
  }

  this.views.push(completedPaymentMethodView);
};

PaymentMethodsView.prototype._changeActivePaymentMethodView = function (paymentMethod) {
  var activeMethodView, i;
  var previousActiveMethodView = this.activeMethodView;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      activeMethodView = this.views[i];
      break;
    }
  }

  if (previousActiveMethodView) {
    previousActiveMethodView.setActive(false);
  }
  this.activeMethodView = activeMethodView;
  this.activeMethodView.setActive(true);
};

PaymentMethodsView.prototype.requestPaymentMethod = function (callback) {
  callback(null, this.model.getActivePaymentMethod());
};

module.exports = PaymentMethodsView;
