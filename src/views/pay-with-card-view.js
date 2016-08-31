'use strict';

var BaseView = require('./base-view');
var cardTypes = require('../constants').cardTypes;
var events = require('../constants').events;
var hostedFields = require('braintree-web/hosted-fields');

function PayWithCardView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PayWithCardView.prototype = Object.create(BaseView.prototype);
PayWithCardView.prototype.constructor = PayWithCardView;
PayWithCardView.ID = PayWithCardView.prototype.ID = 'braintree-dropin__pay-with-card';

PayWithCardView.prototype._initialize = function () {
  var challenges = this.options.client.getConfiguration().gatewayConfiguration.challenges;
  var hasCVV = challenges.indexOf('cvv') !== -1;
  var hasPostal = challenges.indexOf('postal_code') !== -1;
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
      '.invalid': {
        color: 'tomato'
      },
      '.valid': {
        color: 'green'
      }
    }
  };

  if (!hasCVV) {
    this.element.removeChild(this.element.querySelector('.braintree-dropin__cvv-container'));
    delete hfOptions.fields.cvv;
  }
  if (!hasPostal) {
    this.element.removeChild(this.element.querySelector('.braintree-dropin__postal-code-container'));
    delete hfOptions.fields.postalCode;
  }

  this.mainView.asyncDependencyStarting();

  hostedFields.create(hfOptions, function (err, hostedFieldsInstance) {
    if (err) {
      console.error(err);
      return;
    }

    this.hostedFieldsInstance = hostedFieldsInstance;

    this.fieldsValid = false;
    this.cardTypeSupported = false;
    this.paymentMethodRequestable = false;

    this.hostedFieldsInstance.on('validityChange', this._handlePaymentMethodRequestableEvents.bind(this));
    this.hostedFieldsInstance.on('cardTypeChange', this._handlePaymentMethodRequestableEvents.bind(this));
    this.mainView.asyncDependencyReady();
  }.bind(this));
};

PayWithCardView.prototype._handlePaymentMethodRequestableEvents = function (state) {
  this.cardTypeSupported = state.cards.some(function (card) {
    return this._isSupportedCardType(card);
  }.bind(this));
  this.fieldsValid = Object.keys(state.fields).every(function (key) {
    return state.fields[key].isValid;
  });

  if (this.fieldsValid && this.cardTypeSupported && !this.paymentMethodRequestable) {
    this.mainView.emit(events.PAYMENT_METHOD_REQUESTABLE);
    this.paymentMethodRequestable = true;
  } else if ((!this.fieldsValid || !this.cardTypeSupported) && this.paymentMethodRequestable) {
    this.mainView.emit(events.NO_PAYMENT_METHOD_REQUESTABLE);
    this.paymentMethodRequestable = false;
  }
};

PayWithCardView.prototype._isSupportedCardType = function (card) {
  var supportedCardTypes = this.options.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  if (card && card.type) {
    return supportedCardTypes.indexOf(cardTypes[card.type]) !== -1;
  }

  return false;
};

PayWithCardView.prototype.requestPaymentMethod = function (callback) {
  var state = this.hostedFieldsInstance.getState();
  var cardTypeSupported = this._isSupportedCardType(state.cards[0]);
  var fieldsValid = Object.keys(state.fields).every(function (key) {
    return state.fields[key].isValid;
  });

  if (!cardTypeSupported) {
    callback(new Error('Card type is unsupported.'));
    return;
  }

  if (fieldsValid) {
    this.hostedFieldsInstance.tokenize({vault: true}, function (err, payload) {
      if (err) {
        callback(err);
        return;
      }

      Object.keys(state.fields).forEach(function (field) {
        this.hostedFieldsInstance.clear(field);
      }.bind(this));

      this.mainView.updateCompletedView(payload);
      callback(null, payload);
    }.bind(this));
  }
};

PayWithCardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.mainView.componentId + ' .braintree-dropin__' + field;
};

PayWithCardView.prototype.teardown = function (callback) {
  this.hostedFieldsInstance.teardown(callback);
};

module.exports = PayWithCardView;
