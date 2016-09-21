'use strict';

var classlist = require('./classlist');
var cardTypes = require('../constants').supportedCardTypes;

module.exports = function (element, supportedCardTypes) {
  Object.keys(cardTypes).forEach(function (cardType) {
    var cardIcon;
    var cardNiceType = cardTypes[cardType];

    if (supportedCardTypes.indexOf(cardNiceType) === -1) {
      cardIcon = element.querySelector('.braintree-dropin__icon-card-' + cardType);
      classlist.add(cardIcon, 'braintree-dropin__display--none');
    }
  });
};
