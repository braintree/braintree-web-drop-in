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
  var div = document.createElement('div');
  var html = paypalHTML;

  BasePickerView.prototype._initialize.apply(this, arguments);

  this.element.innerHTML = html;
  this.element.appendChild(div);
  this.mainView.asyncDependencyStarting();

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

    this.mainView.asyncDependencyReady();
  }.bind(this));
};

PayPalPickerView.prototype.teardown = function (callback) {
  this.paypalInstance.teardown(callback);
};

module.exports = PayPalPickerView;
