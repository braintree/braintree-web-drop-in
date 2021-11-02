'use strict';

var assign = require('../../lib/assign').assign;
var fs = require('fs');
var BaseView = require('../base-view');
var classList = require('@braintree/class-list');
var constants = require('../../constants');
var DropinError = require('../../lib/dropin-error');
var hostedFields = require('braintree-web/hosted-fields');
var isUtf8 = require('../../lib/is-utf-8');
var transitionHelper = require('../../lib/transition-helper');
var Promise = require('../../lib/promise');

var cardIconHTML = fs.readFileSync(__dirname + '/../../html/card-icons.html', 'utf8');

var PASSTHROUGH_EVENTS = [
  'empty',
  // TODO should intercept this event and call tokenize
  'inputSubmitRequest',
  'binAvailable'
];

function CardView() {
  BaseView.apply(this, arguments);
}

CardView.prototype = Object.create(BaseView.prototype);
CardView.prototype.constructor = CardView;
CardView.ID = CardView.prototype.ID = constants.paymentOptionIDs.card;

CardView.prototype.initialize = function () {
  var cvvFieldGroup, postalCodeFieldGroup, hfOptions;
  var cardholderNameGroup = this.getElementById('cardholder-name-field-group');
  var cardIcons = this.getElementById('card-view-icons');

  // If merchant explicty passes a value of `true` for card configuration,
  // we need to treat it as if no card configuration was passed, and provide
  // the default configuration
  if (this.model.merchantConfiguration.card && this.model.merchantConfiguration.card !== true) {
    this.merchantConfiguration = this.model.merchantConfiguration.card;
  } else {
    this.merchantConfiguration = {};
  }
  this.merchantConfiguration.vault = this.merchantConfiguration.vault || {};
  this.hasCardholderName = Boolean(this.merchantConfiguration.cardholderName);
  this.cardholderNameRequired = this.hasCardholderName && this.merchantConfiguration.cardholderName.required === true;
  hfOptions = this._generateHostedFieldsOptions();

  cardIcons.innerHTML = cardIconHTML;
  this._hideUnsupportedCardIcons();

  this.hasCVV = hfOptions.fields.cvv;
  this.saveCardInput = this.getElementById('save-card-input');
  this.cardNumberIcon = this.getElementById('card-number-icon');
  this.cardNumberIconSvg = this.getElementById('card-number-icon-svg');
  this.cvvIcon = this.getElementById('cvv-icon');
  this.cvvIconSvg = this.getElementById('cvv-icon-svg');
  this.cvvLabelDescriptor = this.getElementById('cvv-label-descriptor');
  this.fieldErrors = {};

  if (!this.hasCardholderName) {
    cardholderNameGroup.parentNode.removeChild(cardholderNameGroup);
  }

  if (!this.hasCVV) {
    cvvFieldGroup = this.getElementById('cvv-field-group');
    cvvFieldGroup.parentNode.removeChild(cvvFieldGroup);
  }

  if (!hfOptions.fields.postalCode) {
    postalCodeFieldGroup = this.getElementById('postal-code-field-group');
    postalCodeFieldGroup.parentNode.removeChild(postalCodeFieldGroup);
  }

  if (!this.model.isGuestCheckout && this.merchantConfiguration.vault.allowVaultCardOverride === true) {
    classList.remove(this.getElementById('save-card-field-group'), 'braintree-hidden');
  }

  // NEXT_MAJOR_VERSION change out this vaultCard property
  // to something more generic, such as vaultOnTokenization so
  // all the vault objects can have the same shape (instead
  // of being specific to cards here)
  if (this.merchantConfiguration.vault.vaultCard === false) {
    this.saveCardInput.checked = false;
  }

  return hostedFields.create(hfOptions).then(function (hostedFieldsInstance) {
    this.hostedFieldsInstance = hostedFieldsInstance;
    this.hostedFieldsInstance.on('blur', this._onBlurEvent.bind(this));
    this.hostedFieldsInstance.on('cardTypeChange', this._onCardTypeChangeEvent.bind(this));
    this.hostedFieldsInstance.on('focus', this._onFocusEvent.bind(this));
    this.hostedFieldsInstance.on('notEmpty', this._onNotEmptyEvent.bind(this));
    this.hostedFieldsInstance.on('validityChange', this._onValidityChangeEvent.bind(this));

    PASSTHROUGH_EVENTS.forEach(function (eventName) {
      this.hostedFieldsInstance.on(eventName, function (event) {
        this.model._emit('card:' + eventName, event);
      }.bind(this));
    }.bind(this));

    this.model.asyncDependencyReady(CardView.ID);
  }.bind(this)).catch(function (err) {
    this.model.asyncDependencyFailed({
      view: this.ID,
      error: err
    });
  }.bind(this));
};

