'use strict';

module.exports = function () {
  var el = document.createElement('div');
  var prop = 'flex-basis: 1px';
  var prefixes = [
    '-webkit-',
    '-moz-',
    '-ms-',
    '-o-',
    ''
  ];

  prefixes.forEach(function (prefix) {
    el.style.cssText += prefix + prop;
  });

  return Boolean(el.style.length);
};
