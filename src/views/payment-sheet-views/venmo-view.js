'use strict';

var BaseView = require('../base-view');
var btVenmo = require('braintree-web/venmo');
var DropinError = require('../../lib/dropin-error');
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
    client: this.client,
    allowNewBrowserTab: false
  }).then(function (venmoInstance) {
    var button = self.getElementById('venmo-button');

    self.venmoInstance = venmoInstance;

    button.addEventListener('click', function (event) {
      event.preventDefault();

      return venmoInstance.tokenize().then(function (payload) {
        self.model.addPaymentMethod(payload);
      }).catch(function (tokenizeErr) {
        if (tokenizeErr.code === 'VENMO_APP_CANCELED') {
          // customer cancels the flow in the app
          // we don't emit an error because the customer
          // initiated that action
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

module.exports = VenmoView;