CardView.prototype._sendRequestableEvent = function () {
  if (!this._isTokenizing) {
    this.model.setPaymentMethodRequestable({
      isRequestable: this._validateForm(),
      type: constants.paymentMethodTypes.card
    });
  }
};

CardView.prototype._generateHostedFieldsOptions = function () {
  var challenges = this.client.getConfiguration().gatewayConfiguration.challenges;
  var hasCVVChallenge = challenges.indexOf('cvv') !== -1;
  var hasPostalCodeChallenge = challenges.indexOf('postal_code') !== -1;
  var overrides = this.merchantConfiguration.overrides;
  var options = {
    client: this.client,
    fields: {
      cardholderName: {
        container: this._getFieldContainer('cardholder-name'),
        placeholder: this.strings.cardholderNamePlaceholder
      },
      number: {
        container: this._getFieldContainer('number'),
        placeholder: generateCardNumberPlaceholder()
      },
      expirationDate: {
        container: this._getFieldContainer('expiration'),
        placeholder: this.strings.expirationDatePlaceholder
      },
      cvv: {
        container: this._getFieldContainer('cvv'),
        placeholder: addBullets(3)
      },
      postalCode: {
        container: this._getFieldContainer('postal-code')
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
        color: '#6a6a6a'
      },
      ':-moz-placeholder': {
        color: '#6a6a6a'
      },
      '::-moz-placeholder': {
        color: '#6a6a6a'
      },
      ':-ms-input-placeholder ': {
        color: '#6a6a6a'
      },
      'input::-ms-clear': {
        color: 'transparent'
      }
    }
  };

  if (!this.hasCardholderName) {
    delete options.fields.cardholderName;
  }

  if (!hasCVVChallenge) {
    delete options.fields.cvv;
  }

  if (!hasPostalCodeChallenge) {
    delete options.fields.postalCode;
  }

  if (!overrides) { return options; }

  if (overrides.fields) {
    if (overrides.fields.cvv && typeof overrides.fields.cvv.placeholder !== 'undefined') {
      this._hasCustomCVVPlaceholder = true;
    }

    Object.keys(overrides.fields).forEach(function (field) {
      if ((field === 'cvv' || field === 'postalCode') && overrides.fields[field] === null) {
        delete options.fields[field];

        return;
      }

      if (!options.fields[field]) {
        return;
      }

      assign(options.fields[field], overrides.fields[field], {
        selector: options.fields[field].selector
      });
    });
  }

  if (overrides.styles) {
    Object.keys(overrides.styles).forEach(function (style) {
      if (overrides.styles[style] === null) {
        delete options.styles[style];

        return;
      } else if (typeof overrides.styles[style] === 'string') {
        // it's a class name, and should override the configured styles entirely
        options.styles[style] = overrides.styles[style];

        return;
      }

      normalizeStyles(overrides.styles[style]);
      options.styles[style] = options.styles[style] || {};

      assign(options.styles[style], overrides.styles[style]);
    });
  }

  return options;
};

