'use strict';

var BaseView = require('./base-view');
var CardPickerView = require('./picker-views/card-picker-view');
var CompletedPickerView = require('./picker-views/completed-picker-view');
var PayPalPickerView = require('./picker-views/paypal-picker-view');
var classlist = require('../lib/classlist');

function PaymentMethodPickerView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodPickerView.prototype = Object.create(BaseView.prototype);
PaymentMethodPickerView.prototype.constructor = PaymentMethodPickerView;
PaymentMethodPickerView.ID = PaymentMethodPickerView.prototype.ID = 'payment-method-picker';

PaymentMethodPickerView.prototype._initialize = function () {
  var enabledPaymentMethods = this.getElementById('enabled-payment-methods');

  this.element.addEventListener('click', function () {
    this.toggleDrawer();
  }.bind(this));

  this.drawer = this.getElementById('drawer');
  this.savedPaymentMethods = this.getElementById('saved-payment-methods');
  this.activePaymentMethod = this.getElementById('active-payment-method');
  this.choosePaymentMethod = this.getElementById('choose-payment-method');

  this.views = [
    CardPickerView,
    PayPalPickerView
  ].reduce(function (views, PickerView) {
    var pickerView;

    if (PickerView.isEnabled(this.options)) {
      pickerView = new PickerView({
        mainView: this.mainView,
        model: this.model,
        options: this.options
      });
      enabledPaymentMethods.appendChild(pickerView.element);

      views.push(pickerView);
    }

    return views;
  }.bind(this), []);

  this.model.getPaymentMethods().forEach(function (paymentMethod) {
    this.addCompletedPickerView(paymentMethod);
  }.bind(this));

  this.model.on('changeActivePaymentMethod', function (paymentMethod) {
    this.setActivePaymentMethod(paymentMethod);
  }.bind(this));

  this.model.on('addPaymentMethod', function (paymentMethod) {
    this.addCompletedPickerView(paymentMethod);
  }.bind(this));
};

PaymentMethodPickerView.prototype.toggleDrawer = function () {
  classlist.toggle(this.element, 'braintree-dropin__collapsed');
};

PaymentMethodPickerView.prototype.addCompletedPickerView = function (paymentMethod) {
  var completedPickerView = new CompletedPickerView({
    model: this.model,
    paymentMethod: paymentMethod
  });

  this.savedPaymentMethods.appendChild(completedPickerView.element);
  this.views.push(completedPickerView);
};

PaymentMethodPickerView.prototype.setActivePaymentMethod = function (paymentMethod) {
  var termSlot = this.activePaymentMethod.querySelector('.braintree-dropin__list-term');
  var descriptionSlot = this.activePaymentMethod.querySelector('.braintree-dropin__list-desc');

  this.paymentMethod = paymentMethod;

  if (paymentMethod.type === 'PayPalAccount') {
    termSlot.textContent = this.paymentMethod.details.email;
    descriptionSlot.textContent = 'PayPal';
  } else if (paymentMethod.type === 'CreditCard') {
    termSlot.textContent = 'Ending in ••' + this.paymentMethod.details.lastTwo;
    descriptionSlot.textContent = this.paymentMethod.details.cardType;
  }
};

PaymentMethodPickerView.prototype.teardown = function (callback) {
  var viewNames = Object.keys(this.views);
  var numberOfViews = viewNames.length;
  var viewsTornDown = 0;
  var error;

  viewNames.forEach(function (view) {
    this.views[view].teardown(function (err) {
      if (err) {
        error = err;
      }
      viewsTornDown += 1;

      if (viewsTornDown >= numberOfViews) {
        callback(error);
      }
    });
  }.bind(this));
};

module.exports = PaymentMethodPickerView;
