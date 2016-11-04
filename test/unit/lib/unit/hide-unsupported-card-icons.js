'use strict';

var cardIcons = require('../../../../src/html/card-icons.html');
var hideUnsupportedCardIcons = require('../../../../src/lib/hide-unsupported-card-icons');

describe('hideUnsupportedCardIcons', function () {
  beforeEach(function () {
    this.element = document.createElement('div');
    this.element.innerHTML = cardIcons;

    this.supportedCardTypes = ['American Express', 'Discover', 'JCB', 'MasterCard', 'Visa'];
  });

  it('shows supported card icons', function () {
    var supportedCardTypes = ['american-express', 'discover', 'jcb', 'master-card', 'visa'];

    hideUnsupportedCardIcons(this.element, this.supportedCardTypes);

    supportedCardTypes.forEach(function (cardType) {
      var cardIcon = this.element.querySelector('.braintree-dropin__icon-card-' + cardType);

      expect(cardIcon.classList.contains('braintree-dropin__display--none')).to.be.false;
    }.bind(this));
  });

  it('hides unsupported card icons', function () {
    var unsupportedCardTypes = ['unionpay', 'maestro'];

    hideUnsupportedCardIcons(this.element, this.supportedCardTypes);

    unsupportedCardTypes.forEach(function (cardType) {
      var cardIcon = this.element.querySelector('.braintree-dropin__icon-card-' + cardType);

      expect(cardIcon.classList.contains('braintree-dropin__display--none')).to.be.true;
    }.bind(this));
  });
});
