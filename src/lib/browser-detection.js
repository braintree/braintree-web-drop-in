'use strict';

function isIe9(userAgent) {
  userAgent = userAgent || navigator.userAgent;
  return userAgent.indexOf('MSIE 9') !== -1;
}

module.exports = {
  isIe9: isIe9
};
