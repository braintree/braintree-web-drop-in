'use strict';

var BaseView = require('./base-view');

function PaymentOptionsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentOptionsView.prototype = Object.create(BaseView.prototype);
PaymentOptionsView.prototype.constructor = PaymentOptionsView;
PaymentOptionsView.ID = PaymentOptionsView.prototype.ID = 'payment-options';

PaymentOptionsView.prototype._initialize = function () {
};

module.exports = PaymentOptionsView;
