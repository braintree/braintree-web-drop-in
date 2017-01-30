'use strict';

var BaseView = require('../base-view');
var cardIconHTML = require('../../html/card-icons.html');
var classlist = require('../../lib/classlist');
var constants = require('../../constants');
var hostedFields = require('braintree-web/hosted-fields');

function CardView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

CardView.prototype = Object.create(BaseView.prototype);
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

  cardIcons.innerHTML = cardIconHTML;
  this._hideUnsupportedCardIcons();

  this.cardNumberIcon = this.getElementById('card-number-icon');
  this.cardNumberIconSvg = this.getElementById('card-number-icon-svg');
  this.cvvIcon = this.getElementById('cvv-icon');
  this.cvvIconSvg = this.getElementById('cvv-icon-svg');
  this.cvvLabelDescriptor = this.getElementById('cvv-label-descriptor');
  this.fieldErrors = {};

  if (!hasCVV) {
    this.getElementById('cvv-field-group').remove();
    delete hfOptions.fields.cvv;
  }
  if (!hasPostal) {
    this.getElementById('postal-code-field-group').remove();
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

  Object.keys(state.fields).forEach(function (key) {
    var field = state.fields[key];

    if (field.isEmpty) {
      this.showFieldError(key, this.strings['fieldEmptyFor' + capitalize(key)]);
      formValid = false;
    } else if (!field.isValid) {
      this.showFieldError(key, this.strings['fieldInvalidFor' + capitalize(key)]);
      formValid = false;
    }
  }.bind(this));

  if (formValid) {
    cardType = constants.configurationCardTypes[state.cards[0].type];
    cardTypeSupported = formValid ? supportedCardTypes.indexOf(cardType) !== -1 : true;

    if (!cardTypeSupported) {
      this.showFieldError('number', this.strings.unsupportedCardTypeError);
      this.model.reportError({message: this.strings.hostedFieldsFieldsInvalidError});
      callback(new Error(constants.errors.NO_PAYMENT_METHOD_ERROR));
      return;
    }

    this.model.beginLoading();

    this.hostedFieldsInstance.tokenize({
      vault: !this.model.isGuestCheckout
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
    this.model.reportError({message: this.strings.hostedFieldsFieldsInvalidError});
    callback(new Error(constants.errors.NO_PAYMENT_METHOD_ERROR));
  }
};

CardView.prototype.showFieldError = function (field, errorMessage) {
  var fieldError;
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(field) + '-field-group');

  if (!this.fieldErrors.hasOwnProperty(field)) {
    this.fieldErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-field-error');
  }

  classlist.add(fieldGroup, 'braintree-form__field-group--has-error');

  fieldError = this.fieldErrors[field];
  fieldError.textContent = errorMessage;
};

CardView.prototype.hideFieldError = function (field) {
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(field) + '-field-group');

  if (!this.fieldErrors.hasOwnProperty(field)) {
    this.fieldErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-field-error');
  }

  classlist.remove(fieldGroup, 'braintree-form__field-group--has-error');
};

CardView.prototype.teardown = function (callback) {
  this.hostedFieldsInstance.teardown(callback);
};

CardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.model.componentID + ' .braintree-form-' + field;
};

CardView.prototype._onBlurEvent = function (event) {
  var field = event.fields[event.emittedBy];
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(event.emittedBy) + '-field-group');

  classlist.remove(fieldGroup, 'braintree-form__field-group--is-focused');

  if (field.isEmpty) {
    this.showFieldError(event.emittedBy, this.strings['fieldEmptyFor' + capitalize(event.emittedBy)]);
  } else if (!field.isValid) {
    this.showFieldError(event.emittedBy, this.strings['fieldInvalidFor' + capitalize(event.emittedBy)]);
  } else if (event.emittedBy === 'number' && !this._isCardTypeSupported(event.cards[0].type)) {
    this.showFieldError('number', this.strings.unsupportedCardTypeError);
  }
};

CardView.prototype._onCardTypeChangeEvent = function (event) {
  var cardType;
  var cardNumberHrefLink = '#iconCardFront';
  var cvvHrefLink = '#iconCVVBack';
  var cvvDescriptor = '(3 digits)';
  var cvvPlaceholder = '•••';
  var numberFieldGroup = this.getElementById('number-field-group');

  if (event.cards.length === 1) {
    cardType = event.cards[0].type;
    cardNumberHrefLink = '#icon-' + cardType;
    if (cardType === 'american-express') {
      cvvHrefLink = '#iconCVVFront';
      cvvDescriptor = '(4 digits)';
      cvvPlaceholder = '••••';
    }
    // Keep icon visible when field is not focused
    classlist.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  } else {
    classlist.remove(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  }

  this.cardNumberIconSvg.setAttribute('xlink:href', cardNumberHrefLink);
  this.cvvIconSvg.setAttribute('xlink:href', cvvHrefLink);
  this.cvvLabelDescriptor.textContent = cvvDescriptor;
  this.hostedFieldsInstance.setAttribute({
    field: 'cvv',
    attribute: 'placeholder',
    value: cvvPlaceholder
  });
};

CardView.prototype._onFocusEvent = function (event) {
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(event.emittedBy) + '-field-group');

  classlist.add(fieldGroup, 'braintree-form__field-group--is-focused');
};

CardView.prototype._onNotEmptyEvent = function (event) {
  this.hideFieldError(event.emittedBy);
};

CardView.prototype._onValidityChangeEvent = function (event) {
  var isValid;
  var field = event.fields[event.emittedBy];

  if (event.emittedBy === 'number' && event.cards[0]) {
    isValid = field.isValid && this._isCardTypeSupported(event.cards[0].type);
  } else {
    isValid = field.isValid;
  }

  classlist.toggle(field.container, 'braintree-form__field--valid', isValid);

  if (field.isPotentiallyValid) {
    this.hideFieldError(event.emittedBy);
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

CardView.prototype._isCardTypeSupported = function (cardType) {
  var configurationCardType = constants.configurationCardTypes[cardType];
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  return supportedCardTypes.indexOf(configurationCardType) !== -1;
};

function camelCaseToSnakeCase(string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function capitalize(string) {
  return string[0].toUpperCase() + string.substr(1);
}

module.exports = CardView;
