'use strict';

module.exports = function (win) {
  win = win || global;

  return win.document.characterSet.toLowerCase() === 'utf-8';
};
