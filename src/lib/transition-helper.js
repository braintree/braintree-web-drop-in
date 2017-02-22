'use strict';

var browserDetection = require('./browser-detection');

function onTransitionEnd(element, propertyName, callback) {
  if (browserDetection.isIe9()) {
    callback();
    return;
  }

  element.addEventListener('transitionend', function (event) {
    if (event.propertyName === propertyName) {
      callback();
    }
  });
}

module.exports = {
  onTransitionEnd: onTransitionEnd
};
