'use strict';

function _classesOf(element) {
  return element.className.trim().split(/\s+/);
}

function _hasClass(element, classname) {
  return new RegExp('\\b' + classname + '\\b').test(element.className);
}

function add(element) {
  var toAdd = Array.prototype.slice.call(arguments, 1);
  var className = _classesOf(element).filter(function (classname) {
    return toAdd.indexOf(classname) === -1;
  }).concat(toAdd).join(' ');

  element.className = className;
}

function remove(element) {
  var toRemove = Array.prototype.slice.call(arguments, 1);
  var className = _classesOf(element).filter(function (classname) {
    return toRemove.indexOf(classname) === -1;
  }).join(' ');

  element.className = className;
}

function toggle(element, classname, adding) {
  if (arguments.length < 3) {
    if (_hasClass(element, classname)) {
      remove(element, classname);
    } else {
      add(element, classname);
    }
  } else if (adding) {
    add(element, classname);
  } else {
    remove(element, classname);
  }
}

module.exports = {
  add: add,
  remove: remove,
  toggle: toggle
};
