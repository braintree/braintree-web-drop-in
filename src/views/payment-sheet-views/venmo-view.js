'use strict';

const assign = require('../../lib/assign').assign;
const BaseView = require('../base-view');
const btVenmo = require('braintree-web/venmo');
const DropinError = require('../../lib/dropin-error');
const Promise = require('../../lib/promise');
const paymentOptionIDs = require('../../constants').paymentOptionIDs;

function VenmoView() {
  BaseView.apply(this, arguments);
}

VenmoView.prototype = Object.create(BaseView.prototype);
VenmoView.prototype.constructor = VenmoView;
VenmoView.ID = VenmoView.prototype.ID = paymentOptionIDs.venmo;

VenmoView.prototype.initialize = function () {
  const self = this;
  const venmoConfiguration = assign({}, self.model.merchantConfiguration.venmo, {
    authorization: this.model.authorization
  });

  self.model.asyncDependencyStarting();

  return btVenmo.create(venmoConfiguration).then(function (venmoInstance) {
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
    const button = self.getElementById('venmo-button');

    button.addEventListener('click', function (event) {
      event.preventDefault();

      self.preventUserAction();

      return self.venmoInstance.tokenize().then(function (payload) {
        self.model.addPaymentMethod(payload);
      }).catch(function (tokenizeErr) {
        if (self._isIgnorableError(tokenizeErr)) {
          return;
        }

        self.model.reportError(tokenizeErr);
      }).then(function () {
        self.allowUserAction();
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

VenmoView.isEnabled = function (options) {
  const venmoEnabled = Boolean(options.merchantConfiguration.venmo);

  if (!venmoEnabled) {
    return Promise.resolve(false);
  }

  return Promise.resolve(btVenmo.isBrowserSupported(options.merchantConfiguration.venmo));
};

module.exports = VenmoView;
