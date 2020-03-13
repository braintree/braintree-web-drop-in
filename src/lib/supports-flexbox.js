'use strict';

module.exports = function () {
  const el = document.createElement('div');
  const prop = 'flex-basis: 1px';
  const prefixes = [
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
