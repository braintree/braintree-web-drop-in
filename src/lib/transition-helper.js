'use strict';

var browserDetection = require('./browser-detection');

function onTransitionEnd(element, propertyName, callback) {
  if (browserDetection.isIe9()) {
    callback();
    return;
  }

  function transitionEventListener(event) {
    if (event.propertyName === propertyName) {
      element.removeEventListener('transitionend', transitionEventListener);
      callback();
    }
  }

  element.addEventListener('transitionend', transitionEventListener);
}

module.exports = {
  onTransitionEnd: onTransitionEnd
};
