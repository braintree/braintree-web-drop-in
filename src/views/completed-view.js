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
  this.termSlot = this.element.querySelector('.braintree-list__term');
  this.descriptionSlot = this.element.querySelector('.braintree-list__desc');
};

CompletedView.prototype.requestPaymentMethod = function (callback) {
  callback(null, this.paymentMethod);
};

CompletedView.prototype.updatePaymentMethod = function (paymentMethod) {
  this.paymentMethod = paymentMethod;

  if (this.paymentMethod.type === 'PayPalAccount') {
    this.termSlot.textContent = this.paymentMethod.details.email;
    this.descriptionSlot.textContent = 'PayPal';
  } else {
    this.termSlot.textContent = 'Ending in ••' + this.paymentMethod.details.lastTwo;
    this.descriptionSlot.textContent = this.paymentMethod.details.cardType;
  }
};

module.exports = CompletedView;
