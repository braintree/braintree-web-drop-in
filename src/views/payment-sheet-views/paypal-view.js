'use strict';

var BasePaymentSheetView = require('./base-payment-sheet-view');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var paypal = require('braintree-web/paypal');

function PayPalView() {
  BasePaymentSheetView.apply(this, arguments);
}

PayPalView.prototype = Object.create(BasePaymentSheetView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

PayPalView.prototype._initialize = function () {
  BasePaymentSheetView.prototype._initialize.apply(this, arguments);
  this._createPayPalButton();
  this._authInProgress = false;
  this.model.asyncDependencyStarting();

  paypal.create({client: this.client}, function (err, paypalInstance) {
    if (err) {
      console.error(err);
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

  event.preventDefault();
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

PayPalView.prototype._onSelect = function () {
  if (this._authInProgress) {
    this._focusFrame();
  } else {
    this._tokenize();
  }
};

module.exports = PayPalView;
