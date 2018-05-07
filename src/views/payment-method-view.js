'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var constants = require('../constants');
var fs = require('fs');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');

var paymentMethodHTML = fs.readFileSync(__dirname + '/../html/payment-method.html', 'utf8');

function PaymentMethodView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodView.prototype = Object.create(BaseView.prototype);
PaymentMethodView.prototype.constructor = PaymentMethodView;

PaymentMethodView.prototype._initialize = function () {
  var endingInText;
  var html = paymentMethodHTML;
  var paymentMethodCardTypes = constants.paymentMethodCardTypes;
  var paymentMethodTypes = constants.paymentMethodTypes;

  this.element = document.createElement('div');
  this.element.className = 'braintree-method';
  this.element.setAttribute('tabindex', '0');

  addSelectionEventHandler(this.element, this._choosePaymentMethod.bind(this));

  html = html.replace(/@DISABLE_MESSAGE/g, this.strings.hasSubscription);

  switch (this.paymentMethod.type) {
    case paymentMethodTypes.applePay:
      html = html.replace(/@ICON/g, 'logoApplePay')
        .replace(/@CLASSNAME/g, '')
        .replace(/@TITLE/g, this.strings['Apple Pay'])
        .replace(/@SUBTITLE/g, '');
      break;
    case paymentMethodTypes.card:
      endingInText = this.strings.endingIn.replace('{{lastTwoCardDigits}}', this.paymentMethod.details.lastTwo);
      html = html.replace(/@ICON/g, 'icon-' + paymentMethodCardTypes[this.paymentMethod.details.cardType])
        .replace(/@CLASSNAME/g, ' braintree-icon--bordered')
        .replace(/@TITLE/g, endingInText)
        .replace(/@SUBTITLE/g, this.strings[this.paymentMethod.details.cardType]);
      break;
    case paymentMethodTypes.googlePay:
      html = html.replace(/@ICON/g, 'logoGooglePay')
        .replace(/@CLASSNAME/g, '')
        .replace(/@TITLE/g, this.strings['Google Pay'])
        .replace(/@SUBTITLE/g, '');
      break;
    case paymentMethodTypes.paypal:
      html = html.replace(/@ICON/g, 'logoPayPal')
        .replace(/@CLASSNAME/g, '')
        .replace(/@TITLE/g, this.paymentMethod.details.email)
        .replace(/@SUBTITLE/g, this.strings.PayPal);
      break;
    case paymentMethodTypes.venmo:
      html = html.replace(/@ICON/g, 'logoVenmo')
        .replace(/@CLASSNAME/g, '')
        .replace(/@TITLE/g, this.paymentMethod.details.username)
        .replace(/@SUBTITLE/g, this.strings.Venmo);
      break;
    default:
      break;
  }

  this.element.innerHTML = html;
  this.checkMark = this.element.querySelector('.braintree-method__check-container');
  addSelectionEventHandler(this.element.querySelector('.braintree-method__delete-container'), function () {
    // TODO: open confirmation dialog
    console.log(this.paymentMethod);
  }.bind(this));
};

PaymentMethodView.prototype.setActive = function (isActive) {
  // setTimeout required to animate addition of new payment methods
  setTimeout(function () {
    classlist.toggle(this.element, 'braintree-method--active', isActive);
  }.bind(this), 0);
};

PaymentMethodView.prototype.enableEditMode = function () {
  this._isInEditMode = true;
  classlist.add(this.checkMark, 'braintree-hidden');
  if (this.paymentMethod.hasSubscription) {
    classlist.add(this.element, 'braintree-method--disabled');
  }
};

PaymentMethodView.prototype.disableEditMode = function () {
  this._isInEditMode = false;
  classlist.remove(this.checkMark, 'braintree-hidden');
  classlist.remove(this.element, 'braintree-method--disabled');
};

PaymentMethodView.prototype._choosePaymentMethod = function () {
  if (this._isInEditMode) {
    return;
  }
  this.model.changeActivePaymentMethod(this.paymentMethod);
};

module.exports = PaymentMethodView;
