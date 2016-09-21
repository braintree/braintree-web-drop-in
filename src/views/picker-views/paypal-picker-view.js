'use strict';

var BasePickerView = require('./base-picker-view');
var paypal = require('braintree-web/paypal');
var paypalHTML = require('../../html/paypal-picker.html');

function PayPalPickerView() {
  BasePickerView.apply(this, arguments);
}

PayPalPickerView.isEnabled = function (options) {
  var isGatewayEnabled = options.client.getConfiguration().gatewayConfiguration.paypalEnabled;
  var isMerchantEnabled = Boolean(options.paypal);

  return isGatewayEnabled && isMerchantEnabled;
};

PayPalPickerView.prototype = Object.create(BasePickerView.prototype);
PayPalPickerView.prototype.constructor = PayPalPickerView;

PayPalPickerView.prototype._initialize = function () {
  BasePickerView.prototype._initialize.apply(this, arguments);

  this.element.innerHTML = paypalHTML;
  this.model.asyncDependencyStarting();
  this._createPayPalButton();

  paypal.create({client: this.options.client}, function (err, paypalInstance) {
    if (err) {
      console.error(err);
      return;
    }

    this.paypalInstance = paypalInstance;

    this.element.addEventListener('click', function (event) {
      event.preventDefault();
      this.paypalInstance.tokenize(this.options.paypal, function (tokenizeErr, tokenizePayload) {
        if (tokenizeErr) {
          console.error(tokenizeErr);
          return;
        }

        this.model.addPaymentMethod(tokenizePayload);
      }.bind(this));
    }.bind(this));

    this.model.asyncDependencyReady();
  }.bind(this));
};

PayPalPickerView.prototype._createPayPalButton = function () {
  var script = document.createElement('script');
  var scriptAttrs = {
    'data-merchant': 'braintree',
    'data-button': 'checkout',
    'data-type': 'button',
    'data-color': 'blue'
  };

  script.src = 'https://www.paypalobjects.com/api/button.js';
  script.async = true;

  Object.keys(scriptAttrs).forEach(function (attr) {
    script.setAttribute(attr, scriptAttrs[attr]);
  });

  this.getElementById('paypal-button').appendChild(script);
};

PayPalPickerView.prototype.teardown = function (callback) {
  this.paypalInstance.teardown(callback);
};

module.exports = PayPalPickerView;
