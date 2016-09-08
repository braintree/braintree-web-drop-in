'use strict';

var BasePickerView = require('./base-picker-view');
var classList = require('../../lib/classlist');
var paypal = require('braintree-web/paypal');

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
  var a = document.createElement('a');

  BasePickerView.prototype._initialize.apply(this, arguments);

  classList.add(this.element, 'braintree-dropin__paypal-picker-view');
  a.href = '#';
  a.textContent = 'Pay with PayPal';
  this.element.appendChild(a);
  this.mainView.asyncDependencyStarting();

  paypal.create({client: this.options.client}, function (err, paypalInstance) {
    if (err) {
      console.error(err);
      return;
    }

    this.paypalInstance = paypalInstance;

    this.element.addEventListener('click', function () {
      this.paypalInstance.tokenize(this.options.paypal, function (tokenizeErr, tokenizePayload) {
        if (tokenizeErr) {
          console.error(tokenizeErr);
          return;
        }

        this.mainView.updateActivePaymentMethod(tokenizePayload);
      }.bind(this));
    }.bind(this));

    this.mainView.asyncDependencyReady();
  }.bind(this));
};

PayPalPickerView.prototype.teardown = function (callback) {
  this.paypalInstance.teardown(callback);
};

module.exports = PayPalPickerView;
