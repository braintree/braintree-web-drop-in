'use strict';

var assign = require('../../lib/assign').assign;
var fs = require('fs');
var BaseView = require('../base-view');
var classlist = require('../../lib/classlist');
var constants = require('../../constants');
var DropinError = require('../../lib/dropin-error');
var hostedFields = require('braintree-web/hosted-fields');
var isUtf8 = require('../../lib/is-utf-8');
var transitionHelper = require('../../lib/transition-helper');
var Promise = require('../../lib/promise');

var cardIconHTML = fs.readFileSync(__dirname + '/../../html/card-icons.html', 'utf8');

function CardView() {
  BaseView.apply(this, arguments);
}

CardView.prototype = Object.create(BaseView.prototype);
CardView.prototype.constructor = CardView;
CardView.ID = CardView.prototype.ID = constants.paymentOptionIDs.card;

CardView.prototype.initialize = function () {
  var cvvFieldGroup, postalCodeFieldGroup;
  var cardholderNameField = this.getElementById('cardholder-name-field-group');
  var cardIcons = this.getElementById('card-view-icons');
  var hfOptions = this._generateHostedFieldsOptions();

  cardIcons.innerHTML = cardIconHTML;
  this._hideUnsupportedCardIcons();

  this.hasCVV = hfOptions.fields.cvv;
  this.hasCardholderName = Boolean(this.model.merchantConfiguration.card && this.model.merchantConfiguration.card.cardholderName);
  this.cardholderNameInput = cardholderNameField.querySelector('input');
  this.cardNumberIcon = this.getElementById('card-number-icon');
  this.cardNumberIconSvg = this.getElementById('card-number-icon-svg');
  this.cvvIcon = this.getElementById('cvv-icon');
  this.cvvIconSvg = this.getElementById('cvv-icon-svg');
  this.cvvLabelDescriptor = this.getElementById('cvv-label-descriptor');
  this.fieldErrors = {};
  this.extraInputs = [
    {
      fieldName: 'cardholderName',
      enabled: this.hasCardholderName,
      required: this.hasCardholderName && this.model.merchantConfiguration.card.cardholderName.required,
      requiredError: this.strings.fieldEmptyForCardholderName,
      validations: [
        {
          isValid: function (value) {
            return value.length < 256;
          },
          error: this.strings.fieldTooLongForCardholderName
        }
      ]
    }
  ];

  if (!this.hasCVV) {
    cvvFieldGroup = this.getElementById('cvv-field-group');
    cvvFieldGroup.parentNode.removeChild(cvvFieldGroup);
  }

  if (!hfOptions.fields.postalCode) {
    postalCodeFieldGroup = this.getElementById('postal-code-field-group');
    postalCodeFieldGroup.parentNode.removeChild(postalCodeFieldGroup);
  }

  this.extraInputs.forEach(function (extraInput) {
    if (extraInput.enabled) {
      this._setupExtraInput(extraInput);
    } else {
      this._removeExtraInput(extraInput);
    }
  }.bind(this));

  this.model.asyncDependencyStarting();

  return hostedFields.create(hfOptions).then(function (hostedFieldsInstance) {
    this.hostedFieldsInstance = hostedFieldsInstance;
    this.hostedFieldsInstance.on('blur', this._onBlurEvent.bind(this));
    this.hostedFieldsInstance.on('cardTypeChange', this._onCardTypeChangeEvent.bind(this));
    this.hostedFieldsInstance.on('focus', this._onFocusEvent.bind(this));
    this.hostedFieldsInstance.on('notEmpty', this._onNotEmptyEvent.bind(this));
    this.hostedFieldsInstance.on('validityChange', this._onValidityChangeEvent.bind(this));

    this.model.asyncDependencyReady();
  }.bind(this)).catch(function (err) {
    this.model.asyncDependencyFailed({
      view: this.ID,
      error: err
    });
  }.bind(this));
};

