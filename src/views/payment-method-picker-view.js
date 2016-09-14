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
  var savedPaymentMethodsHeader = this.getElementById('saved-payment-methods-header');
  var paymentMethods = this.model.getPaymentMethods();

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

  if (paymentMethods) {
    classlist.remove(savedPaymentMethodsHeader, 'braintree-dropin__display--none');
    paymentMethods.forEach(function (paymentMethod) {
      this.addCompletedPickerView(paymentMethod);
    }.bind(this));
  }

  this.model.on('changeActivePaymentMethod', function (paymentMethod) {
    this.setActivePaymentMethod(paymentMethod);
  }.bind(this));

  this.model.on('addPaymentMethod', function (paymentMethod) {
    classlist.remove(savedPaymentMethodsHeader, 'braintree-dropin__display--none');
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

PaymentMethodPickerView.prototype.getCompletedPickerView = function (paymentMethod) {
  var completedView;

  this.views.forEach(function (view) {
    if (view.paymentMethod && view.paymentMethod.nonce === paymentMethod.nonce) {
      completedView = view;
    }
  });

  return completedView;
};

PaymentMethodPickerView.prototype.setActivePaymentMethod = function (paymentMethod) {
  var html;
  var completedPickerView = this.getCompletedPickerView(paymentMethod);

  html = completedPickerView.element.querySelector('.braintree-dropin__payment-method').innerHTML;

  this.activePaymentMethod.innerHTML = html;
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
