'use strict';

var assign = require('../lib/assign').assign;

module.exports = assign({}, require('./en'), {
  postalCodeLabel: 'Postcode'
});
