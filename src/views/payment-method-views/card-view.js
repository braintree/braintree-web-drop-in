'use strict';

var BasePaymentMethodView = require('./base-payment-method-view');
var cardIconHTML = require('../../html/card-icons.html');
var classlist = require('../../lib/classlist');
var configurationCardTypes = require('../../constants').configurationCardTypes;
var hideUnsupportedCardIcons = require('../../lib/hide-unsupported-card-icons');
var hostedFields = require('braintree-web/hosted-fields');
var isGuestCheckout = require('../../lib/is-guest-checkout');

function CardView() {
  BasePaymentMethodView.apply(this, arguments);
}

CardView.isEnabled = function () {
  // TODO make card optional
  return true;
};

CardView.prototype = Object.create(BasePaymentMethodView.prototype);
CardView.prototype.constructor = CardView;
CardView.ID = CardView.prototype.ID = 'pay-with-card';

CardView.prototype._initialize = function () {
  var cardIcons = this.getElementById('card-view-icons');
  var challenges = this.options.client.getConfiguration().gatewayConfiguration.challenges;
  var hasCVV = challenges.indexOf('cvv') !== -1;
  var hasPostal = challenges.indexOf('postal_code') !== -1;
  var supportedCardTypes = this.options.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;
  var hfOptions = {
    client: this.options.client,
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

  BasePaymentMethodView.prototype._initialize.apply(this, arguments);

  cardIcons.innerHTML = cardIconHTML;
  hideUnsupportedCardIcons(this.element, supportedCardTypes);

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

  this.model.asyncDependencyStarting();

  hostedFields.create(hfOptions, function (err, hostedFieldsInstance) {
    if (err) {
      this.model.reportError(err);
      return;
    }

    this.hostedFieldsInstance = hostedFieldsInstance;
    this.hostedFieldsInstance.on('blur', this._onBlurEvent.bind(this));
    this.hostedFieldsInstance.on('cardTypeChange', this._onCardTypeChangeEvent.bind(this));
    this.hostedFieldsInstance.on('focus', this._onFocusEvent.bind(this));
    this.hostedFieldsInstance.on('notEmpty', this._onNotEmptyEvent.bind(this));
    this.hostedFieldsInstance.on('validityChange', this._onValidityChangeEvent.bind(this));

    this.model.asyncDependencyReady();
  }.bind(this));
};

CardView.prototype.tokenize = function (callback) {
  var cardTypeSupported;
  var formValid = true;
  var state = this.hostedFieldsInstance.getState();
  var supportedCardTypes = this.options.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;
  var cardType = configurationCardTypes[state.cards[0].type];

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

  cardTypeSupported = formValid ? supportedCardTypes.indexOf(cardType) !== -1 : true;

  if (!cardTypeSupported) {
    this.showInlineError('number', this.strings.unsupportedCardTypeError);
    callback(new Error('No payment method is available.'));
    return;
  }

  if (formValid) {
    this.model.beginLoading();

    this.hostedFieldsInstance.tokenize({
      vault: !isGuestCheckout(this.options.authorization)
    }, function (err, payload) {
      this.model.endLoading();

      if (err) {
        this.model.reportError(err);
        callback(new Error('No payment method is available.'));
        return;
      }

      Object.keys(state.fields).forEach(function (field) {
        this.hostedFieldsInstance.clear(field);
      }.bind(this));

      this.model.addPaymentMethod(payload);
      callback(null, payload);
    }.bind(this));
  } else {
    callback(new Error('No payment method is available.'));
  }
};

CardView.prototype.showInlineError = function (field, errorMessage) {
  var inlineError;

  if (!this.inlineErrors.hasOwnProperty(field)) {
    this.inlineErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-inline-error');
  }

  inlineError = this.inlineErrors[field];
  inlineError.textContent = errorMessage;
  classlist.remove(inlineError, 'braintree-dropin__display--none');
};

CardView.prototype.hideInlineError = function (field) {
  var inlineError;

  if (!this.inlineErrors.hasOwnProperty(field)) {
    this.inlineErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-inline-error');
  }

  inlineError = this.inlineErrors[field];
  classlist.add(inlineError, 'braintree-dropin__display--none');
  inlineError.textContent = '';
};

CardView.prototype.teardown = function (callback) {
  this.hostedFieldsInstance.teardown(callback);
};

CardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.mainView.componentId + ' .braintree-dropin__form-' + field;
};

CardView.prototype._onBlurEvent = function (event) {
  if (event.emittedBy === 'number') {
    if (event.fields.number.isEmpty) {
      classlist.add(this.cardNumberIcon, 'braintree-dropin__hide');
    }
  } else if (event.emittedBy === 'cvv') {
    classlist.add(this.cvvIcon, 'braintree-dropin__hide');
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
    classlist.remove(this.cardNumberIcon, 'braintree-dropin__hide');
  } else if (event.emittedBy === 'cvv') {
    classlist.remove(this.cvvIcon, 'braintree-dropin__hide');
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

function camelCaseToSnakeCase(string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function capitalize(string) {
  return string[0].toUpperCase() + string.substr(1);
}

module.exports = CardView;
