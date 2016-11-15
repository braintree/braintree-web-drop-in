'use strict';

var BaseView = require('../base-view');

function BasePaymentMethodView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

BasePaymentMethodView.prototype = Object.create(BaseView.prototype);
BasePaymentMethodView.prototype.constructor = BasePaymentMethodView;

BasePaymentMethodView.prototype._initialize = function () {
};

module.exports = BasePaymentMethodView;