CardView.prototype._validateForm = function (showFieldErrors) {
  var card, cardType, cardTypeSupported, state;
  var isValid = true;
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  if (!this.hostedFieldsInstance) {
    return false;
  }

  state = this.hostedFieldsInstance.getState();

  Object.keys(state.fields).forEach(function (key) {
    var field = state.fields[key];

    if (!showFieldErrors && !isValid) {
      // return early if form is already invalid
      // and we don't need to display all field errors
      return;
    }

    if (field.isEmpty) {
      if (!this.cardholderNameRequired && key === 'cardholderName') {
        isValid = true;
      } else {
        isValid = false;

        if (showFieldErrors) {
          this.showFieldError(key, this.strings['fieldEmptyFor' + capitalize(key)]);
        }
      }
    } else if (!field.isValid) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError(key, this.strings['fieldInvalidFor' + capitalize(key)]);
      }
    }
  }.bind(this));

  if (state.fields.number.isValid) {
    card = state.cards[0];
    cardType = card && constants.configurationCardTypes[card.type];
    cardTypeSupported = cardType && supportedCardTypes.indexOf(cardType) !== -1;

    if (!cardTypeSupported) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError('number', this.strings.unsupportedCardTypeError);
      }
    }
  }

  return isValid;
};

CardView.prototype.getPaymentMethod = function () { // eslint-disable-line consistent-return
  var formIsValid = this._validateForm();

  if (formIsValid) {
    return {
      type: constants.paymentMethodTypes.card
    };
  }
};

CardView.prototype.tokenize = function () {
  var transitionCallback;
  var self = this;
  var state = self.hostedFieldsInstance.getState();
  var tokenizeOptions = {
    vault: this._shouldVault()
  };

  this.model.clearError();

  if (!this._validateForm(true)) {
    self.model.reportError('hostedFieldsFieldsInvalidError');
    self.allowUserAction();

    return Promise.reject(new DropinError(constants.errors.NO_PAYMENT_METHOD_ERROR));
  }

  if (!this.cardholderNameRequired && state.fields.cardholderName && state.fields.cardholderName.isEmpty) {
    tokenizeOptions.fieldsToTokenize = Object.keys(state.fields).filter(function (field) {
      return field !== 'cardholderName';
    });
  }

  self._isTokenizing = true;

  return self.hostedFieldsInstance.tokenize(tokenizeOptions).then(function (payload) {
    var retainCardFields = self.merchantConfiguration.clearFieldsAfterTokenization === false;

    if (!retainCardFields) {
      Object.keys(state.fields).forEach(function (field) {
        self.hostedFieldsInstance.clear(field);
      });
    }

    if (self._shouldVault()) {
      payload.vaulted = true;
    }

    return new Promise(function (resolve) {
      transitionCallback = function () {
        // Wait for braintree-sheet--tokenized class to be added in IE 9
        // before attempting to remove it
        setTimeout(function () {
          self.model.addPaymentMethod(payload);
          resolve(payload);
          classList.remove(self.element, 'braintree-sheet--tokenized');
        }, 0);
      };

      transitionHelper.onTransitionEnd(self.element, 'max-height', transitionCallback);

      setTimeout(function () {
        self.allowUserAction();
        self._isTokenizing = false;
      }, constants.CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);

      classList.add(self.element, 'braintree-sheet--tokenized');
    });
  }).catch(function (err) {
    self._isTokenizing = false;
    // this is a little magical, but if the code property exists
    // in the translations with the word Error appended to the end,
    // then reportError will automatically print that translation.
    // See https://github.com/braintree/braintree-web-drop-in/blob/6ecba73f2f16e8b7ae2119702ac162a1a985908e/src/views/main-view.js#L255-L256
    self.model.reportError(err);
    self.allowUserAction();

    return Promise.reject(new DropinError({
      message: constants.errors.NO_PAYMENT_METHOD_ERROR,
      braintreeWebError: err
    }));
  });
};

CardView.prototype.showFieldError = function (field, errorMessage) {
  var fieldError;
  var fieldGroup = this.getElementById(camelCaseToKebabCase(field) + '-field-group');
  var input = fieldGroup.querySelector('input');

  if (!this.fieldErrors.hasOwnProperty(field)) {
    this.fieldErrors[field] = this.getElementById(camelCaseToKebabCase(field) + '-field-error');
  }

  classList.add(fieldGroup, 'braintree-form__field-group--has-error');

  fieldError = this.fieldErrors[field];
  fieldError.innerHTML = errorMessage;

  if (input) {
    input.setAttribute('aria-invalid', true);
  } else {
    this.hostedFieldsInstance.setAttribute({
      field: field,
      attribute: 'aria-invalid',
      value: true
    });
    this.hostedFieldsInstance.setMessage({
      field: field,
      message: errorMessage
    });
  }
};

