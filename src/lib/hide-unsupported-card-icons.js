'use strict';

var classlist = require('./classlist');
var configurationCardTypes = require('../constants').configurationCardTypes;

module.exports = function (element, supportedCardTypes) {
  Object.keys(configurationCardTypes).forEach(function (paymentMethodCardType) {
    var cardIcon;
    var configurationCardType = configurationCardTypes[paymentMethodCardType];

    if (supportedCardTypes.indexOf(configurationCardType) === -1) {
      cardIcon = element.querySelector('.braintree-dropin__icon-card-' + paymentMethodCardType);
      classlist.add(cardIcon, 'braintree-dropin__display--none');
    }
  });
};
