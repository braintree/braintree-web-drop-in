'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var CardView = require('./payment-method-views/card-view');
var CompletedView = require('./completed-view');
var isGuestCheckout = require('../lib/is-guest-checkout');
var PayPalView = require('./payment-method-views/paypal-view');
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
  // Make PaymentMethodViews for every enabled payment option
  // If guest checkout:
  //  - One payment method enabled: show that PaymentMethodView
  //  - 1+ payment method enabled: show AccordionView
  // If vaulted:
  //  - show CompletedView
  var paymentMethods = this.model.getPaymentMethods();
  var paymentMethodViews;

  this.additionalOptions = this.getElementById('additional-options');
  this.alert = this.getElementById('alert');
  this.views = {};

  paymentMethodViews = [
    CardView,
    PayPalView
  ].reduce(function (views, PaymentMethodView) {
    var paymentMethodView;

    if (PaymentMethodView.isEnabled(this.options)) {
      paymentMethodView = new PaymentMethodView({
        element: this.getElementById(PaymentMethodView.ID),
        mainView: this,
        model: this.model,
        options: this.options,
        strings: this.strings
      });

      this.addView(paymentMethodView);
      views.push(paymentMethodView);
    }
    return views;
  }.bind(this), []);

  this.completedView = new CompletedView({
    element: this.getElementById(CompletedView.ID),
    model: this.model,
    options: this.options,
    strings: this.strings
  });
  this.addView(this.completedView);

  this.additionalOptions.addEventListener('click', this.showAdditionalOptions.bind(this));

  this.loadingContainer = this.element.querySelector('[data-braintree-id="loading-container"]');
  this.loadingIndicator = this.element.querySelector('[data-braintree-id="loading-indicator"]');
  this.dropinContainer = this.element.querySelector('.braintree-dropin');
  this.supportsFlexbox = supportsFlexbox();

  this.model.on('asyncDependenciesReady', this.hideLoadingIndicator.bind(this));

  this.model.on('changeActivePaymentMethod', function () {
    this.setActiveView(CompletedView.ID);
  }.bind(this));

  this.model.on('loadBegin', this.showLoadingIndicator.bind(this));
  this.model.on('loadEnd', this.hideLoadingIndicator.bind(this));

  if (paymentMethods.length > 0) {
    this.model.changeActivePaymentMethod(paymentMethods[0]);
  } else if (paymentMethodViews.length > 1) {
    // create and show payment options view

  } else {
    this.setActiveView(paymentMethodViews[0].ID);
  }
};

MainView.prototype.addView = function (view) {
  this.views[view.ID] = view;
};

MainView.prototype.getView = function (id) {
  return this.views[id];
};

MainView.prototype.setActiveView = function (id) {
  this.dropinWrapper.className = 'braintree-dropin__' + id;
  this.activeView = this.getView(id);

  // TODO: make this better
  switch (id) {
    case CardView.ID:
      if (!isGuestCheckout(this.options.authorization)) {
        this.showAdditionalOptionsButton();
      } else {
        this.hideAdditionalOptionsButton();
      }
      break;
    case CompletedView.ID:
      this.showAdditionalOptionsButton();
      break;
    default:
      break;
  }

  if (!this.supportsFlexbox) {
    this.dropinWrapper.className += ' braintree-dropin__no-flexbox';
  }

  this.model.clearError();
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

function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function (m) {
    return m[1].toUpperCase();
  });
}

MainView.prototype.showAdditionalOptions = function () {
  if (this.activeView === this.completedView) {
    // TODO: if there's only one payment method, make that the active view.
    // If there are multiple, show the accordion.
    this.setActiveView(CardView.ID);
  } else {
    this.setActiveView(CompletedView.ID);
  }
};

MainView.prototype.showAdditionalOptionsButton = function () {
  classlist.remove(this.additionalOptions, 'braintree-dropin__display--none');
};

MainView.prototype.hideAdditionalOptionsButton = function () {
  classlist.add(this.additionalOptions, 'braintree-dropin__display--none');
};

MainView.prototype.showAlert = function (error) {
  var errorMessage;

  if (error && error.code && this.strings[snakeCaseToCamelCase(error.code) + 'Error']) {
    errorMessage = this.strings[snakeCaseToCamelCase(error.code) + 'Error'];
  } else {
    errorMessage = error.message || this.strings.genericError;
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
