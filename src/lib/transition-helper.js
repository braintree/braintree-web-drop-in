'use strict';

var browserDetection = require('./browser-detection');

function onTransitionEnd(element, callback) {
  if (browserDetection.isIe9()) {
    callback();
    return;
  }

  element.addEventListener('transitionend', callback);
}

module.exports = {
  onTransitionEnd: onTransitionEnd
};