CardView.prototype.hideFieldError = function (field) {
  var fieldGroup = this.getElementById(camelCaseToKebabCase(field) + '-field-group');
  var input = fieldGroup.querySelector('input');

  if (!this.fieldErrors.hasOwnProperty(field)) {
    this.fieldErrors[field] = this.getElementById(camelCaseToKebabCase(field) + '-field-error');
  }

  classList.remove(fieldGroup, 'braintree-form__field-group--has-error');

  if (input) {
    input.removeAttribute('aria-invalid');
  } else {
    this.hostedFieldsInstance.removeAttribute({
      field: field,
      attribute: 'aria-invalid'
    });
    this.hostedFieldsInstance.setMessage({
      field: field,
      message: ''
    });
  }
};

CardView.prototype.teardown = function () {
  return this.hostedFieldsInstance.teardown();
};

CardView.prototype._shouldVault = function () {
  return !this.model.isGuestCheckout && this.saveCardInput.checked;
};

CardView.prototype._getFieldContainer = function (field) {
  // we committed to not changing the data-braintree-id fields
  // so we need to convert this field to the id used in the HTML
  if (field === 'expiration') {
    field = 'expiration-date';
  }

  return this.getElementById(field + '-field-group').querySelector('.braintree-form__hosted-field');
};

CardView.prototype._onBlurEvent = function (event) {
  var field = event.fields[event.emittedBy];
  var fieldGroup = this.getElementById(camelCaseToKebabCase(event.emittedBy) + '-field-group');

  classList.remove(fieldGroup, 'braintree-form__field-group--is-focused');

  if (this._shouldApplyFieldEmptyError(event.emittedBy, field)) {
    this.showFieldError(event.emittedBy, this.strings['fieldEmptyFor' + capitalize(event.emittedBy)]);
  } else if (!field.isEmpty && !field.isValid) {
    this.showFieldError(event.emittedBy, this.strings['fieldInvalidFor' + capitalize(event.emittedBy)]);
  } else if (event.emittedBy === 'number' && !this._isCardTypeSupported(event.cards[0].type)) {
    this.showFieldError('number', this.strings.unsupportedCardTypeError);
  }

  this.model._emit('card:blur', event);

  setTimeout(function () {
    // when focusing on a field by clicking the label,
    // we need to wait a bit for the iframe to be
    // focused properly before applying validations
    if (this._shouldApplyFieldEmptyError(event.emittedBy, field)) {
      this.showFieldError(event.emittedBy, this.strings['fieldEmptyFor' + capitalize(event.emittedBy)]);
    }
  }.bind(this), 150);
};

