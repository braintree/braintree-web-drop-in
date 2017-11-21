'use strict';

function isHTTPS() {
  return global.location.protocol === 'https:';
}

module.exports = {
  isHTTPS: isHTTPS
};
