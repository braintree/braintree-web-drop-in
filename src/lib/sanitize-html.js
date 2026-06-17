'use strict';

module.exports = function (string) {
  if (typeof string !== 'string') {
    return '';
  }

  return string
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
