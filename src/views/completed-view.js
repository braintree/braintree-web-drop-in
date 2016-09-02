'use strict';

var BaseView = require('./base-view');

function CompletedView() {
  BaseView.apply(this, arguments);
  this._initialize();
}

CompletedView.prototype = Object.create(BaseView.prototype);
CompletedView.prototype.constructor = CompletedView;
CompletedView.ID = CompletedView.prototype.ID = 'braintree-dropin__completed';

CompletedView.prototype._initialize = function () {
  this.typeSlot = this.element.querySelector('.braintree-dropin__completed-type');
  this.nonceSlot = this.element.querySelector('.braintree-dropin__completed-nonce');
};

CompletedView.prototype.requestPaymentMethod = function (callback) {
  callback(null, this.paymentMethod);
};

CompletedView.prototype.updatePaymentMethod = function (paymentMethod) {
  this.paymentMethod = paymentMethod;
  this.typeSlot.textContent = this.paymentMethod.type;
  this.nonceSlot.textContent = this.paymentMethod.nonce;
};

module.exports = CompletedView;
