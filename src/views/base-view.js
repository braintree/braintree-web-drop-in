'use strict';

var assign = require('../lib/assign').assign;
var errorMessage = require('../constants').NO_PAYMENT_METHOD_ERROR;

function BaseView(options) {
  options = options || {};

  assign(this, options);
}

BaseView.prototype.getElementById = function (id) {
  if (!this.element) { return null; }

  return this.element.querySelector('[data-braintree-id="' + id + '"]');
};

BaseView.prototype.requestPaymentMethod = function (callback) {
  callback(new Error(errorMessage));
};

BaseView.prototype.teardown = function (cb) {
  cb();
};

module.exports = BaseView;
