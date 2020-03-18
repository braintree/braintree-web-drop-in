'use strict';

function isHidden(element) {
  if (!element) { // no parentNode, so nothing containing the element is hidden
    return false;
  }

  if (element.style.display === 'none') {
    return true;
  }

  return isHidden(element.parentNode);
}

function onTransitionEnd(element, propertyName, callback) {
  if (isHidden(element)) {
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
