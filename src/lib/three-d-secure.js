'use strict';

var fs = require('fs');
var classList = require('@braintree/class-list');
var threeDSecure = require('braintree-web/three-d-secure');
var Promise = require('./promise');

function ThreeDSecure(client, merchantConfiguration, cardVerificationString) {
  this._client = client;
  this._config = merchantConfiguration;
  this._modal = this._setupModal(cardVerificationString);
}

ThreeDSecure.prototype.initialize = function () {
  var self = this;

  return threeDSecure.create({
    client: this._client
  }).then(function (instance) {
    self._instance = instance;
  });
};

ThreeDSecure.prototype.verify = function (nonce) {
  var self = this;

  this._revealModal();

  return Promise.all([
    this._waitForThreeDSecure(),
    this._instance.verifyCard({
      nonce: nonce,
      amount: this._config.amount,
      showLoader: false,
      addFrame: function (err, iframe) {
        var modalBody = self._modal.querySelector('.braintree-three-d-secure__modal-body');

        iframe.onload = function () {
          classList.add(modalBody, 'braintree-three-d-secure__frame-active');
        };

        modalBody.appendChild(iframe);
      },
      removeFrame: function () {
        self._cleanupModal();
      }
    }).then(function (payload) {
      self._resolveThreeDSecure();

      return payload;
    })
  ]).then(function (result) {
    self._cleanupModal();

    return result[1];
  }).catch(function (err) {
    self._cleanupModal();

    if (err.type === 'THREE_D_SECURE_CANCELLED') {
      return Promise.resolve(err.payload);
    }

    return Promise.reject(err);
  });
};

ThreeDSecure.prototype.cancel = function () {
  var self = this;

  return this._instance.cancelVerifyCard().then(function (payload) {
    self._rejectThreeDSecure({
      type: 'THREE_D_SECURE_CANCELLED',
      payload: {
        nonce: payload.nonce,
        liabilityShifted: payload.liabilityShifted,
        liabilityShiftPossible: payload.liabilityShiftPossible
      }
    });
  }).catch(function () {
    // only reason this would reject
    // is if there is no verification in progress
    // so we just swallow the error
  }).then(function () {
    self._cleanupModal();
  });
};

ThreeDSecure.prototype.updateConfiguration = function (key, value) {
  this._config[key] = value;
};

ThreeDSecure.prototype.teardown = function () {
  return this._instance.teardown();
};

ThreeDSecure.prototype._cleanupModal = function () {
  var iframe = this._modal.querySelector('iframe');

  classList.remove(this._modal.querySelector('.braintree-three-d-secure__modal'), 'braintree-three-d-secure__frame_visible');
  classList.remove(this._modal.querySelector('.braintree-three-d-secure__backdrop'), 'braintree-three-d-secure__frame_visible');

  if (iframe && iframe.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }
  setTimeout(function () {
    if (this._modal.parentNode) {
      this._modal.parentNode.removeChild(this._modal);
    }
  }.bind(this), 300);
};

ThreeDSecure.prototype._setupModal = function (cardVerificationString) {
  var self = this;
  var modal = document.createElement('div');

  modal.innerHTML = fs.readFileSync(__dirname + '/../html/three-d-secure.html', 'utf8')
    .replace('{{cardVerification}}', cardVerificationString);

  modal.querySelector('.braintree-three-d-secure__modal-close').addEventListener('click', function () {
    self.cancel();
  });

  return modal;
};

ThreeDSecure.prototype._waitForThreeDSecure = function () {
  var self = this;

  return new Promise(function (resolve, reject) {
    self._resolveThreeDSecure = resolve;
    self._rejectThreeDSecure = reject;
  });
};

ThreeDSecure.prototype._revealModal = function () {
  document.body.appendChild(this._modal);
  classList.add(this._modal.querySelector('.braintree-three-d-secure__backdrop'), 'braintree-three-d-secure__frame_visible');
  setTimeout(function () {
    classList.add(this._modal.querySelector('.braintree-three-d-secure__modal'), 'braintree-three-d-secure__frame_visible');
  }.bind(this), 10);
};

module.exports = ThreeDSecure;
