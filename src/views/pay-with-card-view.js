'use strict';

var BaseView = require('./base-view');
var cardIconHTML = require('../html/card-icons.html');
var cardTypes = require('../constants').supportedCardTypes;
var hideUnsupportedCardIcons = require('../lib/hide-unsupported-card-icons');
var hostedFields = require('braintree-web/hosted-fields');

function PayWithCardView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PayWithCardView.prototype = Object.create(BaseView.prototype);
PayWithCardView.prototype.constructor = PayWithCardView;
PayWithCardView.ID = PayWithCardView.prototype.ID = 'pay-with-card';

PayWithCardView.prototype._initialize = function () {
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

  if (!hasCVV) {
    this.element.removeChild(this.getElementById('cvv-container'));
    delete hfOptions.fields.cvv;
  }
  if (!hasPostal) {
    this.element.removeChild(this.getElementById('postal-code-container'));
    delete hfOptions.fields.postalCode;
  }

  cardIcons.innerHTML = cardIconHTML;
  hideUnsupportedCardIcons(this.element, supportedCardTypes);

  this.model.asyncDependencyStarting();

  hostedFields.create(hfOptions, function (err, hostedFieldsInstance) {
    if (err) {
      console.error(err);
      return;
    }

    this.submit = this.getElementById('card-submit');
    this.submit.addEventListener('click', this.tokenize.bind(this));
    this.hostedFieldsInstance = hostedFieldsInstance;
    this.model.asyncDependencyReady();
  }.bind(this));
};

PayWithCardView.prototype.tokenize = function () {
  var state = this.hostedFieldsInstance.getState();
  var supportedCardTypes = this.options.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;
  var formValid = Object.keys(state.fields).every(function (key) {
    return state.fields[key].isValid;
  });
  var cardType = cardTypes[state.cards[0].type];
  var cardTypeSupported = formValid ? supportedCardTypes.indexOf(cardType) !== -1 : true;

  if (!cardTypeSupported) {
    console.error(new Error('Card type is unsupported.'));
    return;
  }

  if (formValid) {
    this.hostedFieldsInstance.tokenize({vault: true}, function (err, payload) {
      if (err) {
        console.error(err);
        return;
      }

      Object.keys(state.fields).forEach(function (field) {
        this.hostedFieldsInstance.clear(field);
      }.bind(this));

      this.model.addPaymentMethod(payload);
    }.bind(this));
  }
};

PayWithCardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.mainView.componentId + ' .braintree-dropin__form-' + field;
};

PayWithCardView.prototype.teardown = function (callback) {
  this.hostedFieldsInstance.teardown(callback);
};

module.exports = PayWithCardView;
