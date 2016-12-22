'use strict';

var BasePaymentSheetView = require('./base-payment-sheet-view');
var cardIconHTML = require('../../html/card-icons.html');
var classlist = require('../../lib/classlist');
var constants = require('../../constants');
var hostedFields = require('braintree-web/hosted-fields');
var isGuestCheckout = require('../../lib/is-guest-checkout');

function CardView() {
  BasePaymentSheetView.apply(this, arguments);
}

CardView.prototype = Object.create(BasePaymentSheetView.prototype);
CardView.prototype.constructor = CardView;
CardView.ID = CardView.prototype.ID = constants.paymentOptionIDs.card;

CardView.prototype._initialize = function () {
  var cardIcons = this.getElementById('card-view-icons');
  var challenges = this.client.getConfiguration().gatewayConfiguration.challenges;
  var hasCVV = challenges.indexOf('cvv') !== -1;
  var hasPostal = challenges.indexOf('postal_code') !== -1;
  var hfOptions = {
    client: this.client,
    fields: {
      number: {
        selector: this._generateFieldSelector('number'),
        placeholder: '•••• •••• •••• ••••'
      },
      expirationDate: {
        selector: this._generateFieldSelector('expiration'),
        placeholder: 'MM / YY'
      },
      cvv: {
        selector: this._generateFieldSelector('cvv'),
        placeholder: '•••'
      },
      postalCode: {
        selector: this._generateFieldSelector('postal-code'),
        placeholder: 'ZIP'
      }
    },
    styles: {
      input: {
        'font-size': '16px',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        color: '#000'
      },
      ':focus': {
        color: 'black'
      },
      '::-webkit-input-placeholder': {
        color: 'rgba(0,0,0,0.25)'
      },
      ':-moz-placeholder': {
        color: 'rgba(0,0,0,0.25)'
      },
      '::-moz-placeholder': {
        color: 'rgba(0,0,0,0.25)'
      },
      ':-ms-input-placeholder ': {
        color: 'rgba(0,0,0,0.25)'
      }
    }
  };

  BasePaymentSheetView.prototype._initialize.apply(this, arguments);

  cardIcons.innerHTML = cardIconHTML;
  this._hideUnsupportedCardIcons();

  this.cardNumberIcon = this.getElementById('card-number-icon');
  this.cardNumberIconSvg = this.getElementById('card-number-icon-svg');
  this.cvvIcon = this.getElementById('cvv-icon');
  this.cvvIconSvg = this.getElementById('cvv-icon-svg');
  this.cvvLabelDescriptor = this.getElementById('cvv-label-descriptor');
  this.inlineErrors = {};

  if (!hasCVV) {
    this.getElementById('cvv-container').remove();
    delete hfOptions.fields.cvv;
  }
  if (!hasPostal) {
    this.getElementById('postal-code-container').remove();
    delete hfOptions.fields.postalCode;
  }

  this.model.beginLoading();
  this.model.asyncDependencyStarting();

  hostedFields.create(hfOptions, function (err, hostedFieldsInstance) {
    if (err) {
      this.model.reportError(err);
      this.model.endLoading();
      return;
    }

    this.hostedFieldsInstance = hostedFieldsInstance;
    this.hostedFieldsInstance.on('blur', this._onBlurEvent.bind(this));
    this.hostedFieldsInstance.on('cardTypeChange', this._onCardTypeChangeEvent.bind(this));
    this.hostedFieldsInstance.on('focus', this._onFocusEvent.bind(this));
    this.hostedFieldsInstance.on('notEmpty', this._onNotEmptyEvent.bind(this));
    this.hostedFieldsInstance.on('validityChange', this._onValidityChangeEvent.bind(this));

    this.model.asyncDependencyReady();
    this.model.endLoading();
  }.bind(this));
};