CardView.prototype._setupExtraInput = function (extraInput) {
  var self = this;
  var fieldNameKebab = camelCaseToKebabCase(extraInput.fieldName);
  var field = this.getElementById(fieldNameKebab + '-field-group');
  var input = field.querySelector('input');
  var nameContainer = field.querySelector('.braintree-form__hosted-field');

  input.addEventListener('keyup', function () {
    var valid = self._validateExtraInput(extraInput, true);

    classlist.toggle(nameContainer, 'braintree-form__field--valid', valid);

    if (valid) {
      self.hideFieldError(extraInput.fieldName);
    }

    self._sendRequestableEvent();
  }, false);

  if (extraInput.required) {
    input.addEventListener('blur', function () {
      // the active element inside the blur event is the document.body
      // by taking it out of the event loop, we can detect the new
      // active element (hosted field or other card view element)
      setTimeout(function () {
        if (isCardViewElement()) {
          self._validateExtraInput(extraInput, true);
        }
      }, 0);
    }, false);
  }
};

CardView.prototype._removeExtraInput = function (extraInput) {
  var field = this.getElementById(camelCaseToKebabCase(extraInput.fieldName) + '-field-group');

  field.parentNode.removeChild(field);
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
  var overrides = this.model.merchantConfiguration.card && this.model.merchantConfiguration.card.overrides;
  var options = {
    client: this.client,
    fields: {
      number: {
        selector: this._generateFieldSelector('number'),
        placeholder: generateCardNumberPlaceholder()
      },
      expirationDate: {
        selector: this._generateFieldSelector('expiration'),
        placeholder: this.strings.expirationDatePlaceholder
      },
      cvv: {
        selector: this._generateFieldSelector('cvv'),
        placeholder: addBullets(3)
      },
      postalCode: {
        selector: this._generateFieldSelector('postal-code')
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

  if (!hasCVVChallenge) {
    delete options.fields.cvv;
  }

  if (!hasPostalCodeChallenge) {
    delete options.fields.postalCode;
  }

  if (!overrides) { return options; }

  if (overrides.fields) {
    if (overrides.fields.cvv && overrides.fields.cvv.placeholder) {
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
      }

      normalizeStyles(overrides.styles[style]);
      options.styles[style] = options.styles[style] || {};

      assign(options.styles[style], overrides.styles[style]);
    });
  }

  return options;
};

CardView.prototype._validateForm = function (showFieldErrors) {
  var cardType, cardTypeSupported, state;
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
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError(key, this.strings['fieldEmptyFor' + capitalize(key)]);
      }
    } else if (!field.isValid) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError(key, this.strings['fieldInvalidFor' + capitalize(key)]);
      }
    }
  }.bind(this));

  if (state.fields.number.isValid) {
    cardType = constants.configurationCardTypes[state.cards[0].type];
    cardTypeSupported = supportedCardTypes.indexOf(cardType) !== -1;

    if (!cardTypeSupported) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError('number', this.strings.unsupportedCardTypeError);
      }
    }
  }

  if (this.extraInputs) {
    this.extraInputs.forEach(function (extraInput) {
      var fieldIsValid;

      if (!extraInput.enabled) {
        return;
      }

      fieldIsValid = this._validateExtraInput(extraInput, showFieldErrors);

      isValid = isValid && fieldIsValid;
    }.bind(this));
  }

  return isValid;
};

