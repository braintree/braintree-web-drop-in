'use strict';

var BraintreeError = require('../lib/error');
var BaseView = require('./base-view');
var CompletedView = require('./completed-view');
var errors = require('../errors');
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
  var completedView = new CompletedView({
    element: this.dropinWrapper.querySelector('.' + CompletedView.ID)
  });
  var payWithCardView = new PayWithCardView({
    element: this.dropinWrapper.querySelector('.' + PayWithCardView.ID),
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
  this.addView(completedView);
  this.addView(payWithCardView);
  this.addView(paymentMethodPickerView);
  this.paymentMethodPickerView = paymentMethodPickerView;

  if (this.existingPaymentMethods.length > 0) {
    completedView.updatePaymentMethod(this.existingPaymentMethods[0]);
    this.setActiveView(completedView.ID);
  } else if (this.paymentMethodPickerView.views.length > 1) {
    this.setActiveView(this.paymentMethodPickerView.ID);
  } else {
    this.setActiveView(payWithCardView.ID);
  }
};

MainView.prototype.addView = function (view) {
  this.views[view.ID] = view;
};

MainView.prototype.setActiveView = function (id) {
  this.activeView = this.views[id];
  this.paymentMethodPickerView.collapse();

  this.dropinWrapper.className = id;
};

MainView.prototype.requestPaymentMethod = function (callback) {
  if (typeof this.activeView.requestPaymentMethod !== 'function') {
    callback(new BraintreeError(errors.REQUEST_PAYMENT_METHOD_UNAVAILABLE));
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

MainView.prototype.updateCompletedView = function (paymentMethod, existing) {
  var completedView = this.views[CompletedView.ID];

  completedView.updatePaymentMethod(paymentMethod);
  this.setActiveView(CompletedView.ID);

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
