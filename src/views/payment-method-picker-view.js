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
PaymentMethodPickerView.ID = PaymentMethodPickerView.prototype.ID = 'braintree-dropin__payment-method-picker';

PaymentMethodPickerView.prototype._initialize = function () {
  this.togglerItem = this.element.querySelector('.braintree-dropin__payment-method-picker-toggler');

  this.togglerItem.addEventListener('click', function () {
    this.toggle();
  }.bind(this));

  this.views = [
    CardPickerView,
    PayPalPickerView
  ].reduce(function (views, PickerView) {
    var pickerView;

    if (PickerView.isEnabled(this.options)) {
      pickerView = new PickerView({
        mainView: this.mainView,
        options: this.options
      });
      this.element.appendChild(pickerView.element);

      views.push(pickerView);
    }

    return views;
  }.bind(this), []);

  if (this.views.length === 1) {
    classlist.add(this.element, 'braintree-dropin__hidden');
  }

  this.existingPaymentMethods.forEach(function (paymentMethod) {
    this.addCompletedPickerView(paymentMethod);
  }.bind(this));
};

PaymentMethodPickerView.prototype.toggle = function () {
  classlist.toggle(this.element, 'braintree-dropin__closed');
};

PaymentMethodPickerView.prototype.collapse = function () {
  classlist.add(this.element, 'braintree-dropin__closed');
};

PaymentMethodPickerView.prototype.addCompletedPickerView = function (paymentMethod) {
  var completedPickerView = new CompletedPickerView({
    mainView: this.mainView,
    paymentMethod: paymentMethod
  });

  this.element.appendChild(completedPickerView.element);
  classlist.remove(this.element, 'braintree-dropin__hidden');
  this.views.push(completedPickerView);
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
