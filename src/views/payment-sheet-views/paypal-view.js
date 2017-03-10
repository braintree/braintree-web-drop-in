'use strict';

var BaseView = require('../base-view');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var paypal = require('braintree-web/paypal');

function PayPalView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PayPalView.prototype = Object.create(BaseView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

PayPalView.prototype._initialize = function () {
  this._createPayPalButton();
  this._authInProgress = false;
  this.model.asyncDependencyStarting();

  if (!paypal.isSupported()) {
    this.model.asyncDependencyFailed({
      view: this.ID,
      error: new Error(this.strings.browserNotSupported)
    });
    return;
  }

  paypal.create({client: this.client}, function (err, paypalInstance) {
    if (err) {
      this.model.asyncDependencyFailed({
        view: this.ID,
        error: err
      });
      return;
    }

    this.paypalInstance = paypalInstance;

    this.paypalButton = this.getElementById('paypal-button');
    this.paypalButton.addEventListener('click', this._onSelect.bind(this));

    this.model.asyncDependencyReady();
  }.bind(this));
};

PayPalView.prototype._createPayPalButton = function () {
  var buttonContainer = this.getElementById('paypal-button');
  var script = document.createElement('script');
  var scriptAttrs = {
    'data-merchant': 'braintree',
    'data-button': 'checkout',
    'data-button_type': 'button',
    'data-color': 'gold',
    'data-size': 'small'
  };

  script.src = 'https://www.paypalobjects.com/api/button.js';
  script.async = true;

  Object.keys(scriptAttrs).forEach(function (attr) {
    script.setAttribute(attr, scriptAttrs[attr]);
  });

  buttonContainer.appendChild(script);
};

PayPalView.prototype._tokenize = function () {
  var tokenizeReturn;

  this._authInProgress = true;

  tokenizeReturn = this.paypalInstance.tokenize(this.model.merchantConfiguration.paypal, function (tokenizeErr, tokenizePayload) {
    this._authInProgress = false;

    if (tokenizeErr) {
      if (tokenizeErr.code !== 'PAYPAL_POPUP_CLOSED') {
        if (tokenizeErr.type === 'MERCHANT') {
          console.error(tokenizeErr);
          this.model.reportError(null);
        } else {
          this.model.reportError(tokenizeErr);
        }
      }
      return;
    }

    this.model.addPaymentMethod(tokenizePayload);
  }.bind(this));

  this._focusFrame = tokenizeReturn.focus;
  this.closeFrame = tokenizeReturn.close;
};

PayPalView.prototype._onSelect = function (event) {
  event.preventDefault();
  if (this._authInProgress) {
    this._focusFrame();
  } else {
    this._tokenize();
  }
};

module.exports = PayPalView;
