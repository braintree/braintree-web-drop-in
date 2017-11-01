'use strict';

var fs = require('fs');
var classlist = require('./classlist');
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
        var count = 0;
        var modalBody = self._modal.querySelector('.braintree-three-d-secure__modal-body');

        iframe.onload = function () {
          count++;

          if (count === 2) {
            classlist.add(modalBody, 'braintree-three-d-secure__frame-active');
          }
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

ThreeDSecure.prototype.updateConfiguration = function (key, value) {
  this._config[key] = value;
};

ThreeDSecure.prototype.teardown = function () {
  return this._instance.teardown();
};

ThreeDSecure.prototype._cleanupModal = function () {
  var iframe = this._modal.querySelector('iframe');

  classlist.remove(this._modal.querySelector('.braintree-three-d-secure__modal'), 'braintree-three-d-secure__frame_visible');
  classlist.remove(this._modal.querySelector('.braintree-three-d-secure__backdrop'), 'braintree-three-d-secure__frame_visible');

  iframe.parentNode.removeChild(iframe);
  setTimeout(function () {
    this._modal.parentNode.removeChild(this._modal);
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
  classlist.add(this._modal.querySelector('.braintree-three-d-secure__backdrop'), 'braintree-three-d-secure__frame_visible');
  setTimeout(function () {
    classlist.add(this._modal.querySelector('.braintree-three-d-secure__modal'), 'braintree-three-d-secure__frame_visible');
  }.bind(this), 10);
};

module.exports = ThreeDSecure;
