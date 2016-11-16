'use strict';

var BaseView = require('./base-view');
var CompletedPaymentMethodView = require('./completed-payment-method-view');

function CompletedView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

CompletedView.prototype = Object.create(BaseView.prototype);
CompletedView.prototype.constructor = CompletedView;
CompletedView.ID = CompletedView.prototype.ID = 'completed';

CompletedView.prototype._initialize = function () {
  var paymentMethods = this.model.getPaymentMethods();

  this.views = [];
  this.container = this.getElementById('completed-container');

  // TODO find a better way to detect when in guest checkout, and only show one completed payment method view
  //   - Possibly pass guestCheckout in options?

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));

  if (paymentMethods.length > 0) {
    // Should this add payment methods using the model? I think no, to preserve which one is default
    paymentMethods.forEach(this._addPaymentMethod.bind(this));
    this._changeActivePaymentMethodView(paymentMethods[0]);
  }
};

CompletedView.prototype._addPaymentMethod = function (paymentMethod) {
  var completedPaymentMethodView = new CompletedPaymentMethodView({
    model: this.model,
    paymentMethod: paymentMethod,
    strings: this.strings
  });

  this.container.appendChild(completedPaymentMethodView.element);

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
