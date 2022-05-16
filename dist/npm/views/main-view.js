'use strict';

var analytics = require('../lib/analytics');
var analyticsKinds = require('../constants').analyticsKinds;
var BaseView = require('./base-view');
var classList = require('@braintree/class-list');
var sheetViews = require('./payment-sheet-views');
var PaymentMethodsView = require('./payment-methods-view');
var PaymentOptionsView = require('./payment-options-view');
var DeleteConfirmationView = require('./delete-confirmation-view');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');
var Promise = require('../lib/promise');
var wait = require('../lib/wait');
var supportsFlexbox = require('../lib/supports-flexbox');

var CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT = require('../constants').CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT;
var DEVELOPER_MISCONFIGURATION_MESSAGE = require('../constants').errors.DEVELOPER_MISCONFIGURATION_MESSAGE;

function MainView() {
  BaseView.apply(this, arguments);

  this.dependenciesInitializing = 0;

  this._initialize();
}

MainView.prototype = Object.create(BaseView.prototype);
MainView.prototype.constructor = MainView;

MainView.prototype._initialize = function () {
  var paymentOptionsView;

  this._hasMultiplePaymentOptions = this.model.supportedPaymentOptions.length > 1;

  this._views = {};

  this.sheetContainer = this.getElementById('sheet-container');
  this.sheetErrorText = this.getElementById('sheet-error-text');

  this.toggle = this.getElementById('toggle');
  this.disableWrapper = this.getElementById('disable-wrapper');
  this.lowerContainer = this.getElementById('lower-container');

  this.loadingContainer = this.getElementById('loading-container');
  this.dropinContainer = this.element.querySelector('.braintree-dropin');

  this.supportsFlexbox = supportsFlexbox();

  this.model.on('asyncDependenciesReady', this.hideLoadingIndicator.bind(this));

  this.model.on('errorOccurred', this.showSheetError.bind(this));
  this.model.on('errorCleared', this.hideSheetError.bind(this));
  this.model.on('preventUserAction', this.preventUserAction.bind(this));
  this.model.on('allowUserAction', this.allowUserAction.bind(this));

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
      paymentSheetView.initialize();

      this.addView(paymentSheetView);
      ids.push(paymentSheetView.ID);
    }

    return ids;
  }.bind(this), []);

  this.paymentMethodsViews = new PaymentMethodsView({
    element: this.element,
    model: this.model,
    client: this.client,
    strings: this.strings
  });
  this.addView(this.paymentMethodsViews);

  this.deleteConfirmationView = new DeleteConfirmationView({
    element: this.getElementById('delete-confirmation'),
    model: this.model,
    strings: this.strings
  });
  this.addView(this.deleteConfirmationView);

  addSelectionEventHandler(this.toggle, this.toggleAdditionalOptions.bind(this));

  this.model.on('changeActivePaymentMethod', function () {
    wait.delay(CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT).then(function () {
      var id = PaymentMethodsView.ID;

      // if Drop-in gets into the state where it's told to go to the methods
      // view, but there are no saved payment methods, it should instead
      // redirect to the view it started on
      if (!this.model.hasPaymentMethods()) {
        id = this.model.getInitialViewId();
      }

      this.setPrimaryView(id);
    }.bind(this));
  }.bind(this));

  this.model.on('changeActiveView', this._onChangeActiveView.bind(this));

  this.model.on('removeActivePaymentMethod', function () {
    var activePaymentView = this.getView(this.model.getActivePaymentViewId());

    if (activePaymentView && typeof activePaymentView.removeActivePaymentMethod === 'function') {
      activePaymentView.removeActivePaymentMethod();
    }
  }.bind(this));

  this.model.on('enableEditMode', this.enableEditMode.bind(this));

  this.model.on('disableEditMode', this.disableEditMode.bind(this));

  this.model.on('confirmPaymentMethodDeletion', this.openConfirmPaymentMethodDeletionDialog.bind(this));
  this.model.on('cancelVaultedPaymentMethodDeletion', this.cancelVaultedPaymentMethodDeletion.bind(this));
  this.model.on('startVaultedPaymentMethodDeletion', this.startVaultedPaymentMethodDeletion.bind(this));
  this.model.on('finishVaultedPaymentMethodDeletion', this.finishVaultedPaymentMethodDeletion.bind(this));

  if (this._hasMultiplePaymentOptions) {
    paymentOptionsView = new PaymentOptionsView({
      client: this.client,
      element: this.getElementById(PaymentOptionsView.ID),
      mainView: this,
      model: this.model,
      strings: this.strings
    });

    this.addView(paymentOptionsView);
  }

  this._sendToDefaultView();
};

