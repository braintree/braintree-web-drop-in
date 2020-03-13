'use strict';

function kebabCaseToCamelCase(kebab) {
  const parts = kebab.split('-');
  const first = parts.shift();
  const capitalizedParts = parts.map(function (part) {
    return part.charAt(0).toUpperCase() + part.substring(1);
  });

  return [first].concat(capitalizedParts).join('');
}

module.exports = kebabCaseToCamelCase;
