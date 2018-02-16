'use strict';

module.exports = function (string) {
  if (typeof string !== 'string') {
    return '';
  }

  return string
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    // https://stackoverflow.com/a/1354491/2601552
    // .replace(/[\u00A0-\u00FF\u2022-\u2135]/g, function(char) {
    //    return '&#' + char.charCodeAt(0) + ';';
    // });
};
