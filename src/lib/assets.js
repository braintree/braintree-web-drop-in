'use strict';

var Promise = require('./promise');

function loadScript(container, options) {
  var script = document.createElement('script');
  var attrs = options.dataAttributes || {};

  script.src = options.src;
  script.id = options.id;
  script.async = true;

  Object.keys(attrs).forEach(function (key) {
    script.setAttribute('data-' + key, attrs[key]);
  });

  return new Promise(function (resolve) {
    script.addEventListener('load', resolve);
    container.appendChild(script);
  });
}

function loadStylesheet(options) {
  var stylesheet = document.createElement('link');
  var container = options.container || document.head;

  stylesheet.setAttribute('rel', 'stylesheet');
  stylesheet.setAttribute('type', 'text/css');
  stylesheet.setAttribute('href', options.href);
  stylesheet.setAttribute('id', options.id);

  if (container.firstChild) {
    container.insertBefore(stylesheet, container.firstChild);
  } else {
    container.appendChild(stylesheet);
  }
}

module.exports = {
  loadScript: loadScript,
  loadStylesheet: loadStylesheet
};
