'use strict';

var BaseView = require('../base-view');
var btVenmo = require('braintree-web/venmo');
var DropinError = require('../../lib/dropin-error');
var Promise = require('../../lib/promise');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;

function VenmoView() {
  BaseView.apply(this, arguments);
}

VenmoView.prototype = Object.create(BaseView.prototype);
VenmoView.prototype.constructor = VenmoView;
VenmoView.ID = VenmoView.prototype.ID = paymentOptionIDs.venmo;

VenmoView.prototype.initialize = function () {
  var self = this;

  self.model.asyncDependencyStarting();

  return btVenmo.create({
    client: this.client
  }).then(function (venmoInstance) {
    self.venmoInstance = venmoInstance;

    if (!self.venmoInstance.hasTokenizationResult()) {
      return Promise.resolve();
    }

    return self.venmoInstance.tokenize().then(function (payload) {
      self.model.reportAppSwitchPayload(payload);
    }).catch(function (err) {
      if (self._isIgnorableError(err)) {
        return;
      }
      self.model.reportAppSwitchError(paymentOptionIDs.venmo, err);
    });
  }).then(function () {
    var button = self.getElementById('venmo-button');

    button.addEventListener('click', function (event) {
      event.preventDefault();

      return self.venmoInstance.tokenize().then(function (payload) {
        self.model.addPaymentMethod(payload);
      }).catch(function (tokenizeErr) {
        if (self._isIgnorableError(tokenizeErr)) {
          return;
        }

        self.model.reportError(tokenizeErr);
      });
    });

    self.model.asyncDependencyReady();
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

VenmoView.prototype._isIgnorableError = function (error) {
  // customer cancels the flow in the app
  // we don't emit an error because the customer
  // initiated that action
  return error.code === 'VENMO_APP_CANCELED';
};

module.exports = VenmoView;