MainView.prototype._onChangeActiveView = function (data) {
  var id = data.newViewId;
  var activePaymentView = this.getView(id);

  if (id === PaymentMethodsView.ID) {
    classList.add(this.paymentMethodsViews.container, 'braintree-methods--active');
    classList.remove(this.sheetContainer, 'braintree-sheet--active');
  } else {
    wait.delay(0).then(function () {
      classList.add(this.sheetContainer, 'braintree-sheet--active');
    }.bind(this));
    classList.remove(this.paymentMethodsViews.container, 'braintree-methods--active');
    if (!this.getView(id).getPaymentMethod()) {
      this.model.setPaymentMethodRequestable({
        isRequestable: false
      });
    }
  }

  activePaymentView.onSelection();
};

MainView.prototype.addView = function (view) {
  this._views[view.ID] = view;
};

MainView.prototype.getView = function (id) {
  return this._views[id];
};

MainView.prototype.setPrimaryView = function (id, secondaryViewId) {
  var paymentMethod;

  wait.delay(0).then(function () {
    this.element.className = prefixShowClass(id);
    if (secondaryViewId) {
      classList.add(this.element, prefixShowClass(secondaryViewId));
    }
  }.bind(this));

  this.primaryView = this.getView(id);
  this.model.changeActiveView(id);

  if (this.paymentSheetViewIDs.indexOf(id) !== -1) {
    if (this.model.getPaymentMethods().length > 0 || this.getView(PaymentOptionsView.ID)) {
      this.showToggle();
    } else {
      this.hideToggle();
    }
  } else if (id === PaymentMethodsView.ID) {
    this.showToggle();
    // Move options below the upper-container
    this.getElementById('lower-container').appendChild(this.getElementById('options'));
  } else if (id === PaymentOptionsView.ID) {
    this.hideToggle();
  }

  if (!this.supportsFlexbox) {
    this.element.setAttribute('data-braintree-no-flexbox', true);
  }

  paymentMethod = this.primaryView.getPaymentMethod();

  this.model.setPaymentMethodRequestable({
    isRequestable: Boolean(paymentMethod && !this.model.isInEditMode()),
    type: paymentMethod && paymentMethod.type,
    selectedPaymentMethod: paymentMethod
  });

  this.model.clearError();
};

MainView.prototype.requestPaymentMethod = function () {
  var activePaymentView = this.getView(this.model.getActivePaymentViewId());

  return activePaymentView.requestPaymentMethod().then(function (payload) {
    analytics.sendEvent(this.client, 'request-payment-method.' + analyticsKinds[payload.type]);

    return payload;
  }.bind(this)).catch(function (err) {
    analytics.sendEvent(this.client, 'request-payment-method.error');

    return Promise.reject(err);
  }.bind(this));
};

MainView.prototype.hideLoadingIndicator = function () {
  classList.remove(this.dropinContainer, 'braintree-loading');
  classList.add(this.dropinContainer, 'braintree-loaded');
  classList.add(this.loadingContainer, 'braintree-hidden');
};

MainView.prototype.showLoadingIndicator = function () {
  classList.add(this.dropinContainer, 'braintree-loading');
  classList.remove(this.dropinContainer, 'braintree-loaded');
  classList.remove(this.loadingContainer, 'braintree-hidden');
};

MainView.prototype.toggleAdditionalOptions = function () {
  var sheetViewID;
  var isPaymentSheetView = this.paymentSheetViewIDs.indexOf(this.primaryView.ID) !== -1;

  this.hideToggle();

  if (!this._hasMultiplePaymentOptions) {
    sheetViewID = this.paymentSheetViewIDs[0];

    classList.add(this.element, prefixShowClass(sheetViewID));
    this.model.changeActiveView(sheetViewID);
  } else if (isPaymentSheetView) {
    if (this.model.getPaymentMethods().length === 0) {
      this.setPrimaryView(PaymentOptionsView.ID);
    } else {
      this.setPrimaryView(PaymentMethodsView.ID, PaymentOptionsView.ID);
      this.hideToggle();
    }
  } else {
    classList.add(this.element, prefixShowClass(PaymentOptionsView.ID));
  }
};

MainView.prototype.showToggle = function () {
  if (this.model.isInEditMode()) {
    return;
  }
  classList.remove(this.toggle, 'braintree-hidden');
  classList.add(this.lowerContainer, 'braintree-hidden');
};

