'use strict';

var fs = require('fs');
var threeDSecure = require('braintree-web/three-d-secure');
var Promise = require('./promise');

function ThreeDSecure(merchantConfiguration, cardVerificationString) {
  this._config = merchantConfiguration;
  this._modal = this._setupModal(cardVerificationString);
}

ThreeDSecure.prototype.initialize = function () {
  var self = this;

  return threeDSecure.create(this._config).then(function (instance) {
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
      showLoader: this._config.showLoader,
      addFrame: function (err, iframe) {
        self._modal.querySelector('.braintree-three-d-secure__modal-body').appendChild(iframe);
      },
      removeFrame: function () {
        self._cleanupModal();
      }
    }).then(function (payload) {
      self._resolveThreeDSecure();

      return payload;
    })
  ]).then(function (result) {
    return result[1];
  }).catch(function (err) {
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
    self._cleanupModal();
  }).catch(function () {
    // only reason this would reject
    // is if there is no verificatin in progress
    // so we just swallow the error
  });
};

ThreeDSecure.prototype.teardown = function () {
  return this._instance.teardown();
};

ThreeDSecure.prototype._cleanupModal = function () {
  var iframe = this._modal.querySelector('iframe');

  iframe.parentNode.removeChild(iframe);
  this._modal.parentNode.removeChild(this._modal);
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
  this._modal.querySelector('.braintree-three-d-secure__backdrop').style.opacity = 1;
};

module.exports = ThreeDSecure;
