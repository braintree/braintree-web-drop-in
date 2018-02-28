'use strict';

module.exports = function (string) {
  if (typeof string !== 'string') {
    return '';
  }

  return string
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
