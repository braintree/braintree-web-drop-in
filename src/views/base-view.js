'use strict';

const assign = require('../lib/assign').assign;
const classList = require('@braintree/class-list');
const DropinError = require('../lib/dropin-error');
const errors = require('../constants').errors;
const Promise = require('../lib/promise');

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
    classList.add(this.element, 'braintree-sheet--loading');
  }

  this.model.preventUserAction();
};

BaseView.prototype.allowUserAction = function () {
  if (this.element) {
    classList.remove(this.element, 'braintree-sheet--loading');
  }

  this.model.allowUserAction();
};

module.exports = BaseView;
