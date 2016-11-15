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
  this.container = this.getElementById('completed-container');

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
};

CompletedView.prototype._addPaymentMethod = function (paymentMethod) {
  var completedPaymentMethodView = new CompletedPaymentMethodView({
    paymentMethod: paymentMethod,
    strings: this.strings
  });

  if (isGuestCheckout(this.options.authorization)) {
    this.container.innerHTML = '';
  }

  this.container.appendChild(completedPaymentMethodView.element);
};

module.exports = CompletedView;
