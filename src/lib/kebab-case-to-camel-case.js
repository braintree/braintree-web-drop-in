'use strict';

function kebabCaseToCamelCase(kebab) {
  var parts = kebab.split('-');
  var first = parts.shift();
  var capitalizedParts = parts.map(function (part) {
    return part.charAt(0).toUpperCase() + part.substring(1);
  });

  return [first].concat(capitalizedParts).join('');
}

module.exports = kebabCaseToCamelCase;
