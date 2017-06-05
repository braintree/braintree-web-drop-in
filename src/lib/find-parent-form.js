'use strict';

function findParentForm(element) {
  var parentNode = element.parentNode;

  if (!parentNode || parentNode.nodeName === 'FORM') {
    return parentNode;
  }

  return findParentForm(parentNode);
}

module.exports = {
  findParentForm: findParentForm
};
