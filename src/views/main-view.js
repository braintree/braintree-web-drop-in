'use strict';

var BaseView = require('./base-view');
var PaymentMethodPickerView = require('./payment-method-picker-view');
var PayWithCardView = require('./pay-with-card-view');

function MainView() {
  BaseView.apply(this, arguments);

  this.dependenciesInitializing = 0;
  this._initialize();
}

MainView.prototype = Object.create(BaseView.prototype);
MainView.prototype.constructor = MainView;

MainView.prototype._initialize = function () {
  var payWithCardView = new PayWithCardView({
    element: this.dropinWrapper.querySelector('.braintree-dropin__view.' + PayWithCardView.ID),
    mainView: this,
    options: this.options
  });
  var paymentMethodPickerView = new PaymentMethodPickerView({
    element: this.dropinWrapper.querySelector('.' + PaymentMethodPickerView.ID),
    existingPaymentMethods: this.existingPaymentMethods,
    mainView: this,
    options: this.options
  });

  this.views = {};
  this.addView(payWithCardView);
  this.addView(paymentMethodPickerView);
  this.paymentMethodPickerView = paymentMethodPickerView;

  if (this.paymentMethodPickerView.views.length === 1) {
    this.setActiveView(PayWithCardView.ID);
  } else {
    this.setActiveView(PaymentMethodPickerView.ID);
  }
};

MainView.prototype.addView = function (view) {
  this.views[view.ID] = view;
};

MainView.prototype.setActiveView = function (id) {
  this.activeView = this.views[id];
  this.dropinWrapper.className = id;
};

MainView.prototype.requestPaymentMethod = function (callback) {
  if (typeof this.activeView.requestPaymentMethod !== 'function') {
    callback(new Error('No payment method available.'));
    return;
  }

  this.activeView.requestPaymentMethod(callback);
};

MainView.prototype.asyncDependencyStarting = function () {
  this.dependenciesInitializing++;
};

MainView.prototype.asyncDependencyReady = function () {
  this.dependenciesInitializing--;
  if (this.dependenciesInitializing === 0) {
    this.callback();
  }
};

MainView.prototype.updateActivePaymentMethod = function (paymentMethod, existing) {
  this.setActiveView(PaymentMethodPickerView.ID);
  this.paymentMethodPickerView.setActivePaymentMethod(paymentMethod);

  if (!existing) {
    this.paymentMethodPickerView.addCompletedPickerView(paymentMethod);
  }
};

MainView.prototype.teardown = function (callback) {
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

module.exports = MainView;
