'use strict';

var BaseView = require('./base-view');
var CompletedPaymentMethodView = require('./completed-payment-method-view');
var isGuestCheckout = require('../lib/is-guest-checkout');

function CompletedView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

CompletedView.prototype = Object.create(BaseView.prototype);
CompletedView.prototype.constructor = CompletedView;
CompletedView.ID = CompletedView.prototype.ID = 'completed';

CompletedView.prototype._initialize = function () {
  var i;
  var paymentMethods = this.model.getPaymentMethods();

  this.views = [];
  this.container = this.getElementById('completed-container');
  this.isGuestCheckout = isGuestCheckout(this.options.authorization);

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));

  if (paymentMethods.length > 0) {
    for (i = paymentMethods.length - 1; i >= 0; i--) {
      this._addPaymentMethod(paymentMethods[i]);
    }
  }
};

CompletedView.prototype._addPaymentMethod = function (paymentMethod) {
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

CompletedView.prototype._changeActivePaymentMethodView = function (paymentMethod) {
  var activeView, i;
  var previousActiveView = this.activeView;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      activeView = this.views[i];
      break;
    }
  }

  if (previousActiveView) {
    previousActiveView.setActive(false);
  }
  this.activeView = activeView;
  this.activeView.setActive(true);
};

CompletedView.prototype.requestPaymentMethod = function (callback) {
  callback(null, this.model.getActivePaymentMethod());
};

module.exports = CompletedView;
