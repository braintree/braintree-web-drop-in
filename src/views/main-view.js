'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var errors = require('../errors');
var PaymentMethodPickerView = require('./payment-method-picker-view');
var PayWithCardView = require('./pay-with-card-view');
var supportsFlexbox = require('../lib/supports-flexbox');

function MainView() {
  BaseView.apply(this, arguments);

  this.dependenciesInitializing = 0;
  this.element = this.dropinWrapper;
  this._initialize();
}

MainView.prototype = Object.create(BaseView.prototype);
MainView.prototype.constructor = MainView;

MainView.prototype._initialize = function () {
  var paymentMethods = this.model.getPaymentMethods();
  var payWithCardView;

  this.alert = this.getElementById('alert');

  payWithCardView = new PayWithCardView({
    element: this.getElementById(PayWithCardView.ID),
    mainView: this,
    model: this.model,
    options: this.options,
    strings: this.strings
  });

  this.paymentMethodPickerView = new PaymentMethodPickerView({
    element: this.getElementById(PaymentMethodPickerView.ID),
    model: this.model,
    mainView: this,
    options: this.options,
    strings: this.strings
  });

  this.views = {};
  this.addView(payWithCardView);
  this.addView(this.paymentMethodPickerView);
  this.loadingContainer = this.element.querySelector('[data-braintree-id="loading-container"]');
  this.loadingIndicator = this.element.querySelector('[data-braintree-id="loading-indicator"]');
  this.dropinContainer = this.element.querySelector('.braintree-dropin');
  this.supportsFlexbox = supportsFlexbox();

  this.model.on('asyncDependenciesReady', this.hideLoadingIndicator.bind(this));

  this.model.on('changeActivePaymentMethod', function () {
    this.setActiveView('active-payment-method');
  }.bind(this));

  this.model.on('loadBegin', this.showLoadingIndicator.bind(this));
  this.model.on('loadEnd', this.hideLoadingIndicator.bind(this));

  this.model.on('errorOccurred', function (errorCode) {
    this.showAlert(errorCode);
  }.bind(this));

  this.model.on('errorCleared', this.hideAlert.bind(this));

  if (paymentMethods.length > 0) {
    this.model.changeActivePaymentMethod(paymentMethods[0]);
  } else if (this.paymentMethodPickerView.views.length === 1) {
    this.setActiveView(PayWithCardView.ID);
    classlist.add(this.getElementById('payment-method-picker'), 'braintree-dropin__hide');
  } else {
    this.setActiveView('choose-payment-method');
  }
};

MainView.prototype.addView = function (view) {
  this.views[view.ID] = view;
};

MainView.prototype.setActiveView = function (id) {
  this.dropinWrapper.className = 'braintree-dropin__' + id;

  if (!this.supportsFlexbox) {
    this.dropinWrapper.className += ' braintree-dropin__no-flexbox';
  }

  this.model.clearError();

  if (id !== 'active-payment-method') {
    this.paymentMethodPickerView.hideCheckMarks();
  }
  this.model.endLoading();
};

MainView.prototype.showLoadingIndicator = function () {
  classlist.remove(this.loadingIndicator, 'braintree-dropin__loading-indicator--inactive');
  classlist.remove(this.loadingContainer, 'braintree-dropin__loading-container--inactive');
  classlist.add(this.dropinContainer, 'braintree-dropin__hide');
};

MainView.prototype.hideLoadingIndicator = function () {
  setTimeout(function () {
    classlist.add(this.loadingIndicator, 'braintree-dropin__loading-indicator--inactive');
  }.bind(this), 200);

  setTimeout(function () {
    classlist.add(this.loadingContainer, 'braintree-dropin__loading-container--inactive');
    classlist.remove(this.dropinContainer, 'braintree-dropin__hide');
  }.bind(this), 1000);
};

MainView.prototype.showAlert = function (error) {
  var errorMessage;

  if (error && error.code && errors[error.code]) {
    errorMessage = errors[error.code];
  } else {
    errorMessage = error.message || errors.GENERIC;
  }

  classlist.remove(this.alert, 'braintree-dropin__display--none');
  this.alert.textContent = errorMessage;
};

MainView.prototype.hideAlert = function () {
  classlist.add(this.alert, 'braintree-dropin__display--none');
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
