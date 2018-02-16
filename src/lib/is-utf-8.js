'use strict';

module.exports = function () {
  return global.document.characterSet.toLowerCase() === 'utf-8';
};
