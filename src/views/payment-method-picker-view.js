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

  this.element.addEventListener('keydown', function (event) {
    if (event.which === 13) { this.toggleDrawer(); }
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

  if (paymentMethods.length > 0) {
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
    classlist.remove(this.element, 'braintree-dropin__hide');
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
  var i, view;

  for (i = 0; i < this.views.length; i++) {
    view = this.views[i];

    if (view.paymentMethod && view.paymentMethod.nonce === paymentMethod.nonce) {
      return view;
    }
  }
  return null;
};

PaymentMethodPickerView.prototype.setActivePaymentMethod = function (paymentMethod) {
  var completedPickerView = this.getCompletedPickerView(paymentMethod);
  var html = completedPickerView.html;
  var firstChild = this.savedPaymentMethods.firstChild;

  this.activePaymentMethod.innerHTML = html;

  this.hideCheckMarks();
  classlist.add(completedPickerView.checkIcon, 'braintree-dropin__check-container--active');
  this.savedPaymentMethods.insertBefore(completedPickerView.element, firstChild);
};

PaymentMethodPickerView.prototype.hideCheckMarks = function () {
  this.views.forEach(function (view) {
    if (view.checkIcon) {
      classlist.remove(view.checkIcon, 'braintree-dropin__check-container--active');
    }
  });
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
