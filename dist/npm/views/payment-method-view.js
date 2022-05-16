'use strict';

var analytics = require('../lib/analytics');
var BaseView = require('./base-view');
var classList = require('@braintree/class-list');
var constants = require('../constants');

var addSelectionEventHandler = require('../lib/add-selection-event-handler');

var paymentMethodHTML = "<div class=\"braintree-method__icon-container braintree-method__delete-container\">\r\n  <div class=\"braintree-method__icon braintree-method__delete\">\r\n    <svg width=\"48\" height=\"29\">\r\n      <use xlink:href=\"#iconX\"></use>\r\n    </svg>\r\n  </div>\r\n</div>\r\n\r\n<div class=\"braintree-method__logo\">\r\n  <svg width=\"40\" height=\"24\" class=\"@CLASSNAME\">\r\n    <use xlink:href=\"#@ICON\"></use>\r\n  </svg>\r\n</div>\r\n\r\n<div class=\"braintree-method__label\">@TITLE<br><div class=\"braintree-method__label--small\">@SUBTITLE</div></div>\r\n\r\n<div class=\"braintree-method__icon-container braintree-method__check-container\">\r\n  <div class=\"braintree-method__icon braintree-method__check\">\r\n    <svg height=\"100%\" width=\"100%\">\r\n      <use xlink:href=\"#iconCheck\"></use>\r\n    </svg>\r\n  </div>\r\n</div>\r\n";

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
  this.element.setAttribute('role', 'button');

  addSelectionEventHandler(this.element, function () {
    if (this.model.isInEditMode()) {
      this._selectDelete();
    } else {
      this._choosePaymentMethod();
    }
  }.bind(this));

  switch (this.paymentMethod.type) {
    case paymentMethodTypes.applePay:
      html = html.replace(/@ICON/g, 'logoApplePay')
        .replace(/@CLASSNAME/g, '')
        .replace(/@TITLE/g, this.strings['Apple Pay'])
        .replace(/@SUBTITLE/g, '');
      break;
    case paymentMethodTypes.card:
      endingInText = this.strings.endingIn.replace('{{lastFourCardDigits}}', this.paymentMethod.details.lastFour);
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
};

PaymentMethodView.prototype.setActive = function (isActive) {
  // setTimeout required to animate addition of new payment methods
  setTimeout(function () {
    classList.toggle(this.element, 'braintree-method--active', isActive);
  }.bind(this), 0);
};

PaymentMethodView.prototype.enableEditMode = function () {
  classList.add(this.checkMark, 'braintree-hidden');
  if (this.paymentMethod.hasSubscription) {
    classList.add(this.element, 'braintree-method--disabled');
  }
};

PaymentMethodView.prototype.disableEditMode = function () {
  classList.remove(this.checkMark, 'braintree-hidden');
  classList.remove(this.element, 'braintree-method--disabled');
};

PaymentMethodView.prototype.teardown = function () {
  if (this.element.parentNode) {
    this.element.parentNode.removeChild(this.element);
  }
};

PaymentMethodView.prototype._choosePaymentMethod = function () {
  if (this.paymentMethod.vaulted) {
    analytics.sendEvent(this.client, 'vaulted-' + constants.analyticsKinds[this.paymentMethod.type] + '.select');
  }

  this.model.changeActivePaymentMethod(this.paymentMethod);
};

PaymentMethodView.prototype._selectDelete = function () {
  this.model.confirmPaymentMethodDeletion(this.paymentMethod);
};

module.exports = PaymentMethodView;