CardView.prototype.tokenize = function (callback) {
  var cardType, cardTypeSupported;
  var formValid = true;
  var state = this.hostedFieldsInstance.getState();
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  this.model.clearError();

  Object.keys(state.fields).forEach(function (key) {
    var field = state.fields[key];

    if (field.isEmpty) {
      this.showInlineError(key, this.strings['fieldEmptyFor' + capitalize(key)]);
      formValid = false;
    } else if (!field.isValid) {
      this.showInlineError(key, this.strings['fieldInvalidFor' + capitalize(key)]);
      formValid = false;
    }
  }.bind(this));

  if (formValid) {
    cardType = constants.configurationCardTypes[state.cards[0].type];
    cardTypeSupported = formValid ? supportedCardTypes.indexOf(cardType) !== -1 : true;

    if (!cardTypeSupported) {
      this.showInlineError('number', this.strings.unsupportedCardTypeError);
      callback(new Error(constants.errors.NO_PAYMENT_METHOD_ERROR));
      return;
    }

    this.model.beginLoading();

    this.hostedFieldsInstance.tokenize({
      vault: !isGuestCheckout(this.merchantConfiguration.authorization)
    }, function (err, payload) {
      this.model.endLoading();

      if (err) {
        this.model.reportError(err);
        callback(new Error(constants.errors.NO_PAYMENT_METHOD_ERROR));
        return;
      }

      Object.keys(state.fields).forEach(function (field) {
        this.hostedFieldsInstance.clear(field);
      }.bind(this));

      this.model.addPaymentMethod(payload);
      callback(null, payload);
    }.bind(this));
  } else {
    callback(new Error(constants.errors.NO_PAYMENT_METHOD_ERROR));
  }
};

CardView.prototype.showInlineError = function (field, errorMessage) {
  var inlineError;

  if (!this.inlineErrors.hasOwnProperty(field)) {
    this.inlineErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-inline-error');
  }

  inlineError = this.inlineErrors[field];
  inlineError.textContent = errorMessage;
  classlist.remove(inlineError, 'braintree-hidden');
};

CardView.prototype.hideInlineError = function (field) {
  var inlineError;

  if (!this.inlineErrors.hasOwnProperty(field)) {
    this.inlineErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-inline-error');
  }

  inlineError = this.inlineErrors[field];
  classlist.add(inlineError, 'braintree-hidden');
  inlineError.textContent = '';
};

CardView.prototype.teardown = function (callback) {
  this.hostedFieldsInstance.teardown(callback);
};

CardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.mainView.componentId + ' .braintree-form-' + field;
};

CardView.prototype._onBlurEvent = function (event) {
  if (event.emittedBy === 'number') {
    if (event.fields.number.isEmpty) {
      classlist.add(this.cardNumberIcon, 'braintree-hidden');
    }
  } else if (event.emittedBy === 'cvv') {
    classlist.add(this.cvvIcon, 'braintree-hidden');
  }
};

CardView.prototype._onCardTypeChangeEvent = function (event) {
  var cardType;
  var cardNumberHrefLink = '#iconCardFront';
  var cvvHrefLink = '#iconCVVBack';
  var cvvDescriptor = '(3 digits)';
  var cvvPlaceholder = '•••';

  if (event.cards.length === 1) {
    cardType = event.cards[0].type;
    cardNumberHrefLink = '#icon-' + cardType;
    if (cardType === 'american-express') {
      cvvHrefLink = '#iconCVVFront';
      cvvDescriptor = '(4 digits)';
      cvvPlaceholder = '••••';
    }
  }

  this.cardNumberIconSvg.setAttribute('xlink:href', cardNumberHrefLink);
  this.cvvIconSvg.setAttribute('xlink:href', cvvHrefLink);
  this.cvvLabelDescriptor.textContent = cvvDescriptor;
  this.hostedFieldsInstance.setPlaceholder('cvv', cvvPlaceholder);
};

CardView.prototype._onFocusEvent = function (event) {
  if (event.emittedBy === 'number') {
    classlist.remove(this.cardNumberIcon, 'braintree-hidden');
  } else if (event.emittedBy === 'cvv') {
    classlist.remove(this.cvvIcon, 'braintree-hidden');
  }
};

CardView.prototype._onNotEmptyEvent = function (event) {
  this.hideInlineError(event.emittedBy);
};

CardView.prototype._onValidityChangeEvent = function (event) {
  var field = event.fields[event.emittedBy];

  if (field.isPotentiallyValid) {
    this.hideInlineError(event.emittedBy);
  } else {
    this.showInlineError(event.emittedBy, this.strings['fieldInvalidFor' + capitalize(event.emittedBy)]);
  }
};

CardView.prototype.requestPaymentMethod = function (callback) {
  this.tokenize(callback);
};

CardView.prototype._hideUnsupportedCardIcons = function () {
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  Object.keys(constants.configurationCardTypes).forEach(function (paymentMethodCardType) {
    var cardIcon;
    var configurationCardType = constants.configurationCardTypes[paymentMethodCardType];

    if (supportedCardTypes.indexOf(configurationCardType) === -1) {
      cardIcon = this.getElementById(paymentMethodCardType + '-card-icon');
      classlist.add(cardIcon, 'braintree-hidden');
    }
  }.bind(this));
};

function camelCaseToSnakeCase(string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function capitalize(string) {
  return string[0].toUpperCase() + string.substr(1);
}

module.exports = CardView;