MainView.prototype.hideToggle = function () {
  classList.add(this.toggle, 'braintree-hidden');
  classList.remove(this.lowerContainer, 'braintree-hidden');
};

MainView.prototype.showSheetError = function (error) {
  var errorMessage;
  var genericErrorMessage = this.strings.genericError;

  if (this.strings.hasOwnProperty(error)) {
    errorMessage = this.strings[error];
  } else if (error && typeof error.code === 'string') {
    errorMessage = this.strings[snakeCaseToCamelCase(error.code) + 'Error'] || genericErrorMessage;
  } else if (error === 'developerError') {
    errorMessage = DEVELOPER_MISCONFIGURATION_MESSAGE;
  } else {
    errorMessage = genericErrorMessage;
  }

  classList.add(this.dropinContainer, 'braintree-sheet--has-error');
  this.sheetErrorText.innerHTML = errorMessage;
};

MainView.prototype.hideSheetError = function () {
  classList.remove(this.dropinContainer, 'braintree-sheet--has-error');
};

MainView.prototype.getOptionsElements = function () {
  return this._views.options.elements;
};

MainView.prototype.preventUserAction = function () {
  classList.remove(this.disableWrapper, 'braintree-hidden');
};

MainView.prototype.allowUserAction = function () {
  classList.add(this.disableWrapper, 'braintree-hidden');
};

MainView.prototype.teardown = function () {
  var error;
  var viewNames = Object.keys(this._views);
  var teardownPromises = viewNames.map(function (view) {
    return this._views[view].teardown().catch(function (err) {
      error = err;
    });
  }.bind(this));

  return Promise.all(teardownPromises).then(function () {
    if (error) {
      return Promise.reject(error);
    }

    return Promise.resolve();
  });
};

MainView.prototype.enableEditMode = function () {
  this.setPrimaryView(this.paymentMethodsViews.ID);
  this.paymentMethodsViews.enableEditMode();
  this.hideToggle();

  this.model.setPaymentMethodRequestable({
    isRequestable: false
  });
};

MainView.prototype.disableEditMode = function () {
  var paymentMethod;

  this.hideSheetError();
  this.paymentMethodsViews.disableEditMode();
  this.showToggle();

  paymentMethod = this.primaryView.getPaymentMethod();

  this.model.setPaymentMethodRequestable({
    isRequestable: Boolean(paymentMethod),
    type: paymentMethod && paymentMethod.type,
    selectedPaymentMethod: paymentMethod
  });
};

MainView.prototype.openConfirmPaymentMethodDeletionDialog = function (paymentMethod) {
  this.deleteConfirmationView.applyPaymentMethod(paymentMethod);
  this.setPrimaryView(this.deleteConfirmationView.ID);
};

MainView.prototype.cancelVaultedPaymentMethodDeletion = function () {
  this.setPrimaryView(this.paymentMethodsViews.ID);
};

MainView.prototype.startVaultedPaymentMethodDeletion = function () {
  this.element.className = '';
  this.showLoadingIndicator();
};

MainView.prototype.finishVaultedPaymentMethodDeletion = function (error) {
  var self = this;

  this.paymentMethodsViews.refreshPaymentMethods();

  if (error && this.model.getPaymentMethods().length > 0) {
    this.model.enableEditMode();
    this.showSheetError('vaultManagerPaymentMethodDeletionError');
  } else {
    this._sendToDefaultView();
  }

  return new Promise(function (resolve) {
    wait.delay(500).then(function () {
      // allow all the views to reset before hiding the loading indicator
      self.hideLoadingIndicator();
      resolve();
    });
  });
};

MainView.prototype._sendToDefaultView = function () {
  var paymentMethods = this.model.getPaymentMethods();
  var preselectVaultedPaymentMethod = this.model.merchantConfiguration.preselectVaultedPaymentMethod !== false;

  if (paymentMethods.length > 0) {
    if (preselectVaultedPaymentMethod) {
      analytics.sendEvent(this.client, 'vaulted-card.preselect');

      this.model.changeActivePaymentMethod(paymentMethods[0]);
    } else {
      this.setPrimaryView(this.paymentMethodsViews.ID);
    }
  } else if (this._hasMultiplePaymentOptions) {
    this.setPrimaryView(PaymentOptionsView.ID);
  } else {
    this.setPrimaryView(this.paymentSheetViewIDs[0]);
  }
};
function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function (m) {
    return m[1].toUpperCase();
  });
}

function prefixShowClass(classname) {
  return 'braintree-show-' + classname;
}

module.exports = MainView;