CardView.prototype._onCardTypeChangeEvent = function (event) {
  var cardType;
  var cardNumberHrefLink = '#iconCardFront';
  var cvvHrefLink = '#iconCVVBack';
  var cvvDescriptor = this.strings.cvvThreeDigitLabelSubheading;
  var cvvPlaceholder = addBullets(3);
  var numberFieldGroup = this.getElementById('number-field-group');

  if (event.cards.length === 1) {
    cardType = event.cards[0].type;
    cardNumberHrefLink = '#icon-' + cardType;
    if (cardType === 'american-express') {
      cvvHrefLink = '#iconCVVFront';
      cvvDescriptor = this.strings.cvvFourDigitLabelSubheading;
      cvvPlaceholder = addBullets(4);
    }
    // Keep icon visible when field is not focused
    classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  } else {
    classList.remove(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  }

  this.cardNumberIconSvg.setAttribute('xlink:href', cardNumberHrefLink);

  if (this.hasCVV) {
    this.cvvIconSvg.setAttribute('xlink:href', cvvHrefLink);
    this.cvvLabelDescriptor.innerHTML = cvvDescriptor;

    if (!this._hasCustomCVVPlaceholder) {
      this.hostedFieldsInstance.setAttribute({
        field: 'cvv',
        attribute: 'placeholder',
        value: cvvPlaceholder
      });
    }
  }

  this.model._emit('card:cardTypeChange', event);
};

CardView.prototype._onFocusEvent = function (event) {
  var fieldGroup = this.getElementById(camelCaseToKebabCase(event.emittedBy) + '-field-group');

  classList.add(fieldGroup, 'braintree-form__field-group--is-focused');

  this.model._emit('card:focus', event);
};

CardView.prototype._onNotEmptyEvent = function (event) {
  this.hideFieldError(event.emittedBy);

  this.model._emit('card:notEmpty', event);
};

CardView.prototype._onValidityChangeEvent = function (event) {
  var isValid;
  var field = event.fields[event.emittedBy];

  if (event.emittedBy === 'number' && event.cards[0]) {
    isValid = field.isValid && this._isCardTypeSupported(event.cards[0].type);
  } else {
    isValid = field.isValid;
  }

  classList.toggle(field.container, 'braintree-form__field--valid', isValid);

  if (field.isPotentiallyValid) {
    this.hideFieldError(event.emittedBy);
  }

  this._sendRequestableEvent();

  this.model._emit('card:validityChange', event);
};

CardView.prototype.requestPaymentMethod = function () {
  this.preventUserAction();

  return this.tokenize();
};

CardView.prototype.onSelection = function () {
  if (!this.hostedFieldsInstance) {
    return;
  }

  setTimeout(function () {
    if (this.hasCardholderName) {
      this.hostedFieldsInstance.focus('cardholderName');
    } else {
      this.hostedFieldsInstance.focus('number');
    }
  }.bind(this), 50);

  this._sendRequestableEvent();
};

CardView.prototype._hideUnsupportedCardIcons = function () {
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  Object.keys(constants.configurationCardTypes).forEach(function (paymentMethodCardType) {
    var cardIcon;
    var configurationCardType = constants.configurationCardTypes[paymentMethodCardType];

    if (supportedCardTypes.indexOf(configurationCardType) === -1) {
      cardIcon = this.getElementById(paymentMethodCardType + '-card-icon');
      classList.add(cardIcon, 'braintree-hidden');
    }
  }.bind(this));
};

CardView.prototype._isCardTypeSupported = function (cardType) {
  var configurationCardType = constants.configurationCardTypes[cardType];
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  return supportedCardTypes.indexOf(configurationCardType) !== -1;
};

CardView.isEnabled = function (options) {
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;
  var disabledByMerchant = options.merchantConfiguration.card === false;

  return Promise.resolve(!disabledByMerchant && gatewayConfiguration.creditCards.supportedCardTypes.length > 0);
};

CardView.prototype._shouldApplyFieldEmptyError = function (fieldId, field) {
  if (!field.isEmpty) {
    return false;
  }

  if (fieldId === 'cardholderName' && !this.cardholderNameRequired) {
    return false;
  }

  return isCardViewElement();
};

function isCardViewElement() {
  var activeId = document.activeElement && document.activeElement.id;
  var isHostedFieldsElement = document.activeElement instanceof HTMLIFrameElement && activeId.indexOf('braintree-hosted-field') !== -1;

  return isHostedFieldsElement;
}

function camelCaseToKebabCase(string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function capitalize(string) {
  return string[0].toUpperCase() + string.substr(1);
}

function normalizeStyles(styles) {
  Object.keys(styles).forEach(function (style) {
    var transformedKeyName = camelCaseToKebabCase(style);

    styles[transformedKeyName] = styles[style];
  });
}

function addBullets(number) {
  var bulletCharacter = isUtf8() ? '•' : '*';

  return Array(number + 1).join(bulletCharacter);
}

function generateCardNumberPlaceholder() {
  var four = addBullets(4);

  return [four, four, four, four].join(' ');
}

module.exports = CardView;
