'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var sheetViews = require('./payment-sheet-views');
var PaymentMethodsView = require('./payment-methods-view');
var PaymentOptionsView = require('./payment-options-view');
var supportsFlexbox = require('../lib/supports-flexbox');
var strings = require('../translations/en'); // todo: locale support

function MainView() {
  BaseView.apply(this, arguments);

  this.dependenciesInitializing = 0;

  this._initialize();
}

MainView.prototype = Object.create(BaseView.prototype);
MainView.prototype.constructor = MainView;

MainView.prototype._initialize = function () {
  var hasMultiplePaymentOptions = this.model.supportedPaymentOptions.length > 1;
  var paymentMethodsViews, paymentOptionsView;
  var paymentMethods = this.model.getPaymentMethods();

  this.strings = strings;

  this._views = {};

  this.sheetContainer = this.getElementById('sheet-container');
  this.sheetErrorText = this.getElementById('sheet-error-text');

  this.toggle = this.getElementById('toggle');

  this.loadingContainer = this.getElementById('loading-container');
  this.loadingIndicator = this.getElementById('loading-indicator');
  this.dropinContainer = this.element.querySelector('.braintree-dropin');

  this.supportsFlexbox = supportsFlexbox();

  this.model.on('loadBegin', this.showLoadingIndicator.bind(this));
  this.model.on('loadEnd', this.hideLoadingIndicator.bind(this));

  this.model.on('errorOccurred', this.showSheetError.bind(this));
  this.model.on('errorCleared', this.hideSheetError.bind(this));

  this.paymentSheetViewIDs = Object.keys(sheetViews).reduce(function (ids, sheetViewKey) {
    var PaymentSheetView, paymentSheetView;

    if (this.model.supportedPaymentOptions.indexOf(sheetViewKey) !== -1) {
      PaymentSheetView = sheetViews[sheetViewKey];

      paymentSheetView = new PaymentSheetView({
        element: this.getElementById(PaymentSheetView.ID),
        mainView: this,
        model: this.model,
        client: this.client,
        strings: this.strings
      });

      this.addView(paymentSheetView);
      ids.push(paymentSheetView.ID);
    }

    return ids;
  }.bind(this), []);

  paymentMethodsViews = new PaymentMethodsView({
    element: this.getElementById(PaymentMethodsView.ID),
    model: this.model,
    strings: this.strings
  });
  this.addView(paymentMethodsViews);

  this.toggle.addEventListener('click', this.toggleAdditionalOptions.bind(this));

  this.model.on('changeActivePaymentMethod', function () {
    this.setPrimaryView(PaymentMethodsView.ID);
  }.bind(this));

  this.model.on('changeActivePaymentView', function (id) {
    if (id === PaymentMethodsView.ID) {
      classlist.add(paymentMethodsViews.element, 'braintree-methods--active');
      classlist.remove(this.sheetContainer, 'braintree-sheet--active');
    } else {
      classlist.add(this.sheetContainer, 'braintree-sheet--active');
      classlist.remove(paymentMethodsViews.element, 'braintree-methods--active');
    }
  }.bind(this));

  if (hasMultiplePaymentOptions) {
    paymentOptionsView = new PaymentOptionsView({
      element: this.getElementById(PaymentOptionsView.ID),
      mainView: this,
      model: this.model,
      strings: this.strings
    });

    this.addView(paymentOptionsView);
  }

  if (paymentMethods.length > 0) {
    this.model.changeActivePaymentMethod(paymentMethods[0]);
  } else if (hasMultiplePaymentOptions) {
    this.setPrimaryView(paymentOptionsView.ID);
  } else {
    this.setPrimaryView(this.paymentSheetViewIDs[0]);
  }
};

MainView.prototype.addView = function (view) {
  this._views[view.ID] = view;
};

MainView.prototype.getView = function (id) {
  return this._views[id];
};

