'use strict';

var assign = require('../lib/assign').assign;
var DropinError = require('../lib/dropin-error');
var errors = require('../constants').errors;

function BaseView(options) {
  options = options || {};

  assign(this, options);
}

BaseView.prototype.getElementById = function (id) {
  if (!this.element) { return null; }

  return this.element.querySelector('[data-braintree-id="' + id + '"]');
};

BaseView.prototype.requestPaymentMethod = function () {
  return Promise.reject(new DropinError(errors.NO_PAYMENT_METHOD_ERROR));
};

BaseView.prototype.getPaymentMethod = function () {
  return this.activeMethodView && this.activeMethodView.paymentMethod;
};

BaseView.prototype.onSelection = function () {};

BaseView.prototype.teardown = function () {
  return Promise.resolve();
};

BaseView.prototype.preventUserAction = function () {
  if (this.element) {
    this.element.classList.add('braintree-sheet--loading');
  }

  this.model.preventUserAction();
};

BaseView.prototype.allowUserAction = function () {
  if (this.element) {
    this.element.classList.remove('braintree-sheet--loading');
  }

  this.model.allowUserAction();
};

module.exports = BaseView;
