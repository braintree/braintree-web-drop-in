'use strict';

var Promise = require('./promise');

function delay(time) {
  time = time || 0;

  return new Promise(function (resolve) {
    window.setTimeout(resolve, time);
  });
}

module.exports = {
  delay: delay
};
