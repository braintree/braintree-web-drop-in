'use strict';

var BaseView = require('./base-view');
var PaymentMethodView = require('./payment-method-view');
var DropinError = require('../lib/dropin-error');
var classlist = require('../lib/classlist');
var errors = require('../constants').errors;
var Promise = require('../lib/promise');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');

var PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING = {
  CreditCard: 'Card',
  PayPalAccount: 'PayPal',
  ApplePayCard: 'Apple Pay',
  AndroidPayCard: 'Google Pay',
  VenmoAccount: 'Venmo'
};

function PaymentMethodsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodsView.prototype = Object.create(BaseView.prototype);
PaymentMethodsView.prototype.constructor = PaymentMethodsView;
PaymentMethodsView.ID = PaymentMethodsView.prototype.ID = 'methods';

PaymentMethodsView.prototype._initialize = function () {
  var i;
  var paymentMethods = this.model.getPaymentMethods();

  this.views = [];
  this.container = this.getElementById('methods-container');
  this._headingLabel = this.getElementById('methods-label');
  this._editButton = this.getElementById('methods-edit');
  this._doneEdittingButton = this.getElementById('done-edit');

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('removePaymentMethod', this._removePaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));

  for (i = paymentMethods.length - 1; i >= 0; i--) {
    this._addPaymentMethod(paymentMethods[i]);
  }

  addSelectionEventHandler(this._editButton, function () {
    this.model.enableEditMode();
  }.bind(this));
  addSelectionEventHandler(this._doneEdittingButton, function () {
    this.model.disableEditMode();
  }.bind(this));
};

PaymentMethodsView.prototype.removeActivePaymentMethod = function () {
  if (!this.activeMethodView) {
    return;
  }
  this.activeMethodView.setActive(false);
  this.activeMethodView = null;
  classlist.add(this._headingLabel, 'braintree-no-payment-method-selected');
};

PaymentMethodsView.prototype._getPaymentMethodString = function () {
  var stringKey = PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING[this.activeMethodView.paymentMethod.type];
  var paymentMethodTypeString = this.strings[stringKey];

  return this.strings.payingWith.replace('{{paymentSource}}', paymentMethodTypeString);
};

PaymentMethodsView.prototype.enableEditMode = function () {
  classlist.add(this.container, 'braintree-methods--edit');

  classlist.add(this._editButton, 'braintree-hidden');
  classlist.add(this._headingLabel, 'braintree-hidden');
  classlist.remove(this._doneEdittingButton, 'braintree-hidden');

  this.views.forEach(function (view) {
    view.enableEditMode();
  });
};

PaymentMethodsView.prototype.disableEditMode = function () {
  classlist.remove(this.container, 'braintree-methods--edit');

  classlist.remove(this._editButton, 'braintree-hidden');
  classlist.remove(this._headingLabel, 'braintree-hidden');
  classlist.add(this._doneEdittingButton, 'braintree-hidden');

  this.views.forEach(function (view) {
    view.disableEditMode();
  });
};

PaymentMethodsView.prototype._addPaymentMethod = function (paymentMethod) {
  var paymentMethodView = new PaymentMethodView({
    model: this.model,
    paymentMethod: paymentMethod,
    strings: this.strings
  });

  if (this.model.isGuestCheckout && this.container.firstChild) {
    this.container.removeChild(this.container.firstChild);
    this.views.pop();
  }

  if (this.container.firstChild) {
    this.container.insertBefore(paymentMethodView.element, this.container.firstChild);
  } else {
    this.container.appendChild(paymentMethodView.element);
  }

  this.views.push(paymentMethodView);
};

PaymentMethodsView.prototype._removePaymentMethod = function (paymentMethod) {
  var i;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      this.container.removeChild(this.views[i].element);
      this._headingLabel.innerHTML = '&nbsp;';
      this.views.splice(i, 1);
      break;
    }
  }
};

PaymentMethodsView.prototype._changeActivePaymentMethodView = function (paymentMethod) {
  var i;
  var previousActiveMethodView = this.activeMethodView;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      this.activeMethodView = this.views[i];
      this._headingLabel.innerHTML = this._getPaymentMethodString();
      break;
    }
  }

  if (previousActiveMethodView) {
    previousActiveMethodView.setActive(false);
  }
  this.activeMethodView.setActive(true);
  classlist.remove(this._headingLabel, 'braintree-no-payment-method-selected');
};

PaymentMethodsView.prototype.requestPaymentMethod = function () {
  if (!this.activeMethodView) {
    return Promise.reject(new DropinError(errors.NO_PAYMENT_METHOD_ERROR));
  }
  return Promise.resolve(this.activeMethodView.paymentMethod);
};

module.exports = PaymentMethodsView;
