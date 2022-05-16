'use strict';

var BaseView = require('./base-view');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');
var paymentMethodTypes = require('../constants').paymentMethodTypes;

function DeleteConfirmationView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

DeleteConfirmationView.prototype = Object.create(BaseView.prototype);
DeleteConfirmationView.prototype.constructor = DeleteConfirmationView;
DeleteConfirmationView.ID = DeleteConfirmationView.prototype.ID = 'delete-confirmation';

DeleteConfirmationView.prototype._initialize = function () {
  this._yesButton = this.getElementById('delete-confirmation__yes');
  this._noButton = this.getElementById('delete-confirmation__no');
  this._messageBox = this.getElementById('delete-confirmation__message');

  addSelectionEventHandler(this._yesButton, function () {
    this.model.deleteVaultedPaymentMethod();
  }.bind(this));
  addSelectionEventHandler(this._noButton, function () {
    this.model.cancelDeleteVaultedPaymentMethod();
  }.bind(this));
};

DeleteConfirmationView.prototype.applyPaymentMethod = function (paymentMethod) {
  var identifier, secondaryIdentifier;
  var messageText = this.strings[paymentMethod.type + 'DeleteConfirmationMessage'];

  if (messageText) {
    switch (paymentMethod.type) {
      case paymentMethodTypes.card:
        identifier = paymentMethod.details.lastFour;
        secondaryIdentifier = paymentMethod.details.cardType;
        secondaryIdentifier = this.strings[secondaryIdentifier] || secondaryIdentifier;
        break;
      case paymentMethodTypes.paypal:
        identifier = paymentMethod.details.email;
        break;
      case paymentMethodTypes.venmo:
        identifier = paymentMethod.details.username;
        break;
      default:
        break;
    }

    messageText = messageText.replace('{{identifier}}', identifier);
    if (secondaryIdentifier) {
      messageText = messageText.replace('{{secondaryIdentifier}}', secondaryIdentifier);
    }
  } else {
    messageText = this.strings.genericDeleteConfirmationMessage;
  }
  this._messageBox.innerText = messageText;
};

DeleteConfirmationView.prototype.onSelection = function () {
  window.requestAnimationFrame(function () {
    this._yesButton.focus();
  }.bind(this));
};

module.exports = DeleteConfirmationView;