CardView.prototype._validateExtraInput = function (extraInput, showFieldError) {
  var fieldNameKebab = camelCaseToKebabCase(extraInput.fieldName);
  var field = this.getElementById(fieldNameKebab + '-field-group');
  var input = field.querySelector('input');
  var valid = true;

  if (extraInput.required) {
    valid = input.value.length > 0;

    if (!valid && showFieldError) {
      this.showFieldError(extraInput.fieldName, extraInput.requiredError);
    }
  }

  extraInput.validations.forEach(function (validation) {
    var validationPassed = validation.isValid(input.value);

    if (!validationPassed && showFieldError) {
      this.showFieldError(extraInput.fieldName, validation.error);
    }

    valid = valid && validationPassed;
  }.bind(this));

  return valid;
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
    vault: !self.model.isGuestCheckout
  };

  this.model.clearError();

  if (!this._validateForm(true)) {
    self.model.reportError('hostedFieldsFieldsInvalidError');
    classlist.remove(self.element, 'braintree-sheet--loading');

    return Promise.reject(new DropinError(constants.errors.NO_PAYMENT_METHOD_ERROR));
  }

  if (this.hasCardholderName) {
    tokenizeOptions.cardholderName = this.cardholderNameInput.value;
  }

  self._isTokenizing = true;

  return self.hostedFieldsInstance.tokenize(tokenizeOptions).then(function (payload) {
    Object.keys(state.fields).forEach(function (field) {
      self.hostedFieldsInstance.clear(field);
    });

    if (!self.model.isGuestCheckout) {
      payload.vaulted = true;
    }

    return new Promise(function (resolve) {
      transitionCallback = function () {
        // Wait for braintree-sheet--tokenized class to be added in IE 9
        // before attempting to remove it
        setTimeout(function () {
          self.model.addPaymentMethod(payload);
          resolve(payload);
          classlist.remove(self.element, 'braintree-sheet--tokenized');
        }, 0);
        self._isTokenizing = false;
      };

      transitionHelper.onTransitionEnd(self.element, 'max-height', transitionCallback);

      setTimeout(function () {
        classlist.remove(self.element, 'braintree-sheet--loading');
      }, constants.CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);

      classlist.add(self.element, 'braintree-sheet--tokenized');
    });
  }).catch(function (err) {
    self._isTokenizing = false;
    self.model.reportError(err);
    classlist.remove(self.element, 'braintree-sheet--loading');
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

  classlist.add(fieldGroup, 'braintree-form__field-group--has-error');

  fieldError = this.fieldErrors[field];
  fieldError.innerHTML = errorMessage;

  if (input && isNormalFieldElement(input)) {
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

  classlist.remove(fieldGroup, 'braintree-form__field-group--has-error');

  if (input && isNormalFieldElement(input)) {
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

CardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.model.componentID + ' .braintree-form-' + field;
};

CardView.prototype._onBlurEvent = function (event) {
  var field = event.fields[event.emittedBy];
  var fieldGroup = this.getElementById(camelCaseToKebabCase(event.emittedBy) + '-field-group');

  classlist.remove(fieldGroup, 'braintree-form__field-group--is-focused');

  if (shouldApplyFieldEmptyError(field)) {
    this.showFieldError(event.emittedBy, this.strings['fieldEmptyFor' + capitalize(event.emittedBy)]);
  } else if (!field.isEmpty && !field.isValid) {
    this.showFieldError(event.emittedBy, this.strings['fieldInvalidFor' + capitalize(event.emittedBy)]);
  } else if (event.emittedBy === 'number' && !this._isCardTypeSupported(event.cards[0].type)) {
    this.showFieldError('number', this.strings.unsupportedCardTypeError);
  }

  setTimeout(function () {
    // when focusing on a field by clicking the label,
    // we need to wait a bit for the iframe to be
    // focused properly before applying validations
    if (shouldApplyFieldEmptyError(field)) {
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
    classlist.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  } else {
    classlist.remove(numberFieldGroup, 'braintree-form__field-group--card-type-known');
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
};

CardView.prototype._onFocusEvent = function (event) {
  var fieldGroup = this.getElementById(camelCaseToKebabCase(event.emittedBy) + '-field-group');

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

  this._sendRequestableEvent();
};

CardView.prototype.requestPaymentMethod = function () {
  classlist.add(this.element, 'braintree-sheet--loading');
  return this.tokenize();
};

CardView.prototype.onSelection = function () {
  if (!this.hostedFieldsInstance) {
    return;
  }

  if (this.hasCardholderName) {
    setTimeout(function () { // wait until input is visible
      this.cardholderNameInput.focus();
    }.bind(this), 1);
  } else {
    this.hostedFieldsInstance.focus('number');
  }
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

function isNormalFieldElement(element) {
  return element.id.indexOf('braintree__card-view-input') !== -1;
}

function shouldApplyFieldEmptyError(field) {
  return field.isEmpty && isCardViewElement();
}

function isCardViewElement() {
  var activeId = document.activeElement && document.activeElement.id;
  var isHostedFieldsElement = document.activeElement instanceof HTMLIFrameElement && activeId.indexOf('braintree-hosted-field') !== -1;

  return isHostedFieldsElement || isNormalFieldElement(document.activeElement);
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
