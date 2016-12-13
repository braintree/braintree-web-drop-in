'use strict';

var BaseView = require('../base-view');

function BasePaymentSheetView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

BasePaymentSheetView.prototype = Object.create(BaseView.prototype);
BasePaymentSheetView.prototype.constructor = BasePaymentSheetView;

BasePaymentSheetView.prototype._initialize = function () {
};

module.exports = BasePaymentSheetView;
