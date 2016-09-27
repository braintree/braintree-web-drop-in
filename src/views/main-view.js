'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var DropinErrorEmitter = require('../dropin-error-emitter');
var errors = require('../errors');
var PaymentMethodPickerView = require('./payment-method-picker-view');
var PayWithCardView = require('./pay-with-card-view');

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

  this.errorEmitter = new DropinErrorEmitter();
  this.alert = this.getElementById('alert');

  payWithCardView = new PayWithCardView({
    element: this.getElementById(PayWithCardView.ID),
    errorEmitter: this.errorEmitter,
    mainView: this,
    model: this.model,
    options: this.options
  });

  this.paymentMethodPickerView = new PaymentMethodPickerView({
    element: this.getElementById(PaymentMethodPickerView.ID),
    errorEmitter: this.errorEmitter,
    model: this.model,
    mainView: this,
    options: this.options
  });

  this.views = {};
  this.addView(payWithCardView);
  this.addView(this.paymentMethodPickerView);

  this.model.on('changeActivePaymentMethod', function () {
    this.setActiveView('active-payment-method');
  }.bind(this));

  this.errorEmitter.on('errorOccurred', function (errorCode) {
    this.showAlert(errorCode);
  }.bind(this));

  this.errorEmitter.on('errorCleared', function () {
    this.hideAlert();
  }.bind(this));

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
  this.errorEmitter.clear();

  if (id !== 'active-payment-method') {
    this.paymentMethodPickerView.hideCheckMarks();
  }
};

MainView.prototype.showAlert = function (errorCode) {
  var errorMessage = errors[errorCode] || errors.GENERIC;

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
