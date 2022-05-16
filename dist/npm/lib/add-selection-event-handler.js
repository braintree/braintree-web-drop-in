'use strict';

function addSelectionEventHandler(element, func) {
  element.addEventListener('click', func);
  element.addEventListener('keyup', function (event) {
    if (event.keyCode === 13) {
      func();
    }
  });
}

module.exports = addSelectionEventHandler;
