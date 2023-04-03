'use strict';

var BaseView = require('./base-view');
var PaymentMethodView = require('./payment-method-view');
var DropinError = require('../lib/dropin-error');
var errors = require('../constants').errors;
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
  this.views = [];
  this.container = this.getElementById('methods-container');
  this._headingLabel = this.getElementById('methods-label');
  this._editButton = this.getElementById('methods-edit');

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));
  this.model.on('refreshPaymentMethods', this.refreshPaymentMethods.bind(this));

  this.refreshPaymentMethods();

  if (this.model.merchantConfiguration.vaultManager) {
    this.model.on('removePaymentMethod', this._removePaymentMethod.bind(this));

    addSelectionEventHandler(this._editButton, function () {
      if (this.model.isInEditMode()) {
        this.model.disableEditMode();
      } else {
        this.model.enableEditMode();
      }
    }.bind(this));

    this._editButton.classList.remove('braintree-hidden');
  }
};

PaymentMethodsView.prototype.removeActivePaymentMethod = function () {
  if (!this.activeMethodView) {
    return;
  }
  this.activeMethodView.setActive(false);
  this.activeMethodView = null;
  this._headingLabel.classList.add('braintree-no-payment-method-selected');
};

PaymentMethodsView.prototype._getPaymentMethodString = function () {
  var stringKey, paymentMethodTypeString;

  if (!this.activeMethodView) {
    return '';
  }

  stringKey = PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING[this.activeMethodView.paymentMethod.type];
  paymentMethodTypeString = this.strings[stringKey];

  return this.strings.payingWith.replace('{{paymentSource}}', paymentMethodTypeString);
};

PaymentMethodsView.prototype.enableEditMode = function () {
  this.container.classList.add('braintree-methods--edit');

  this._editButton.innerHTML = this.strings.deleteCancelButton;
  this._headingLabel.innerHTML = this.strings.editPaymentMethods;

  this.views.forEach(function (view) {
    view.enableEditMode();
  });
};

PaymentMethodsView.prototype.disableEditMode = function () {
  this.container.classList.remove('braintree-methods--edit');

  this._editButton.innerHTML = this.strings.edit;
  this._headingLabel.innerHTML = this._getPaymentMethodString();

  this.views.forEach(function (view) {
    view.disableEditMode();
  });
};

PaymentMethodsView.prototype._addPaymentMethod = function (paymentMethod) {
  var paymentMethodView = new PaymentMethodView({
    model: this.model,
    paymentMethod: paymentMethod,
    client: this.client,
    strings: this.strings
  });

  if (this.model.isGuestCheckout && this.container.firstChild) {
    this.views[0].teardown();
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
      this.views[i].teardown();
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
  this._headingLabel.classList.remove('braintree-no-payment-method-selected');
};

PaymentMethodsView.prototype.requestPaymentMethod = function () {
  if (!this.activeMethodView || this.model.isInEditMode()) {
    return Promise.reject(new DropinError(errors.NO_PAYMENT_METHOD_ERROR));
  }

  return Promise.resolve(this.activeMethodView.paymentMethod);
};

PaymentMethodsView.prototype.refreshPaymentMethods = function () {
  var i;
  var paymentMethods = this.model.getPaymentMethods();

  this.views.forEach(function (view) {
    view.teardown();
  });

  this.views = [];

  for (i = paymentMethods.length - 1; i >= 0; i--) {
    this._addPaymentMethod(paymentMethods[i]);
  }
};

module.exports = PaymentMethodsView;