MainView.prototype.setPrimaryView = function (id) {
  if (this.primaryView && this.primaryView.closeFrame) {
    this.primaryView.closeFrame();
  }

  this.element.className = prefixClass(id);
  this.primaryView = this.getView(id);
  this.model.changeActivePaymentView(id);

  if (this.paymentSheetViewIDs.indexOf(id) !== -1) {
    if (this.model.getPaymentMethods().length > 0 || this.getView(PaymentOptionsView.ID)) {
      this.showToggle();
    } else {
      this.hideToggle();
    }
  } else if (id === PaymentMethodsView.ID) {
    this.showToggle();
  } else if (id === PaymentOptionsView.ID) {
    this.hideToggle();
  }

  if (!this.supportsFlexbox) {
    // TODO update no flex support
    this.element.className += ' braintree-dropin__no-flexbox';
  }

  this.model.clearError();
  this.model.endLoading();
};

MainView.prototype.requestPaymentMethod = function (callback) {
  var activePaymentView = this.getView(this.model.getActivePaymentView());

  activePaymentView.requestPaymentMethod(function (err, payload) {
    if (err) {
      callback(err);
      return;
    }
    this.setPrimaryView(PaymentMethodsView.ID);
    callback(null, payload);
  }.bind(this));
};

MainView.prototype.showLoadingIndicator = function () {
  classlist.remove(this.loadingIndicator, 'braintree-loader__indicator--inactive');
  classlist.remove(this.loadingContainer, 'braintree-loader__container--inactive');
  classlist.add(this.dropinContainer, 'braintree-hidden');
};

MainView.prototype.hideLoadingIndicator = function () {
  setTimeout(function () {
    classlist.add(this.loadingIndicator, 'braintree-loader__indicator--inactive');
  }.bind(this), 200);

  setTimeout(function () {
    classlist.add(this.loadingContainer, 'braintree-loader__container--inactive');
    classlist.remove(this.dropinContainer, 'braintree-hidden');
  }.bind(this), 1000);
};

MainView.prototype.toggleAdditionalOptions = function () {
  var sheetViewID;
  var hasMultiplePaymentOptions = this.model.supportedPaymentOptions.length > 1;
  var isPaymentSheetView = this.paymentSheetViewIDs.indexOf(this.primaryView.ID) !== -1;

  this.hideToggle();

  if (!hasMultiplePaymentOptions) {
    sheetViewID = this.paymentSheetViewIDs[0];

    classlist.add(this.element, prefixClass(sheetViewID));
    this.model.changeActivePaymentView(sheetViewID);
  } else if (isPaymentSheetView) {
    if (this.model.getPaymentMethods().length === 0) {
      this.setPrimaryView(PaymentOptionsView.ID);
    } else {
      this.setPrimaryView(PaymentMethodsView.ID);
      this.hideToggle();
      classlist.add(this.element, prefixClass(PaymentOptionsView.ID));
    }
  } else {
    classlist.add(this.element, prefixClass(PaymentOptionsView.ID));
  }
};

MainView.prototype.showToggle = function () {
  classlist.remove(this.toggle, 'braintree-hidden');
};

MainView.prototype.hideToggle = function () {
  classlist.add(this.toggle, 'braintree-hidden');
};

MainView.prototype.showSheetError = function (error) {
  var errorMessage = this.strings.genericError;

  if (error && error.code && this.strings[snakeCaseToCamelCase(error.code) + 'Error']) {
    errorMessage = this.strings[snakeCaseToCamelCase(error.code) + 'Error'];
  } else if (error && error.message) {
    errorMessage = error.message;
  }

  classlist.add(this.sheetContainer, 'braintree-sheet--has-error');
  this.sheetErrorText.textContent = errorMessage;
};

MainView.prototype.hideSheetError = function () {
  classlist.remove(this.sheetContainer, 'braintree-sheet--has-error');
};

MainView.prototype.teardown = function (callback) {
  var viewNames = Object.keys(this._views);
  var numberOfViews = viewNames.length;
  var viewsTornDown = 0;
  var error;

  viewNames.forEach(function (view) {
    this._views[view].teardown(function (err) {
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

function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function (m) {
    return m[1].toUpperCase();
  });
}

function prefixClass(classname) {
  return 'braintree-' + classname;
}

module.exports = MainView;
