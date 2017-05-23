(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.braintree || (g.braintree = {})).dropin = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var request = require('./request');
var isWhitelistedDomain = require('../lib/is-whitelisted-domain');
var BraintreeError = require('../lib/braintree-error');
var convertToBraintreeError = require('../lib/convert-to-braintree-error');
var addMetadata = require('../lib/add-metadata');
var Promise = require('../lib/promise');
var once = require('../lib/once');
var deferred = require('../lib/deferred');
var assign = require('../lib/assign').assign;
var constants = require('./constants');
var errors = require('./errors');
var sharedErrors = require('../lib/errors');
var VERSION = require('../lib/constants').VERSION;

/**
 * This object is returned by {@link Client#getConfiguration|getConfiguration}. This information is used extensively by other Braintree modules to properly configure themselves.
 * @typedef {object} Client~configuration
 * @property {object} client The braintree-web/client parameters.
 * @property {string} client.authorization A tokenizationKey or clientToken.
 * @property {object} gatewayConfiguration Gateway-supplied configuration.
 * @property {object} analyticsMetadata Analytics-specific data.
 * @property {string} analyticsMetadata.sessionId Uniquely identifies a browsing session.
 * @property {string} analyticsMetadata.sdkVersion The braintree.js version.
 * @property {string} analyticsMetadata.merchantAppId Identifies the merchant's web app.
 */

/**
 * @class
 * @param {Client~configuration} configuration Options
 * @description <strong>Do not use this constructor directly. Use {@link module:braintree-web/client.create|braintree.client.create} instead.</strong>
 * @classdesc This class is required by many other Braintree components. It serves as the base API layer that communicates with our servers. It is also capable of being used to formulate direct calls to our servers, such as direct credit card tokenization. See {@link Client#request}.
 */
function Client(configuration) {
  var configurationJSON, gatewayConfiguration, braintreeApiConfiguration;

  configuration = configuration || {};

  configurationJSON = JSON.stringify(configuration);
  gatewayConfiguration = configuration.gatewayConfiguration;

  if (!gatewayConfiguration) {
    throw new BraintreeError(errors.CLIENT_MISSING_GATEWAY_CONFIGURATION);
  }

  [
    'assetsUrl',
    'clientApiUrl',
    'configUrl'
  ].forEach(function (property) {
    if (property in gatewayConfiguration && !isWhitelistedDomain(gatewayConfiguration[property])) {
      throw new BraintreeError({
        type: errors.CLIENT_GATEWAY_CONFIGURATION_INVALID_DOMAIN.type,
        code: errors.CLIENT_GATEWAY_CONFIGURATION_INVALID_DOMAIN.code,
        message: property + ' property is on an invalid domain.'
      });
    }
  });

  /**
   * Returns a copy of the configuration values.
   * @public
   * @returns {Client~configuration} configuration
   */
  this.getConfiguration = function () {
    return JSON.parse(configurationJSON);
  };

  this._request = request;
  this._configuration = this.getConfiguration();

  this._clientApiBaseUrl = gatewayConfiguration.clientApiUrl + '/v1/';

  braintreeApiConfiguration = gatewayConfiguration.braintreeApi;
  if (braintreeApiConfiguration) {
    this._braintreeApi = {
      baseUrl: braintreeApiConfiguration.url + '/',
      accessToken: braintreeApiConfiguration.accessToken
    };

    if (!isWhitelistedDomain(this._braintreeApi.baseUrl)) {
      throw new BraintreeError({
        type: errors.CLIENT_GATEWAY_CONFIGURATION_INVALID_DOMAIN.type,
        code: errors.CLIENT_GATEWAY_CONFIGURATION_INVALID_DOMAIN.code,
        message: 'braintreeApi URL is on an invalid domain.'
      });
    }
  }
}

/**
 * Used by other modules to formulate all network requests to the Braintree gateway. It is also capable of being used directly from your own form to tokenize credit card information. However, be sure to satisfy PCI compliance if you use direct card tokenization.
 * @public
 * @param {object} options Request options:
 * @param {string} options.method HTTP method, e.g. "get" or "post".
 * @param {string} options.endpoint Endpoint path, e.g. "payment_methods".
 * @param {object} options.data Data to send with the request.
 * @param {number} [options.timeout=60000] Set a timeout (in milliseconds) for the request.
 * @param {callback} [callback] The second argument, <code>data</code>, is the returned server data.
 * @example
 * <caption>Direct Credit Card Tokenization</caption>
 * var createClient = require('braintree-web/client').create;
 *
 * createClient({
 *   authorization: CLIENT_AUTHORIZATION
 * }, function (createErr, clientInstance) {
 *   var form = document.getElementById('my-form-id');
 *   var data = {
 *     creditCard: {
 *       number: form['cc-number'].value,
 *       cvv: form['cc-cvv'].value,
 *       expirationDate: form['cc-date'].value,
 *       billingAddress: {
 *         postalCode: form['cc-postal'].value
 *       },
 *       options: {
 *         validate: false
 *       }
 *     }
 *   };
 *
 *   // Warning: For a merchant to be eligible for the easiest level of PCI compliance (SAQ A),
 *   // payment fields cannot be hosted on your checkout page.
 *   // For an alternative to the following, use Hosted Fields.
 *   clientInstance.request({
 *     endpoint: 'payment_methods/credit_cards',
 *     method: 'post',
 *     data: data
 *   }, function (requestErr, response) {
 *     // More detailed example of handling API errors: https://codepen.io/braintree/pen/MbwjdM
 *     if (requestErr) { throw new Error(requestErr); }
 *
 *     console.log('Got nonce:', response.creditCards[0].nonce);
 *   });
 * });
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
Client.prototype.request = function (options, callback) {
  var self = this; // eslint-disable-line no-invalid-this
  var requestPromise = new Promise(function (resolve, reject) {
    var optionName, api, baseUrl, requestOptions;

    if (!options.method) {
      optionName = 'options.method';
    } else if (!options.endpoint) {
      optionName = 'options.endpoint';
    }

    if (optionName) {
      throw new BraintreeError({
        type: errors.CLIENT_OPTION_REQUIRED.type,
        code: errors.CLIENT_OPTION_REQUIRED.code,
        message: optionName + ' is required when making a request.'
      });
    }

    if ('api' in options) {
      api = options.api;
    } else {
      api = 'clientApi';
    }

    requestOptions = {
      method: options.method,
      timeout: options.timeout
    };

    if (api === 'clientApi') {
      baseUrl = self._clientApiBaseUrl;

      requestOptions.data = addMetadata(self._configuration, options.data);
    } else if (api === 'braintreeApi') {
      if (!self._braintreeApi) {
        throw new BraintreeError(sharedErrors.BRAINTREE_API_ACCESS_RESTRICTED);
      }

      baseUrl = self._braintreeApi.baseUrl;

      requestOptions.data = options.data;

      requestOptions.headers = {
        'Braintree-Version': constants.BRAINTREE_API_VERSION_HEADER,
        Authorization: 'Bearer ' + self._braintreeApi.accessToken
      };
    } else {
      throw new BraintreeError({
        type: errors.CLIENT_OPTION_INVALID.type,
        code: errors.CLIENT_OPTION_INVALID.code,
        message: 'options.api is invalid.'
      });
    }

    requestOptions.url = baseUrl + options.endpoint;

    self._request(requestOptions, function (err, data, status) {
      var resolvedData;
      var requestError = formatRequestError(status, err);

      if (requestError) {
        reject(requestError);
        return;
      }

      resolvedData = assign({_httpStatus: status}, data);

      resolve(resolvedData);
    });
  });

  if (typeof callback === 'function') {
    callback = once(deferred(callback));

    requestPromise.then(function (response) {
      callback(null, response, response._httpStatus);
    }).catch(function (err) {
      var status = err && err.details && err.details.httpStatus;

      callback(err, null, status);
    });
    return;
  }

  return requestPromise; // eslint-disable-line consistent-return
};

function formatRequestError(status, err) { // eslint-disable-line consistent-return
  var requestError;

  if (status === -1) {
    requestError = new BraintreeError(errors.CLIENT_REQUEST_TIMEOUT);
  } else if (status === 403) {
    requestError = new BraintreeError(errors.CLIENT_AUTHORIZATION_INSUFFICIENT);
  } else if (status === 429) {
    requestError = new BraintreeError(errors.CLIENT_RATE_LIMITED);
  } else if (status >= 500) {
    requestError = new BraintreeError(errors.CLIENT_GATEWAY_NETWORK);
  } else if (status < 200 || status >= 400) {
    requestError = convertToBraintreeError(err, {
      type: errors.CLIENT_REQUEST_ERROR.type,
      code: errors.CLIENT_REQUEST_ERROR.code,
      message: errors.CLIENT_REQUEST_ERROR.message
    });
  }

  if (requestError) {
    requestError.details = requestError.details || {};
    requestError.details.httpStatus = status;

    return requestError;
  }
}

Client.prototype.toJSON = function () {
  return this.getConfiguration();
};

/**
 * Returns the Client version.
 * @public
 * @returns {String} The created client's version.
 * @example
 * var createClient = require('braintree-web/client').create;
 *
 * createClient({
 *   authorization: CLIENT_AUTHORIZATION
 * }, function (createErr, clientInstance) {
 *   console.log(clientInstance.getVersion()); // Ex: 1.0.0
 * });
 * @returns {void}
 */
Client.prototype.getVersion = function () {
  return VERSION;
};

module.exports = Client;

},{"../lib/add-metadata":21,"../lib/assign":23,"../lib/braintree-error":25,"../lib/constants":30,"../lib/convert-to-braintree-error":32,"../lib/deferred":34,"../lib/errors":37,"../lib/is-whitelisted-domain":39,"../lib/once":42,"../lib/promise":44,"./constants":2,"./errors":3,"./request":8}],2:[function(require,module,exports){
'use strict';

module.exports = {
  BRAINTREE_API_VERSION_HEADER: '2017-04-03'
};

},{}],3:[function(require,module,exports){
'use strict';

var BraintreeError = require('../lib/braintree-error');

module.exports = {
  CLIENT_GATEWAY_CONFIGURATION_INVALID_DOMAIN: {
    type: BraintreeError.types.MERCHANT,
    code: 'CLIENT_GATEWAY_CONFIGURATION_INVALID_DOMAIN'
  },
  CLIENT_OPTION_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'CLIENT_OPTION_REQUIRED'
  },
  CLIENT_OPTION_INVALID: {
    type: BraintreeError.types.MERCHANT,
    code: 'CLIENT_OPTION_INVALID'
  },
  CLIENT_MISSING_GATEWAY_CONFIGURATION: {
    type: BraintreeError.types.INTERNAL,
    code: 'CLIENT_MISSING_GATEWAY_CONFIGURATION',
    message: 'Missing gatewayConfiguration.'
  },
  CLIENT_INVALID_AUTHORIZATION: {
    type: BraintreeError.types.MERCHANT,
    code: 'CLIENT_INVALID_AUTHORIZATION',
    message: 'Authorization is invalid. Make sure your client token or tokenization key is valid.'
  },
  CLIENT_GATEWAY_NETWORK: {
    type: BraintreeError.types.NETWORK,
    code: 'CLIENT_GATEWAY_NETWORK',
    message: 'Cannot contact the gateway at this time.'
  },
  CLIENT_REQUEST_TIMEOUT: {
    type: BraintreeError.types.NETWORK,
    code: 'CLIENT_REQUEST_TIMEOUT',
    message: 'Request timed out waiting for a reply.'
  },
  CLIENT_REQUEST_ERROR: {
    type: BraintreeError.types.NETWORK,
    code: 'CLIENT_REQUEST_ERROR',
    message: 'There was a problem with your request.'
  },
  CLIENT_RATE_LIMITED: {
    type: BraintreeError.types.MERCHANT,
    code: 'CLIENT_RATE_LIMITED',
    message: 'You are being rate-limited; please try again in a few minutes.'
  },
  CLIENT_AUTHORIZATION_INSUFFICIENT: {
    type: BraintreeError.types.MERCHANT,
    code: 'CLIENT_AUTHORIZATION_INSUFFICIENT',
    message: 'The authorization used has insufficient privileges.'
  }
};

},{"../lib/braintree-error":25}],4:[function(require,module,exports){
(function (global){
'use strict';

var BraintreeError = require('../lib/braintree-error');
var Promise = require('../lib/promise');
var wrapPromise = require('wrap-promise');
var request = require('./request');
var uuid = require('../lib/uuid');
var constants = require('../lib/constants');
var createAuthorizationData = require('../lib/create-authorization-data');
var errors = require('./errors');

function getConfiguration(options) {
  return new Promise(function (resolve, reject) {
    var configuration, authData, attrs, configUrl;
    var sessionId = uuid();
    var analyticsMetadata = {
      merchantAppId: global.location.host,
      platform: constants.PLATFORM,
      sdkVersion: constants.VERSION,
      source: constants.SOURCE,
      integration: constants.INTEGRATION,
      integrationType: constants.INTEGRATION,
      sessionId: sessionId
    };

    try {
      authData = createAuthorizationData(options.authorization);
    } catch (err) {
      reject(new BraintreeError(errors.CLIENT_INVALID_AUTHORIZATION));
      return;
    }
    attrs = authData.attrs;
    configUrl = authData.configUrl;

    attrs._meta = analyticsMetadata;
    attrs.braintreeLibraryVersion = constants.BRAINTREE_LIBRARY_VERSION;
    attrs.configVersion = '3';

    request({
      url: configUrl,
      method: 'GET',
      data: attrs
    }, function (err, response, status) {
      var errorTemplate;

      if (err) {
        if (status === 403) {
          errorTemplate = errors.CLIENT_AUTHORIZATION_INSUFFICIENT;
        } else {
          errorTemplate = errors.CLIENT_GATEWAY_NETWORK;
        }

        reject(new BraintreeError({
          type: errorTemplate.type,
          code: errorTemplate.code,
          message: errorTemplate.message,
          details: {
            originalError: err
          }
        }));
        return;
      }

      configuration = {
        authorization: options.authorization,
        authorizationType: attrs.tokenizationKey ? 'TOKENIZATION_KEY' : 'CLIENT_TOKEN',
        analyticsMetadata: analyticsMetadata,
        gatewayConfiguration: response
      };

      resolve(configuration);
    });
  });
}

module.exports = {
  getConfiguration: wrapPromise(getConfiguration)
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../lib/braintree-error":25,"../lib/constants":30,"../lib/create-authorization-data":33,"../lib/promise":44,"../lib/uuid":47,"./errors":3,"./request":8,"wrap-promise":70}],5:[function(require,module,exports){
'use strict';

var BraintreeError = require('../lib/braintree-error');
var Client = require('./client');
var getConfiguration = require('./get-configuration').getConfiguration;
var VERSION = "3.16.0";
var Promise = require('../lib/promise');
var wrapPromise = require('wrap-promise');
var sharedErrors = require('../lib/errors');

/** @module braintree-web/client */

/**
 * @function create
 * @description This function is the entry point for the <code>braintree.client</code> module. It is used for creating {@link Client} instances that service communication to Braintree servers.
 * @param {object} options Object containing all {@link Client} options:
 * @param {string} options.authorization A tokenizationKey or clientToken.
 * @param {callback} [callback] The second argument, <code>data</code>, is the {@link Client} instance.
 * @returns {Promise|void} Returns a promise if no callback is provided.
 * @example
 * var createClient = require('braintree-web/client').create;
 *
 * createClient({
 *   authorization: CLIENT_AUTHORIZATION
 * }, function (createErr, clientInstance) {
 *   // ...
 * });
 * @static
 */
function create(options) {
  if (!options.authorization) {
    return Promise.reject(new BraintreeError({
      type: sharedErrors.INSTANTIATION_OPTION_REQUIRED.type,
      code: sharedErrors.INSTANTIATION_OPTION_REQUIRED.code,
      message: 'options.authorization is required when instantiating a client.'
    }));
  }

  return getConfiguration(options).then(function (configuration) {
    if (options.debug) {
      configuration.isDebug = true;
    }

    return new Client(configuration);
  });
}

module.exports = {
  create: wrapPromise(create),
  /**
   * @description The current version of the SDK, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};

},{"../lib/braintree-error":25,"../lib/errors":37,"../lib/promise":44,"./client":1,"./get-configuration":4,"wrap-promise":70}],6:[function(require,module,exports){
(function (global){
'use strict';

var querystring = require('../../lib/querystring');
var assign = require('../../lib/assign').assign;
var prepBody = require('./prep-body');
var parseBody = require('./parse-body');
var isXHRAvailable = global.XMLHttpRequest && 'withCredentials' in new global.XMLHttpRequest();

function getRequestObject() {
  return isXHRAvailable ? new XMLHttpRequest() : new XDomainRequest();
}

function request(options, cb) {
  var status, resBody;
  var method = options.method;
  var url = options.url;
  var body = options.data;
  var timeout = options.timeout;
  var headers = assign({
    'Content-Type': 'application/json'
  }, options.headers);
  var req = getRequestObject();
  var callback = cb;

  if (method === 'GET') {
    url = querystring.queryify(url, body);
    body = null;
  }

  if (isXHRAvailable) {
    req.onreadystatechange = function () {
      if (req.readyState !== 4) { return; }

      status = req.status;
      resBody = parseBody(req.responseText);

      if (status >= 400 || status < 200) {
        callback(resBody || 'error', null, status || 500);
      } else {
        callback(null, resBody, status);
      }
    };
  } else {
    if (options.headers) {
      url = querystring.queryify(url, headers);
    }

    req.onload = function () {
      callback(null, parseBody(req.responseText), req.status);
    };

    req.onerror = function () {
      // XDomainRequest does not report a body or status for errors, so
      // hardcode to 'error' and 500, respectively
      callback('error', null, 500);
    };

    // This must remain for IE9 to work
    req.onprogress = function () {};

    req.ontimeout = function () {
      callback('timeout', null, -1);
    };
  }

  req.open(method, url, true);
  req.timeout = timeout;

  if (isXHRAvailable) {
    Object.keys(headers).forEach(function (headerKey) {
      req.setRequestHeader(headerKey, headers[headerKey]);
    });
  }

  try {
    req.send(prepBody(method, body));
  } catch (e) { /* ignored */ }
}

module.exports = {
  request: request
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../lib/assign":23,"../../lib/querystring":45,"./parse-body":11,"./prep-body":12}],7:[function(require,module,exports){
(function (global){
'use strict';

module.exports = function getUserAgent() {
  return global.navigator.userAgent;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],8:[function(require,module,exports){
'use strict';

var ajaxIsAvaliable;
var once = require('../../lib/once');
var JSONPDriver = require('./jsonp-driver');
var AJAXDriver = require('./ajax-driver');
var getUserAgent = require('./get-user-agent');
var isHTTP = require('./is-http');

function isAjaxAvailable() {
  if (ajaxIsAvaliable == null) {
    ajaxIsAvaliable = !(isHTTP() && /MSIE\s(8|9)/.test(getUserAgent()));
  }

  return ajaxIsAvaliable;
}

module.exports = function (options, cb) {
  cb = once(cb || Function.prototype);
  options.method = (options.method || 'GET').toUpperCase();
  options.timeout = options.timeout == null ? 60000 : options.timeout;
  options.data = options.data || {};

  if (isAjaxAvailable()) {
    AJAXDriver.request(options, cb);
  } else {
    JSONPDriver.request(options, cb);
  }
};

},{"../../lib/once":42,"./ajax-driver":6,"./get-user-agent":7,"./is-http":9,"./jsonp-driver":10}],9:[function(require,module,exports){
(function (global){
'use strict';

module.exports = function () {
  return global.location.protocol === 'http:';
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
(function (global){
'use strict';

var head;
var uuid = require('../../lib/uuid');
var querystring = require('../../lib/querystring');
var timeouts = {};

function _removeScript(script) {
  if (script && script.parentNode) {
    script.parentNode.removeChild(script);
  }
}

function _createScriptTag(url, callbackName) {
  var script = document.createElement('script');
  var done = false;

  script.src = url;
  script.async = true;
  script.onerror = function () {
    global[callbackName]({message: 'error', status: 500});
  };

  script.onload = script.onreadystatechange = function () {
    if (done) { return; }

    if (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete') {
      done = true;
      script.onload = script.onreadystatechange = null;
    }
  };

  return script;
}

function _cleanupGlobal(callbackName) {
  try {
    delete global[callbackName];
  } catch (_) {
    global[callbackName] = null;
  }
}

function _setupTimeout(timeout, callbackName) {
  timeouts[callbackName] = setTimeout(function () {
    timeouts[callbackName] = null;

    global[callbackName]({
      error: 'timeout',
      status: -1
    });

    global[callbackName] = function () {
      _cleanupGlobal(callbackName);
    };
  }, timeout);
}

function _setupGlobalCallback(script, callback, callbackName) {
  global[callbackName] = function (response) {
    var status = response.status || 500;
    var err = null;
    var data = null;

    delete response.status;

    if (status >= 400 || status < 200) {
      err = response;
    } else {
      data = response;
    }

    _cleanupGlobal(callbackName);
    _removeScript(script);

    clearTimeout(timeouts[callbackName]);
    callback(err, data, status);
  };
}

function request(options, callback) {
  var script;
  var callbackName = 'callback_json_' + uuid().replace(/-/g, '');
  var url = options.url;
  var attrs = options.data;
  var method = options.method;
  var timeout = options.timeout;

  url = querystring.queryify(url, attrs);
  url = querystring.queryify(url, {
    _method: method,
    callback: callbackName
  });

  script = _createScriptTag(url, callbackName);
  _setupGlobalCallback(script, callback, callbackName);
  _setupTimeout(timeout, callbackName);

  if (!head) {
    head = document.getElementsByTagName('head')[0];
  }

  head.appendChild(script);
}

module.exports = {
  request: request
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../lib/querystring":45,"../../lib/uuid":47}],11:[function(require,module,exports){
'use strict';

module.exports = function (body) {
  try {
    body = JSON.parse(body);
  } catch (e) { /* ignored */ }

  return body;
};

},{}],12:[function(require,module,exports){
'use strict';

module.exports = function (method, body) {
  if (typeof method !== 'string') {
    throw new Error('Method must be a string');
  }

  if (method.toLowerCase() !== 'get' && body != null) {
    body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return body;
};

},{}],13:[function(require,module,exports){
'use strict';

var BraintreeError = require('../../lib/braintree-error');
var errors = require('../shared/errors');
var whitelist = require('../shared/constants').whitelistedAttributes;

function attributeValidationError(attribute, value) {
  var err;

  if (!whitelist.hasOwnProperty(attribute)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_ATTRIBUTE_NOT_SUPPORTED.type,
      code: errors.HOSTED_FIELDS_ATTRIBUTE_NOT_SUPPORTED.code,
      message: 'The "' + attribute + '" attribute is not supported in Hosted Fields.'
    });
  } else if (value != null && !_isValid(attribute, value)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_ATTRIBUTE_VALUE_NOT_ALLOWED.type,
      code: errors.HOSTED_FIELDS_ATTRIBUTE_VALUE_NOT_ALLOWED.code,
      message: 'Value "' + value + '" is not allowed for "' + attribute + '" attribute.'
    });
  }

  return err;
}

function _isValid(attribute, value) {
  if (whitelist[attribute] === 'string') {
    return typeof value === 'string' || typeof value === 'number';
  } else if (whitelist[attribute] === 'boolean') {
    return String(value) === 'true' || String(value) === 'false';
  }

  return false;
}

module.exports = attributeValidationError;

},{"../../lib/braintree-error":25,"../shared/constants":18,"../shared/errors":19}],14:[function(require,module,exports){
'use strict';

var constants = require('../shared/constants');
var useMin = require('../../lib/use-min');

module.exports = function composeUrl(assetsUrl, componentId, isDebug) {
  return assetsUrl +
    '/web/' +
    constants.VERSION +
    '/html/hosted-fields-frame' + useMin(isDebug) + '.html#' +
    componentId;
};

},{"../../lib/use-min":46,"../shared/constants":18}],15:[function(require,module,exports){
'use strict';

var Destructor = require('../../lib/destructor');
var classlist = require('../../lib/classlist');
var iFramer = require('iframer');
var Bus = require('../../lib/bus');
var BraintreeError = require('../../lib/braintree-error');
var composeUrl = require('./compose-url');
var constants = require('../shared/constants');
var errors = require('../shared/errors');
var INTEGRATION_TIMEOUT_MS = require('../../lib/constants').INTEGRATION_TIMEOUT_MS;
var uuid = require('../../lib/uuid');
var findParentTags = require('../shared/find-parent-tags');
var isIos = require('browser-detection/is-ios');
var events = constants.events;
var EventEmitter = require('../../lib/event-emitter');
var injectFrame = require('./inject-frame');
var analytics = require('../../lib/analytics');
var whitelistedFields = constants.whitelistedFields;
var VERSION = "3.16.0";
var methods = require('../../lib/methods');
var convertMethodsToError = require('../../lib/convert-methods-to-error');
var sharedErrors = require('../../lib/errors');
var getCardTypes = require('credit-card-type');
var attributeValidationError = require('./attribute-validation-error');
var Promise = require('../../lib/promise');
var wrapPromise = require('wrap-promise');

/**
 * @typedef {object} HostedFields~tokenizePayload
 * @property {string} nonce The payment method nonce.
 * @property {object} details Additional account details.
 * @property {string} details.cardType Type of card, ex: Visa, MasterCard.
 * @property {string} details.lastTwo Last two digits of card number.
 * @property {string} description A human-readable description.
 * @property {string} type The payment method type, always `CreditCard`.
 */

/**
 * @typedef {object} HostedFields~stateObject
 * @description The event payload sent from {@link HostedFields#on|on} or {@link HostedFields#getState|getState}.
 * @property {HostedFields~hostedFieldsCard[]} cards
 * This will return an array of potential {@link HostedFields~hostedFieldsCard|cards}. If the card type has been determined, the array will contain only one card.
 * Internally, Hosted Fields uses <a href="https://github.com/braintree/credit-card-type">credit-card-type</a>,
 * an open-source card detection library.
 * @property {string} emittedBy
 * The name of the field associated with an event. This will not be included if returned by {@link HostedFields#getState|getState}. It will be one of the following strings:<br>
 * - `"number"`
 * - `"cvv"`
 * - `"expirationDate"`
 * - `"expirationMonth"`
 * - `"expirationYear"`
 * - `"postalCode"`
 * @property {object} fields
 * @property {?HostedFields~hostedFieldsFieldData} fields.number {@link HostedFields~hostedFieldsFieldData|hostedFieldsFieldData} for the number field, if it is present.
 * @property {?HostedFields~hostedFieldsFieldData} fields.cvv {@link HostedFields~hostedFieldsFieldData|hostedFieldsFieldData} for the CVV field, if it is present.
 * @property {?HostedFields~hostedFieldsFieldData} fields.expirationDate {@link HostedFields~hostedFieldsFieldData|hostedFieldsFieldData} for the expiration date field, if it is present.
 * @property {?HostedFields~hostedFieldsFieldData} fields.expirationMonth {@link HostedFields~hostedFieldsFieldData|hostedFieldsFieldData} for the expiration month field, if it is present.
 * @property {?HostedFields~hostedFieldsFieldData} fields.expirationYear {@link HostedFields~hostedFieldsFieldData|hostedFieldsFieldData} for the expiration year field, if it is present.
 * @property {?HostedFields~hostedFieldsFieldData} fields.postalCode {@link HostedFields~hostedFieldsFieldData|hostedFieldsFieldData} for the postal code field, if it is present.
 */

/**
 * @typedef {object} HostedFields~hostedFieldsFieldData
 * @description Data about Hosted Fields fields, sent in {@link HostedFields~stateObject|stateObjects}.
 * @property {HTMLElement} container Reference to the container DOM element on your page associated with the current event.
 * @property {boolean} isFocused Whether or not the input is currently focused.
 * @property {boolean} isEmpty Whether or not the user has entered a value in the input.
 * @property {boolean} isPotentiallyValid
 * A determination based on the future validity of the input value.
 * This is helpful when a user is entering a card number and types <code>"41"</code>.
 * While that value is not valid for submission, it is still possible for
 * it to become a fully qualified entry. However, if the user enters <code>"4x"</code>
 * it is clear that the card number can never become valid and isPotentiallyValid will
 * return false.
 * @property {boolean} isValid Whether or not the value of the associated input is <i>fully</i> qualified for submission.
 */

/**
 * @typedef {object} HostedFields~hostedFieldsCard
 * @description Information about the card type, sent in {@link HostedFields~stateObject|stateObjects}.
 * @property {string} type The code-friendly representation of the card type. It will be one of the following strings:
 * - `american-express`
 * - `diners-club`
 * - `discover`
 * - `jcb`
 * - `maestro`
 * - `master-card`
 * - `unionpay`
 * - `visa`
 * @property {string} niceType The pretty-printed card type. It will be one of the following strings:
 * - `American Express`
 * - `Diners Club`
 * - `Discover`
 * - `JCB`
 * - `Maestro`
 * - `MasterCard`
 * - `UnionPay`
 * - `Visa`
 * @property {object} code
 * This object contains data relevant to the security code requirements of the card brand.
 * For example, on a Visa card there will be a <code>CVV</code> of 3 digits, whereas an
 * American Express card requires a 4-digit <code>CID</code>.
 * @property {string} code.name <code>"CVV"</code> <code>"CID"</code> <code>"CVC"</code>
 * @property {number} code.size The expected length of the security code. Typically, this is 3 or 4.
 */

/**
 * @name HostedFields#on
 * @function
 * @param {string} event The name of the event to which you are subscribing.
 * @param {function} handler A callback to handle the event.
 * @description Subscribes a handler function to a named event. `event` should be {@link HostedFields#event:blur|blur}, {@link HostedFields#event:focus|focus}, {@link HostedFields#event:empty|empty}, {@link HostedFields#event:notEmpty|notEmpty}, {@link HostedFields#event:cardTypeChange|cardTypeChange}, or {@link HostedFields#event:validityChange|validityChange}. Events will emit a {@link HostedFields~stateObject|stateObject}.
 * @example
 * <caption>Listening to a Hosted Field event, in this case 'focus'</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('focus', function (event) {
 *     console.log(event.emittedBy, 'has been focused');
 *   });
 * });
 * @returns {void}
 */

/**
 * This event is emitted when the user requests submission of an input field, such as by pressing the Enter or Return key on their keyboard, or mobile equivalent.
 * @event HostedFields#inputSubmitRequest
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Clicking a submit button upon hitting Enter (or equivalent) within a Hosted Field</caption>
 * var hostedFields = require('braintree-web/hosted-fields');
 * var submitButton = document.querySelector('input[type="submit"]');
 *
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('inputSubmitRequest', function () {
 *     // User requested submission, e.g. by pressing Enter or equivalent
 *     submitButton.click();
 *   });
 * });
 */

/**
 * This event is emitted when a field transitions from having data to being empty.
 * @event HostedFields#empty
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Listening to an empty event</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('empty', function (event) {
 *     console.log(event.emittedBy, 'is now empty');
 *   });
 * });
 */

/**
 * This event is emitted when a field transitions from being empty to having data.
 * @event HostedFields#notEmpty
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Listening to an notEmpty event</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('notEmpty', function (event) {
 *     console.log(event.emittedBy, 'is now not empty');
 *   });
 * });
 */

/**
 * This event is emitted when a field loses focus.
 * @event HostedFields#blur
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Listening to a blur event</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('blur', function (event) {
 *     console.log(event.emittedBy, 'lost focus');
 *   });
 * });
 */

/**
 * This event is emitted when a field gains focus.
 * @event HostedFields#focus
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Listening to a focus event</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('focus', function (event) {
 *     console.log(event.emittedBy, 'gained focus');
 *   });
 * });
 */

/**
 * This event is emitted when activity within the number field has changed such that the possible card type has changed.
 * @event HostedFields#cardTypeChange
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Listening to a cardTypeChange event</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('cardTypeChange', function (event) {
 *     if (event.cards.length === 1) {
 *       console.log(event.cards[0].type);
 *     } else {
 *       console.log('Type of card not yet known');
 *     }
 *   });
 * });
 */

/**
 * This event is emitted when the validity of a field has changed. Validity is represented in the {@link HostedFields~stateObject|stateObject} as two booleans: `isValid` and `isPotentiallyValid`.
 * @event HostedFields#validityChange
 * @type {HostedFields~stateObject}
 * @example
 * <caption>Listening to a validityChange event</caption>
 * hostedFields.create({ ... }, function (createErr, hostedFieldsInstance) {
 *   hostedFieldsInstance.on('validityChange', function (event) {
 *     var field = event.fields[event.emittedBy];
 *
 *     if (field.isValid) {
 *       console.log(event.emittedBy, 'is fully valid');
 *     } else if (field.isPotentiallyValid) {
 *       console.log(event.emittedBy, 'is potentially valid');
 *     } else {
 *       console.log(event.emittedBy, 'is not valid');
 *     }
 *   });
 * });
 */

function createInputEventHandler(fields) {
  return function (eventData) {
    var field;
    var merchantPayload = eventData.merchantPayload;
    var emittedBy = merchantPayload.emittedBy;
    var container = fields[emittedBy].containerElement;

    Object.keys(merchantPayload.fields).forEach(function (key) {
      merchantPayload.fields[key].container = fields[key].containerElement;
    });

    field = merchantPayload.fields[emittedBy];

    classlist.toggle(container, constants.externalClasses.FOCUSED, field.isFocused);
    classlist.toggle(container, constants.externalClasses.VALID, field.isValid);
    classlist.toggle(container, constants.externalClasses.INVALID, !field.isPotentiallyValid);

    this._state = { // eslint-disable-line no-invalid-this
      cards: merchantPayload.cards,
      fields: merchantPayload.fields
    };

    this._emit(eventData.type, merchantPayload); // eslint-disable-line no-invalid-this
  };
}

/**
 * @class HostedFields
 * @param {object} options The Hosted Fields {@link module:braintree-web/hosted-fields.create create} options.
 * @description <strong>Do not use this constructor directly. Use {@link module:braintree-web/hosted-fields.create|braintree-web.hosted-fields.create} instead.</strong>
 * @classdesc This class represents a Hosted Fields component produced by {@link module:braintree-web/hosted-fields.create|braintree-web/hosted-fields.create}. Instances of this class have methods for interacting with the input fields within Hosted Fields' iframes.
 */
function HostedFields(options) {
  var failureTimeout, clientVersion, clientConfig;
  var self = this;
  var fields = {};
  var fieldCount = 0;
  var componentId = uuid();

  if (!options.client) {
    throw new BraintreeError({
      type: sharedErrors.INSTANTIATION_OPTION_REQUIRED.type,
      code: sharedErrors.INSTANTIATION_OPTION_REQUIRED.code,
      message: 'options.client is required when instantiating Hosted Fields.'
    });
  }

  clientConfig = options.client.getConfiguration();
  clientVersion = options.client.getVersion();
  if (clientVersion !== VERSION) {
    throw new BraintreeError({
      type: sharedErrors.INCOMPATIBLE_VERSIONS.type,
      code: sharedErrors.INCOMPATIBLE_VERSIONS.code,
      message: 'Client (version ' + clientVersion + ') and Hosted Fields (version ' + VERSION + ') components must be from the same SDK version.'
    });
  }

  if (!options.fields) {
    throw new BraintreeError({
      type: sharedErrors.INSTANTIATION_OPTION_REQUIRED.type,
      code: sharedErrors.INSTANTIATION_OPTION_REQUIRED.code,
      message: 'options.fields is required when instantiating Hosted Fields.'
    });
  }

  EventEmitter.call(this);

  this._injectedNodes = [];
  this._destructor = new Destructor();
  this._fields = fields;
  this._state = {
    fields: {},
    cards: getCardTypes('')
  };

  this._bus = new Bus({
    channel: componentId,
    merchantUrl: location.href
  });

  this._destructor.registerFunctionForTeardown(function () {
    self._bus.teardown();
  });

  this._client = options.client;

  analytics.sendEvent(this._client, 'custom.hosted-fields.initialized');

  Object.keys(options.fields).forEach(function (key) {
    var field, container, frame;

    if (!constants.whitelistedFields.hasOwnProperty(key)) {
      throw new BraintreeError({
        type: errors.HOSTED_FIELDS_INVALID_FIELD_KEY.type,
        code: errors.HOSTED_FIELDS_INVALID_FIELD_KEY.code,
        message: '"' + key + '" is not a valid field.'
      });
    }

    field = options.fields[key];

    container = document.querySelector(field.selector);

    if (!container) {
      throw new BraintreeError({
        type: errors.HOSTED_FIELDS_INVALID_FIELD_SELECTOR.type,
        code: errors.HOSTED_FIELDS_INVALID_FIELD_SELECTOR.code,
        message: errors.HOSTED_FIELDS_INVALID_FIELD_SELECTOR.message,
        details: {
          fieldSelector: field.selector,
          fieldKey: key
        }
      });
    } else if (container.querySelector('iframe[name^="braintree-"]')) {
      throw new BraintreeError({
        type: errors.HOSTED_FIELDS_FIELD_DUPLICATE_IFRAME.type,
        code: errors.HOSTED_FIELDS_FIELD_DUPLICATE_IFRAME.code,
        message: errors.HOSTED_FIELDS_FIELD_DUPLICATE_IFRAME.message,
        details: {
          fieldSelector: field.selector,
          fieldKey: key
        }
      });
    }

    if (field.maxlength && typeof field.maxlength !== 'number') {
      throw new BraintreeError({
        type: errors.HOSTED_FIELDS_FIELD_PROPERTY_INVALID.type,
        code: errors.HOSTED_FIELDS_FIELD_PROPERTY_INVALID.code,
        message: 'The value for maxlength must be a number.',
        details: {
          fieldKey: key
        }
      });
    }

    frame = iFramer({
      type: key,
      name: 'braintree-hosted-field-' + key,
      style: constants.defaultIFrameStyle
    });

    this._injectedNodes = this._injectedNodes.concat(injectFrame(frame, container));
    this._setupLabelFocus(key, container);
    fields[key] = {
      frameElement: frame,
      containerElement: container
    };
    fieldCount++;

    this._state.fields[key] = {
      isEmpty: true,
      isValid: false,
      isPotentiallyValid: true,
      isFocused: false,
      container: container
    };

    setTimeout(function () {
      frame.src = composeUrl(clientConfig.gatewayConfiguration.assetsUrl, componentId, clientConfig.isDebug);
    }, 0);
  }.bind(this));

  failureTimeout = setTimeout(function () {
    analytics.sendEvent(self._client, 'custom.hosted-fields.load.timed-out');
  }, INTEGRATION_TIMEOUT_MS);

  this._bus.on(events.FRAME_READY, function (reply) {
    fieldCount--;
    if (fieldCount === 0) {
      clearTimeout(failureTimeout);
      reply(options);
      self._emit('ready');
    }
  });

  this._bus.on(
    events.INPUT_EVENT,
    createInputEventHandler(fields).bind(this)
  );

  this._destructor.registerFunctionForTeardown(function () {
    var j, node, parent;

    for (j = 0; j < self._injectedNodes.length; j++) {
      node = self._injectedNodes[j];
      parent = node.parentNode;

      parent.removeChild(node);

      classlist.remove(
        parent,
        constants.externalClasses.FOCUSED,
        constants.externalClasses.INVALID,
        constants.externalClasses.VALID
      );
    }
  });

  this._destructor.registerFunctionForTeardown(function () {
    var methodNames = methods(HostedFields.prototype).concat(methods(EventEmitter.prototype));

    convertMethodsToError(self, methodNames);
  });
}

HostedFields.prototype = Object.create(EventEmitter.prototype, {
  constructor: HostedFields
});

HostedFields.prototype._setupLabelFocus = function (type, container) {
  var labels, i;
  var shouldSkipLabelFocus = isIos();
  var bus = this._bus;

  if (shouldSkipLabelFocus) { return; }
  if (container.id == null) { return; }

  function triggerFocus() {
    bus.emit(events.TRIGGER_INPUT_FOCUS, type);
  }

  labels = Array.prototype.slice.call(document.querySelectorAll('label[for="' + container.id + '"]'));
  labels = labels.concat(findParentTags(container, 'label'));

  for (i = 0; i < labels.length; i++) {
    labels[i].addEventListener('click', triggerFocus, false);
  }

  this._destructor.registerFunctionForTeardown(function () {
    for (i = 0; i < labels.length; i++) {
      labels[i].removeEventListener('click', triggerFocus, false);
    }
  });
};

/**
 * Cleanly remove anything set up by {@link module:braintree-web/hosted-fields.create|create}.
 * @public
 * @param {callback} [callback] Called on completion, containing an error if one occurred. No data is returned if teardown completes successfully. If no callback is provided, `teardown` returns a promise.
 * @example
 * hostedFieldsInstance.teardown(function (teardownErr) {
 *   if (teardownErr) {
 *     console.error('Could not tear down Hosted Fields!');
 *   } else {
 *     console.info('Hosted Fields has been torn down!');
 *   }
 * });
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.teardown = function () {
  var self = this;

  return new Promise(function (resolve, reject) {
    self._destructor.teardown(function (err) {
      analytics.sendEvent(self._client, 'custom.hosted-fields.teardown-completed');

      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Tokenizes fields and returns a nonce payload.
 * @public
 * @param {object} [options] All tokenization options for the Hosted Fields component.
 * @param {boolean} [options.vault=false] When true, will vault the tokenized card. Cards will only be vaulted when using a client created with a client token that includes a customer ID.
 * @param {string} [options.billingAddress.postalCode] When supplied, this postal code will be tokenized along with the contents of the fields. If a postal code is provided as part of the Hosted Fields configuration, the value of the field will be tokenized and this value will be ignored.
 * @param {callback} [callback] The second argument, <code>data</code>, is a {@link HostedFields~tokenizePayload|tokenizePayload}. If no callback is provided, `tokenize` returns a function that resolves with a {@link HostedFields~tokenizePayload|tokenizePayload}.
 * @example <caption>Tokenize a card</caption>
 * hostedFieldsInstance.tokenize(function (tokenizeErr, payload) {
 *   if (tokenizeErr) {
 *     switch (tokenizeErr.code) {
 *       case 'HOSTED_FIELDS_FIELDS_EMPTY':
 *         // occurs when none of the fields are filled in
 *         console.error('All fields are empty! Please fill out the form.');
 *         break;
 *       case 'HOSTED_FIELDS_FIELDS_INVALID':
 *         // occurs when certain fields do not pass client side validation
 *         console.error('Some fields are invalid:', tokenizeErr.details.invalidFieldKeys);
 *         break;
 *       case 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE':
 *         // occurs when:
 *         //   * the client token used for client authorization was generated
 *         //     with a customer ID and the fail on duplicate payment method
 *         //     option is set to true
 *         //   * the card being tokenized has previously been vaulted (with any customer)
 *         // See: https://developers.braintreepayments.com/reference/request/client-token/generate/#options.fail_on_duplicate_payment_method
 *         console.error('This payment method already exists in your vault.');
 *         break;
 *       case 'HOSTED_FIELDS_TOKENIZATION_CVV_VERIFICATION_FAILED':
 *         // occurs when:
 *         //   * the client token used for client authorization was generated
 *         //     with a customer ID and the verify card option is set to true
 *         //     and you have credit card verification turned on in the Braintree
 *         //     control panel
 *         //   * the cvv does not pass verfication (https://developers.braintreepayments.com/reference/general/testing/#avs-and-cvv/cid-responses)
 *         // See: https://developers.braintreepayments.com/reference/request/client-token/generate/#options.verify_card
 *         console.error('CVV did not pass verification');
 *         break;
 *       case 'HOSTED_FIELDS_FAILED_TOKENIZATION':
 *         // occurs for any other tokenization error on the server
 *         console.error('Tokenization failed server side. Is the card valid?');
 *         break;
 *       case 'HOSTED_FIELDS_TOKENIZATION_NETWORK_ERROR':
 *         // occurs when the Braintree gateway cannot be contacted
 *         console.error('Network error occurred when tokenizing.');
 *         break;
 *       default:
 *         console.error('Something bad happened!', tokenizeErr);
 *     }
 *   } else {
 *     console.log('Got nonce:', payload.nonce);
 *   }
 * });
 * @example <caption>Tokenize and vault a card</caption>
 * hostedFieldsInstance.tokenize({
 *   vault: true
 * }, function (tokenizeErr, payload) {
 *   if (tokenizeErr) {
 *     console.error(tokenizeErr);
 *   } else {
 *     console.log('Got nonce:', payload.nonce);
 *   }
 * });
 * @example <caption>Tokenize a card with the postal code option</caption>
 * hostedFieldsInstance.tokenize({
 *   billingAddress: {
 *     postalCode: '11111'
 *   }
 * }, function (tokenizeErr, payload) {
 *   if (tokenizeErr) {
 *     console.error(tokenizeErr);
 *   } else {
 *     console.log('Got nonce:', payload.nonce);
 *   }
 * });
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.tokenize = function (options) {
  var self = this;

  if (!options) {
    options = {};
  }

  return new Promise(function (resolve, reject) {
    self._bus.emit(events.TOKENIZATION_REQUEST, options, function (response) {
      var err = response[0];
      var payload = response[1];

      if (err) {
        reject(err);
      } else {
        resolve(payload);
      }
    });
  });
};

/**
 * Add a class to a {@link module:braintree-web/hosted-fields~field field}. Useful for updating field styles when events occur elsewhere in your checkout.
 * @public
 * @param {string} field The field you wish to add a class to. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {string} classname The class to be added.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the class is added successfully.
 *
 * @example
 * hostedFieldsInstance.addClass('number', 'custom-class', function (addClassErr) {
 *   if (addClassErr) {
 *     console.error(addClassErr);
 *   }
 * });
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.addClass = function (field, classname) {
  var err;

  if (!whitelistedFields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_INVALID.type,
      code: errors.HOSTED_FIELDS_FIELD_INVALID.code,
      message: '"' + field + '" is not a valid field. You must use a valid field option when adding a class.'
    });
  } else if (!this._fields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.type,
      code: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.code,
      message: 'Cannot add class to "' + field + '" field because it is not part of the current Hosted Fields options.'
    });
  } else {
    this._bus.emit(events.ADD_CLASS, field, classname);
  }

  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve();
};

/**
 * Removes a class to a {@link module:braintree-web/hosted-fields~field field}. Useful for updating field styles when events occur elsewhere in your checkout.
 * @public
 * @param {string} field The field you wish to remove a class from. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {string} classname The class to be removed.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the class is removed successfully.
 *
 * @example
 * hostedFieldsInstance.addClass('number', 'custom-class', function (addClassErr) {
 *   if (addClassErr) {
 *     console.error(addClassErr);
 *     return;
 *   }
 *
 *   // some time later...
 *   hostedFieldsInstance.removeClass('number', 'custom-class');
 * });
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.removeClass = function (field, classname) {
  var err;

  if (!whitelistedFields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_INVALID.type,
      code: errors.HOSTED_FIELDS_FIELD_INVALID.code,
      message: '"' + field + '" is not a valid field. You must use a valid field option when removing a class.'
    });
  } else if (!this._fields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.type,
      code: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.code,
      message: 'Cannot remove class from "' + field + '" field because it is not part of the current Hosted Fields options.'
    });
  } else {
    this._bus.emit(events.REMOVE_CLASS, field, classname);
  }

  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve();
};

/**
 * Sets an attribute of a {@link module:braintree-web/hosted-fields~field field}.
 * Supported attributes are `aria-invalid`, `aria-required`, `disabled`, and `placeholder`.
 *
 * @public
 * @param {object} options The options for the attribute you wish to set.
 * @param {string} options.field The field to which you wish to add an attribute. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {string} options.attribute The name of the attribute you wish to add to the field.
 * @param {string} options.value The value for the attribute.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the attribute is set successfully.
 *
 * @example <caption>Set the placeholder attribute of a field</caption>
 * hostedFieldsInstance.setAttribute({
 *   field: 'number',
 *   attribute: 'placeholder',
 *   value: '1111 1111 1111 1111'
 * }, function (attributeErr) {
 *   if (attributeErr) {
 *     console.error(attributeErr);
 *   }
 * });
 *
 * @example <caption>Set the aria-required attribute of a field</caption>
 * hostedFieldsInstance.setAttribute({
 *   field: 'number',
 *   attribute: 'aria-required',
 *   value: true
 * }, function (attributeErr) {
 *   if (attributeErr) {
 *     console.error(attributeErr);
 *   }
 * });
 *
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.setAttribute = function (options) {
  var attributeErr, err;

  if (!whitelistedFields.hasOwnProperty(options.field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_INVALID.type,
      code: errors.HOSTED_FIELDS_FIELD_INVALID.code,
      message: '"' + options.field + '" is not a valid field. You must use a valid field option when setting an attribute.'
    });
  } else if (!this._fields.hasOwnProperty(options.field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.type,
      code: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.code,
      message: 'Cannot set attribute for "' + options.field + '" field because it is not part of the current Hosted Fields options.'
    });
  } else {
    attributeErr = attributeValidationError(options.attribute, options.value);

    if (attributeErr) {
      err = attributeErr;
    } else {
      this._bus.emit(events.SET_ATTRIBUTE, options.field, options.attribute, options.value);
    }
  }

  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve();
};

/**
 * Removes a supported attribute from a {@link module:braintree-web/hosted-fields~field field}.
 *
 * @public
 * @param {object} options The options for the attribute you wish to remove.
 * @param {string} options.field The field from which you wish to remove an attribute. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {string} options.attribute The name of the attribute you wish to remove from the field.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the attribute is removed successfully.
 *
 * @example <caption>Remove the placeholder attribute of a field</caption>
 * hostedFieldsInstance.removeAttribute({
 *   field: 'number',
 *   attribute: 'placeholder'
 * }, function (attributeErr) {
 *   if (attributeErr) {
 *     console.error(attributeErr);
 *   }
 * });
 *
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.removeAttribute = function (options) {
  var attributeErr, err;

  if (!whitelistedFields.hasOwnProperty(options.field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_INVALID.type,
      code: errors.HOSTED_FIELDS_FIELD_INVALID.code,
      message: '"' + options.field + '" is not a valid field. You must use a valid field option when removing an attribute.'
    });
  } else if (!this._fields.hasOwnProperty(options.field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.type,
      code: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.code,
      message: 'Cannot remove attribute for "' + options.field + '" field because it is not part of the current Hosted Fields options.'
    });
  } else {
    attributeErr = attributeValidationError(options.attribute);

    if (attributeErr) {
      err = attributeErr;
    } else {
      this._bus.emit(events.REMOVE_ATTRIBUTE, options.field, options.attribute);
    }
  }

  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve();
};

/**
 * @deprecated since version 3.8.0. Use {@link HostedFields#setAttribute|setAttribute} instead.
 *
 * @public
 * @param {string} field The field whose placeholder you wish to change. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {string} placeholder Will be used as the `placeholder` attribute of the input.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the placeholder updated successfully.
 *
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
HostedFields.prototype.setPlaceholder = function (field, placeholder) {
  return this.setAttribute({
    field: field,
    attribute: 'placeholder',
    value: placeholder
  });
};

/**
 * Clear the value of a {@link module:braintree-web/hosted-fields~field field}.
 * @public
 * @param {string} field The field you wish to clear. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the field cleared successfully.
 * @returns {Promise|void} Returns a promise if no callback is provided.
 * @example
 * hostedFieldsInstance.clear('number', function (clearErr) {
 *   if (clearErr) {
 *     console.error(clearErr);
 *   }
 * });
 *
 * @example <caption>Clear several fields</caption>
 * hostedFieldsInstance.clear('number');
 * hostedFieldsInstance.clear('cvv');
 * hostedFieldsInstance.clear('expirationDate');
 */
HostedFields.prototype.clear = function (field) {
  var err;

  if (!whitelistedFields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_INVALID.type,
      code: errors.HOSTED_FIELDS_FIELD_INVALID.code,
      message: '"' + field + '" is not a valid field. You must use a valid field option when clearing a field.'
    });
  } else if (!this._fields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.type,
      code: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.code,
      message: 'Cannot clear "' + field + '" field because it is not part of the current Hosted Fields options.'
    });
  } else {
    this._bus.emit(events.CLEAR_FIELD, field);
  }

  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve();
};

/**
 * Programmatically focus a {@link module:braintree-web/hosted-fields~field field}.
 * @public
 * @param {string} field The field you want to focus. Must be a valid {@link module:braintree-web/hosted-fields~fieldOptions fieldOption}.
 * @param {callback} [callback] Callback executed on completion, containing an error if one occurred. No data is returned if the field focused successfully.
 * @returns {void}
 * @example
 * hostedFieldsInstance.focus('number', function (focusErr) {
 *   if (focusErr) {
 *     console.error(focusErr);
 *   }
 * });
 * @example <caption>Using an event listener</caption>
 * myElement.addEventListener('click', function (e) {
 *   // Note: In Firefox, the focus method can be suppressed
 *   // if the element has a tabindex property or the element
 *   // is an anchor link with an href property.
 *   e.preventDefault();
 *   hostedFieldsInstance.focus('number');
 * });
 */
HostedFields.prototype.focus = function (field) {
  var err;

  if (!whitelistedFields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_INVALID.type,
      code: errors.HOSTED_FIELDS_FIELD_INVALID.code,
      message: '"' + field + '" is not a valid field. You must use a valid field option when focusing a field.'
    });
  } else if (!this._fields.hasOwnProperty(field)) {
    err = new BraintreeError({
      type: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.type,
      code: errors.HOSTED_FIELDS_FIELD_NOT_PRESENT.code,
      message: 'Cannot focus "' + field + '" field because it is not part of the current Hosted Fields options.'
    });
  } else {
    this._bus.emit(events.TRIGGER_INPUT_FOCUS, field);
  }

  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve();
};

/**
 * Returns an {@link HostedFields~stateObject|object} that includes the state of all fields and possible card types.
 * @public
 * @returns {object} {@link HostedFields~stateObject|stateObject}
 * @example <caption>Check if all fields are valid</caption>
 * var state = hostedFields.getState();
 *
 * var formValid = Object.keys(state.fields).every(function (key) {
 *   return state.fields[key].isValid;
 * });
 */
HostedFields.prototype.getState = function () {
  return this._state;
};

module.exports = wrapPromise.wrapPrototype(HostedFields);

},{"../../lib/analytics":22,"../../lib/braintree-error":25,"../../lib/bus":28,"../../lib/classlist":29,"../../lib/constants":30,"../../lib/convert-methods-to-error":31,"../../lib/destructor":35,"../../lib/errors":37,"../../lib/event-emitter":38,"../../lib/methods":41,"../../lib/promise":44,"../../lib/uuid":47,"../shared/constants":18,"../shared/errors":19,"../shared/find-parent-tags":20,"./attribute-validation-error":13,"./compose-url":14,"./inject-frame":16,"browser-detection/is-ios":53,"credit-card-type":54,"iframer":56,"wrap-promise":70}],16:[function(require,module,exports){
'use strict';

module.exports = function injectFrame(frame, container) {
  var clearboth = document.createElement('div');
  var fragment = document.createDocumentFragment();

  clearboth.style.clear = 'both';

  fragment.appendChild(frame);
  fragment.appendChild(clearboth);

  container.appendChild(fragment);

  return [frame, clearboth];
};

},{}],17:[function(require,module,exports){
'use strict';
/** @module braintree-web/hosted-fields */

var HostedFields = require('./external/hosted-fields');
var supportsInputFormatting = require('restricted-input/supports-input-formatting');
var wrapPromise = require('wrap-promise');
var Promise = require('../lib/promise');
var VERSION = "3.16.0";

/**
 * Fields used in {@link module:braintree-web/hosted-fields~fieldOptions fields options}
 * @typedef {object} field
 * @property {string} selector A CSS selector to find the container where the hosted field will be inserted.
 * @property {string} [placeholder] Will be used as the `placeholder` attribute of the input. If `placeholder` is not natively supported by the browser, it will be polyfilled.
 * @property {string} [type] Will be used as the `type` attribute of the input. To mask `cvv` input, for instance, `type: "password"` can be used.
 * @property {boolean} [formatInput=true] Enable or disable automatic formatting on this field.
 * @property {object|boolean} [select] If truthy, this field becomes a `<select>` dropdown list. This can only be used for `expirationMonth` and `expirationYear` fields. If you do not use a `placeholder` property for the field, the current month/year will be the default selected value.
 * @property {string[]} [select.options] An array of 12 strings, one per month. This can only be used for the `expirationMonth` field. For example, the array can look like `['01 - January', '02 - February', ...]`.
 * @property {number} [maxlength] Will be used as the `maxlength` attribute of the input if it is less than the default. The primary use cases for the `maxlength` option are: limiting the length of the CVV input for CVV-only verifications when the card type is known and limiting the length of the postal code input when cards are coming from a known region. This option applies only to CVV and postal code fields.
 */

/**
 * An object that has {@link module:braintree-web/hosted-fields~field field objects} for each field. Used in {@link module:braintree-web/hosted-fields~create create}.
 * @typedef {object} fieldOptions
 * @property {field} [number] A field for card number.
 * @property {field} [expirationDate] A field for expiration date in `MM/YYYY` format. This should not be used with the `expirationMonth` and `expirationYear` properties.
 * @property {field} [expirationMonth] A field for expiration month in `MM` format. This should be used with the `expirationYear` property.
 * @property {field} [expirationYear] A field for expiration year in `YYYY` format. This should be used with the `expirationMonth` property.
 * @property {field} [cvv] A field for 3 or 4 digit CVV or CID.
 * @property {field} [postalCode] A field for postal or region code.
 */

/**
 * An object that represents CSS that will be applied in each hosted field. This object looks similar to CSS. Typically, these styles involve fonts (such as `font-family` or `color`).
 *
 * These are the CSS properties that Hosted Fields supports. Any other CSS should be specified on your page and outside of any Braintree configuration. Trying to set unsupported properties will fail and put a warning in the console.
 *
 * Supported CSS properties are:
 * `appearance`
 * `color`
 * `direction`
 * `font-family`
 * `font-size-adjust`
 * `font-size`
 * `font-stretch`
 * `font-style`
 * `font-variant-alternates`
 * `font-variant-caps`
 * `font-variant-east-asian`
 * `font-variant-ligatures`
 * `font-variant-numeric`
 * `font-variant`
 * `font-weight`
 * `font`
 * `letter-spacing`
 * `line-height`
 * `opacity`
 * `outline`
 * `text-shadow`
 * `transition`
 * `-moz-appearance`
 * `-moz-osx-font-smoothing`
 * `-moz-tap-highlight-color`
 * `-moz-transition`
 * `-webkit-appearance`
 * `-webkit-font-smoothing`
 * `-webkit-tap-highlight-color`
 * `-webkit-transition`
 * @typedef {object} styleOptions
 */

/**
 * @static
 * @function create
 * @param {object} options Creation options:
 * @param {Client} options.client A {@link Client} instance.
 * @param {fieldOptions} options.fields A {@link module:braintree-web/hosted-fields~fieldOptions set of options for each field}.
 * @param {styleOptions} options.styles {@link module:braintree-web/hosted-fields~styleOptions Styles} applied to each field.
 * @param {callback} [callback] The second argument, `data`, is the {@link HostedFields} instance. If no callback is provided, `create` returns a promise that resolves with the {@link HostedFields} instance.
 * @returns {void}
 * @example
 * braintree.hostedFields.create({
 *   client: clientInstance,
 *   styles: {
 *     'input': {
 *       'font-size': '16pt',
 *       'color': '#3A3A3A'
 *     },
 *     '.number': {
 *       'font-family': 'monospace'
 *     },
 *     '.valid': {
 *       'color': 'green'
 *     }
 *   },
 *   fields: {
 *     number: {
 *       selector: '#card-number'
 *     },
 *     cvv: {
 *       selector: '#cvv',
 *       placeholder: '•••'
 *     },
 *     expirationDate: {
 *       selector: '#expiration-date',
 *       type: 'month'
 *     }
 *   }
 * }, callback);
 * @example <caption>Right to Left Language Support</caption>
 * braintree.hostedFields.create({
 *   client: clientInstance,
 *   styles: {
 *     'input': {
 *       // other styles
 *       direction: 'rtl'
 *     },
 *   },
 *   fields: {
 *     number: {
 *       selector: '#card-number',
 *       // Credit card formatting is not currently supported
 *       // with RTL languages, so we need to turn it off for the number input
 *       formatInput: false
 *     },
 *     cvv: {
 *       selector: '#cvv',
 *       placeholder: '•••'
 *     },
 *     expirationDate: {
 *       selector: '#expiration-date',
 *       type: 'month'
 *     }
 *   }
 * }, callback);
 */
function create(options) {
  var integration;

  return new Promise(function (resolve) {
    integration = new HostedFields(options);

    integration.on('ready', function () {
      resolve(integration);
    });
  });
}

module.exports = {
  /**
   * @static
   * @function supportsInputFormatting
   * @description Returns false if input formatting will be automatically disabled due to browser incompatibility. Otherwise, returns true. For a list of unsupported browsers, [go here](https://github.com/braintree/restricted-input/blob/master/README.md#browsers-where-formatting-is-turned-off-automatically).
   * @returns {Boolean} Returns false if input formatting will be automatically disabled due to browser incompatibility. Otherwise, returns true.
   * @example Conditionally choosing split expiration date inputs if formatting is unavailable
   * var canFormat = braintree.hostedFields.supportsInputFormatting();
   * var fields = {
   *   number: {
   *     selector: '#card-number'
   *   },
   *   cvv: {
   *     selector: '#cvv'
   *   }
   * };
   *
   * if (canFormat) {
   *   fields.expirationDate = {
   *     selection: '#expiration-date'
   *   };
   *   functionToCreateAndInsertExpirationDateDivToForm();
   * } else {
   *   fields.expirationMonth = {
   *     selection: '#expiration-month'
   *   };
   *   fields.expirationYear = {
   *     selection: '#expiration-year'
   *   };
   *   functionToCreateAndInsertExpirationMonthAndYearDivsToForm();
   * }
   *
   * braintree.hostedFields.create({
   *   client: clientInstance,
   *   styles: {
   *     // Styles
   *   },
   *   fields: fields
   * }, callback);
   */
  supportsInputFormatting: supportsInputFormatting,
  create: wrapPromise(create),
  /**
   * @description The current version of the SDK, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};

},{"../lib/promise":44,"./external/hosted-fields":15,"restricted-input/supports-input-formatting":66,"wrap-promise":70}],18:[function(require,module,exports){
'use strict';
/* eslint-disable no-reserved-keys */

var enumerate = require('../../lib/enumerate');
var errors = require('./errors');
var VERSION = "3.16.0";

var constants = {
  VERSION: VERSION,
  maxExpirationYearAge: 19,
  externalEvents: {
    FOCUS: 'focus',
    BLUR: 'blur',
    EMPTY: 'empty',
    NOT_EMPTY: 'notEmpty',
    VALIDITY_CHANGE: 'validityChange',
    CARD_TYPE_CHANGE: 'cardTypeChange'
  },
  defaultMaxLengths: {
    number: 19,
    postalCode: 8,
    expirationDate: 7,
    expirationMonth: 2,
    expirationYear: 4,
    cvv: 3
  },
  externalClasses: {
    FOCUSED: 'braintree-hosted-fields-focused',
    INVALID: 'braintree-hosted-fields-invalid',
    VALID: 'braintree-hosted-fields-valid'
  },
  defaultIFrameStyle: {
    border: 'none',
    width: '100%',
    height: '100%',
    'float': 'left'
  },
  tokenizationErrorCodes: {
    81724: errors.HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE,
    81736: errors.HOSTED_FIELDS_TOKENIZATION_CVV_VERIFICATION_FAILED
  },
  whitelistedStyles: [
    '-moz-appearance',
    '-moz-osx-font-smoothing',
    '-moz-tap-highlight-color',
    '-moz-transition',
    '-webkit-appearance',
    '-webkit-font-smoothing',
    '-webkit-tap-highlight-color',
    '-webkit-transition',
    'appearance',
    'color',
    'direction',
    'font',
    'font-family',
    'font-size',
    'font-size-adjust',
    'font-stretch',
    'font-style',
    'font-variant',
    'font-variant-alternates',
    'font-variant-caps',
    'font-variant-east-asian',
    'font-variant-ligatures',
    'font-variant-numeric',
    'font-weight',
    'letter-spacing',
    'line-height',
    'opacity',
    'outline',
    'text-shadow',
    'transition'
  ],
  whitelistedFields: {
    number: {
      name: 'credit-card-number',
      label: 'Credit Card Number'
    },
    cvv: {
      name: 'cvv',
      label: 'CVV'
    },
    expirationDate: {
      name: 'expiration',
      label: 'Expiration Date'
    },
    expirationMonth: {
      name: 'expiration-month',
      label: 'Expiration Month'
    },
    expirationYear: {
      name: 'expiration-year',
      label: 'Expiration Year'
    },
    postalCode: {
      name: 'postal-code',
      label: 'Postal Code'
    }
  },
  whitelistedAttributes: {
    'aria-invalid': 'boolean',
    'aria-required': 'boolean',
    disabled: 'boolean',
    placeholder: 'string'
  }
};

constants.events = enumerate([
  'FRAME_READY',
  'VALIDATE_STRICT',
  'CONFIGURATION',
  'TOKENIZATION_REQUEST',
  'INPUT_EVENT',
  'TRIGGER_INPUT_FOCUS',
  'ADD_CLASS',
  'REMOVE_CLASS',
  'SET_ATTRIBUTE',
  'REMOVE_ATTRIBUTE',
  'CLEAR_FIELD'
], 'hosted-fields:');

module.exports = constants;

},{"../../lib/enumerate":36,"./errors":19}],19:[function(require,module,exports){
'use strict';

var BraintreeError = require('../../lib/braintree-error');

module.exports = {
  HOSTED_FIELDS_INVALID_FIELD_KEY: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_INVALID_FIELD_KEY'
  },
  HOSTED_FIELDS_INVALID_FIELD_SELECTOR: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_INVALID_FIELD_SELECTOR',
    message: 'Selector does not reference a valid DOM node.'
  },
  HOSTED_FIELDS_FIELD_DUPLICATE_IFRAME: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_FIELD_DUPLICATE_IFRAME',
    message: 'Element already contains a Braintree iframe.'
  },
  HOSTED_FIELDS_FIELD_INVALID: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_FIELD_INVALID'
  },
  HOSTED_FIELDS_FIELD_NOT_PRESENT: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_FIELD_NOT_PRESENT'
  },
  HOSTED_FIELDS_TOKENIZATION_NETWORK_ERROR: {
    type: BraintreeError.types.NETWORK,
    code: 'HOSTED_FIELDS_TOKENIZATION_NETWORK_ERROR',
    message: 'A tokenization network error occurred.'
  },
  HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE: {
    type: BraintreeError.types.CUSTOMER,
    code: 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE',
    message: 'This credit card already exists in the merchant\'s vault.'
  },
  HOSTED_FIELDS_TOKENIZATION_CVV_VERIFICATION_FAILED: {
    type: BraintreeError.types.CUSTOMER,
    code: 'HOSTED_FIELDS_TOKENIZATION_CVV_VERIFICATION_FAILED',
    message: 'CVV verification failed during tokenization.'
  },
  HOSTED_FIELDS_FAILED_TOKENIZATION: {
    type: BraintreeError.types.CUSTOMER,
    code: 'HOSTED_FIELDS_FAILED_TOKENIZATION',
    message: 'The supplied card data failed tokenization.'
  },
  HOSTED_FIELDS_FIELDS_EMPTY: {
    type: BraintreeError.types.CUSTOMER,
    code: 'HOSTED_FIELDS_FIELDS_EMPTY',
    message: 'All fields are empty. Cannot tokenize empty card fields.'
  },
  HOSTED_FIELDS_FIELDS_INVALID: {
    type: BraintreeError.types.CUSTOMER,
    code: 'HOSTED_FIELDS_FIELDS_INVALID',
    message: 'Some payment input fields are invalid. Cannot tokenize invalid card fields.'
  },
  HOSTED_FIELDS_ATTRIBUTE_NOT_SUPPORTED: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_ATTRIBUTE_NOT_SUPPORTED'
  },
  HOSTED_FIELDS_ATTRIBUTE_VALUE_NOT_ALLOWED: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_ATTRIBUTE_VALUE_NOT_ALLOWED'
  },
  HOSTED_FIELDS_FIELD_PROPERTY_INVALID: {
    type: BraintreeError.types.MERCHANT,
    code: 'HOSTED_FIELDS_FIELD_PROPERTY_INVALID'
  }
};

},{"../../lib/braintree-error":25}],20:[function(require,module,exports){
'use strict';

function findParentTags(element, tag) {
  var parent = element.parentNode;
  var parents = [];

  while (parent != null) {
    if (parent.tagName != null && parent.tagName.toLowerCase() === tag) {
      parents.push(parent);
    }

    parent = parent.parentNode;
  }

  return parents;
}

module.exports = findParentTags;

},{}],21:[function(require,module,exports){
'use strict';

var createAuthorizationData = require('./create-authorization-data');
var jsonClone = require('./json-clone');
var constants = require('./constants');

function addMetadata(configuration, data) {
  var key;
  var attrs = data ? jsonClone(data) : {};
  var authAttrs = createAuthorizationData(configuration.authorization).attrs;
  var _meta = jsonClone(configuration.analyticsMetadata);

  attrs.braintreeLibraryVersion = constants.BRAINTREE_LIBRARY_VERSION;

  for (key in attrs._meta) {
    if (attrs._meta.hasOwnProperty(key)) {
      _meta[key] = attrs._meta[key];
    }
  }

  attrs._meta = _meta;

  if (authAttrs.tokenizationKey) {
    attrs.tokenizationKey = authAttrs.tokenizationKey;
  } else {
    attrs.authorizationFingerprint = authAttrs.authorizationFingerprint;
  }

  return attrs;
}

module.exports = addMetadata;

},{"./constants":30,"./create-authorization-data":33,"./json-clone":40}],22:[function(require,module,exports){
'use strict';

var constants = require('./constants');
var addMetadata = require('./add-metadata');

function _millisToSeconds(millis) {
  return Math.floor(millis / 1000);
}

function sendAnalyticsEvent(client, kind, callback) {
  var configuration = client.getConfiguration();
  var request = client._request;
  var timestamp = _millisToSeconds(Date.now());
  var url = configuration.gatewayConfiguration.analytics.url;
  var data = {
    analytics: [{
      kind: constants.ANALYTICS_PREFIX + kind,
      timestamp: timestamp
    }]
  };

  request({
    url: url,
    method: 'post',
    data: addMetadata(configuration, data),
    timeout: constants.ANALYTICS_REQUEST_TIMEOUT_MS
  }, callback);
}

module.exports = {
  sendEvent: sendAnalyticsEvent
};

},{"./add-metadata":21,"./constants":30}],23:[function(require,module,exports){
'use strict';

var assignNormalized = typeof Object.assign === 'function' ? Object.assign : assignPolyfill;

function assignPolyfill(destination) {
  var i, source, key;

  for (i = 1; i < arguments.length; i++) {
    source = arguments[i];
    for (key in source) {
      if (source.hasOwnProperty(key)) {
        destination[key] = source[key];
      }
    }
  }

  return destination;
}

module.exports = {
  assign: assignNormalized,
  _assign: assignPolyfill
};

},{}],24:[function(require,module,exports){
'use strict';

var once = require('./once');

function call(fn, callback) {
  var isSync = fn.length === 0;

  if (isSync) {
    fn();
    callback(null);
  } else {
    fn(callback);
  }
}

module.exports = function (functions, cb) {
  var i;
  var length = functions.length;
  var remaining = length;
  var callback = once(cb);

  if (length === 0) {
    callback(null);
    return;
  }

  function finish(err) {
    if (err) {
      callback(err);
      return;
    }

    remaining -= 1;
    if (remaining === 0) {
      callback(null);
    }
  }

  for (i = 0; i < length; i++) {
    call(functions[i], finish);
  }
};

},{"./once":42}],25:[function(require,module,exports){
'use strict';

var enumerate = require('./enumerate');

/**
 * @class
 * @global
 * @param {object} options Construction options
 * @classdesc This class is used to report error conditions, frequently as the first parameter to callbacks throughout the Braintree SDK.
 * @description <strong>You cannot use this constructor directly. Interact with instances of this class through {@link callback callbacks}.</strong>
 */
function BraintreeError(options) {
  if (!BraintreeError.types.hasOwnProperty(options.type)) {
    throw new Error(options.type + ' is not a valid type.');
  }

  if (!options.code) {
    throw new Error('Error code required.');
  }

  if (!options.message) {
    throw new Error('Error message required.');
  }

  this.name = 'BraintreeError';

  /**
   * @type {string}
   * @description A code that corresponds to specific errors.
   */
  this.code = options.code;

  /**
   * @type {string}
   * @description A short description of the error.
   */
  this.message = options.message;

  /**
   * @type {BraintreeError.types}
   * @description The type of error.
   */
  this.type = options.type;

  /**
   * @type {object=}
   * @description Additional information about the error, such as an underlying network error response.
   */
  this.details = options.details;
}

BraintreeError.prototype = Object.create(Error.prototype);
BraintreeError.prototype.constructor = BraintreeError;

/**
 * Enum for {@link BraintreeError} types.
 * @name BraintreeError.types
 * @enum
 * @readonly
 * @memberof BraintreeError
 * @property {string} CUSTOMER An error caused by the customer.
 * @property {string} MERCHANT An error that is actionable by the merchant.
 * @property {string} NETWORK An error due to a network problem.
 * @property {string} INTERNAL An error caused by Braintree code.
 * @property {string} UNKNOWN An error where the origin is unknown.
 */
BraintreeError.types = enumerate([
  'CUSTOMER',
  'MERCHANT',
  'NETWORK',
  'INTERNAL',
  'UNKNOWN'
]);

BraintreeError.findRootError = function (err) {
  if (err instanceof BraintreeError && err.details && err.details.originalError) {
    return BraintreeError.findRootError(err.details.originalError);
  }

  return err;
};

module.exports = BraintreeError;

},{"./enumerate":36}],26:[function(require,module,exports){
'use strict';

var isWhitelistedDomain = require('../is-whitelisted-domain');

function checkOrigin(postMessageOrigin, merchantUrl) {
  var merchantOrigin, merchantHost;
  var a = document.createElement('a');

  a.href = merchantUrl;

  if (a.protocol === 'https:') {
    merchantHost = a.host.replace(/:443$/, '');
  } else if (a.protocol === 'http:') {
    merchantHost = a.host.replace(/:80$/, '');
  } else {
    merchantHost = a.host;
  }

  merchantOrigin = a.protocol + '//' + merchantHost;

  if (merchantOrigin === postMessageOrigin) { return true; }

  a.href = postMessageOrigin;

  return isWhitelistedDomain(postMessageOrigin);
}

module.exports = {
  checkOrigin: checkOrigin
};

},{"../is-whitelisted-domain":39}],27:[function(require,module,exports){
'use strict';

var enumerate = require('../enumerate');

module.exports = enumerate([
  'CONFIGURATION_REQUEST'
], 'bus:');

},{"../enumerate":36}],28:[function(require,module,exports){
'use strict';

var bus = require('framebus');
var events = require('./events');
var checkOrigin = require('./check-origin').checkOrigin;
var BraintreeError = require('../braintree-error');

function BraintreeBus(options) {
  options = options || {};

  this.channel = options.channel;
  if (!this.channel) {
    throw new BraintreeError({
      type: BraintreeError.types.INTERNAL,
      code: 'MISSING_CHANNEL_ID',
      message: 'Channel ID must be specified.'
    });
  }

  this.merchantUrl = options.merchantUrl;

  this._isDestroyed = false;
  this._isVerbose = false;

  this._listeners = [];

  this._log('new bus on channel ' + this.channel, [location.href]);
}

BraintreeBus.prototype.on = function (eventName, originalHandler) {
  var namespacedEvent, args;
  var handler = originalHandler;
  var self = this;

  if (this._isDestroyed) { return; }

  if (this.merchantUrl) {
    handler = function () {
      /* eslint-disable no-invalid-this */
      if (checkOrigin(this.origin, self.merchantUrl)) {
        originalHandler.apply(this, arguments);
      }
      /* eslint-enable no-invalid-this */
    };
  }

  namespacedEvent = this._namespaceEvent(eventName);
  args = Array.prototype.slice.call(arguments);
  args[0] = namespacedEvent;
  args[1] = handler;

  this._log('on', args);
  bus.on.apply(bus, args);

  this._listeners.push({
    eventName: eventName,
    handler: handler,
    originalHandler: originalHandler
  });
};

BraintreeBus.prototype.emit = function (eventName) {
  var args;

  if (this._isDestroyed) { return; }

  args = Array.prototype.slice.call(arguments);
  args[0] = this._namespaceEvent(eventName);

  this._log('emit', args);
  bus.emit.apply(bus, args);
};

BraintreeBus.prototype._offDirect = function (eventName) {
  var args = Array.prototype.slice.call(arguments);

  if (this._isDestroyed) { return; }

  args[0] = this._namespaceEvent(eventName);

  this._log('off', args);
  bus.off.apply(bus, args);
};

BraintreeBus.prototype.off = function (eventName, originalHandler) {
  var i, listener;
  var handler = originalHandler;

  if (this._isDestroyed) { return; }

  if (this.merchantUrl) {
    for (i = 0; i < this._listeners.length; i++) {
      listener = this._listeners[i];

      if (listener.originalHandler === originalHandler) {
        handler = listener.handler;
      }
    }
  }

  this._offDirect(eventName, handler);
};

BraintreeBus.prototype._namespaceEvent = function (eventName) {
  return ['braintree', this.channel, eventName].join(':');
};

BraintreeBus.prototype.teardown = function () {
  var listener, i;

  for (i = 0; i < this._listeners.length; i++) {
    listener = this._listeners[i];
    this._offDirect(listener.eventName, listener.handler);
  }

  this._listeners.length = 0;

  this._isDestroyed = true;
};

BraintreeBus.prototype._log = function (functionName, args) {
  if (this._isVerbose) {
    console.log(functionName, args); // eslint-disable-line no-console
  }
};

BraintreeBus.events = events;

module.exports = BraintreeBus;

},{"../braintree-error":25,"./check-origin":26,"./events":27,"framebus":55}],29:[function(require,module,exports){
'use strict';

function _classesOf(element) {
  return element.className.trim().split(/\s+/);
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
  if (adding) {
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

},{}],30:[function(require,module,exports){
'use strict';

var VERSION = "3.16.0";
var PLATFORM = 'web';

module.exports = {
  ANALYTICS_PREFIX: 'web.',
  ANALYTICS_REQUEST_TIMEOUT_MS: 2000,
  INTEGRATION_TIMEOUT_MS: 60000,
  VERSION: VERSION,
  INTEGRATION: 'custom',
  SOURCE: 'client',
  PLATFORM: PLATFORM,
  BRAINTREE_LIBRARY_VERSION: 'braintree/' + PLATFORM + '/' + VERSION
};

},{}],31:[function(require,module,exports){
'use strict';

var BraintreeError = require('./braintree-error');
var sharedErrors = require('./errors');

module.exports = function (instance, methodNames) {
  methodNames.forEach(function (methodName) {
    instance[methodName] = function () {
      throw new BraintreeError({
        type: sharedErrors.METHOD_CALLED_AFTER_TEARDOWN.type,
        code: sharedErrors.METHOD_CALLED_AFTER_TEARDOWN.code,
        message: methodName + ' cannot be called after teardown.'
      });
    };
  });
};

},{"./braintree-error":25,"./errors":37}],32:[function(require,module,exports){
'use strict';

var BraintreeError = require('./braintree-error');

function convertToBraintreeError(originalErr, btErrorObject) {
  if (originalErr instanceof BraintreeError) {
    return originalErr;
  }

  return new BraintreeError({
    type: btErrorObject.type,
    code: btErrorObject.code,
    message: btErrorObject.message,
    details: {
      originalError: originalErr
    }
  });
}

module.exports = convertToBraintreeError;

},{"./braintree-error":25}],33:[function(require,module,exports){
'use strict';

var atob = require('../lib/polyfill').atob;

var apiUrls = {
  production: 'https://api.braintreegateway.com:443',
  sandbox: 'https://api.sandbox.braintreegateway.com:443'
};

function _isTokenizationKey(str) {
  return /^[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9_]+$/.test(str);
}

function _parseTokenizationKey(tokenizationKey) {
  var tokens = tokenizationKey.split('_');
  var environment = tokens[0];
  var merchantId = tokens.slice(2).join('_');

  return {
    merchantId: merchantId,
    environment: environment
  };
}

function createAuthorizationData(authorization) {
  var parsedClientToken, parsedTokenizationKey;
  var data = {
    attrs: {},
    configUrl: ''
  };

  if (_isTokenizationKey(authorization)) {
    parsedTokenizationKey = _parseTokenizationKey(authorization);
    data.attrs.tokenizationKey = authorization;
    data.configUrl = apiUrls[parsedTokenizationKey.environment] + '/merchants/' + parsedTokenizationKey.merchantId + '/client_api/v1/configuration';
  } else {
    parsedClientToken = JSON.parse(atob(authorization));
    data.attrs.authorizationFingerprint = parsedClientToken.authorizationFingerprint;
    data.configUrl = parsedClientToken.configUrl;
  }

  return data;
}

module.exports = createAuthorizationData;

},{"../lib/polyfill":43}],34:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
  return function () {
    // IE9 doesn't support passing arguments to setTimeout so we have to emulate it.
    var args = arguments;

    setTimeout(function () {
      fn.apply(null, args);
    }, 1);
  };
};

},{}],35:[function(require,module,exports){
'use strict';

var batchExecuteFunctions = require('./batch-execute-functions');

function Destructor() {
  this._teardownRegistry = [];

  this._isTearingDown = false;
}

Destructor.prototype.registerFunctionForTeardown = function (fn) {
  if (typeof fn === 'function') {
    this._teardownRegistry.push(fn);
  }
};

Destructor.prototype.teardown = function (callback) {
  if (this._isTearingDown) {
    callback(new Error('Destructor is already tearing down'));
    return;
  }

  this._isTearingDown = true;

  batchExecuteFunctions(this._teardownRegistry, function (err) {
    this._teardownRegistry = [];
    this._isTearingDown = false;

    if (typeof callback === 'function') {
      callback(err);
    }
  }.bind(this));
};

module.exports = Destructor;

},{"./batch-execute-functions":24}],36:[function(require,module,exports){
'use strict';

function enumerate(values, prefix) {
  prefix = prefix == null ? '' : prefix;

  return values.reduce(function (enumeration, value) {
    enumeration[value] = prefix + value;
    return enumeration;
  }, {});
}

module.exports = enumerate;

},{}],37:[function(require,module,exports){
'use strict';

var BraintreeError = require('./braintree-error');

module.exports = {
  CALLBACK_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'CALLBACK_REQUIRED'
  },
  INSTANTIATION_OPTION_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'INSTANTIATION_OPTION_REQUIRED'
  },
  INVALID_OPTION: {
    type: BraintreeError.types.MERCHANT,
    code: 'INVALID_OPTION'
  },
  INCOMPATIBLE_VERSIONS: {
    type: BraintreeError.types.MERCHANT,
    code: 'INCOMPATIBLE_VERSIONS'
  },
  METHOD_CALLED_AFTER_TEARDOWN: {
    type: BraintreeError.types.MERCHANT,
    code: 'METHOD_CALLED_AFTER_TEARDOWN'
  },
  BRAINTREE_API_ACCESS_RESTRICTED: {
    type: BraintreeError.types.MERCHANT,
    code: 'BRAINTREE_API_ACCESS_RESTRICTED',
    message: 'Your access is restricted and cannot use this part of the Braintree API.'
  }
};

},{"./braintree-error":25}],38:[function(require,module,exports){
'use strict';

function EventEmitter() {
  this._events = {};
}

EventEmitter.prototype.on = function (event, callback) {
  if (this._events[event]) {
    this._events[event].push(callback);
  } else {
    this._events[event] = [callback];
  }
};

EventEmitter.prototype._emit = function (event) {
  var i, args;
  var callbacks = this._events[event];

  if (!callbacks) { return; }

  args = Array.prototype.slice.call(arguments, 1);

  for (i = 0; i < callbacks.length; i++) {
    callbacks[i].apply(null, args);
  }
};

module.exports = EventEmitter;

},{}],39:[function(require,module,exports){
'use strict';

var parser;
var legalHosts = {
  'paypal.com': 1,
  'braintreepayments.com': 1,
  'braintreegateway.com': 1,
  'braintree-api.com': 1
};

function stripSubdomains(domain) {
  return domain.split('.').slice(-2).join('.');
}

function isWhitelistedDomain(url) {
  var mainDomain;

  url = url.toLowerCase();

  if (!/^https:/.test(url)) {
    return false;
  }

  parser = parser || document.createElement('a');
  parser.href = url;
  mainDomain = stripSubdomains(parser.hostname);

  return legalHosts.hasOwnProperty(mainDomain);
}

module.exports = isWhitelistedDomain;

},{}],40:[function(require,module,exports){
'use strict';

module.exports = function (value) {
  return JSON.parse(JSON.stringify(value));
};

},{}],41:[function(require,module,exports){
'use strict';

module.exports = function (obj) {
  return Object.keys(obj).filter(function (key) {
    return typeof obj[key] === 'function';
  });
};

},{}],42:[function(require,module,exports){
'use strict';

function once(fn) {
  var called = false;

  return function () {
    if (!called) {
      called = true;
      fn.apply(null, arguments);
    }
  };
}

module.exports = once;

},{}],43:[function(require,module,exports){
(function (global){
'use strict';

var atobNormalized = typeof global.atob === 'function' ? global.atob : atob;

function atob(base64String) {
  var a, b, c, b1, b2, b3, b4, i;
  var base64Matcher = new RegExp('^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})([=]{1,2})?$');
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var result = '';

  if (!base64Matcher.test(base64String)) {
    throw new Error('Non base64 encoded input passed to window.atob polyfill');
  }

  i = 0;
  do {
    b1 = characters.indexOf(base64String.charAt(i++));
    b2 = characters.indexOf(base64String.charAt(i++));
    b3 = characters.indexOf(base64String.charAt(i++));
    b4 = characters.indexOf(base64String.charAt(i++));

    a = (b1 & 0x3F) << 2 | b2 >> 4 & 0x3;
    b = (b2 & 0xF) << 4 | b3 >> 2 & 0xF;
    c = (b3 & 0x3) << 6 | b4 & 0x3F;

    result += String.fromCharCode(a) + (b ? String.fromCharCode(b) : '') + (c ? String.fromCharCode(c) : '');
  } while (i < base64String.length);

  return result;
}

module.exports = {
  atob: function (base64String) {
    return atobNormalized.call(global, base64String);
  },
  _atob: atob
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],44:[function(require,module,exports){
(function (global){
'use strict';

var Promise = global.Promise || require('promise-polyfill');

module.exports = Promise;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"promise-polyfill":60}],45:[function(require,module,exports){
(function (global){
'use strict';

function _notEmpty(obj) {
  var key;

  for (key in obj) {
    if (obj.hasOwnProperty(key)) { return true; }
  }

  return false;
}

function _isArray(value) {
  return value && typeof value === 'object' && typeof value.length === 'number' &&
    Object.prototype.toString.call(value) === '[object Array]' || false;
}

function parse(url) {
  var query, params;

  url = url || global.location.href;

  if (!/\?/.test(url)) {
    return {};
  }

  query = url.replace(/#.*$/, '').replace(/^.*\?/, '').split('&');

  params = query.reduce(function (toReturn, keyValue) {
    var parts = keyValue.split('=');
    var key = decodeURIComponent(parts[0]);
    var value = decodeURIComponent(parts[1]);

    toReturn[key] = value;
    return toReturn;
  }, {});

  return params;
}

function stringify(params, namespace) {
  var k, v, p;
  var query = [];

  for (p in params) {
    if (!params.hasOwnProperty(p)) {
      continue;
    }

    v = params[p];

    if (namespace) {
      if (_isArray(params)) {
        k = namespace + '[]';
      } else {
        k = namespace + '[' + p + ']';
      }
    } else {
      k = p;
    }
    if (typeof v === 'object') {
      query.push(stringify(v, k));
    } else {
      query.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    }
  }

  return query.join('&');
}

function queryify(url, params) {
  url = url || '';

  if (params != null && typeof params === 'object' && _notEmpty(params)) {
    url += url.indexOf('?') === -1 ? '?' : '';
    url += url.indexOf('=') !== -1 ? '&' : '';
    url += stringify(params);
  }

  return url;
}

module.exports = {
  parse: parse,
  stringify: stringify,
  queryify: queryify
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],46:[function(require,module,exports){
'use strict';

function useMin(isDebug) {
  return isDebug ? '' : '.min';
}

module.exports = useMin;

},{}],47:[function(require,module,exports){
'use strict';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : r & 0x3 | 0x8;

    return v.toString(16);
  });
}

module.exports = uuid;

},{}],48:[function(require,module,exports){
'use strict';

var BraintreeError = require('../lib/braintree-error');

module.exports = {
  PAYPAL_NOT_ENABLED: {
    type: BraintreeError.types.MERCHANT,
    code: 'PAYPAL_NOT_ENABLED',
    message: 'PayPal is not enabled for this merchant.'
  },
  PAYPAL_SANDBOX_ACCOUNT_NOT_LINKED: {
    type: BraintreeError.types.MERCHANT,
    code: 'PAYPAL_SANDBOX_ACCOUNT_NOT_LINKED',
    message: 'A linked PayPal Sandbox account is required to use PayPal Checkout in Sandbox. See https://developers.braintreepayments.com/guides/paypal/testing-go-live/#linked-paypal-testing for details on linking your PayPal sandbox with Braintree.'
  },
  PAYPAL_TOKENIZATION_REQUEST_ACTIVE: {
    type: BraintreeError.types.MERCHANT,
    code: 'PAYPAL_TOKENIZATION_REQUEST_ACTIVE',
    message: 'Another tokenization request is active.'
  },
  PAYPAL_ACCOUNT_TOKENIZATION_FAILED: {
    type: BraintreeError.types.NETWORK,
    code: 'PAYPAL_ACCOUNT_TOKENIZATION_FAILED',
    message: 'Could not tokenize user\'s PayPal account.'
  },
  PAYPAL_FLOW_FAILED: {
    type: BraintreeError.types.NETWORK,
    code: 'PAYPAL_FLOW_FAILED',
    message: 'Could not initialize PayPal flow.'
  },
  PAYPAL_FLOW_OPTION_REQUIRED: {
    type: BraintreeError.types.MERCHANT,
    code: 'PAYPAL_FLOW_OPTION_REQUIRED',
    message: 'PayPal flow property is invalid or missing.'
  },
  PAYPAL_POPUP_OPEN_FAILED: {
    type: BraintreeError.types.MERCHANT,
    code: 'PAYPAL_POPUP_OPEN_FAILED',
    message: 'PayPal popup failed to open, make sure to tokenize in response to a user action.'
  },
  PAYPAL_POPUP_CLOSED: {
    type: BraintreeError.types.CUSTOMER,
    code: 'PAYPAL_POPUP_CLOSED',
    message: 'Customer closed PayPal popup before authorizing.'
  },
  PAYPAL_INVALID_PAYMENT_OPTION: {
    type: BraintreeError.types.MERCHANT,
    code: 'PAYPAL_INVALID_PAYMENT_OPTION',
    message: 'PayPal payment options are invalid.'
  }
};

},{"../lib/braintree-error":25}],49:[function(require,module,exports){
'use strict';
/**
 * @module braintree-web/paypal-checkout
 * @description A component to integrate with the [PayPal Checkout.js library](https://github.com/paypal/paypal-checkout).
 */

var BraintreeError = require('../lib/braintree-error');
var analytics = require('../lib/analytics');
var errors = require('./errors');
var Promise = require('../lib/promise');
var wrapPromise = require('wrap-promise');
var PayPalCheckout = require('./paypal-checkout');
var sharedErrors = require('../lib/errors');
var VERSION = "3.16.0";

/**
 * @static
 * @function create
 * @param {object} options Creation options:
 * @param {Client} options.client A {@link Client} instance.
 * @param {callback} [callback] The second argument, `data`, is the {@link PayPalCheckout} instance.
 * @example
 * // Be sure to have checkout.js loaded on your page.
 * // You can use the paypal-checkout package on npm
 * // with a build tool or use a script hosted by PayPal:
 * // <script src="https://www.paypalobjects.com/api/checkout.js" data-version-4 log-level="warn"></script>
 *
 * braintree.paypalCheckout.create({
 *   client: clientInstance
 * }, function (createErr, paypalCheckoutInstance) {
 *   if (createErr) {
 *     console.error('Error!', createErr);
 *     return;
 *   }
 *
 *   paypal.Button.render({
 *     env: 'production', // or 'sandbox'
 *
 *     locale: 'en_US',
 *
 *     payment: function () {
 *       return paypalCheckoutInstance.createPayment({
 *         flow: 'vault'
 *       });
 *     },
 *
 *     onAuthorize: function (data, actions) {
 *       return paypalCheckoutInstance.tokenizePayment(data).then(function (payload) {
 *         // Submit payload.nonce to your server
 *       });
 *     },
 *
 *     onCancel: function (data) {
 *       console.log('checkout.js payment cancelled', JSON.stringify(data, 0, 2));
 *     },
 *
 *     onError: function (err) {
 *       console.error('checkout.js error', err);
 *     }
 *   }, '#paypal-button'); // the PayPal button will be rendered in an html element with the id `paypal-button`
 * });
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
function create(options) {
  var config, clientVersion;

  if (options.client == null) {
    return Promise.reject(new BraintreeError({
      type: sharedErrors.INSTANTIATION_OPTION_REQUIRED.type,
      code: sharedErrors.INSTANTIATION_OPTION_REQUIRED.code,
      message: 'options.client is required when instantiating PayPal Checkout.'
    }));
  }

  config = options.client.getConfiguration();
  clientVersion = options.client.getVersion();

  if (clientVersion !== VERSION) {
    return Promise.reject(new BraintreeError({
      type: sharedErrors.INCOMPATIBLE_VERSIONS.type,
      code: sharedErrors.INCOMPATIBLE_VERSIONS.code,
      message: 'Client (version ' + clientVersion + ') and PayPal Checkout (version ' + VERSION + ') components must be from the same SDK version.'
    }));
  }

  if (!config.gatewayConfiguration.paypalEnabled) {
    return Promise.reject(new BraintreeError(errors.PAYPAL_NOT_ENABLED));
  }

  if (!config.gatewayConfiguration.paypal.clientId) {
    return Promise.reject(new BraintreeError(errors.PAYPAL_SANDBOX_ACCOUNT_NOT_LINKED));
  }

  analytics.sendEvent(options.client, 'paypal-checkout.initialized');

  return Promise.resolve(new PayPalCheckout(options));
}

/**
 * @static
 * @function isSupported
 * @description Returns true if PayPal Checkout [supports this browser](/current/#browser-support-webviews).
 * @deprecated Previously, this method checked for Popup support in the brower. Checkout.js now falls back to a modal if popups are not supported.
 * @example
 * if (braintree.paypalCheckout.isSupported()) {
 *   // Add PayPal button to the page
 * } else {
 *   // Hide PayPal payment option
 * }
 * @returns {Boolean} Returns true if PayPal Checkout supports this browser.
 */
function isSupported() {
  return true;
}

module.exports = {
  create: wrapPromise(create),
  isSupported: isSupported,
  /**
   * @description The current version of the SDK, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};

},{"../lib/analytics":22,"../lib/braintree-error":25,"../lib/errors":37,"../lib/promise":44,"./errors":48,"./paypal-checkout":50,"wrap-promise":70}],50:[function(require,module,exports){
'use strict';

var analytics = require('../lib/analytics');
var Promise = require('../lib/promise');
var wrapPromise = require('wrap-promise');
var BraintreeError = require('../lib/braintree-error');
var convertToBraintreeError = require('../lib/convert-to-braintree-error');
var errors = require('./errors');
var constants = require('../paypal/shared/constants');

/**
 * PayPal Checkout tokenized payload. Returned in {@link PayPalCheckout#tokenizePayment}'s callback as the second argument, `data`.
 * @typedef {object} PayPalCheckout~tokenizePayload
 * @property {string} nonce The payment method nonce.
 * @property {string} type The payment method type, always `PayPalAccount`.
 * @property {object} details Additional PayPal account details.
 * @property {string} details.email User's email address.
 * @property {string} details.payerId User's payer ID, the unique identifier for each PayPal account.
 * @property {string} details.firstName User's given name.
 * @property {string} details.lastName User's surname.
 * @property {?string} details.countryCode User's 2 character country code.
 * @property {?string} details.phone User's phone number (e.g. 555-867-5309).
 * @property {?object} details.shippingAddress User's shipping address details, only available if shipping address is enabled.
 * @property {string} details.shippingAddress.recipientName Recipient of postage.
 * @property {string} details.shippingAddress.line1 Street number and name.
 * @property {string} details.shippingAddress.line2 Extended address.
 * @property {string} details.shippingAddress.city City or locality.
 * @property {string} details.shippingAddress.state State or region.
 * @property {string} details.shippingAddress.postalCode Postal code.
 * @property {string} details.shippingAddress.countryCode 2 character country code (e.g. US).
 * @property {?object} details.billingAddress User's billing address details.
 * Not available to all merchants; [contact PayPal](https://developers.braintreepayments.com/support/guides/paypal/setup-guide#contacting-paypal-support) for details on eligibility and enabling this feature.
 * Alternatively, see `shippingAddress` above as an available client option.
 * @property {string} details.billingAddress.line1 Street number and name.
 * @property {string} details.billingAddress.line2 Extended address.
 * @property {string} details.billingAddress.city City or locality.
 * @property {string} details.billingAddress.state State or region.
 * @property {string} details.billingAddress.postalCode Postal code.
 * @property {string} details.billingAddress.countryCode 2 character country code (e.g. US).
 * @property {?object} creditFinancingOffered This property will only be present when the customer pays with PayPal Credit.
 * @property {object} creditFinancingOffered.totalCost This is the estimated total payment amount including interest and fees the user will pay during the lifetime of the loan.
 * @property {string} creditFinancingOffered.totalCost.value An amount defined by [ISO 4217](http://www.iso.org/iso/home/standards/currency_codes.htm) for the given currency.
 * @property {string} creditFinancingOffered.totalCost.currency 3 letter currency code as defined by [ISO 4217](http://www.iso.org/iso/home/standards/currency_codes.htm).
 * @property {number} creditFinancingOffered.term Length of financing terms in months.
 * @property {object} creditFinancingOffered.monthlyPayment This is the estimated amount per month that the customer will need to pay including fees and interest.
 * @property {string} creditFinancingOffered.monthlyPayment.value An amount defined by [ISO 4217](http://www.iso.org/iso/home/standards/currency_codes.htm) for the given currency.
 * @property {string} creditFinancingOffered.monthlyPayment.currency 3 letter currency code as defined by [ISO 4217](http://www.iso.org/iso/home/standards/currency_codes.htm).
 * @property {object} creditFinancingOffered.totalInterest Estimated interest or fees amount the payer will have to pay during the lifetime of the loan.
 * @property {string} creditFinancingOffered.totalInterest.value An amount defined by [ISO 4217](http://www.iso.org/iso/home/standards/currency_codes.htm) for the given currency.
 * @property {string} creditFinancingOffered.totalInterest.currency 3 letter currency code as defined by [ISO 4217](http://www.iso.org/iso/home/standards/currency_codes.htm).
 * @property {boolean} creditFinancingOffered.payerAcceptance Status of whether the customer ultimately was approved for and chose to make the payment using the approved installment credit.
 * @property {boolean} creditFinancingOffered.cartAmountImmutable Indicates whether the cart amount is editable after payer's acceptance on PayPal side.
 */

/**
 * @class
 * @param {object} options see {@link module:braintree-web/paypal-checkout.create|paypal-checkout.create}
 * @classdesc This class represents a PayPal Checkout component that coordinates with the {@link https://developer.paypal.com/docs/integration/direct/express-checkout/integration-jsv4|PayPal checkout.js} library. Instances of this class can generate payment data and tokenize authorized payments.
 *
 * All UI (such as preventing actions on the parent page while authentication is in progress) is managed by {@link https://developer.paypal.com/docs/integration/direct/express-checkout/integration-jsv4|checkout.js}.
 * @description <strong>Do not use this constructor directly. Use {@link module:braintree-web/paypal-checkout.create|braintree-web.paypal-checkout.create} instead.</strong>
 */
function PayPalCheckout(options) {
  this._client = options.client;
}

/**
 * Creates a PayPal payment ID or billing token using the given options. This is meant to be passed to PayPal's checkout.js library.
 * When a {@link callback} is defined, the function returns undefined and invokes the callback with the id to be used with the checkout.js library. Otherwise, it returns a Promise that resolves with the id.
 * @public
 * @param {object} options All options for the PayPalCheckout component.
 * @param {string} options.flow Set to 'checkout' for one-time payment flow, or 'vault' for Vault flow. If 'vault' is used with a client token generated with a customer ID, the PayPal account will be added to that customer as a saved payment method.
 * @param {string} [options.intent=authorize]
 * Checkout flows only.
 * * `authorize` - Submits the transaction for authorization but not settlement.
 * * `sale` - Payment will be immediately submitted for settlement upon creating a transaction.
 * @param {boolean} [options.offerCredit=false] Offers the customer PayPal Credit if they qualify.
 * @param {string|number} [options.amount] The amount of the transaction. Required when using the Checkout flow.
 * @param {string} [options.currency] The currency code of the amount, such as 'USD'. Required when using the Checkout flow.
 * @param {string} [options.displayName] The merchant name displayed inside of the PayPal lightbox; defaults to the company name on your Braintree account
 * @param {string} [options.locale=en_US] Use this option to change the language, links, and terminology used in the PayPal flow. This locale will be used unless the buyer has set a preferred locale for their account. If an unsupported locale is supplied, a fallback locale (determined by buyer preference or browser data) will be used and no error will be thrown.
 *
 * Supported locales are:
 * `da_DK`,
 * `de_DE`,
 * `en_AU`,
 * `en_GB`,
 * `en_US`,
 * `es_ES`,
 * `fr_CA`,
 * `fr_FR`,
 * `id_ID`,
 * `it_IT`,
 * `ja_JP`,
 * `ko_KR`,
 * `nl_NL`,
 * `no_NO`,
 * `pl_PL`,
 * `pt_BR`,
 * `pt_PT`,
 * `ru_RU`,
 * `sv_SE`,
 * `th_TH`,
 * `zh_CN`,
 * `zh_HK`,
 * and `zh_TW`.
 *
 * @param {boolean} [options.enableShippingAddress=false] Returns a shipping address object in {@link PayPal#tokenize}.
 * @param {object} [options.shippingAddressOverride] Allows you to pass a shipping address you have already collected into the PayPal payment flow.
 * @param {string} options.shippingAddressOverride.line1 Street address.
 * @param {string} [options.shippingAddressOverride.line2] Street address (extended).
 * @param {string} options.shippingAddressOverride.city City.
 * @param {string} options.shippingAddressOverride.state State.
 * @param {string} options.shippingAddressOverride.postalCode Postal code.
 * @param {string} options.shippingAddressOverride.countryCode Country.
 * @param {string} [options.shippingAddressOverride.phone] Phone number.
 * @param {string} [options.shippingAddressOverride.recipientName] Recipient's name.
 * @param {boolean} [options.shippingAddressEditable=true] Set to false to disable user editing of the shipping address.
 * @param {string} [options.billingAgreementDescription] Use this option to set the description of the preapproved payment agreement visible to customers in their PayPal profile during Vault flows. Max 255 characters.
 * @param {string} [options.landingPageType=login] Use this option to specify the PayPal page to display when a user lands on the PayPal site to complete the payment.
 * * `login` - A PayPal account login page is used.
 * * `billing` - A non-PayPal account landing page is used.
 * @param {callback} [callback] The second argument is a PayPal `paymentId` or `billingToken` string, depending on whether `options.flow` is `checkout` or `vault`. This is also what is resolved by the promise if no callback is provided.
 * @example
 * // this paypal object is created by checkout.js
 * // see https://github.com/paypal/paypal-checkout
 * paypal.Button.render({
 *   // when createPayment resolves, it is automatically passed to checkout.js
 *   payment: function () {
 *    return paypalCheckoutInstance.createPayment({
 *       flow: 'checkout',
 *       amount: '10.00',
 *       currency: 'USD',
 *       intent: 'sale'
 *     });
 *   },
 *   // Add other options, e.g. onAuthorize, env, locale
 * }, '#paypal-button');
 *
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
PayPalCheckout.prototype.createPayment = function (options) {
  var endpoint;

  if (!options || !constants.FLOW_ENDPOINTS.hasOwnProperty(options.flow)) {
    return Promise.reject(new BraintreeError(errors.PAYPAL_FLOW_OPTION_REQUIRED));
  }

  endpoint = 'paypal_hermes/' + constants.FLOW_ENDPOINTS[options.flow];

  analytics.sendEvent(this._client, 'paypal-checkout.createPayment');
  if (options.offerCredit === true) {
    analytics.sendEvent(this._client, 'paypal-checkout.credit.offered');
  }

  return this._client.request({
    endpoint: endpoint,
    method: 'post',
    data: this._formatPaymentResourceData(options)
  }).then(function (response) {
    var flowToken;

    if (options.flow === 'checkout') {
      flowToken = response.paymentResource.paymentToken;
    } else {
      flowToken = response.agreementSetup.tokenId;
    }

    return flowToken;
  }).catch(function (err) {
    var status = err.details && err.details.httpStatus;

    if (status === 422) {
      return Promise.reject(new BraintreeError({
        type: errors.PAYPAL_INVALID_PAYMENT_OPTION.type,
        code: errors.PAYPAL_INVALID_PAYMENT_OPTION.code,
        message: errors.PAYPAL_INVALID_PAYMENT_OPTION.message,
        details: {
          originalError: err
        }
      }));
    }

    return Promise.reject(convertToBraintreeError(err, {
      type: errors.PAYPAL_FLOW_FAILED.type,
      code: errors.PAYPAL_FLOW_FAILED.code,
      message: errors.PAYPAL_FLOW_FAILED.message
    }));
  });
};

/**
 * Tokenizes the authorize data from PayPal's checkout.js library when completing a buyer approval flow.
 * When a {@link callback} is defined, invokes the callback with {@link PayPalCheckout~tokenizePayload|tokenizePayload} and returns undefined. Otherwise, returns a Promise that resolves with a {@link PayPalCheckout~tokenizePayload|tokenizePayload}.
 * @public
 * @param {object} tokenizeOptions Tokens and IDs required to tokenize the payment.
 * @param {string} tokenizeOptions.payerId Payer ID returned by PayPal `onAuthorize` callback.
 * @param {string} [tokenizeOptions.paymentId] Payment ID returned by PayPal `onAuthorize` callback.
 * @param {string} [tokenizeOptions.billingToken] Billing Token returned by PayPal `onAuthorize` callback.
 * @param {callback} [callback] The second argument, <code>payload</code>, is a {@link PayPalCheckout~tokenizePayload|tokenizePayload}. If no callback is provided, the promise resolves with a {@link PayPalCheckout~tokenizePayload|tokenizePayload}.
 * @example
 * // this paypal object is created by checkout.js
 * // see https://github.com/paypal/paypal-checkout
 * paypal.Button.render({
 *   onAuthorize: function (data, actions) {
 *     return paypalCheckoutInstance.tokenizePayment(data).then(function (payload) {
 *       // Submit payload.nonce to your server
 *     }).catch(function (err) {
 *       // handle error
 *     });
 *   },
 *   // Add other options, e.g. payment, env, locale
 * }, '#paypal-button');
 * @returns {Promise|void} Returns a promise if no callback is provided.
 */
PayPalCheckout.prototype.tokenizePayment = function (tokenizeOptions) {
  var self = this;
  var payload;
  var client = this._client;
  var options = {
    flow: tokenizeOptions.billingToken ? 'vault' : 'checkout',
    intent: tokenizeOptions.intent
  };
  var params = {
    // The paymentToken provided by Checkout.js v4 is the ECToken
    ecToken: tokenizeOptions.paymentToken,
    billingToken: tokenizeOptions.billingToken,
    payerId: tokenizeOptions.payerID,
    paymentId: tokenizeOptions.paymentID
  };

  analytics.sendEvent(client, 'paypal-checkout.tokenization.started');

  return client.request({
    endpoint: 'payment_methods/paypal_accounts',
    method: 'post',
    data: self._formatTokenizeData(options, params)
  }).then(function (response) {
    payload = self._formatTokenizePayload(response);

    analytics.sendEvent(client, 'paypal-checkout.tokenization.success');
    if (payload.creditFinancingOffered) {
      analytics.sendEvent(client, 'paypal-checkout.credit.accepted');
    }

    return payload;
  }).catch(function (err) {
    analytics.sendEvent(client, 'paypal-checkout.tokenization.failed');

    return Promise.reject(convertToBraintreeError(err, {
      type: errors.PAYPAL_ACCOUNT_TOKENIZATION_FAILED.type,
      code: errors.PAYPAL_ACCOUNT_TOKENIZATION_FAILED.code,
      message: errors.PAYPAL_ACCOUNT_TOKENIZATION_FAILED.message
    }));
  });
};

PayPalCheckout.prototype._formatPaymentResourceData = function (options) {
  var key;
  var gatewayConfiguration = this._client.getConfiguration().gatewayConfiguration;
  var paymentResource = {
    // returnUrl and cancelUrl are required in hermes create_payment_resource route
    // but are not validated and are not actually used with checkout.js
    returnUrl: 'x',
    cancelUrl: 'x',
    offerPaypalCredit: options.offerCredit === true,
    experienceProfile: {
      brandName: options.displayName || gatewayConfiguration.paypal.displayName,
      localeCode: options.locale,
      noShipping: (!options.enableShippingAddress).toString(),
      addressOverride: options.shippingAddressEditable === false,
      landingPageType: options.landingPageType
    }
  };

  if (options.flow === 'checkout') {
    paymentResource.amount = options.amount;
    paymentResource.currencyIsoCode = options.currency;

    if (options.hasOwnProperty('intent')) {
      paymentResource.intent = options.intent;
    }

    for (key in options.shippingAddressOverride) {
      if (options.shippingAddressOverride.hasOwnProperty(key)) {
        paymentResource[key] = options.shippingAddressOverride[key];
      }
    }
  } else {
    paymentResource.shippingAddress = options.shippingAddressOverride;

    if (options.billingAgreementDescription) {
      paymentResource.description = options.billingAgreementDescription;
    }
  }

  return paymentResource;
};

PayPalCheckout.prototype._formatTokenizeData = function (options, params) {
  var clientConfiguration = this._client.getConfiguration();
  var gatewayConfiguration = clientConfiguration.gatewayConfiguration;
  var isTokenizationKey = clientConfiguration.authorizationType === 'TOKENIZATION_KEY';
  var data = {
    paypalAccount: {
      correlationId: params.billingToken || params.ecToken,
      options: {
        validate: options.flow === 'vault' && !isTokenizationKey
      }
    }
  };

  if (params.billingToken) {
    data.paypalAccount.billingAgreementToken = params.billingToken;
  } else {
    data.paypalAccount.paymentToken = params.paymentId;
    data.paypalAccount.payerId = params.payerId;
    data.paypalAccount.unilateral = gatewayConfiguration.paypal.unvettedMerchant;

    if (options.intent) {
      data.paypalAccount.intent = options.intent;
    }
  }

  return data;
};

PayPalCheckout.prototype._formatTokenizePayload = function (response) {
  var payload;
  var account = {};

  if (response.paypalAccounts) {
    account = response.paypalAccounts[0];
  }

  payload = {
    nonce: account.nonce,
    details: {},
    type: account.type
  };

  if (account.details && account.details.payerInfo) {
    payload.details = account.details.payerInfo;
  }

  if (account.details && account.details.creditFinancingOffered) {
    payload.creditFinancingOffered = account.details.creditFinancingOffered;
  }

  return payload;
};

module.exports = wrapPromise.wrapPrototype(PayPalCheckout);

},{"../lib/analytics":22,"../lib/braintree-error":25,"../lib/convert-to-braintree-error":32,"../lib/promise":44,"../paypal/shared/constants":51,"./errors":48,"wrap-promise":70}],51:[function(require,module,exports){
'use strict';

module.exports = {
  LANDING_FRAME_NAME: 'braintreepaypallanding',
  FLOW_ENDPOINTS: {
    checkout: 'create_payment_resource',
    vault: 'setup_billing_agreement'
  }
};

},{}],52:[function(require,module,exports){
'use strict';

module.exports = function isIe9(ua) {
  ua = ua || navigator.userAgent;
  return ua.indexOf('MSIE 9') !== -1;
};

},{}],53:[function(require,module,exports){
(function (global){
'use strict';

module.exports = function isIos(ua) {
  ua = ua || global.navigator.userAgent;
  return /iPhone|iPod|iPad/i.test(ua);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],54:[function(require,module,exports){
'use strict';

var types = {};
var VISA = 'visa';
var MASTERCARD = 'master-card';
var AMERICAN_EXPRESS = 'american-express';
var DINERS_CLUB = 'diners-club';
var DISCOVER = 'discover';
var JCB = 'jcb';
var UNIONPAY = 'unionpay';
var MAESTRO = 'maestro';
var CVV = 'CVV';
var CID = 'CID';
var CVC = 'CVC';
var CVN = 'CVN';
var testOrder = [
  VISA,
  MASTERCARD,
  AMERICAN_EXPRESS,
  DINERS_CLUB,
  DISCOVER,
  JCB,
  UNIONPAY,
  MAESTRO
];

function clone(x) {
  var prefixPattern, exactPattern, dupe;

  if (!x) { return null; }

  prefixPattern = x.prefixPattern.source;
  exactPattern = x.exactPattern.source;
  dupe = JSON.parse(JSON.stringify(x));
  dupe.prefixPattern = prefixPattern;
  dupe.exactPattern = exactPattern;

  return dupe;
}

types[VISA] = {
  niceType: 'Visa',
  type: VISA,
  prefixPattern: /^4$/,
  exactPattern: /^4\d*$/,
  gaps: [4, 8, 12],
  lengths: [16, 18, 19],
  code: {
    name: CVV,
    size: 3
  }
};

types[MASTERCARD] = {
  niceType: 'MasterCard',
  type: MASTERCARD,
  prefixPattern: /^(5|5[1-5]|2|22|222|222[1-9]|2[3-6]|27[0-1]|2720)$/,
  exactPattern: /^(5[1-5]|222[1-9]|2[3-6]|27[0-1]|2720)\d*$/,
  gaps: [4, 8, 12],
  lengths: [16],
  code: {
    name: CVC,
    size: 3
  }
};

types[AMERICAN_EXPRESS] = {
  niceType: 'American Express',
  type: AMERICAN_EXPRESS,
  prefixPattern: /^(3|34|37)$/,
  exactPattern: /^3[47]\d*$/,
  isAmex: true,
  gaps: [4, 10],
  lengths: [15],
  code: {
    name: CID,
    size: 4
  }
};

types[DINERS_CLUB] = {
  niceType: 'Diners Club',
  type: DINERS_CLUB,
  prefixPattern: /^(3|3[0689]|30[0-5])$/,
  exactPattern: /^3(0[0-5]|[689])\d*$/,
  gaps: [4, 10],
  lengths: [14],
  code: {
    name: CVV,
    size: 3
  }
};

types[DISCOVER] = {
  niceType: 'Discover',
  type: DISCOVER,
  prefixPattern: /^(6|60|601|6011|65|64|64[4-9])$/,
  exactPattern: /^(6011|65|64[4-9])\d*$/,
  gaps: [4, 8, 12],
  lengths: [16, 19],
  code: {
    name: CID,
    size: 3
  }
};

types[JCB] = {
  niceType: 'JCB',
  type: JCB,
  prefixPattern: /^(2|21|213|2131|1|18|180|1800|3|35)$/,
  exactPattern: /^(2131|1800|35)\d*$/,
  gaps: [4, 8, 12],
  lengths: [16],
  code: {
    name: CVV,
    size: 3
  }
};

types[UNIONPAY] = {
  niceType: 'UnionPay',
  type: UNIONPAY,
  prefixPattern: /^(6|62)$/,
  exactPattern: /^62\d*$/,
  gaps: [4, 8, 12],
  lengths: [16, 17, 18, 19],
  code: {
    name: CVN,
    size: 3
  }
};

types[MAESTRO] = {
  niceType: 'Maestro',
  type: MAESTRO,
  prefixPattern: /^(5|5[06-9]|6\d*)$/,
  exactPattern: /^5[06-9]\d*$/,
  gaps: [4, 8, 12],
  lengths: [12, 13, 14, 15, 16, 17, 18, 19],
  code: {
    name: CVC,
    size: 3
  }
};

function creditCardType(cardNumber) {
  var type, value, i;
  var prefixResults = [];
  var exactResults = [];

  if (!(typeof cardNumber === 'string' || cardNumber instanceof String)) {
    return [];
  }

  for (i = 0; i < testOrder.length; i++) {
    type = testOrder[i];
    value = types[type];

    if (cardNumber.length === 0) {
      prefixResults.push(clone(value));
      continue;
    }

    if (value.exactPattern.test(cardNumber)) {
      exactResults.push(clone(value));
    } else if (value.prefixPattern.test(cardNumber)) {
      prefixResults.push(clone(value));
    }
  }

  return exactResults.length ? exactResults : prefixResults;
}

creditCardType.getTypeInfo = function (type) {
  return clone(types[type]);
};

creditCardType.types = {
  VISA: VISA,
  MASTERCARD: MASTERCARD,
  AMERICAN_EXPRESS: AMERICAN_EXPRESS,
  DINERS_CLUB: DINERS_CLUB,
  DISCOVER: DISCOVER,
  JCB: JCB,
  UNIONPAY: UNIONPAY,
  MAESTRO: MAESTRO
};

module.exports = creditCardType;

},{}],55:[function(require,module,exports){
(function (global){
'use strict';
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(typeof global === 'undefined' ? root : global);
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return factory(root); });
  } else {
    root.framebus = factory(root);
  }
})(this, function (root) { // eslint-disable-line no-invalid-this
  var win, framebus;
  var popups = [];
  var subscribers = {};
  var prefix = '/*framebus*/';

  function include(popup) {
    if (popup == null) { return false; }
    if (popup.Window == null) { return false; }
    if (popup.constructor !== popup.Window) { return false; }

    popups.push(popup);
    return true;
  }

  function target(origin) {
    var key;
    var targetedFramebus = {};

    for (key in framebus) {
      if (!framebus.hasOwnProperty(key)) { continue; }

      targetedFramebus[key] = framebus[key];
    }

    targetedFramebus._origin = origin || '*';

    return targetedFramebus;
  }

  function publish(event) {
    var payload, args;
    var origin = _getOrigin(this); // eslint-disable-line no-invalid-this

    if (_isntString(event)) { return false; }
    if (_isntString(origin)) { return false; }

    args = Array.prototype.slice.call(arguments, 1);

    payload = _packagePayload(event, args, origin);
    if (payload === false) { return false; }

    _broadcast(win.top || win.self, payload, origin);

    return true;
  }

  function subscribe(event, fn) {
    var origin = _getOrigin(this); // eslint-disable-line no-invalid-this

    if (_subscriptionArgsInvalid(event, fn, origin)) { return false; }

    subscribers[origin] = subscribers[origin] || {};
    subscribers[origin][event] = subscribers[origin][event] || [];
    subscribers[origin][event].push(fn);

    return true;
  }

  function unsubscribe(event, fn) {
    var i, subscriberList;
    var origin = _getOrigin(this); // eslint-disable-line no-invalid-this

    if (_subscriptionArgsInvalid(event, fn, origin)) { return false; }

    subscriberList = subscribers[origin] && subscribers[origin][event];
    if (!subscriberList) { return false; }

    for (i = 0; i < subscriberList.length; i++) {
      if (subscriberList[i] === fn) {
        subscriberList.splice(i, 1);
        return true;
      }
    }

    return false;
  }

  function _getOrigin(scope) {
    return scope && scope._origin || '*';
  }

  function _isntString(string) {
    return typeof string !== 'string';
  }

  function _packagePayload(event, args, origin) {
    var packaged = false;
    var payload = {
      event: event,
      origin: origin
    };
    var reply = args[args.length - 1];

    if (typeof reply === 'function') {
      payload.reply = _subscribeReplier(reply, origin);
      args = args.slice(0, -1);
    }

    payload.args = args;

    try {
      packaged = prefix + JSON.stringify(payload);
    } catch (e) {
      throw new Error('Could not stringify event: ' + e.message);
    }
    return packaged;
  }

  function _unpackPayload(e) {
    var payload, replyOrigin, replySource, replyEvent;

    if (e.data.slice(0, prefix.length) !== prefix) { return false; }

    try {
      payload = JSON.parse(e.data.slice(prefix.length));
    } catch (err) {
      return false;
    }

    if (payload.reply != null) {
      replyOrigin = e.origin;
      replySource = e.source;
      replyEvent = payload.reply;

      payload.reply = function reply(data) { // eslint-disable-line consistent-return
        var replyPayload = _packagePayload(replyEvent, [data], replyOrigin);

        if (replyPayload === false) { return false; }

        replySource.postMessage(replyPayload, replyOrigin);
      };

      payload.args.push(payload.reply);
    }

    return payload;
  }

  function _attach(w) {
    if (win) { return; }
    win = w || root;

    if (win.addEventListener) {
      win.addEventListener('message', _onmessage, false);
    } else if (win.attachEvent) {
      win.attachEvent('onmessage', _onmessage);
    } else if (win.onmessage === null) {
      win.onmessage = _onmessage;
    } else {
      win = null;
    }
  }

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : r & 0x3 | 0x8;

      return v.toString(16);
    });
  }

  function _onmessage(e) {
    var payload;

    if (_isntString(e.data)) { return; }

    payload = _unpackPayload(e);
    if (!payload) { return; }

    _dispatch('*', payload.event, payload.args, e);
    _dispatch(e.origin, payload.event, payload.args, e);
    _broadcastPopups(e.data, payload.origin, e.source);
  }

  function _dispatch(origin, event, args, e) {
    var i;

    if (!subscribers[origin]) { return; }
    if (!subscribers[origin][event]) { return; }

    for (i = 0; i < subscribers[origin][event].length; i++) {
      subscribers[origin][event][i].apply(e, args);
    }
  }

  function _hasOpener(frame) {
    if (frame.top !== frame) { return false; }
    if (frame.opener == null) { return false; }
    if (frame.opener === frame) { return false; }
    if (frame.opener.closed === true) { return false; }

    return true;
  }

  function _broadcast(frame, payload, origin) {
    var i;

    try {
      frame.postMessage(payload, origin);

      if (_hasOpener(frame)) {
        _broadcast(frame.opener.top, payload, origin);
      }

      for (i = 0; i < frame.frames.length; i++) {
        _broadcast(frame.frames[i], payload, origin);
      }
    } catch (_) { /* ignored */ }
  }

  function _broadcastPopups(payload, origin, source) {
    var i, popup;

    for (i = popups.length - 1; i >= 0; i--) {
      popup = popups[i];

      if (popup.closed === true) {
        popups = popups.slice(i, 1);
      } else if (source !== popup) {
        _broadcast(popup.top, payload, origin);
      }
    }
  }

  function _subscribeReplier(fn, origin) {
    var uuid = _uuid();

    function replier(d, o) {
      fn(d, o);
      framebus.target(origin).unsubscribe(uuid, replier);
    }

    framebus.target(origin).subscribe(uuid, replier);
    return uuid;
  }

  function _subscriptionArgsInvalid(event, fn, origin) {
    if (_isntString(event)) { return true; }
    if (typeof fn !== 'function') { return true; }
    if (_isntString(origin)) { return true; }

    return false;
  }

  _attach();

  framebus = {
    target: target,
    include: include,
    publish: publish,
    pub: publish,
    trigger: publish,
    emit: publish,
    subscribe: subscribe,
    sub: subscribe,
    on: subscribe,
    unsubscribe: unsubscribe,
    unsub: unsubscribe,
    off: unsubscribe
  };

  return framebus;
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],56:[function(require,module,exports){
'use strict';

var setAttributes = require('./lib/set-attributes');
var defaultAttributes = require('./lib/default-attributes');
var assign = require('./lib/assign');

module.exports = function createFrame(options) {
  var iframe = document.createElement('iframe');
  var config = assign({}, defaultAttributes, options);

  if (config.style && typeof config.style !== 'string') {
    assign(iframe.style, config.style);
    delete config.style;
  }

  setAttributes(iframe, config);

  if (!iframe.getAttribute('id')) {
    iframe.id = iframe.name;
  }

  return iframe;
};

},{"./lib/assign":57,"./lib/default-attributes":58,"./lib/set-attributes":59}],57:[function(require,module,exports){
'use strict';

module.exports = function assign(target) {
  var objs = Array.prototype.slice.call(arguments, 1);

  objs.forEach(function (obj) {
    if (typeof obj !== 'object') { return; }

    Object.keys(obj).forEach(function (key) {
      target[key] = obj[key];
    });
  });

  return target;
}

},{}],58:[function(require,module,exports){
'use strict';

module.exports = {
  src: 'about:blank',
  frameBorder: 0,
  allowtransparency: true,
  scrolling: 'no'
};

},{}],59:[function(require,module,exports){
'use strict';

module.exports = function setAttributes(element, attributes) {
  var value;

  for (var key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      value = attributes[key];

      if (value == null) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, value);
      }
    }
  }
};

},{}],60:[function(require,module,exports){
(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {}
  
  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise._immediateFn(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise._immediateFn(function() {
        if (!self._handled) {
          Promise._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new (this.constructor)(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
    function (fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @deprecated
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    Promise._immediateFn = fn;
  };

  /**
   * Change the function to execute on unhandled rejection
   * @param {function} fn Function to execute on unhandled rejection
   * @deprecated
   */
  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    Promise._unhandledRejectionFn = fn;
  };
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);

},{}],61:[function(require,module,exports){
(function (global){
'use strict';

var UA = global.navigator && global.navigator.userAgent;

var isAndroid = require('browser-detection/is-android');
var isChrome = require('browser-detection/is-chrome');
var isIos = require('browser-detection/is-ios');
var isIE9 = require('browser-detection/is-ie9');

// Old Android Webviews used specific versions of Chrome with 0.0.0 as their version suffix
// https://developer.chrome.com/multidevice/user-agent#webview_user_agent
var KITKAT_WEBVIEW_REGEX = /Version\/\d\.\d* Chrome\/\d*\.0\.0\.0/;

function _isOldSamsungBrowserOrSamsungWebview(ua) {
  return !isChrome(ua) && ua.indexOf('Samsung') > -1;
}

function isKitKatWebview(uaArg) {
  var ua = uaArg || UA;

  return isAndroid(ua) && KITKAT_WEBVIEW_REGEX.test(ua);
}

function isAndroidChrome(uaArg) {
  var ua = uaArg || UA;

  return isAndroid(ua) && isChrome(ua);
}

function isSamsungBrowser(ua) {
  ua = ua || UA;
  return /SamsungBrowser/.test(ua) || _isOldSamsungBrowserOrSamsungWebview(ua);
}

module.exports = {
  isIE9: isIE9,
  isAndroidChrome: isAndroidChrome,
  isIos: isIos,
  isKitKatWebview: isKitKatWebview,
  isSamsungBrowser: isSamsungBrowser
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"browser-detection/is-android":62,"browser-detection/is-chrome":63,"browser-detection/is-ie9":64,"browser-detection/is-ios":65}],62:[function(require,module,exports){
(function (global){
'use strict';

module.exports = function isAndroid(ua) {
  ua = ua || global.navigator.userAgent;
  return /Android/.test(ua);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],63:[function(require,module,exports){
'use strict';

module.exports = function isChrome(ua) {
  ua = ua || navigator.userAgent;
  return ua.indexOf('Chrome') !== -1 || ua.indexOf('CriOS') !== -1;
};

},{}],64:[function(require,module,exports){
arguments[4][52][0].apply(exports,arguments)
},{"dup":52}],65:[function(require,module,exports){
arguments[4][53][0].apply(exports,arguments)
},{"dup":53}],66:[function(require,module,exports){
'use strict';

var device = require('./lib/device');

module.exports = function () {
  // Digits get dropped in samsung browser
  return !device.isSamsungBrowser();
};

},{"./lib/device":61}],67:[function(require,module,exports){
'use strict';

function deferred(fn) {
  return function () {
    // IE9 doesn't support passing arguments to setTimeout so we have to emulate it.
    var args = arguments;

    setTimeout(function () {
      fn.apply(null, args);
    }, 1);
  };
}

module.exports = deferred;

},{}],68:[function(require,module,exports){
arguments[4][42][0].apply(exports,arguments)
},{"dup":42}],69:[function(require,module,exports){
'use strict';

function promiseOrCallback(promise, callback) { // eslint-disable-line consistent-return
  if (callback) {
    promise
      .then(function (data) {
        callback(null, data);
      })
      .catch(function (err) {
        callback(err);
      });
  } else {
    return promise;
  }
}

module.exports = promiseOrCallback;

},{}],70:[function(require,module,exports){
'use strict';

var deferred = require('./lib/deferred');
var once = require('./lib/once');
var promiseOrCallback = require('./lib/promise-or-callback');

function wrapPromise(fn) {
  return function () {
    var callback;
    var args = Array.prototype.slice.call(arguments);
    var lastArg = args[args.length - 1];

    if (typeof lastArg === 'function') {
      callback = args.pop();
      callback = once(deferred(callback));
    }
    return promiseOrCallback(fn.apply(this, args), callback); // eslint-disable-line no-invalid-this
  };
}

wrapPromise.wrapPrototype = function (target, options) {
  var methods, ignoreMethods, includePrivateMethods;

  options = options || {};
  ignoreMethods = options.ignoreMethods || [];
  includePrivateMethods = options.transformPrivateMethods === true;

  methods = Object.getOwnPropertyNames(target.prototype).filter(function (method) {
    var isNotPrivateMethod;
    var isNonConstructorFunction = method !== 'constructor' &&
      typeof target.prototype[method] === 'function';
    var isNotAnIgnoredMethod = ignoreMethods.indexOf(method) === -1;

    if (includePrivateMethods) {
      isNotPrivateMethod = true;
    } else {
      isNotPrivateMethod = method.charAt(0) !== '_';
    }

    return isNonConstructorFunction &&
      isNotPrivateMethod &&
      isNotAnIgnoredMethod;
  });

  methods.forEach(function (method) {
    var original = target.prototype[method];

    target.prototype[method] = wrapPromise(original);
  });

  return target;
};

module.exports = wrapPromise;

},{"./lib/deferred":67,"./lib/once":68,"./lib/promise-or-callback":69}],71:[function(require,module,exports){
'use strict';

module.exports = {
  paymentOptionIDs: {
    card: 'card',
    paypal: 'paypal',
    paypalCredit: 'paypalCredit'
  },
  paymentMethodTypes: {
    card: 'CreditCard',
    paypal: 'PayPalAccount',
    paypalCredit: 'PayPalAccount'
  },
  analyticsKinds: {
    CreditCard: 'card',
    PayPalAccount: 'paypal'
  },
  paymentMethodCardTypes: {
    Visa: 'visa',
    MasterCard: 'master-card',
    'American Express': 'american-express',
    'Diners Club': 'diners-club',
    Discover: 'discover',
    JCB: 'jcb',
    UnionPay: 'unionpay',
    Maestro: 'maestro'
  },
  configurationCardTypes: {
    visa: 'Visa',
    'master-card': 'MasterCard',
    'american-express': 'American Express',
    'diners-club': 'Discover',
    discover: 'Discover',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    maestro: 'Maestro'
  },
  errors: {
    NO_PAYMENT_METHOD_ERROR: 'No payment method is available.'
  },
  ANALYTICS_REQUEST_TIMEOUT_MS: 2000,
  ANALYTICS_PREFIX: 'web.dropin.',
  CHECKOUT_JS_SOURCE: 'https://www.paypalobjects.com/api/checkout.4.0.75.min.js',
  INTEGRATION: 'dropin2',
  PAYPAL_CHECKOUT_SCRIPT_ID: 'braintree-dropin-paypal-checkout-script',
  STYLESHEET_ID: 'braintree-dropin-stylesheet'
};

},{}],72:[function(require,module,exports){
'use strict';

var DropinError = require('./lib/dropin-error');
var EventEmitter = require('./lib/event-emitter');
var constants = require('./constants');
var paymentMethodTypes = constants.paymentMethodTypes;
var paymentOptionIDs = constants.paymentOptionIDs;
var isGuestCheckout = require('./lib/is-guest-checkout');

function DropinModel(options) {
  this.componentID = options.componentID;
  this.merchantConfiguration = options.merchantConfiguration;

  this.isGuestCheckout = isGuestCheckout(options.client);

  this.dependenciesInitializing = 0;
  this.dependencySuccessCount = 0;
  this.failedDependencies = {};

  this.supportedPaymentOptions = getSupportedPaymentOptions(options);
  this._paymentMethods = this._getSupportedPaymentMethods(options.paymentMethods);
  this._paymentMethodIsRequestable = this._paymentMethods.length > 0;

  EventEmitter.call(this);
}

DropinModel.prototype = Object.create(EventEmitter.prototype, {
  constructor: DropinModel
});

DropinModel.prototype.isPaymentMethodRequestable = function () {
  return Boolean(this._paymentMethodIsRequestable);
};

DropinModel.prototype.addPaymentMethod = function (paymentMethod) {
  this._paymentMethods.push(paymentMethod);
  this._emit('addPaymentMethod', paymentMethod);
  this.changeActivePaymentMethod(paymentMethod);
};

DropinModel.prototype.removePaymentMethod = function (paymentMethod) {
  var paymentMethodLocation = this._paymentMethods.indexOf(paymentMethod);

  if (paymentMethodLocation === -1) {
    return;
  }

  this._paymentMethods.splice(paymentMethodLocation, 1);
  this._emit('removePaymentMethod', paymentMethod);
};

DropinModel.prototype.changeActivePaymentMethod = function (paymentMethod) {
  this._activePaymentMethod = paymentMethod;
  this._emit('changeActivePaymentMethod', paymentMethod);
};

DropinModel.prototype.changeActivePaymentView = function (paymentViewID) {
  this._activePaymentView = paymentViewID;
  this._emit('changeActivePaymentView', paymentViewID);
};

DropinModel.prototype._shouldEmitRequestableEvent = function (options) {
  var requestableStateHasNotChanged = this.isPaymentMethodRequestable() === options.isRequestable;
  var typeHasNotChanged = options.type === this._paymentMethodRequestableType;

  if (requestableStateHasNotChanged && (!options.isRequestable || typeHasNotChanged)) {
    return false;
  }

  return true;
};

DropinModel.prototype.setPaymentMethodRequestable = function (options) {
  var shouldEmitEvent = this._shouldEmitRequestableEvent(options);

  this._paymentMethodIsRequestable = options.isRequestable;

  if (options.isRequestable) {
    this._paymentMethodRequestableType = options.type;
  } else {
    delete this._paymentMethodRequestableType;
  }

  if (!shouldEmitEvent) {
    return;
  }

  if (options.isRequestable) {
    this._emit('paymentMethodRequestable', {type: options.type});
  } else {
    this._emit('noPaymentMethodRequestable');
  }
};

DropinModel.prototype.getPaymentMethods = function () {
  // we want to return a copy of the Array
  // so we can loop through it in dropin.updateConfiguration
  // while calling model.removePaymentMethod
  // which updates the original array
  return this._paymentMethods.slice();
};

DropinModel.prototype.getActivePaymentMethod = function () {
  return this._activePaymentMethod;
};

DropinModel.prototype.getActivePaymentView = function () {
  return this._activePaymentView;
};

DropinModel.prototype.asyncDependencyStarting = function () {
  this.dependenciesInitializing++;
};

DropinModel.prototype.asyncDependencyReady = function () {
  this.dependencySuccessCount++;
  this.dependenciesInitializing--;
  this._checkAsyncDependencyFinished();
};

DropinModel.prototype.asyncDependencyFailed = function (options) {
  this.failedDependencies[options.view] = options.error;
  this.dependenciesInitializing--;
  this._checkAsyncDependencyFinished();
};

DropinModel.prototype._checkAsyncDependencyFinished = function () {
  if (this.dependenciesInitializing === 0) {
    this._emit('asyncDependenciesReady');
  }
};

DropinModel.prototype.reportError = function (error) {
  this._emit('errorOccurred', error);
};

DropinModel.prototype.clearError = function () {
  this._emit('errorCleared');
};

DropinModel.prototype._getSupportedPaymentMethods = function (paymentMethods) {
  var supportedPaymentMethods = this.supportedPaymentOptions.reduce(function (array, key) {
    var paymentMethodType = paymentMethodTypes[key];

    if (paymentMethodType) {
      array.push(paymentMethodType);
    }

    return array;
  }, []);

  return paymentMethods.filter(function (paymentMethod) {
    return supportedPaymentMethods.indexOf(paymentMethod.type) > -1;
  });
};

function getSupportedPaymentOptions(options) {
  var result = [];
  var paymentOptionPriority = options.merchantConfiguration.paymentOptionPriority || ['card', 'paypal', 'paypalCredit'];

  if (!(paymentOptionPriority instanceof Array)) {
    throw new DropinError('paymentOptionPriority must be an array.');
  }

  // Remove duplicates
  paymentOptionPriority = paymentOptionPriority.filter(function (item, pos) { return paymentOptionPriority.indexOf(item) === pos; });

  paymentOptionPriority.forEach(function (paymentOption) {
    if (isPaymentOptionEnabled(paymentOption, options)) {
      result.push(paymentOptionIDs[paymentOption]);
    }
  });

  if (result.length === 0) {
    throw new DropinError('No valid payment options available.');
  }

  return result;
}

function isPaymentOptionEnabled(paymentOption, options) {
  var gatewayConfiguration = options.client.getConfiguration().gatewayConfiguration;

  if (paymentOption === 'card') {
    return gatewayConfiguration.creditCards.supportedCardTypes.length > 0;
  } else if (paymentOption === 'paypal') {
    return gatewayConfiguration.paypalEnabled && Boolean(options.merchantConfiguration.paypal);
  } else if (paymentOption === 'paypalCredit') {
    return gatewayConfiguration.paypalEnabled && Boolean(options.merchantConfiguration.paypalCredit);
  }
  throw new DropinError('paymentOptionPriority: Invalid payment option specified.');
}

module.exports = DropinModel;

},{"./constants":71,"./lib/dropin-error":81,"./lib/event-emitter":82,"./lib/is-guest-checkout":83}],73:[function(require,module,exports){
'use strict';

var assign = require('./lib/assign').assign;
var analytics = require('./lib/analytics');
var constants = require('./constants');
var DropinError = require('./lib/dropin-error');
var DropinModel = require('./dropin-model');
var EventEmitter = require('./lib/event-emitter');
var isGuestCheckout = require('./lib/is-guest-checkout');

var MainView = require('./views/main-view');
var paymentMethodsViewID = require('./views/payment-methods-view').ID;
var paymentOptionsViewID = require('./views/payment-options-view').ID;
var paymentOptionIDs = constants.paymentOptionIDs;
var translations = require('./translations');
var uuid = require('./lib/uuid');

var mainHTML = "<div class=\"braintree-dropin\">\n  <div data-braintree-id=\"methods-label\" class=\"braintree-heading\">&nbsp;</div>\n  <div data-braintree-id=\"choose-a-way-to-pay\" class=\"braintree-heading\">{{chooseAWayToPay}}</div>\n  <div class=\"braintree-placeholder\">&nbsp;</div>\n\n  <div data-braintree-id=\"upper-container\" class=\"braintree-upper-container\">\n    <div data-braintree-id=\"loading-container\" class=\"braintree-loader__container\">\n      <div data-braintree-id=\"loading-indicator\" class=\"braintree-loader__indicator\">\n        <svg width=\"14\" height=\"16\" class=\"braintree-loader__lock\">\n        <use xlink:href=\"#iconLockLoader\"></use>\n        </svg>\n      </div>\n    </div>\n\n    <div data-braintree-id=\"methods\" class=\"braintree-methods braintree-methods-initial\">\n      <div data-braintree-id=\"methods-container\"></div>\n    </div>\n\n    <div data-braintree-id=\"options\" class=\"braintree-test-class braintree-options braintree-options-initial\">\n      <div data-braintree-id=\"payment-options-container\" class=\"braintree-options-list\"></div>\n    </div>\n\n    <div data-braintree-id=\"sheet-container\" class=\"braintree-sheet__container\">\n      <div data-braintree-id=\"paypal\" class=\"braintree-paypal braintree-sheet\">\n        <div data-braintree-id=\"paypal-sheet-header\" class=\"braintree-sheet__header\">\n          <div class=\"braintree-sheet__header-label\">\n            <div class=\"braintree-sheet__logo--header\">\n              <svg height=\"24\" width=\"40\">\n              <use xlink:href=\"#logoPayPal\"></use>\n              </svg>\n            </div>\n            <div class=\"braintree-sheet__label\">{{PayPal}}</div>\n          </div>\n        </div>\n        <div class=\"braintree-sheet__content braintree-sheet__content--button\">\n          <div data-braintree-id=\"paypal-button\" class=\"braintree-sheet__button--paypal\"></div>\n        </div>\n      </div>\n      <div data-braintree-id=\"paypalCredit\" class=\"braintree-paypalCredit braintree-sheet\">\n        <div data-braintree-id=\"paypal-credit-sheet-header\" class=\"braintree-sheet__header\">\n          <div class=\"braintree-sheet__header-label\">\n            <div class=\"braintree-sheet__logo--header\">\n              <svg height=\"24\" width=\"40\">\n              <use xlink:href=\"#logoPayPalCredit\"></use>\n              </svg>\n            </div>\n            <div class=\"braintree-sheet__label\">{{PayPal Credit}}</div>\n          </div>\n        </div>\n        <div class=\"braintree-sheet__content braintree-sheet__content--button\">\n          <div data-braintree-id=\"paypal-credit-button\" class=\"braintree-sheet__button--paypal\"></div>\n        </div>\n      </div>\n      <div data-braintree-id=\"card\" class=\"braintree-card braintree-form braintree-sheet\">\n        <div data-braintree-id=\"card-sheet-header\" class=\"braintree-sheet__header\">\n          <div class=\"braintree-sheet__header-label\">\n            <div class=\"braintree-sheet__logo--header\">\n              <svg height=\"24\" width=\"40\" class=\"braintree-icon--bordered\">\n              <use xlink:href=\"#iconCardFront\"></use>\n              </svg>\n            </div>\n            <div class=\"braintree-sheet__text\">{{payWithCard}}</div>\n          </div>\n          <div data-braintree-id=\"card-view-icons\" class=\"braintree-sheet__icons\"></div>\n        </div>\n        <div class=\"braintree-sheet__content braintree-sheet__content--form\">\n          <div data-braintree-id=\"number-field-group\" class=\"braintree-form__field-group\">\n            <div class=\"braintree-form__label\">{{cardNumberLabel}}</div>\n            <div class=\"braintree-form__field\">\n              <div class=\"braintree-form-number braintree-form__hosted-field\"></div>\n              <div class=\"braintree-form__icon-container\">\n                <div data-braintree-id=\"card-number-icon\" class=\"braintree-form__icon braintree-form__field-secondary-icon\">\n                  <svg height=\"24\" width=\"40\" class=\"braintree-icon--bordered\">\n                  <use data-braintree-id=\"card-number-icon-svg\" xlink:href=\"#iconCardFront\"></use>\n                  </svg>\n                </div>\n                <div class=\"braintree-form__icon braintree-form__field-error-icon\">\n                  <svg height=\"24\" width=\"24\">\n                  <use xlink:href=\"#iconError\"></use>\n                  </svg>\n                </div>\n              </div>\n            </div>\n            <div data-braintree-id=\"number-field-error\" class=\"braintree-form__field-error\"></div>\n          </div>\n\n          <div class=\"braintree-form__flexible-fields\">\n            <div data-braintree-id=\"expiration-date-field-group\" class=\"braintree-form__field-group\">\n              <div class=\"braintree-form__label\">{{expirationDateLabel}}\n                <span class=\"braintree-form__descriptor\">{{expirationDateLabelSubheading}}</span>\n              </div>\n              <div class=\"braintree-form__field\">\n                <div class=\"braintree-form__hosted-field braintree-form-expiration\"></div>\n                <div class=\"braintree-form__icon-container\">\n                  <div class=\"braintree-form__icon braintree-form__field-error-icon\">\n                    <svg height=\"24\" width=\"24\">\n                    <use xlink:href=\"#iconError\"></use>\n                    </svg>\n                  </div>\n                </div>\n              </div>\n\n              <div data-braintree-id=\"expiration-date-field-error\" class=\"braintree-form__field-error\"></div>\n            </div>\n\n            <div data-braintree-id=\"cvv-field-group\" class=\"braintree-form__field-group\">\n              <div class=\"braintree-form__label\">{{cvvLabel}}\n                <span data-braintree-id=\"cvv-label-descriptor\" class=\"braintree-form__descriptor\">{{cvvThreeDigitLabelSubheading}}</span>\n              </div>\n              <div class=\"braintree-form__field\">\n                <div class=\"braintree-form__hosted-field braintree-form-cvv\"></div>\n                <div class=\"braintree-form__icon-container\">\n                  <div data-braintree-id=\"cvv-icon\" class=\"braintree-form__icon braintree-form__field-secondary-icon\">\n                    <svg height=\"24\" width=\"40\" class=\"braintree-icon--bordered\">\n                    <use data-braintree-id=\"cvv-icon-svg\" xlink:href=\"#iconCVVBack\"></use>\n                    </svg>\n                  </div>\n                  <div class=\"braintree-form__icon braintree-form__field-error-icon\">\n                    <svg height=\"24\" width=\"24\">\n                    <use xlink:href=\"#iconError\"></use>\n                    </svg>\n                  </div>\n                </div>\n              </div>\n              <div data-braintree-id=\"cvv-field-error\" class=\"braintree-form__field-error\"></div>\n            </div>\n\n            <div data-braintree-id=\"postal-code-field-group\" class=\"braintree-form__field-group\">\n              <div class=\"braintree-form__label\">{{postalCodeLabel}}</div>\n              <div class=\"braintree-form__field\">\n                <div class=\"braintree-form__hosted-field braintree-form-postal-code\"></div>\n                <div class=\"braintree-form__icon-container\">\n                  <div class=\"braintree-form__icon braintree-form__field-error-icon\">\n                    <svg height=\"24\" width=\"24\">\n                    <use xlink:href=\"#iconError\"></use>\n                    </svg>\n                  </div>\n                </div>\n              </div>\n              <div data-braintree-id=\"postal-code-field-error\" class=\"braintree-form__field-error\"></div>\n            </div>\n          </div>\n        </div>\n      </div>\n      <div data-braintree-id=\"sheet-error\" class=\"braintree-sheet__error\">\n        <div class=\"braintree-form__icon braintree-sheet__error-icon\">\n          <svg height=\"24\" width=\"24\">\n          <use xlink:href=\"#iconError\"></use>\n          </svg>\n        </div>\n        <div data-braintree-id=\"sheet-error-text\" class=\"braintree-sheet__error-text\"></div>\n      </div>\n    </div>\n  </div>\n\n  <div data-braintree-id=\"lower-container\" class=\"braintree-test-class braintree-options braintree-hidden\">\n    <div data-braintree-id=\"other-ways-to-pay\" class=\"braintree-heading\">{{otherWaysToPay}}</div>\n  </div>\n\n  <div data-braintree-id=\"toggle\" class=\"braintree-toggle braintree-hidden\" tabindex=\"0\">\n    <span>{{chooseAnotherWayToPay}}</span>\n  </div>\n</div>\n";
var svgHTML = "<svg data-braintree-id=\"svgs\" style=\"display: none\">\n  <defs>\n    <symbol id=\"icon-visa\" viewBox=\"0 0 53 32\">\n      <title>Visa</title>\n      <path fill=\"#fff\" d=\"M0 2.57C0 1.151 1.189 0 2.657 0h48.02c1.467 0 2.657 1.151 2.657 2.57v26.86c0 1.419-1.189 2.57-2.657 2.57H2.657C1.19 32 0 30.849 0 29.43V2.57z\"/>\n      <path fill=\"#f8b600\" d=\"M0 29.377C0 30.826 1.189 32 2.657 32h48.02c1.467 0 2.657-1.175 2.657-2.623v-2.603H.001v2.603z\"/>\n      <path fill=\"#1a1f71\" d=\"M0 5.227h53.333V2.624c0-1.449-1.189-2.623-2.657-2.623H2.656C1.189.001-.001 1.176-.001 2.624v2.603zm26.128 5.287l-2.815 12.637h-3.405l2.815-12.637h3.404zm14.324 8.16l1.792-4.746 1.031 4.746h-2.823zm3.8 4.477H47.4l-2.75-12.637h-2.904c-.654 0-1.206.364-1.45.926l-5.109 11.711h3.575l.71-1.887h4.367l.413 1.887zm-8.888-4.126c.015-3.335-4.801-3.52-4.769-5.01.01-.453.46-.935 1.443-1.059.488-.06 1.833-.109 3.358.566l.596-2.681c-.819-.284-1.873-.559-3.184-.559-3.366 0-5.734 1.717-5.752 4.177-.022 1.819 1.691 2.834 2.979 3.44 1.328.619 1.773 1.017 1.767 1.57-.009.848-1.059 1.223-2.036 1.237-1.713.026-2.705-.445-3.497-.799l-.618 2.77c.797.35 2.265.655 3.785.671 3.578 0 5.918-1.697 5.928-4.324zm-14.101-8.511l-5.516 12.637h-3.599L9.433 13.065c-.164-.62-.308-.848-.808-1.11-.819-.427-2.17-.826-3.359-1.075l.08-.367h5.793c.738 0 1.402.472 1.571 1.288l1.434 7.313 3.542-8.601h3.577z\"/>\n    </symbol>\n\n    <symbol id=\"icon-master-card\" viewBox=\"0 0 55 32\">\n      <title>MasterCard</title>\n      <path fill=\"#fff\" d=\"M.667 2.57C.667 1.151 1.856 0 3.324 0h48.02c1.467 0 2.657 1.151 2.657 2.57v26.86c0 1.419-1.189 2.57-2.657 2.57H3.324C1.857 32 .667 30.849.667 29.43V2.57z\"/>\n      <path fill=\"#000\" d=\"M15.447 29.6v-1.814c0-.695-.425-1.149-1.152-1.149-.364 0-.758.121-1.031.514-.212-.333-.516-.514-.971-.514-.303 0-.607.091-.849.423v-.363h-.637V29.6h.637v-1.602c0-.514.273-.756.698-.756s.637.272.637.756V29.6h.637v-1.602c0-.514.303-.756.698-.756.425 0 .637.272.637.756V29.6h.698zm9.432-2.903h-1.031v-.877h-.637v.877h-.576v.575h.576v1.33c0 .665.273 1.058 1.001 1.058.273 0 .576-.091.789-.212l-.182-.544c-.182.121-.394.151-.546.151-.303 0-.425-.181-.425-.484v-1.3h1.031v-.575zm5.399-.06c-.364 0-.607.181-.758.423v-.363h-.637V29.6h.637v-1.633c0-.484.212-.756.607-.756.121 0 .273.03.394.06l.182-.605c-.121-.03-.303-.03-.425-.03zm-8.159.302c-.303-.212-.728-.302-1.183-.302-.728 0-1.213.363-1.213.937 0 .484.364.756 1.001.847l.303.03c.334.06.516.151.516.302 0 .212-.243.363-.667.363s-.758-.151-.971-.302l-.303.484c.334.242.789.363 1.244.363.849 0 1.334-.393 1.334-.937 0-.514-.394-.786-1.001-.877l-.303-.03c-.273-.03-.485-.091-.485-.272 0-.212.212-.333.546-.333.364 0 .728.151.91.242l.273-.514zm16.924-.302c-.364 0-.607.181-.758.423v-.363h-.637V29.6h.637v-1.633c0-.484.212-.756.607-.756.121 0 .273.03.394.06l.182-.605c-.121-.03-.303-.03-.425-.03zm-8.128 1.511c0 .877.607 1.512 1.547 1.512.425 0 .728-.091 1.031-.333l-.303-.514c-.243.181-.485.272-.758.272-.516 0-.88-.363-.88-.937 0-.544.364-.907.88-.937.273 0 .516.091.758.272l.303-.514c-.303-.242-.607-.333-1.031-.333-.94 0-1.547.635-1.547 1.512zm5.884 0v-1.451h-.637v.363c-.212-.272-.516-.423-.91-.423-.819 0-1.456.635-1.456 1.512s.637 1.512 1.456 1.512c.425 0 .728-.151.91-.423v.363h.637V28.15zm-2.336 0c0-.514.334-.937.88-.937.516 0 .88.393.88.937 0 .514-.364.937-.88.937-.546-.03-.88-.423-.88-.937zm-7.612-1.511c-.849 0-1.456.605-1.456 1.512s.607 1.512 1.486 1.512c.425 0 .849-.121 1.183-.393l-.303-.454c-.243.181-.546.302-.849.302-.394 0-.789-.181-.88-.695h2.153v-.242c.03-.937-.516-1.542-1.334-1.542zm0 .544c.394 0 .667.242.728.695h-1.516c.061-.393.334-.695.789-.695zm15.801.967v-2.6h-.637v1.512c-.212-.272-.516-.423-.91-.423-.819 0-1.456.635-1.456 1.512s.637 1.512 1.456 1.512c.425 0 .728-.151.91-.423v.363h.637V28.15zm-2.335 0c0-.514.334-.937.88-.937.516 0 .88.393.88.937 0 .514-.364.937-.88.937-.546-.03-.88-.423-.88-.937zm-21.291 0v-1.451h-.637v.363c-.212-.272-.516-.423-.91-.423-.819 0-1.456.635-1.456 1.512s.637 1.512 1.456 1.512c.425 0 .728-.151.91-.423v.363h.637V28.15zm-2.366 0c0-.514.334-.937.88-.937.516 0 .88.393.88.937 0 .514-.364.937-.88.937-.546-.03-.88-.423-.88-.937z\"/>\n      <path fill=\"#ff5f00\" d=\"M31.46 4.655h-9.553v17.113h9.553z\"/>\n      <path fill=\"#eb001b\" d=\"M22.51 13.212c0-3.477 1.638-6.561 4.155-8.557-1.85-1.451-4.185-2.328-6.733-2.328-6.035 0-10.918 4.868-10.918 10.885s4.883 10.885 10.918 10.885c2.548 0 4.883-.877 6.733-2.328-2.517-1.965-4.155-5.08-4.155-8.557z\"/>\n      <path fill=\"#f79e1b\" d=\"M44.345 13.212c0 6.017-4.883 10.885-10.918 10.885-2.548 0-4.883-.877-6.733-2.328 2.548-1.996 4.155-5.08 4.155-8.557s-1.638-6.561-4.155-8.557c1.85-1.451 4.185-2.328 6.733-2.328 6.035 0 10.918 4.898 10.918 10.885z\"/>\n    </symbol>\n\n    <symbol id=\"icon-unionpay\" viewBox=\"0 0 53 32\">\n      <title>Union Pay</title>\n      <path fill=\"#fff\" d=\"M51.111 32H2.222C1 32 0 31.04 0 29.867V2.134C0 .961 1 .001 2.222.001h48.889c1.222 0 2.222.96 2.222 2.133v27.733c0 1.173-1 2.133-2.222 2.133z\"/>\n      <path fill=\"#e21836\" d=\"M13.169 2.667h10.835c1.513 0 2.453 1.241 2.1 2.769l-5.045 21.799C20.703 28.758 19.188 30 17.676 30H6.841c-1.513 0-2.453-1.241-2.101-2.765L9.787 5.436c.353-1.528 1.866-2.769 3.382-2.769z\"/>\n      <path fill=\"#00447b\" d=\"M23.1 2.667h12.459c1.513 0 .831 1.241.475 2.769l-5.045 21.799C30.636 28.758 30.746 30 29.231 30h-12.46c-1.516 0-2.453-1.241-2.097-2.765l5.043-21.799c.357-1.528 1.868-2.769 3.382-2.769z\"/>\n      <path fill=\"#007b84\" d=\"M35.068 2.667h10.833c1.514 0 2.455 1.241 2.1 2.769l-5.044 21.799C42.603 28.758 41.088 30 39.571 30h-10.83c-1.517 0-2.456-1.241-2.1-2.765l5.042-21.799c.354-1.528 1.869-2.769 3.384-2.769z\"/>\n      <path fill=\"#fefefe\" d=\"M36.843 18.763l-1.321 4.399h.356l-.275.908h-.355l-.083.282h-1.256l.086-.282H31.44l.258-.841h.259l1.339-4.466.267-.902h1.283l-.135.455s.342-.247.665-.332c.322-.086 2.181-.118 2.181-.118l-.275.896h-.439zm-2.259 0l-.339 1.124s.38-.173.588-.23c.211-.054.526-.076.526-.076l.245-.818h-1.019zm-.508 1.682l-.35 1.169s.388-.2.596-.262c.21-.049.528-.088.528-.088l.247-.818h-1.022zm-.817 2.729h1.022l.295-.988h-1.02l-.297.988z\"/>\n      <path fill=\"#fefefe\" d=\"M37.407 17.867h1.369l.015.514c-.008.087.065.128.224.128h.279l-.254.848h-.739c-.641.047-.883-.23-.868-.542l-.026-.948zm.183 4.02h-1.303l.223-.755H38l.214-.688h-1.473l.253-.851h4.097l-.258.851h-1.372l-.216.688h1.378l-.227.755h-1.491l-.264.319h.604l.147.95c.016.094.018.155.048.196.03.035.211.05.317.05h.182l-.279.926h-.465c-.073 0-.178-.006-.325-.014-.14-.011-.24-.094-.333-.14-.086-.042-.212-.147-.243-.323l-.145-.948-.677.935c-.215.295-.507.519-.998.519h-.949l.248-.825h.363c.104 0 .198-.041.265-.076.07-.03.131-.065.201-.168l.986-1.401zm-14.286-2.065h3.453l-.253.829h-1.383l-.214.707h1.412l-.258.857h-1.412l-.342 1.149c-.042.127.334.145.471.145l.706-.098-.283.947h-1.593c-.127 0-.224-.018-.363-.049-.134-.033-.192-.094-.253-.186-.057-.094-.146-.171-.085-.371l.457-1.524h-.784l.26-.87h.789l.208-.707h-.783l.25-.829zm2.327-1.491h1.416l-.259.867h-1.935l-.211.183c-.089.087-.12.05-.238.116-.11.054-.34.164-.638.164h-.621l.252-.833h.187c.158 0 .265-.014.319-.049.061-.039.13-.128.209-.27l.355-.651h1.41l-.247.474zm2.022-.465h1.207l-.176.612s.381-.307.649-.416c.265-.099.866-.19.866-.19l1.953-.009-.664 2.23c-.114.382-.244.629-.325.741-.074.116-.16.211-.331.306-.166.088-.315.139-.453.153-.129.009-.326.015-.6.017h-1.881l-.532 1.765c-.049.175-.074.258-.041.305.028.042.091.09.18.09l.829-.079-.283.967h-.929c-.295 0-.51-.006-.661-.018-.144-.012-.293 0-.393-.078-.087-.077-.219-.177-.216-.281.01-.096.049-.255.109-.473l1.691-5.642zm2.563 2.254h-1.979l-.122.401h1.713c.202-.025.243.004.26-.006l.127-.396zm-1.87-.363s.386-.354 1.049-.47c.15-.029 1.092-.02 1.092-.02l.143-.477h-1.995l-.288.967z\"/>\n      <path fill=\"#fefefe\" d=\"M31.176 21.468l-.111.535c-.048.167-.09.294-.215.402-.13.112-.287.23-.649.23l-.669.027-.005.605c-.008.172.037.155.064.182.032.03.059.043.089.054l.211-.011.639-.037-.263.884h-.735c-.514 0-.895-.012-1.021-.112-.123-.078-.14-.178-.137-.347l.047-2.36h1.172l-.015.482h.282c.096 0 .161-.01.202-.035.034-.027.061-.064.08-.124l.114-.376h.921zM14.453 9.63c-.041.19-.794 3.684-.796 3.685-.162.706-.279 1.212-.678 1.535-.228.188-.493.281-.8.281-.492 0-.782-.247-.831-.716l-.009-.16s.15-.948.151-.951c0 0 .79-3.183.931-3.603.005-.024.009-.035.012-.047-1.536.014-1.81 0-1.828-.023-.009.031-.049.23-.049.23l-.806 3.585-.07.306-.131.994c0 .294.056.535.171.739.368.647 1.415.743 2.007.743.764 0 1.479-.164 1.962-.461.84-.5 1.062-1.282 1.257-1.975l.09-.355s.814-3.307.954-3.736c.003-.024.007-.035.011-.047-1.113.012-1.441 0-1.546-.023zm4.495 6.562c-.544-.008-.736-.008-1.373.024l-.026-.048c.057-.243.116-.484.17-.731l.079-.333c.117-.519.232-1.123.247-1.306.011-.112.049-.388-.266-.388-.132 0-.271.065-.41.13-.077.276-.232 1.051-.305 1.406-.158.745-.169.829-.239 1.199l-.046.049c-.561-.008-.755-.008-1.402.024l-.03-.053c.109-.443.216-.89.319-1.331.272-1.2.335-1.659.411-2.269l.051-.037c.629-.088.782-.106 1.464-.247l.057.065-.103.383c.115-.069.225-.139.344-.201.322-.159.68-.205.876-.205.297 0 .624.084.761.431.13.31.044.692-.126 1.445l-.089.382c-.174.837-.203.99-.301 1.565l-.064.049zm2.212 0c-.328-.002-.54-.008-.746-.002-.205.002-.405.012-.71.026l-.018-.026-.02-.028c.083-.318.13-.429.171-.541s.08-.225.153-.547c.095-.42.155-.714.195-.971.044-.249.07-.461.101-.707l.025-.019.027-.024c.326-.047.535-.076.746-.11.214-.031.429-.073.767-.137l.013.03.01.029c-.063.261-.126.519-.189.784-.061.263-.123.522-.182.783-.122.552-.171.759-.2.906-.028.141-.035.218-.085.504l-.029.025-.03.024zm4.896-1.888c.191-.843.044-1.238-.144-1.479-.284-.365-.785-.483-1.305-.483-.313 0-1.057.032-1.64.573-.416.388-.611.918-.727 1.423-.117.516-.254 1.447.596 1.792.264.113.64.144.883.144.622 0 1.26-.173 1.739-.684.372-.416.54-1.033.598-1.287zm-1.425-.061c-.029.141-.152.67-.32.896-.117.165-.255.264-.409.264-.044 0-.313 0-.318-.402-.003-.198.037-.404.086-.624.144-.639.314-1.175.745-1.175.34 0 .363.398.214 1.039zm14.75 2.006c-.657-.005-.846-.005-1.455.02l-.04-.049c.167-.629.332-1.257.479-1.892.19-.826.233-1.177.297-1.659l.049-.042c.653-.094.834-.12 1.514-.247l.021.057c-.124.518-.248 1.036-.368 1.555-.251 1.088-.343 1.641-.438 2.21l-.061.046z\"/>\n      <path fill=\"#fefefe\" d=\"M39.694 14.378c.191-.839-.577-.075-.701-.351-.188-.432-.07-1.308-.828-1.601-.292-.113-.975.034-1.56.571-.412.386-.611.91-.725 1.415-.118.508-.253 1.437.591 1.771.268.114.512.147.756.137.849-.047 1.497-1.338 1.976-1.849.37-.404.435.153.491-.094zm-1.3-.062c-.032.135-.155.67-.324.892-.111.158-.378.258-.53.258-.042 0-.309 0-.319-.398-.003-.196.038-.401.088-.624.145-.626.313-1.159.746-1.159.339 0 .484.388.338 1.03zm-8.618 1.876c-.547-.008-.733-.008-1.374.024l-.024-.048c.054-.243.116-.484.174-.731l.076-.333c.119-.519.233-1.123.246-1.306.011-.112.048-.388-.263-.388-.135 0-.271.065-.411.13-.076.276-.233 1.051-.309 1.406-.154.745-.166.829-.235 1.199l-.047.049c-.561-.008-.755-.008-1.4.024l-.029-.053c.108-.443.214-.89.317-1.331.271-1.2.334-1.659.41-2.269l.05-.037c.63-.088.783-.106 1.465-.247l.055.065-.099.383c.111-.069.226-.139.342-.201.319-.159.68-.205.874-.205.298 0 .627.084.766.431.127.31.042.692-.131 1.445l-.086.382c-.178.837-.205.99-.3 1.565l-.067.049zm5.318-4.517c-.096.435-.377.803-.739.982-.3.151-.664.163-1.042.163h-.243l.018-.098s.45-1.964.448-1.959l.012-.101.01-.078.178.019s.925.081.948.083c.366.14.516.509.41.988zm-.59-2.05c-.002 0-.452.005-.452.005-1.179.014-1.652.008-1.845-.016-.018.086-.049.242-.049.242s-.42 1.969-.42 1.971c0 0-1.01 4.187-1.058 4.383 1.027-.012 1.45-.012 1.626.006.041-.196.28-1.365.282-1.365 0 0 .203-.858.216-.889 0 0 .064-.089.129-.124h.093c.887 0 1.891 0 2.674-.583.533-.399.9-.986 1.063-1.701.042-.176.073-.386.073-.594 0-.274-.054-.545-.213-.757-.401-.565-1.196-.573-2.118-.578zm10.259 2.749l-.052-.059c-.672.135-.794.159-1.412.241l-.046.045c-.003.008-.004.02-.007.029l-.003-.009c-.461 1.07-.446.839-.821 1.68-.003-.039-.004-.065-.005-.103l-.092-1.824-.059-.059c-.704.135-.722.159-1.372.241l-.052.045c-.005.023-.007.047-.01.073l.005.01c.081.419.062.325.143.984.038.323.088.651.124.971.066.534.102.8.179 1.616-.438.731-.544 1.007-.963 1.649l.023.059c.636-.024.782-.024 1.253-.024l.104-.117c.355-.771 3.062-5.448 3.062-5.448zm-23.005.453c.36-.253.405-.602.101-.782-.308-.182-.845-.125-1.208.128-.365.249-.406.6-.099.782.304.178.844.125 1.206-.128z\"/>\n      <path fill=\"#fefefe\" d=\"M41.651 17.886l-.53.912c-.167.311-.477.545-.971.547l-.843-.013.246-.822h.165c.085 0 .149-.006.198-.03.041-.014.073-.047.107-.096l.311-.498h1.318z\"/>\n    </symbol>\n\n    <symbol id=\"icon-american-express\" viewBox=\"0 0 55 32\">\n      <title>American Express</title>\n      <path fill=\"#fff\" d=\"M51.778 32H2.889c-1.222 0-2.222-.96-2.222-2.133V2.134c0-1.173 1-2.133 2.222-2.133h48.889C53 .001 54 .961 54 2.134v27.733C54 31.04 53 32 51.778 32z\"/>\n      <path fill=\"#1478be\" d=\"M9.013 16.427h3.083l-1.541-3.547zm28.125-3.125h-4.984v1.64h4.887v1.846H32.14v1.846h5.095v1.34c.831-1.025 1.772-1.955 2.7-2.98l.941-1.025c-1.246-1.34-2.492-2.775-3.738-4.101v1.435z\"/>\n      <path fill=\"#1478be\" d=\"M51.667 9.333h-7.473L42.423 11.2l-1.661-1.867h-17.45l-1.356 3.222-1.453-3.222H7.73L2.333 22h6.435l.83-2.074h1.868l.83 2.074h28.355l1.771-1.977L44.193 22h7.473l-5.812-6.223 5.812-6.444zm-23.581 10.8H26.01v-6.956l-3.114 6.956h-1.771l-3.114-6.956-.111 6.956h-4.262l-.83-2.074H8.449l-.941 2.074H5.225l3.847-9.03h3.224l3.529 8.311v-8.311h3.529l2.809 6.015 2.491-6.015h3.432v9.03zm19.637 0h-2.698l-2.698-3.015-2.698 3.015h-9.548v-9.03h9.964l2.394 2.904 2.698-2.904h2.698l-4.151 4.563 4.041 4.467z\"/>\n    </symbol>\n\n    <symbol id=\"icon-jcb\" viewBox=\"0 0 53 32\">\n      <title>JCB</title>\n      <path fill=\"#fff\" d=\"M51.111 32H2.222C1 32 0 31.04 0 29.867V2.134C0 .961 1 .001 2.222.001h48.889c1.222 0 2.222.96 2.222 2.133v27.733c0 1.173-1 2.133-2.222 2.133z\"/>\n      <path fill=\"#53b230\" d=\"M44.363 2.679h.018v.523c0 .478.001 22.023 0 22.228-.006 1.436-.684 2.803-1.829 3.661-.838.628-1.821.895-2.854.895-.582 0-6.444.033-6.473-.002-.012-.015 0-.091 0-.109V20.78c0-.051.007-.084.045-.084h7.004c1.157 0 1.792-.343 2.256-.814.586-.596.766-1.548.393-2.308-.32-.651-.981-1.04-1.659-1.217-.211-.055-.427-.091-.644-.111-.014-.001-.086.002-.095-.008-.04-.045.032-.054.052-.061.137-.044.287-.056.425-.098.711-.217 1.326-.727 1.518-1.472.199-.769-.066-1.591-.7-2.069-.454-.343-1.023-.501-1.582-.551-.57-.051-6.364-.029-6.943-.029-.098 0-.07-.027-.07-.118V7.507c0-.413.013-.821.099-1.227.167-.789.546-1.525 1.086-2.12.745-.82 1.782-1.346 2.881-1.457.636-.064 6.521-.022 7.072-.023zm-5.412 11.489c.079.362-.014.756-.273 1.024-.229.237-.54.333-.862.339-.26.005-2.3 0-2.384 0 0-.045.004-2.161.004-2.191.016-.036.024-.024.078-.024.131 0 2.286-.005 2.433.006.309.025.601.161.797.407.102.128.171.278.207.438zm-3.515 2.718c.575 0 2.303-.002 2.592 0 .322.002.624.083.868.304.301.272.436.686.377 1.087-.052.35-.259.665-.562.845-.25.148-.52.166-.802.166-.289 0-2.406.001-2.473.001 0-.045.001-2.38.001-2.402z\"/>\n      <path fill=\"#006cb9\" d=\"M8.766 18.518c-.08-.038-.079-.022-.094-.079-.009-.034-.007-11.152.004-11.41.054-1.269.649-2.476 1.614-3.291.688-.581 1.545-.948 2.44-1.039.528-.054 1.07-.023 1.6-.023.919 0 5.477-.018 5.494 0 .009.01.002 22.344 0 22.765-.006 1.275-.539 2.504-1.475 3.364-.674.62-1.534 1.027-2.44 1.148-.545.073-6.695.041-7.151.041-.087 0-.07.018-.087-.032-.011-.034 0-9.333 0-9.563.882.239 1.8.375 2.707.466.882.089 1.772.124 2.657.082 1.238-.058 2.595-.256 3.616-1.016.426-.317.766-.737.973-1.23.198-.471.267-.981.268-1.489.001-.463.008-5.238-.022-5.255s-3.846-.02-3.866.016c-.017.03.001 5.161 0 5.267-.004.626-.214 1.245-.686 1.669-.624.562-1.48.627-2.276.564-.916-.073-1.81-.326-2.657-.677-.21-.087-.416-.18-.621-.278z\"/>\n      <path fill=\"#e20138\" d=\"M21.265 13.113c-.032.026-.063.052-.094.078V8.068c0-.393-.016-.792.013-1.184.16-2.124 1.83-3.898 3.925-4.168.509-.066 7.196-.056 7.214-.035.011.013 0 .083 0 .099v22.609c-.001 1.738-.967 3.359-2.52 4.132-.673.335-1.394.469-2.14.469-.43 0-6.343.019-6.445 0-.068-.012-.031.013-.047-.03-.01-.027 0-8.729 0-9.92v-.561c.739.638 1.674.999 2.615 1.208.713.159 1.443.235 2.173.262.714.027 1.434.014 2.146-.05.728-.066 1.451-.181 2.167-.326.182-.037.364-.076.545-.118.045-.01.226-.025.25-.06.018-.026 0-.129 0-.159V18.47c-.775.389-1.588.7-2.439.87-1.039.207-2.189.264-3.18-.164-1.003-.434-1.599-1.364-1.699-2.449-.102-1.115.229-2.288 1.176-2.948.981-.685 2.267-.69 3.404-.509.846.134 1.661.408 2.434.776.102.049.204.099.305.15v-1.767c0-.028.018-.136 0-.159-.028-.037-.202-.05-.25-.061-.089-.02-.178-.04-.267-.059-.711-.153-1.429-.276-2.152-.354-.708-.077-1.422-.101-2.135-.087-.724.014-1.449.072-2.161.206-.881.166-1.76.449-2.511.954-.112.076-.221.156-.327.242z\"/>\n    </symbol>\n\n    <symbol id=\"icon-discover\" viewBox=\"0 0 53 32\">\n      <title>Discover</title>\n      <path fill=\"#fff\" d=\"M51.111 32H2.222C1 32 0 31.04 0 29.867V2.134C0 .961 1 .001 2.222.001h48.889c1.222 0 2.222.96 2.222 2.133v27.733c0 1.173-1 2.133-2.222 2.133z\"/>\n      <path fill=\"#f48024\" d=\"M51.993 15.667S36.696 26.799 8.667 31.334H50.66c.736 0 1.333-.597 1.333-1.333V15.668z\"/>\n      <path fill=\"#221f20\" d=\"M7.109 15.677c-.45.407-1.035.585-1.96.585h-.384V11.4h.384c.925 0 1.487.166 1.96.595.495.441.793 1.126.793 1.83 0 .706-.298 1.411-.793 1.853zm-1.673-5.523H3.334v7.352h2.091c1.112 0 1.915-.262 2.62-.849.838-.694 1.333-1.74 1.333-2.822 0-2.17-1.619-3.681-3.942-3.681zm4.604 7.353h1.432v-7.352H10.04zm4.93-4.531c-.86-.318-1.112-.528-1.112-.926 0-.463.45-.815 1.067-.815.429 0 .782.177 1.155.595l.75-.983c-.616-.539-1.353-.815-2.158-.815-1.299 0-2.29.903-2.29 2.107 0 1.013.462 1.532 1.807 2.016.561.198.846.33.99.419.286.187.429.452.429.761 0 .596-.473 1.037-1.112 1.037-.683 0-1.233-.342-1.563-.981l-.925.892c.66.97 1.453 1.4 2.542 1.4 1.488 0 2.532-.991 2.532-2.414 0-1.168-.483-1.697-2.112-2.294zm2.563.86c0 2.161 1.695 3.837 3.876 3.837.617 0 1.145-.121 1.796-.428v-1.688c-.573.574-1.08.805-1.729.805-1.443 0-2.466-1.047-2.466-2.536 0-1.412 1.056-2.525 2.4-2.525.683 0 1.2.244 1.796.827v-1.687c-.629-.319-1.146-.452-1.762-.452-2.17 0-3.91 1.71-3.91 3.848zm17.03 1.256l-1.957-4.939h-1.565l3.116 7.541h.771l3.172-7.541h-1.552zm4.184 2.415h4.061v-1.245h-2.631v-1.984h2.535v-1.245h-2.535v-1.632h2.631v-1.247h-4.061zm6.862-3.968h-.418v-2.227h.441c.892 0 1.377.374 1.377 1.09 0 .739-.485 1.137-1.4 1.137zm2.874-1.214c0-1.377-.947-2.171-2.599-2.171H43.76v7.353h1.431v-2.954h.187l1.982 2.954h1.761l-2.312-3.097c1.079-.22 1.673-.959 1.673-2.084z\"/>\n      <path fill=\"#f48024\" d=\"M31.469 13.835c0 2.159-1.747 3.909-3.904 3.909-2.156 0-3.904-1.75-3.904-3.909s1.748-3.909 3.904-3.909c2.157 0 3.904 1.75 3.904 3.909z\"/>\n    </symbol>\n\n    <symbol id=\"icon-diners-club\" viewBox=\"0 0 55 32\">\n      <title>Diners Club</title>\n      <path fill=\"#fff\" d=\"M51.778 32H2.889c-1.222 0-2.222-.96-2.222-2.133V2.134c0-1.173 1-2.133 2.222-2.133h48.889C53 .001 54 .961 54 2.134v27.733C54 31.04 53 32 51.778 32z\"/>\n      <path fill=\"#fefefe\" d=\"M11.36 15.773c0-7.275 6.053-13.172 13.519-13.172s13.519 5.897 13.519 13.172-6.052 13.173-13.519 13.173S11.36 23.048 11.36 15.773z\"/>\n      <path fill=\"#fff\" d=\"M42.696 29.333H10.667V2h32.029z\"/>\n      <path fill=\"#004a97\" d=\"M32.695 15.643c-.005-3.379-2.145-6.261-5.159-7.402v14.804c3.014-1.143 5.154-4.022 5.159-7.402zm-10.911 7.399v-14.8c-3.012 1.145-5.148 4.023-5.156 7.401.008 3.377 2.144 6.255 5.156 7.399zM24.661 3.13c-7 .003-12.67 5.602-12.672 12.513.001 6.91 5.672 12.508 12.672 12.51 7-.001 12.672-5.6 12.673-12.51-.002-6.91-5.674-12.51-12.673-12.513zm-.031 26.203c-7.659.036-13.964-6.09-13.964-13.548 0-8.15 6.304-13.787 13.964-13.786h3.59c7.569-.001 14.477 5.633 14.477 13.786 0 7.455-6.908 13.548-14.477 13.548h-3.59z\"/>\n    </symbol>\n\n    <symbol id=\"icon-maestro\" viewBox=\"0 0 55 32\">\n      <title>Maestro</title>\n      <path fill=\"#fff\" d=\"M51.778 32H2.889c-1.222 0-2.222-.96-2.222-2.133V2.134c0-1.173 1-2.133 2.222-2.133h48.889C53 .001 54 .961 54 2.134v27.733C54 31.04 53 32 51.778 32z\"/>\n      <path fill=\"#000\" d=\"M20.225 29.853v-1.855c.031-.618-.402-1.144-1.021-1.175h-.155c-.402-.031-.804.185-1.051.525-.216-.34-.588-.556-.99-.525-.34-.031-.68.155-.866.433v-.371h-.649v2.937h.649v-1.576c-.062-.371.216-.711.588-.773h.124c.433 0 .649.278.649.773v1.638h.649v-1.638c-.062-.371.216-.742.588-.773h.124c.433 0 .649.278.649.773v1.638l.711-.031zm3.618-1.453v-1.484h-.649v.371c-.216-.278-.557-.433-.928-.433-.866 0-1.546.68-1.546 1.546s.68 1.546 1.546 1.546c.371 0 .711-.155.928-.433v.371h.649V28.4zm-2.381 0c.031-.495.464-.866.959-.835s.866.464.835.958c-.031.464-.402.835-.897.835s-.897-.371-.897-.866c-.031-.062-.031-.062 0-.093zm16.112-1.545c.217 0 .433.031.619.124.186.062.371.185.495.34.155.155.247.309.34.495.155.402.155.835 0 1.236-.062.185-.186.34-.34.495s-.309.247-.495.34c-.402.155-.866.155-1.268 0-.186-.062-.371-.185-.495-.34-.155-.155-.247-.309-.34-.495-.155-.402-.155-.835 0-1.236.062-.185.186-.34.34-.495s.309-.247.495-.34c.216-.093.433-.155.649-.124zm0 .618c-.124 0-.247.031-.371.062s-.216.124-.309.185c-.093.093-.155.185-.186.309-.093.247-.093.525 0 .773.031.124.124.216.186.309.093.093.186.155.309.185.247.093.495.093.742 0 .124-.031.216-.124.309-.185.093-.093.155-.185.186-.309.093-.247.093-.525 0-.773-.031-.124-.124-.216-.186-.309-.093-.093-.186-.155-.309-.185-.124-.062-.247-.093-.371-.062zm-10.236.927c0-.927-.588-1.546-1.392-1.546-.866 0-1.546.711-1.515 1.576s.711 1.546 1.577 1.515c.433 0 .866-.124 1.206-.402l-.309-.464c-.247.185-.557.309-.866.309-.433.031-.835-.278-.897-.711h2.196v-.278zm-2.196-.278c.031-.402.371-.711.773-.711s.742.309.742.711h-1.515zm4.886-.464c-.278-.155-.588-.247-.928-.247s-.557.124-.557.34c0 .216.216.247.495.278l.309.031c.649.093 1.021.371 1.021.896s-.495.958-1.361.958c-.464 0-.897-.124-1.268-.371l.309-.495c.278.216.619.309.99.309.433 0 .68-.124.68-.371 0-.155-.155-.247-.526-.309l-.309-.031c-.649-.093-1.021-.402-1.021-.866 0-.587.495-.958 1.237-.958.433 0 .835.093 1.206.309l-.278.525zm3.093-.154H32.07v1.329c0 .309.093.495.433.495.186 0 .402-.062.557-.155l.186.556c-.247.155-.526.216-.804.216-.773 0-1.021-.402-1.021-1.082v-1.36h-.588v-.587h.588v-.896h.649v.896h1.051v.587zm2.227-.68c.155 0 .309.031.464.093l-.186.618c-.124-.062-.278-.062-.402-.062-.433 0-.618.278-.618.773v1.669h-.649v-2.937h.649v.371c.155-.34.433-.495.742-.525z\"/>\n      <path fill=\"#7673c0\" d=\"M32.188 4.383h-9.741v17.496h9.741z\"/>\n      <path fill=\"#eb001b\" d=\"M23.067 13.13c0-3.4 1.577-6.646 4.268-8.748C22.511.58 15.49 1.415 11.718 6.268c-3.804 4.822-2.969 11.839 1.886 15.61 4.051 3.184 9.711 3.184 13.762 0-2.721-2.102-4.299-5.317-4.299-8.748z\"/>\n      <path fill=\"#00a1df\" d=\"M45.332 13.13c0 6.151-4.979 11.128-11.133 11.128-2.505 0-4.917-.835-6.865-2.38 4.824-3.771 5.659-10.788 1.886-15.61-.557-.711-1.175-1.329-1.886-1.886C32.158.58 39.179 1.415 42.982 6.268c1.515 1.947 2.35 4.389 2.35 6.862z\"/>\n    </symbol>\n\n    <symbol id=\"logoPayPal\" viewBox=\"0 0 51 32\">\n      <title>PayPal Logo</title>\n      <path fill=\"#fff\" fill-opacity=\"0\" d=\"M49.067 32H2.134C.961 32 .001 31.04.001 29.867V2.134C.001.961.961.001 2.134.001h46.933c1.173 0 2.133.96 2.133 2.133v27.733c0 1.173-.96 2.133-2.133 2.133z\"/>\n      <path fill=\"#263b80\" d=\"M33.817 18.56c.427-.747.747-1.6.96-2.56.213-.853.213-1.707.107-2.347-.107-.747-.427-1.28-.853-1.813-.213-.32-.64-.533-.96-.747.107-.853.107-1.6 0-2.24s-.427-1.173-.96-1.707c-.96-1.067-2.773-1.707-5.333-1.707h-6.933c-.533 0-.853.32-.96.853l-2.88 18.347c0 .213 0 .32.107.427s.32.213.427.213h4.373l-.32 1.92c0 .107 0 .32.107.427s.213.213.427.213h3.627c.427 0 .747-.32.853-.747v-.213l.64-4.373v-.213c.107-.427.427-.747.853-.747h.64c1.813 0 3.413-.427 4.48-1.173.64-.533 1.173-1.067 1.6-1.813z\"/>\n      <path fill=\"#263b80\" d=\"M23.144 11.094c0-.32.213-.533.533-.64.107-.107.213-.107.427-.107h5.44c.64 0 1.28 0 1.813.107.107 0 .32.107.427.107s.32.107.427.107c.107 0 .107 0 .213.107.32.107.533.213.747.32.32-1.707 0-2.88-.96-4.053-1.067-1.173-2.88-1.707-5.333-1.707h-6.933c-.533 0-.96.32-.96.853l-2.987 18.453c-.107.32.213.64.64.64h4.267l1.067-6.827 1.173-7.36z\"/>\n      <path fill=\"#159bd7\" d=\"M33.067 11.094c0 .107 0 .32-.107.427-.96 4.693-4.053 6.293-8.107 6.293h-2.027c-.533 0-.853.32-.96.853l-1.067 6.613-.32 1.92c0 .32.213.64.533.64h3.627c.427 0 .747-.32.853-.747v-.213l.64-4.373v-.213c.107-.427.427-.747.853-.747h.747c3.52 0 6.293-1.387 7.04-5.547.32-1.707.213-3.2-.747-4.16-.213-.32-.533-.533-.96-.747z\"/>\n      <path fill=\"#232c65\" d=\"M32.105 10.666c-.107 0-.32-.107-.427-.107s-.32-.107-.427-.107c-.533-.107-1.173-.107-1.813-.107h-5.44c-.107 0-.213 0-.427.107s-.427.32-.533.64l-1.173 7.36v.213c.107-.533.533-.853.96-.853h2.027c4.053 0 7.147-1.6 8.107-6.293 0-.107 0-.32.107-.427-.213-.107-.533-.213-.747-.32 0-.107-.107-.107-.213-.107z\"/>\n    </symbol>\n\n    <symbol id=\"logoPayPalCredit\" viewBox=\"0 0 125 45\">\n      <title>PayPal Credit Logo</title>\n      <path fill=\"#27346A\" d=\"M69.11 47.383h1.53c4.07 0 7.894-2.225 8.73-7.337.73-4.694-1.95-7.337-6.33-7.337h-1.123c-.275 0-.508.2-.55.47L69.11 47.383zm-3.708-19.64c.074-.464.474-.806.945-.806h8.85c7.3 0 12.412 5.737 11.265 13.11-1.182 7.37-8.137 13.108-15.404 13.108h-9.013c-.343 0-.605-.306-.55-.644L65.4 27.745zM53.943 33.516l-.567 3.574h7.032c.342 0 .604.306.55.645l-.675 4.32c-.073.465-.474.808-.945.808h-6.052c-.47 0-.87.34-.944.804l-.6 3.716h7.45c.34 0 .603.306.55.645l-.676 4.32c-.073.464-.474.807-.945.807H44.676c-.343 0-.604-.306-.55-.644l3.908-24.766c.073-.465.474-.807.944-.807h13.448c.342 0 .604.306.55.644L62.3 31.9c-.073.466-.475.81-.946.81h-6.466c-.47 0-.87.34-.945.806M92.413 53.155h-5.345c-.343 0-.605-.306-.55-.644l3.907-24.766c.074-.465.474-.807.945-.807h5.345c.343 0 .604.306.55.645L93.36 52.348c-.074.465-.474.807-.945.807M30.562 38.69h.66c2.226 0 4.786-.42 5.25-3.27.466-2.85-1.018-3.26-3.396-3.267h-.966c-.29 0-.538.21-.584.5l-.964 6.037zm11.7 14.465h-7.005c-.298 0-.57-.17-.698-.44l-4.624-9.644h-.07l-1.495 9.432c-.06.376-.383.653-.764.653h-5.5c-.344 0-.606-.306-.552-.644l3.932-24.92c.06-.376.385-.653.765-.653h9.528c5.18 0 8.727 2.468 7.858 8.067-.59 3.616-3.095 6.746-6.92 7.407l6.022 9.898c.226.37-.042.847-.477.847zM106.87 53.155h-5.346c-.343 0-.605-.306-.55-.644l3.13-19.8h-4.98c-.343 0-.605-.307-.552-.645l.677-4.32c.072-.465.473-.808.944-.808h16.61c.343 0 .605.306.55.644l-.675 4.32c-.074.466-.475.81-.946.81h-4.815l-3.107 19.64c-.073.463-.474.805-.944.805M21.902 34.388c-.08.486-.674.66-1.018.308-1.168-1.197-2.882-1.83-4.726-1.83-4.17 0-7.47 3.197-8.13 7.262-.625 4.134 1.737 7.122 5.975 7.122 1.748 0 3.602-.665 5.142-1.776.425-.307 1.01.06.925.578l-.97 6c-.057.356-.316.65-.663.75-2.075.61-3.67 1.05-5.614 1.05C1.52 53.85-.287 44.196.296 40.09 1.93 28.586 11.266 25.95 16.99 26.267c1.846.102 3.498.348 5.116.956.523.197.835.736.746 1.287l-.95 5.878\"/>\n      <path fill=\"#2790C3\" d=\"M56.532 6.217c-.323 2.12-1.94 2.12-3.507 2.12h-.89l.625-3.958c.037-.24.243-.416.486-.416h.408c1.066 0 2.072 0 2.59.607.312.365.406.903.288 1.647zm-.68-5.53h-5.905c-.404 0-.747.295-.81.694L46.75 16.52c-.048.297.183.567.485.567h3.03c.282 0 .522-.205.567-.484l.677-4.292c.06-.398.405-.692.81-.692h1.867c3.89 0 6.133-1.88 6.72-5.61.264-1.633.01-2.914-.753-3.812-.84-.986-2.328-1.508-4.303-1.508z\"/>\n      <path fill=\"#27346A\" d=\"M14.423 6.217c-.322 2.12-1.94 2.12-3.506 2.12h-.89l.624-3.958c.038-.24.245-.416.487-.416h.408c1.066 0 2.072 0 2.59.607.312.365.406.903.288 1.647zm-.68-5.53H7.837c-.404 0-.747.295-.81.694L4.64 16.52c-.047.297.184.567.486.567h2.82c.403 0 .747-.293.81-.692L9.4 12.31c.063-.398.406-.692.81-.692h1.868c3.89 0 6.133-1.88 6.72-5.61.264-1.633.01-2.914-.753-3.812-.84-.986-2.328-1.508-4.303-1.508zM27.448 11.65c-.273 1.617-1.555 2.7-3.19 2.7-.82 0-1.477-.263-1.9-.762-.417-.495-.575-1.2-.442-1.986.255-1.6 1.558-2.72 3.168-2.72.803 0 1.455.266 1.885.77.432.508.602 1.218.478 2zm3.94-5.5H28.56c-.24 0-.447.175-.485.414l-.124.79-.197-.285c-.612-.89-1.977-1.187-3.34-1.187-3.122 0-5.79 2.367-6.31 5.686-.27 1.655.114 3.238 1.053 4.342.862 1.015 2.093 1.438 3.56 1.438 2.518 0 3.914-1.618 3.914-1.618l-.126.786c-.047.3.183.57.486.57h2.546c.404 0 .747-.294.81-.693l1.528-9.677c.047-.3-.183-.57-.486-.57z\"/>\n      <path fill=\"#2790C3\" d=\"M69.557 11.65c-.273 1.617-1.555 2.7-3.19 2.7-.82 0-1.477-.263-1.9-.762-.418-.495-.575-1.2-.442-1.986.254-1.6 1.557-2.72 3.168-2.72.803 0 1.455.266 1.885.77.433.508.603 1.218.48 2zm3.94-5.5H70.67c-.242 0-.45.175-.486.414l-.125.79-.198-.285c-.612-.89-1.977-1.187-3.34-1.187-3.122 0-5.79 2.367-6.31 5.686-.27 1.655.113 3.238 1.052 4.342.863 1.015 2.094 1.438 3.56 1.438 2.518 0 3.915-1.618 3.915-1.618l-.128.786c-.047.3.184.57.486.57h2.546c.404 0 .748-.294.81-.693l1.53-9.677c.046-.3-.185-.57-.487-.57z\"/>\n      <path fill=\"#27346A\" d=\"M46.445 6.15h-2.84c-.273 0-.527.134-.68.36l-3.92 5.772-1.66-5.548c-.105-.347-.424-.585-.787-.585h-2.793c-.337 0-.574.33-.466.65l3.128 9.184-2.943 4.152c-.23.326.002.777.402.777h2.84c.267 0 .52-.132.673-.353l9.45-13.638c.226-.327-.008-.773-.405-.773\"/>\n      <path fill=\"#2790C3\" d=\"M76.83 1.104L74.405 16.52c-.047.297.184.567.486.567h2.437c.403 0 .746-.293.81-.692l2.388-15.138c.048-.3-.183-.57-.486-.57h-2.727c-.242 0-.448.177-.486.417\"/>\n    </symbol>\n\n    <symbol id=\"iconCardFront\" viewBox=\"0 0 53 32\">\n      <title>Generic Card</title>\n      <path fill=\"#fff\" d=\"M51.308 32H2.025C1 32 0 31.04 0 30V2C0 .96 1 0 2.025 0h49.283c1.025 0 2.025.96 2.025 2v28c0 1.04-1 2-2.025 2z\"/>\n      <path fill=\"#828282\" d=\"M5.333 10.444c0-.486.635-1.111 1.185-1.111h8.296c.55 0 1.185.625 1.185 1.111v4.444c0 .486-.635 1.111-1.185 1.111H6.518c-.55 0-1.185-.625-1.185-1.111v-4.444zm8 14.889h1.333c.736 0 1.333.597 1.333 1.333s-.597 1.333-1.333 1.333h-1.333c-.736 0-1.333-.597-1.333-1.333s.597-1.333 1.333-1.333zm-6.666 0H8c.736 0 1.333.597 1.333 1.333S8.736 27.999 8 27.999H6.667c-.736 0-1.333-.597-1.333-1.333s.597-1.333 1.333-1.333zm-1.334-4.666c0-1.105.891-2 2.001-2h38.665c1.105 0 2.001.888 2.001 2 0 1.105-.891 2-2.001 2H7.334c-1.105 0-2.001-.888-2.001-2zM48 7.333c0 1.841-1.492 3.333-3.333 3.333s-3.333-1.492-3.333-3.333C41.334 5.492 42.826 4 44.667 4S48 5.492 48 7.333z\"/>\n    </symbol>\n\n    <symbol id=\"iconCVVBack\" viewBox=\"0 0 53 32\">\n      <title>CVV Back</title>\n      <path fill=\"#fff\" d=\"M51.308 32H2.025C1 32 0 31.04 0 30V2C0 .96 1 0 2.025 0h49.283c1.025 0 2.025.96 2.025 2v28c0 1.04-1 2-2.025 2z\"/>\n      <path fill=\"#828282\" d=\"M0 6.667h53.333V12H0V6.667z\"/>\n      <path fill=\"#000\" d=\"M26.667 18.362v7.276c0 .563.492 1.029 1.092 1.029h17.816c.598 0 1.092-.465 1.092-1.029v-7.276c0-.563-.492-1.029-1.092-1.029H27.759c-.598 0-1.092.465-1.092 1.029zm-1.334-.189c0-1.2 1.013-2.173 2.239-2.173H45.76c1.237 0 2.239.982 2.239 2.173v7.654c0 1.2-1.013 2.173-2.239 2.173H27.572c-1.237 0-2.239-.982-2.239-2.173v-7.654z\"/>\n      <path fill=\"#828282\" d=\"M33.333 22c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zm5.334 0c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zM44 22c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2z\"/>\n    </symbol>\n\n    <symbol id=\"iconCVVFront\" viewBox=\"0 0 53 32\">\n      <title>CVV Front</title>\n      <path fill=\"#fff\" d=\"M51.308 32H2.025C1 32 0 31.04 0 30V2C0 .96 1 0 2.025 0h49.283c1.025 0 2.025.96 2.025 2v28c0 1.04-1 2-2.025 2z\"/>\n      <path fill=\"#000\" d=\"M21.333 7.695v7.276c0 .563.488 1.029 1.081 1.029h23.172c.592 0 1.081-.463 1.081-1.029V7.695c0-.563-.488-1.029-1.081-1.029H22.414c-.592 0-1.081.463-1.081 1.029zM20 7.506c0-1.2.998-2.173 2.212-2.173h23.576c1.222 0 2.212.982 2.212 2.173v7.654c0 1.2-.998 2.173-2.212 2.173H22.212c-1.222 0-2.212-.982-2.212-2.173V7.506z\"/>\n      <path fill=\"#828282\" d=\"M28 11.333c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zm10.667 0c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zm-5.334 0c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zm10.667 0c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zm-38.667-.889c0-.486.635-1.111 1.185-1.111h8.296c.55 0 1.185.625 1.185 1.111v4.444c0 .486-.635 1.111-1.185 1.111H6.518c-.55 0-1.185-.625-1.185-1.111v-4.444zm0 14.223c0-1.105.891-2 2.001-2h38.665c1.105 0 2.001.888 2.001 2 0 1.105-.891 2-2.001 2H7.334c-1.105 0-2.001-.888-2.001-2z\"/>\n    </symbol>\n\n    <symbol id=\"iconCheck\" viewBox=\"0 0 42 32\">\n      <title>Check</title>\n      <path class=\"path1\" d=\"M14.379 29.76L39.741 3.415 36.194.001l-21.815 22.79-10.86-11.17L0 15.064z\"/>\n    </symbol>\n\n    <symbol id=\"iconLockLoader\" viewBox=\"0 0 28 32\">\n      <title>Lock Loader</title>\n      <path d=\"M6 10V8c0-4.422 3.582-8 8-8 4.41 0 8 3.582 8 8v2h-4V7.995C18 5.79 16.205 4 14 4c-2.21 0-4 1.792-4 3.995V10H6zM.997 14c-.55 0-.997.445-.997.993v16.014c0 .548.44.993.997.993h26.006c.55 0 .997-.445.997-.993V14.993c0-.548-.44-.993-.997-.993H.997z\"/>\n    </symbol>\n\n    <symbol id=\"iconError\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\">\n      <path d=\"M0 0h24v24H0z\" fill=\"none\"/>\n      <path d=\"M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z\"/>\n    </symbol>\n  </defs>\n</svg>\n";

var UPDATABLE_CONFIGURATION_OPTIONS = [
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit
];
var UPDATABLE_CONFIGURATION_OPTIONS_THAT_REQUIRE_UNVAULTED_PAYMENT_METHODS_TO_BE_REMOVED = [
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit
];
var DEFAULT_CHECKOUTJS_LOG_LEVEL = 'warn';
var VERSION = "1.1.0";

/**
 * @typedef {object} Dropin~cardPaymentMethodPayload
 * @property {string} nonce The payment method nonce.
 * @property {object} details Additional account details.
 * @property {string} details.cardType Type of card, e.g. Visa, MasterCard.
 * @property {string} details.lastTwo Last two digits of card number.
 * @property {string} description A human-readable description.
 * @property {string} type The payment method type, always `CreditCard` when the method requested is a card.
 */

/**
 * @typedef {object} Dropin~paypalPaymentMethodPayload
 * @property {string} nonce The payment method nonce.
 * @property {object} details Additional PayPal account details. See a full list of details in the [PayPal client reference](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#~tokenizePayload).
 * @property {string} type The payment method type, always `PayPalAccount` when the method requested is a PayPal account.
 */

/**
 * @name Dropin#on
 * @function
 * @param {string} event The name of the event to which you are subscribing.
 * @param {function} handler A callback to handle the event.
 * @description Subscribes a handler function to a named event. `event` should be {@link HostedFields#event:paymentMethodRequestable|`paymentMethodRequestable`} or {@link HostedFields#event:noPaymentMethodRequestable|`noPaymentMethodRequestable`}.
 * @returns {void}
 * @example
 * <caption>Dynamically enable or disable your submit button based on whether or not the payment method is requestable</caption>
 * var submitButton = document.querySelector('#submit-button');
 *
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container'
 * }, function (err, dropinInstance) {
 *   submitButton.addEventListener('click', function () {
 *     dropinInstance.requestPaymentMethod(function (err, payload) {
 *       // Send payload.nonce to your server.
 *     });
 *   });
 *
 *   if (dropinInstance.isPaymentMethodRequestable()) {
 *     // This will be true if you generated the client token
 *     // with a customer ID and there is a saved payment method
 *     // available to tokenize with that customer.
 *     submitButton.removeAttribute('disabled');
 *   }
 *
 *   dropinInstance.on('paymentMethodRequestable', function (event) {
 *     console.log(event.type); // The type of Payment Method, e.g 'CreditCard', 'PayPalAccount'.
 *
 *     submitButton.removeAttribute('disabled');
 *   });
 *
 *   dropinInstance.on('noPaymentMethodRequestable', function () {
 *     submitButton.setAttribute('disabled', true);
 *   });
 * });
 */

/**
 * This event is emitted when the payment method available in Drop-in changes. This includes when the state of Drop-in transitions from having no payment method available to having a payment method available and when the payment method available changes. This event is not fired if there is no payment method available on initialization. To check if there is a payment method requestable on initialization, use {@link Dropin#isPaymentMethodRequestable|`isPaymentMethodRequestable`}.
 * @event Dropin#paymentMethodRequestable
 * @type {Dropin~paymentMethodRequestablePayload}
 */

/**
 * @typedef {object} Dropin~paymentMethodRequestablePayload
 * @description The event payload sent from {@link Dropin#on|`on`} with the {@link Dropin#event:paymentMethodRequestable|`paymentMethodRequestable`} event.
 * @property {string} type The type of payment method that is requestable. Either `CreditCard` or `PayPalAccount`.
 */

/**
 * This event is emitted when there is no payment method available in Drop-in. This event is not fired if there is no payment method available on initialization. To check if there is a payment method requestable on initialization, use {@link Dropin#isPaymentMethodRequestable|`isPaymentMethodRequestable`}. No payload is available in the callback for this event.
 * @event Dropin#noPaymentMethodRequestable
 */

/**
 * @class
 * @param {object} options For create options, see {@link module:braintree-web-drop-in|dropin.create}.
 * @description <strong>Do not use this constructor directly. Use {@link module:braintree-web-drop-in|dropin.create} instead.</strong>
 * @classdesc This class represents a Drop-in component, that will create a pre-made UI for accepting cards and PayPal on your page. Instances of this class have methods for requesting a payment method and subscribing to events. For more information, see the [Drop-in guide](https://developers.braintreepayments.com/guides/drop-in/javascript/v3) in the Braintree Developer Docs. To be used in conjunction with the [Braintree Server SDKs](https://developers.braintreepayments.com/start/hello-server/).
 */
function Dropin(options) {
  this._client = options.client;
  this._componentID = uuid();
  this._dropinWrapper = document.createElement('div');
  this._dropinWrapper.id = 'braintree--dropin__' + this._componentID;
  this._dropinWrapper.setAttribute('data-braintree-id', 'wrapper');
  this._dropinWrapper.style.display = 'none';
  this._dropinWrapper.className = 'braintree-loading';
  this._merchantConfiguration = options.merchantConfiguration;

  EventEmitter.call(this);
}

Dropin.prototype = Object.create(EventEmitter.prototype, {
  constructor: Dropin
});

Dropin.prototype._initialize = function (callback) {
  var localizedStrings, localizedHTML, strings;
  var dropinInstance = this; // eslint-disable-line consistent-this
  var container = this._merchantConfiguration.container || this._merchantConfiguration.selector;

  this._injectStylesheet();

  if (!container) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('options.container is required.'));
    return;
  } else if (this._merchantConfiguration.container && this._merchantConfiguration.selector) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('Must only have one options.selector or options.container.'));
    return;
  }

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }

  if (!container || container.nodeType !== 1) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('options.selector or options.container must reference a valid DOM node.'));
    return;
  }

  if (container.innerHTML.trim()) {
    analytics.sendEvent(this._client, 'configuration-error');
    callback(new DropinError('options.selector or options.container must reference an empty DOM node.'));
    return;
  }

  // Backfill with `en`
  strings = assign({}, translations.en);
  if (this._merchantConfiguration.locale) {
    localizedStrings = translations[this._merchantConfiguration.locale] || translations[this._merchantConfiguration.locale.split('_')[0]];
    // Fill `strings` with `localizedStrings` that may exist
    strings = assign(strings, localizedStrings);
  }

  localizedHTML = Object.keys(strings).reduce(function (result, stringKey) {
    var stringValue = strings[stringKey];

    return result.replace(RegExp('{{' + stringKey + '}}', 'g'), stringValue);
  }, mainHTML);

  this._dropinWrapper.innerHTML = svgHTML + localizedHTML;
  container.appendChild(this._dropinWrapper);

  this._getVaultedPaymentMethods(function (paymentMethods) {
    var paypalRequired;

    try {
      this._model = new DropinModel({
        client: this._client,
        componentID: this._componentID,
        merchantConfiguration: this._merchantConfiguration,
        paymentMethods: paymentMethods
      });
    } catch (modelError) {
      dropinInstance.teardown(function () {
        callback(modelError);
      });
      return;
    }

    this._model.on('asyncDependenciesReady', function () {
      if (this._model.dependencySuccessCount >= 1) {
        analytics.sendEvent(this._client, 'appeared');
        this._disableErroredPaymentMethods();
        callback(null, dropinInstance);
      } else {
        analytics.sendEvent(this._client, 'load-error');
        this._dropinWrapper.innerHTML = '';
        callback(new DropinError('All payment options failed to load.'));
      }
    }.bind(this));

    this._model.on('paymentMethodRequestable', function (event) {
      this._emit('paymentMethodRequestable', event);
    }.bind(this));

    this._model.on('noPaymentMethodRequestable', function () {
      this._emit('noPaymentMethodRequestable');
    }.bind(this));

    function createMainView() {
      dropinInstance._mainView = new MainView({
        client: dropinInstance._client,
        element: dropinInstance._dropinWrapper,
        model: dropinInstance._model,
        strings: strings
      });
    }

    paypalRequired = this._supportsPaymentOption(paymentOptionIDs.paypal) || this._supportsPaymentOption(paymentOptionIDs.paypalCredit);

    if (paypalRequired && !document.querySelector('#' + constants.PAYPAL_CHECKOUT_SCRIPT_ID)) {
      this._loadPayPalScript(createMainView);
    } else {
      createMainView();
    }
  }.bind(this));
};

/**
 * Modify your configuration intially set in {@link module:braintree-web-drop-in|`dropin.create`}. Can be used for any `paypal` or `paypalCredit` property.
 *
 * If `updateConfiguration` is called after a user completes the PayPal authorization flow, any PayPal accounts not stored in the Vault record will be removed.
 * @public
 * @param {string} property The top-level property to update. Either `paypal` or `paypalCredit`.
 * @param {string} key The key of the property to update, such as `amount` or `currency`.
 * @param {string|number} value The value of the property to update. Must be the type of the property specified in {@link module:braintree-web-drop-in|`dropin.create`}.
 * @returns {void}
 */
Dropin.prototype.updateConfiguration = function (property, key, value) {
  var isOnMethodsView, hasNoSavedPaymentMethods, hasOnlyOneSupportedPaymentOption;

  if (UPDATABLE_CONFIGURATION_OPTIONS.indexOf(property) === -1) {
    return;
  }

  this._mainView.getView(property).updateConfiguration(key, value);

  if (UPDATABLE_CONFIGURATION_OPTIONS_THAT_REQUIRE_UNVAULTED_PAYMENT_METHODS_TO_BE_REMOVED.indexOf(property) === -1) {
    return;
  }

  this._model.getPaymentMethods().forEach(function (paymentMethod) {
    if (paymentMethod.type === constants.paymentMethodTypes[property] && !paymentMethod.vaulted) {
      this._model.removePaymentMethod(paymentMethod);
    }
  }.bind(this));

  isOnMethodsView = this._mainView.primaryView.ID === paymentMethodsViewID;

  if (isOnMethodsView) {
    hasNoSavedPaymentMethods = this._model.getPaymentMethods().length === 0;

    if (hasNoSavedPaymentMethods) {
      hasOnlyOneSupportedPaymentOption = this._model.supportedPaymentOptions.length === 1;

      if (hasOnlyOneSupportedPaymentOption) {
        this._mainView.setPrimaryView(this._model.supportedPaymentOptions[0]);
      } else {
        this._mainView.setPrimaryView(paymentOptionsViewID);
      }
    }
  }
};

Dropin.prototype._supportsPaymentOption = function (paymentOption) {
  return this._model.supportedPaymentOptions.indexOf(paymentOption) !== -1;
};

Dropin.prototype._loadPayPalScript = function (callback) {
  var script = document.createElement('script');

  script.src = constants.CHECKOUT_JS_SOURCE;
  script.id = constants.PAYPAL_CHECKOUT_SCRIPT_ID;
  script.async = true;
  script.addEventListener('load', callback);
  script.setAttribute('data-log-level', this._merchantConfiguration.paypal.logLevel || DEFAULT_CHECKOUTJS_LOG_LEVEL);
  this._dropinWrapper.appendChild(script);
};

Dropin.prototype._disableErroredPaymentMethods = function () {
  var paymentMethodOptionsElements;
  var failedDependencies = Object.keys(this._model.failedDependencies);

  if (failedDependencies.length === 0) {
    return;
  }

  paymentMethodOptionsElements = this._mainView.getOptionsElements();

  failedDependencies.forEach(function (paymentMethodId) {
    var element = paymentMethodOptionsElements[paymentMethodId];
    var div = element.div;
    var clickHandler = element.clickHandler;
    var error = this._model.failedDependencies[paymentMethodId].message;

    div.classList.add('braintree-disabled');
    div.removeEventListener('click', clickHandler);
    div.querySelector('.braintree-option__disabled-message').textContent = error;
  }.bind(this));
};

/**
 * Requests a payment method object which includes the payment method nonce used by by the [Braintree Server SDKs](https://developers.braintreepayments.com/start/hello-server/). The structure of this payment method object varies by type: a {@link Dropin~cardPaymentMethodPayload|cardPaymentMethodPayload} is returned when the payment method is a card, a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload} is returned when the payment method is a PayPal account. If a payment method is not available, an error will appear in the UI and and error will be returned in the callback.
 * @public
 * @param {callback} callback The first argument will be an error if no payment method is available and will otherwise be null. The second argument will be an object containing a payment method nonce; either a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload} or a {@link Dropin~paypalPaymentMethodPayload|paypalPaymentMethodPayload}.
 * @returns {void}
 */
Dropin.prototype.requestPaymentMethod = function (callback) {
  this._mainView.requestPaymentMethod(callback);
};

Dropin.prototype._removeStylesheet = function () {
  var stylesheet = document.getElementById(constants.STYLESHEET_ID);

  if (stylesheet) {
    stylesheet.parentNode.removeChild(stylesheet);
  }
};

Dropin.prototype._injectStylesheet = function () {
  var stylesheet, stylesheetUrl, head, assetsUrl;

  if (document.getElementById(constants.STYLESHEET_ID)) { return; }

  assetsUrl = this._client.getConfiguration().gatewayConfiguration.assetsUrl;
  stylesheetUrl = assetsUrl + '/web/dropin/' + VERSION + '/css/dropin.css';
  stylesheet = document.createElement('link');
  head = document.head;

  stylesheet.setAttribute('rel', 'stylesheet');
  stylesheet.setAttribute('type', 'text/css');
  stylesheet.setAttribute('href', stylesheetUrl);
  stylesheet.setAttribute('id', constants.STYLESHEET_ID);

  if (head.firstChild) {
    head.insertBefore(stylesheet, head.firstChild);
  } else {
    head.appendChild(stylesheet);
  }
};

Dropin.prototype._getVaultedPaymentMethods = function (callback) {
  if (isGuestCheckout(this._client)) {
    callback([]);
  } else {
    this._client.request({
      endpoint: 'payment_methods',
      method: 'get',
      data: {
        defaultFirst: 1
      }
    }, function (err, paymentMethodsPayload) {
      var paymentMethods;

      if (err) {
        paymentMethods = [];
      } else {
        paymentMethods = paymentMethodsPayload.paymentMethods.map(formatPaymentMethodPayload);
      }

      callback(paymentMethods);
    });
  }
};

/**
 * Cleanly remove anything set up by {@link module:braintree-web-drop-in|dropin.create}. This may be be useful in a single-page app.
 * @public
 * @param {callback} [callback] Called on completion, containing an error if one occurred. No data is returned if teardown completes successfully.
 * @returns {void}
 */
Dropin.prototype.teardown = function (callback) {
  this._removeStylesheet();

  if (this._mainView) {
    this._mainView.teardown(function (err) {
      this._removeDropinWrapper(err, callback);
    }.bind(this));
  } else {
    this._removeDropinWrapper(null, callback);
  }
};

/**
 * Returns a boolean indicating if a payment method is available through {@link Dropin#requestPaymentMethod|requestPaymentMethod}. Particularly useful for detecting if using a client token with a customer ID to show vaulted payment methods.
 * @public
 * @returns {Boolean} True if a payment method is available, otherwise false.
 */
Dropin.prototype.isPaymentMethodRequestable = function () {
  return this._model.isPaymentMethodRequestable();
};

Dropin.prototype._removeDropinWrapper = function (err, callback) {
  this._dropinWrapper.parentNode.removeChild(this._dropinWrapper);
  callback(err);
};

function formatPaymentMethodPayload(paymentMethod) {
  var formattedPaymentMethod = {
    nonce: paymentMethod.nonce,
    details: paymentMethod.details,
    type: paymentMethod.type,
    vaulted: true
  };

  if (paymentMethod.type === constants.paymentMethodTypes.card) {
    formattedPaymentMethod.description = paymentMethod.description;
  }

  return formattedPaymentMethod;
}

module.exports = Dropin;

},{"./constants":71,"./dropin-model":72,"./lib/analytics":76,"./lib/assign":77,"./lib/dropin-error":81,"./lib/event-emitter":82,"./lib/is-guest-checkout":83,"./lib/uuid":87,"./translations":97,"./views/main-view":113,"./views/payment-methods-view":115,"./views/payment-options-view":116}],74:[function(require,module,exports){
'use strict';
/**
 * @module braintree-web-drop-in
 */

var Dropin = require('./dropin');
var client = require('braintree-web/client');
var deferred = require('./lib/deferred');
var constants = require('./constants');
var analytics = require('./lib/analytics');
var DropinError = require('./lib/dropin-error');

var VERSION = "1.1.0";

/**
 * @static
 * @function create
 * @description This function is the entry point for `braintree.dropin`. It is used for creating {@link Dropin} instances.
 * @param {object} options Object containing all {@link Dropin} options:
 * @param {string} options.authorization A [tokenization key](https://developers.braintreepayments.com/guides/authorization/tokenization-key/javascript/v3) or a [client token](https://developers.braintreepayments.com/guides/authorization/client-token). If authorization is a client token created with a [customer ID](https://developers.braintreepayments.com/guides/drop-in/javascript/v3#customer-id), Drop-in will render saved payment methods and automatically store any newly-added payment methods in their Vault record.
 * @param {string|HTMLElement} options.container A reference to an empty element, such as a `<div>`, where Drop-in will be included on your page or the selector for the empty element. e.g. `#dropin-container`.
 * @param {string} options.selector Deprecated: Now an alias for `options.container`.
 * @param {string} [options.locale=`en_US`] Use this option to change the language, links, and terminology used throughout Drop-in. Supported locales include:
 * `da_DK`,
 * `de_DE`,
 * `en_US`,
 * `en_AU`,
 * `en_GB`,
 * `es_ES`,
 * `fr_CA`,
 * `fr_FR`,
 * `id_ID`,
 * `it_IT`,
 * `ja_JP`,
 * `ko_KR`,
 * `nl_NL`,
 * `no_NO`,
 * `pl_PL`,
 * `pt_BR`,
 * `pt_PT`,
 * `ru_RU`,
 * `sv_SE`,
 * `th_TH`,
 * `zh_CN`,
 * `zh_HK`,
 * `zh_TW`.
 * @param {array} [options.paymentOptionPriority] Use this option to indicate the order in which enabled payment options should appear when multiple payment options are enabled. By default, payment options will appear in this order: `['card', 'paypal', 'paypalCredit']`. Payment options omitted from this array will not be offered to the customer.
 *
 * @param {object} [options.paypal] The configuration options for PayPal. To include a PayPal option in your Drop-in integration, include the `paypal` parameter and [enable PayPal in the Braintree Control Panel](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#go-live). To test in Sandbox, you will need to [link a PayPal sandbox test account to your Braintree sandbox account](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#linked-paypal-testing).
 *
 * Some of the PayPal configuration options are listed here, but for a full list see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#createPayment).
 * @param {string} options.paypal.flow Either `checkout` for a one-time [Checkout with PayPal](https://developers.braintreepayments.com/guides/paypal/checkout-with-paypal/javascript/v3) flow or `vault` for a [Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3). Required when using PayPal.
 * @param {string|number} [options.paypal.amount] The amount of the transaction. Required when using the Checkout flow.
 * @param {string} [options.paypal.currency] The currency code of the amount, such as `USD`. Required when using the Checkout flow.
 *
 * @param {object} [options.paypalCredit] The configuration options for PayPal Credit. To include a PayPal Credit option in your Drop-in integration, include the `paypalCredit` parameter and [enable PayPal in the Braintree Control Panel](https://developers.braintreepayments.com/guides/paypal/testing-go-live/#go-live).
 *
 * Some of the PayPal Credit configuration options are listed here, but for a full list see the [PayPal Checkout client reference options](http://braintree.github.io/braintree-web/{@pkg bt-web-version}/PayPalCheckout.html#createPayment). For more information on PayPal Credit, see the [Braintree Developer Docs](https://developers.braintreepayments.com/guides/paypal/paypal-credit/javascript/v3).
 * @param {string} [options.paypalCredit.flow] Either `checkout` for a one-time [Checkout with PayPal](https://developers.braintreepayments.com/guides/paypal/checkout-with-paypal/javascript/v3) flow or `vault` for a [Vault flow](https://developers.braintreepayments.com/guides/paypal/vault/javascript/v3). Required when using PayPal.
 * @param {string|number} [options.paypalCredit.amount] The amount of the transaction. Required when using the Checkout flow.
 * @param {string} [options.paypalCredit.currency] The currency code of the amount, such as `USD`. Required when using the Checkout flow.
 * @param {function} callback The second argument, `data`, is the {@link Dropin} instance.
 * @returns {void}
 * @example
 * <caption>A full example of accepting credit cards</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="UTF-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <div id="dropin-container"></div>
 *     <button id="submit-button">Purchase</button>
 *
 *     <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"></script>
 *
 *     <script>
 *       var submitButton = document.querySelector('#submit-button');
 *
 *       braintree.dropin.create({
 *         authorization: 'CLIENT_AUTHORIZATION',
 *         container: '#dropin-container'
 *       }, function (err, dropinInstance) {
 *         if (err) {
 *           // Handle any errors that might've occurred when creating Drop-in
 *           console.error(err);
 *           return;
 *         }
 *         submitButton.addEventListener('click', function () {
 *           dropinInstance.requestPaymentMethod(function (err, payload) {
 *             if (err) {
 *               // Handle errors in requesting payment method
 *             }
 *
 *             // Send payload.nonce to your server
 *           });
 *         });
 *       });
 *     </script>
 *   </body>
 * </html>
 *
 * @example
 * <caption>Setting up a Drop-in instance to accept credit cards, PayPal, and PayPal Credit</caption>
 * braintree.dropin.create({
 *   authorization: 'CLIENT_AUTHORIZATION',
 *   container: '#dropin-container',
 *   paypal: {
 *     flow: 'checkout',
 *     amount: 10.00,
 *     currency: 'USD'
 *   },
 *  paypalCredit: {
 *    flow: 'checkout',
 *    amount: 10.00,
 *    currency: 'USD'
 *   }
 * }, function (err, dropinInstance) {
 *   // Set up a handler to request a payment method and
 *   // submit the payment method nonce to your server
 * });
 *
 * @example
 * <caption>Submitting the payment method nonce to the server using a form</caption>
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="UTF-8">
 *     <title>Checkout</title>
 *   </head>
 *   <body>
 *     <form id="payment-form" action="/" method="post>
 *       <div id="dropin-container"></div>
 *       <input type="submit" value="Purchase"></input>
 *       <input type="hidden id="nonce" name="payment_method_nonce"></input>
 *     </form>
 *
 *     <script src="https://js.braintreegateway.com/web/dropin/{@pkg version}/js/dropin.min.js"></script>
 *
 *     <script>
 *       var form = document.querySelector('#payment-form');
 *       var nonceInput = document.querySelector('#nonce');
 *
 *       braintree.dropin.create({
 *         authorization: 'CLIENT_AUTHORIZATION',
 *         container: '#dropin-container'
 *       }, function (err, dropinInstance) {
 *         if (err) {
 *           // Handle any errors that might've occurred when creating Drop-in
 *           console.error(err);
 *           return;
 *         }
 *         form.addEventListener('submit', function (event) {
 *           event.preventDefault();
 *
 *           dropinInstance.requestPaymentMethod(function (err, payload) {
 *             if (err) {
 *               // Handle errors in requesting payment method
 *               return;
 *             }
 *
 *             // Send payload.nonce to your server
 *             nonceInput.value = payload.nonce;
 *             form.submit();
 *           });
 *         });
 *       });
 *     </script>
 *   </body>
 * </html>
 */

function create(options, callback) {
  if (typeof callback !== 'function') {
    throw new DropinError('create must include a callback function.');
  }

  callback = deferred(callback);

  if (!options.authorization) {
    callback(new DropinError('options.authorization is required.'));
    return;
  }

  client.create({
    authorization: options.authorization
  }, function (err, clientInstance) {
    if (err) {
      callback(new DropinError({
        message: 'There was an error creating Drop-in.',
        braintreeWebError: err
      }));
      return;
    }

    clientInstance = setAnalyticsIntegration(clientInstance);

    if (clientInstance.getConfiguration().authorizationType === 'TOKENIZATION_KEY') {
      analytics.sendEvent(clientInstance, 'started.tokenization-key');
    } else {
      analytics.sendEvent(clientInstance, 'started.client-token');
    }

    new Dropin({
      merchantConfiguration: options,
      client: clientInstance
    })._initialize(callback);
  });
}

function setAnalyticsIntegration(clientInstance) {
  var configuration = clientInstance.getConfiguration();

  configuration.analyticsMetadata.integration = constants.INTEGRATION;
  configuration.analyticsMetadata.integrationType = constants.INTEGRATION;
  configuration.analyticsMetadata.dropinVersion = VERSION;

  clientInstance.getConfiguration = function () {
    return configuration;
  };

  return clientInstance;
}

module.exports = {
  create: create,
  /**
   * @description The current version of Drop-in, i.e. `{@pkg version}`.
   * @type {string}
   */
  VERSION: VERSION
};

},{"./constants":71,"./dropin":73,"./lib/analytics":76,"./lib/deferred":80,"./lib/dropin-error":81,"braintree-web/client":5}],75:[function(require,module,exports){
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

},{}],76:[function(require,module,exports){
'use strict';

var atob = require('./polyfill').atob;
var constants = require('../constants');
var braintreeClientVersion = require('braintree-web/client').VERSION;

function _millisToSeconds(millis) {
  return Math.floor(millis / 1000);
}

function sendAnalyticsEvent(client, kind, callback) {
  var configuration = client.getConfiguration();
  var analyticsRequest = client._request;
  var timestamp = _millisToSeconds(Date.now());
  var url = configuration.gatewayConfiguration.analytics.url;
  var data = {
    analytics: [{
      kind: constants.ANALYTICS_PREFIX + kind,
      timestamp: timestamp
    }],
    _meta: configuration.analyticsMetadata,
    braintreeLibraryVersion: braintreeClientVersion
  };

  if (configuration.authorizationType === 'TOKENIZATION_KEY') {
    data.tokenizationKey = configuration.authorization;
  } else {
    data.authorizationFingerprint = JSON.parse(atob(configuration.authorization)).authorizationFingerprint;
  }

  analyticsRequest({
    url: url,
    method: 'post',
    data: data,
    timeout: constants.ANALYTICS_REQUEST_TIMEOUT_MS
  }, callback);
}

module.exports = {
  sendEvent: sendAnalyticsEvent
};

},{"../constants":71,"./polyfill":84,"braintree-web/client":5}],77:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"dup":23}],78:[function(require,module,exports){
'use strict';

var isIe9 = require('browser-detection/is-ie9');

module.exports = {
  isIe9: isIe9
};

},{"browser-detection/is-ie9":52}],79:[function(require,module,exports){
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

},{}],80:[function(require,module,exports){
arguments[4][34][0].apply(exports,arguments)
},{"dup":34}],81:[function(require,module,exports){
'use strict';

function isBraintreeWebError(err) {
  return err.name === 'BraintreeError';
}

function DropinError(err) {
  this.name = 'DropinError';

  if (typeof err === 'string') {
    this.message = err;
  } else {
    this.message = err.message;
  }

  if (isBraintreeWebError(err)) {
    this._braintreeWebError = err;
  } else {
    this._braintreeWebError = err.braintreeWebError;
  }
}

DropinError.prototype = Object.create(Error.prototype);
DropinError.prototype.constructor = DropinError;

module.exports = DropinError;

},{}],82:[function(require,module,exports){
arguments[4][38][0].apply(exports,arguments)
},{"dup":38}],83:[function(require,module,exports){
'use strict';

var atob = require('./polyfill').atob;

module.exports = function (client) {
  var authorizationFingerprint;
  var configuration = client.getConfiguration();

  if (configuration.authorizationType !== 'TOKENIZATION_KEY') {
    authorizationFingerprint = JSON.parse(atob(configuration.authorization)).authorizationFingerprint;
    return !authorizationFingerprint || authorizationFingerprint.indexOf('customer_id=') === -1;
  }
  return true;
};

},{"./polyfill":84}],84:[function(require,module,exports){
(function (global){
'use strict';

var atobNormalized = typeof global.atob === 'function' ? global.atob : atob;

function atob(base64String) {
  var a, b, c, b1, b2, b3, b4, i;
  var base64Matcher = new RegExp('^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})([=]{1,2})?$');
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var result = '';

  if (!base64Matcher.test(base64String)) {
    throw new Error('Non base64 encoded input passed to window.atob polyfill');
  }

  i = 0;
  do {
    b1 = characters.indexOf(base64String.charAt(i++));
    b2 = characters.indexOf(base64String.charAt(i++));
    b3 = characters.indexOf(base64String.charAt(i++));
    b4 = characters.indexOf(base64String.charAt(i++));

    a = (b1 & 0x3F) << 2 | b2 >> 4 & 0x3;
    b = (b2 & 0xF) << 4 | b3 >> 2 & 0xF;
    c = (b3 & 0x3) << 6 | b4 & 0x3F;

    result += String.fromCharCode(a) + (b ? String.fromCharCode(b) : '') + (c ? String.fromCharCode(c) : '');
  } while (i < base64String.length);

  return result;
}

module.exports = {
  atob: atobNormalized,
  _atob: atob
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],85:[function(require,module,exports){
'use strict';

module.exports = function () {
  var el = document.createElement('div');
  var prop = 'flex-basis: 1px';
  var prefixes = [
    '-webkit-',
    '-moz-',
    '-ms-',
    '-o-',
    ''
  ];

  prefixes.forEach(function (prefix) {
    el.style.cssText += prefix + prop;
  });

  return Boolean(el.style.length);
};

},{}],86:[function(require,module,exports){
'use strict';

var browserDetection = require('./browser-detection');

function onTransitionEnd(element, propertyName, callback) {
  if (browserDetection.isIe9()) {
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

},{"./browser-detection":78}],87:[function(require,module,exports){
arguments[4][47][0].apply(exports,arguments)
},{"dup":47}],88:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Skift betalingsmetode",
  "choosePaymentMethod": "Vælg en betalingsmetode",
  "savedPaymentMethods": "Gemte betalingsmetoder",
  "payingWith": "Betaler med {{paymentSource}}",
  "chooseAnotherWayToPay": "Vælg en anden betalingsmetode",
  "chooseAWayToPay": "Vælg, hvordan du vil betale",
  "otherWaysToPay": "Andre betalingsmetoder",
  "fieldEmptyForCvv": "Du skal angive kontrolcifrene.",
  "fieldEmptyForExpirationDate": "Du skal angive udløbsdatoen.",
  "fieldEmptyForNumber": "Du skal angive et nummer.",
  "fieldEmptyForPostalCode": "Du skal angive et postnummer.",
  "fieldInvalidForCvv": "Sikkerhedskoden er ugyldig.",
  "fieldInvalidForExpirationDate": "Udløbsdatoen er ugyldig.",
  "fieldInvalidForNumber": "Kortnummeret er ugyldigt.",
  "fieldInvalidForPostalCode": "Postnummeret er ugyldigt.",
  "genericError": "Der opstod fejl i vores system.",
  "hostedFieldsFailedTokenizationError": "Kontroller oplysningerne, og prøv igen.",
  "hostedFieldTokenizationNetworkError": "Netværksfejl. Prøv igen.",
  "hostedFieldsFieldsInvalidError": "Kontroller oplysningerne, og prøv igen.",
  "paypalAccountTokenizationFailed": "PayPal-kontoen blev ikke tilføjet. Prøv igen.",
  "paypalFlowFailedError": "Der kunne ikke oprettes forbindelse til PayPal. Prøv igen.",
  "paypalTokenizationRequestActiveError": "PayPal-betalingen er i gang med at blive autoriseret.",
  "unsupportedCardTypeError": "Korttypen understøttes ikke. Prøv et andet kort.",
  "cardNumberLabel": "Kortnummer",
  "cvvLabel": "Kontrolcifre",
  "cvvThreeDigitLabelSubheading": "(3 cifre)",
  "cvvFourDigitLabelSubheading": "(4 cifre)",
  "expirationDateLabel": "Udløbsdato",
  "expirationDateLabelSubheading": "(MM/ÅÅ)",
  "expirationDatePlaceholder": "MM/ÅÅ",
  "postalCodeLabel": "Postnummer",
  "payWithCard": "Betal med kort",
  "endingIn": "Slutter med ••{{lastTwoCardDigits}}",
  "Card": "Kort",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],89:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Zahlungsquelle ändern",
  "choosePaymentMethod": "Zahlungsquelle auswählen",
  "savedPaymentMethods": "Gespeicherte Zahlungsquellen",
  "payingWith": "Zahlen mit {{paymentSource}}",
  "chooseAnotherWayToPay": "Andere Zahlungsmethode wählen",
  "chooseAWayToPay": "Wie möchten Sie bezahlen?",
  "otherWaysToPay": "Andere Zahlungsmethoden",
  "fieldEmptyForCvv": "Geben Sie die Kartenprüfnummer ein.",
  "fieldEmptyForExpirationDate": "Geben Sie das Ablaufdatum ein.",
  "fieldEmptyForNumber": "Geben Sie die Nummer ein.",
  "fieldEmptyForPostalCode": "Geben Sie die PLZ ein.",
  "fieldInvalidForCvv": "Die Kartenprüfnummer ist ungültig.",
  "fieldInvalidForExpirationDate": "Das Ablaufdatum ist ungültig.",
  "fieldInvalidForNumber": "Die Kreditkartennummer ist ungültig.",
  "fieldInvalidForPostalCode": "Die PLZ ist ungültig.",
  "genericError": "Bei uns ist ein Problem aufgetreten.",
  "hostedFieldsFailedTokenizationError": "Überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.",
  "hostedFieldTokenizationNetworkError": "Netzwerkfehler. Versuchen Sie es erneut.",
  "hostedFieldsFieldsInvalidError": "Überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.",
  "paypalAccountTokenizationFailed": "Beim Hinzufügen des PayPal-Kontos ist ein Problem aufgetreten. Versuchen Sie es erneut.",
  "paypalFlowFailedError": "Beim Verbinden mit PayPal ist ein Problem aufgetreten. Versuchen Sie es erneut.",
  "paypalTokenizationRequestActiveError": "Die PayPal-Zahlung wird bereits autorisiert.",
  "unsupportedCardTypeError": "Dieser Kreditkartentyp wird nicht unterstützt. Versuchen Sie es mit einer anderen Karte.",
  "cardNumberLabel": "Kartennummer",
  "cvvLabel": "Prüfnr.",
  "cvvThreeDigitLabelSubheading": "(3-stellig)",
  "cvvFourDigitLabelSubheading": "(4-stellig)",
  "expirationDateLabel": "Gültig bis",
  "expirationDateLabelSubheading": "(MM/JJ)",
  "expirationDatePlaceholder": "MM/JJ",
  "postalCodeLabel": "PLZ",
  "payWithCard": "Mit Kreditkarte zahlen",
  "endingIn": "Mit den Endziffern ••{{lastTwoCardDigits}}",
  "Card": "Kreditkarte",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],90:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Change Payment Method",
  "choosePaymentMethod": "Choose a payment method",
  "savedPaymentMethods": "Saved payment methods",
  "payingWith": "Paying with {{paymentSource}}",
  "chooseAnotherWayToPay": "Choose another way to pay",
  "chooseAWayToPay": "Choose a way to pay",
  "otherWaysToPay": "Other ways to pay",
  "fieldEmptyForCvv": "Please fill out a CVV.",
  "fieldEmptyForExpirationDate": "Please fill out an expiry date.",
  "fieldEmptyForNumber": "Please fill out a number.",
  "fieldEmptyForPostalCode": "Please fill out a postcode.",
  "fieldInvalidForCvv": "This security code is not valid.",
  "fieldInvalidForExpirationDate": "This expiry date is not valid.",
  "fieldInvalidForNumber": "This card number is not valid.",
  "fieldInvalidForPostalCode": "This postcode is not valid.",
  "genericError": "Something went wrong on our end.",
  "hostedFieldsFailedTokenizationError": "Please check your information and try again.",
  "hostedFieldTokenizationNetworkError": "Network error. Please try again.",
  "hostedFieldsFieldsInvalidError": "Please check your information and try again.",
  "paypalAccountTokenizationFailed": "Something went wrong while adding the PayPal account. Please try again.",
  "paypalFlowFailedError": "Something went wrong while connecting to PayPal. Please try again.",
  "paypalTokenizationRequestActiveError": "PayPal payment authorisation is already in progress.",
  "unsupportedCardTypeError": "This card type is not supported. Please try another card.",
  "cardNumberLabel": "Card Number",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 digits)",
  "cvvFourDigitLabelSubheading": "(4 digits)",
  "expirationDateLabel": "Expiry date",
  "expirationDateLabelSubheading": "(MM/YY)",
  "expirationDatePlaceholder": "MM/YY",
  "postalCodeLabel": "Postcode",
  "payWithCard": "Pay with credit or debit card",
  "endingIn": "Ending in ••{{lastTwoCardDigits}}",
  "Card": "Card",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],91:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Change Funding Source",
  "choosePaymentMethod": "Choose a funding source",
  "savedPaymentMethods": "Saved payment methods",
  "payingWith": "Paying with {{paymentSource}}",
  "chooseAnotherWayToPay": "Choose another way to pay",
  "chooseAWayToPay": "Choose a way to pay",
  "otherWaysToPay": "Other ways to pay",
  "fieldEmptyForCvv": "Please fill in a CSC.",
  "fieldEmptyForExpirationDate": "Please fill in an expiry date.",
  "fieldEmptyForNumber": "Please fill in a number.",
  "fieldEmptyForPostalCode": "Please fill in a postcode.",
  "fieldInvalidForCvv": "This security code is not valid.",
  "fieldInvalidForExpirationDate": "This expiry date is not valid.",
  "fieldInvalidForNumber": "This card number is not valid.",
  "fieldInvalidForPostalCode": "This postcode is not valid.",
  "genericError": "Something went wrong on our end.",
  "hostedFieldsFailedTokenizationError": "Please check your information and try again.",
  "hostedFieldTokenizationNetworkError": "Network error. Please try again.",
  "hostedFieldsFieldsInvalidError": "Please check your information and try again.",
  "paypalAccountTokenizationFailed": "Something went wrong while adding the PayPal account. Please try again.",
  "paypalFlowFailedError": "Something went wrong while connecting to PayPal. Please try again.",
  "paypalTokenizationRequestActiveError": "PayPal payment authorisation is already in progress.",
  "unsupportedCardTypeError": "This card type is not supported. Please try another card.",
  "cardNumberLabel": "Card Number",
  "cvvLabel": "CSC",
  "cvvThreeDigitLabelSubheading": "(3 digits)",
  "cvvFourDigitLabelSubheading": "(4 digits)",
  "expirationDateLabel": "Expiry Date",
  "expirationDateLabelSubheading": "(MM/YY)",
  "expirationDatePlaceholder": "MM/YY",
  "postalCodeLabel": "Postcode",
  "payWithCard": "Pay with card",
  "endingIn": "Ending in ••{{lastTwoCardDigits}}",
  "Card": "Card",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],92:[function(require,module,exports){
'use strict';

module.exports = {
  payingWith: 'Paying with {{paymentSource}}',
  chooseAnotherWayToPay: 'Choose another way to pay',
  chooseAWayToPay: 'Choose a way to pay',
  otherWaysToPay: 'Other ways to pay',
  // Errors
  browserNotSupported: 'Browser not supported.',
  fieldEmptyForCvv: 'Please fill out a CVV.',
  fieldEmptyForExpirationDate: 'Please fill out an expiration date.',
  fieldEmptyForNumber: 'Please fill out a card number.',
  fieldEmptyForPostalCode: 'Please fill out a postal code.',
  fieldInvalidForCvv: 'This security code is not valid.',
  fieldInvalidForExpirationDate: 'This expiration date is not valid.',
  fieldInvalidForNumber: 'This card number is not valid.',
  fieldInvalidForPostalCode: 'This postal code is not valid.',
  genericError: 'Something went wrong on our end.',
  hostedFieldsFailedTokenizationError: 'Please check your information and try again.',
  hostedFieldsTokenizationCvvVerificationFailedError: 'Credit card verification failed. Please check your information and try again.',
  hostedFieldsTokenizationNetworkErrorError: 'Network error. Please try again.',
  hostedFieldsFieldsInvalidError: 'Please check your information and try again.',
  paypalAccountTokenizationFailedError: 'Something went wrong adding the PayPal account. Please try again.',
  paypalFlowFailedError: 'Something went wrong connecting to PayPal. Please try again.',
  paypalTokenizationRequestActiveError: 'PayPal payment authorization is already in progress.',
  unsupportedCardTypeError: 'This card type is not supported. Please try another card.',
  // Card form
  cardNumberLabel: 'Card Number',
  cvvLabel: 'CVV',
  cvvThreeDigitLabelSubheading: '(3 digits)',
  cvvFourDigitLabelSubheading: '(4 digits)',
  expirationDateLabel: 'Expiration Date',
  expirationDateLabelSubheading: '(MM/YY)',
  expirationDatePlaceholder: 'MM/YY',
  postalCodeLabel: 'Postal Code',
  payWithCard: 'Pay with card',
  // Payment Method descriptions
  endingIn: 'Ending in ••{{lastTwoCardDigits}}',
  Card: 'Card',
  PayPal: 'PayPal',
  'PayPal Credit': 'PayPal Credit',
  'American Express': 'American Express',
  Discover: 'Discover',
  'Diners Club': 'Diners Club',
  MasterCard: 'MasterCard',
  Visa: 'Visa',
  JCB: 'JCB',
  Maestro: 'Maestro',
  UnionPay: 'UnionPay'
};

},{}],93:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Cambiar forma de pago",
  "choosePaymentMethod": "Seleccionar forma de pago",
  "savedPaymentMethods": "Formas de pago guardadas",
  "payingWith": "Pago con {{paymentSource}}",
  "chooseAnotherWayToPay": "Selecciona otra forma de pago.",
  "chooseAWayToPay": "Selecciona una forma de pago.",
  "otherWaysToPay": "Otras formas de pago",
  "fieldEmptyForCvv": "Escribe el código CVV.",
  "fieldEmptyForExpirationDate": "Escribe la fecha de vencimiento.",
  "fieldEmptyForNumber": "Escribe un número.",
  "fieldEmptyForPostalCode": "Escribe el código postal.",
  "fieldInvalidForCvv": "Este código de seguridad no es válido.",
  "fieldInvalidForExpirationDate": "Esta fecha de vencimiento no es válida.",
  "fieldInvalidForNumber": "Este número de tarjeta no es válido.",
  "fieldInvalidForPostalCode": "Este código postal no es válido.",
  "genericError": "Hemos tenido algún problema.",
  "hostedFieldsFailedTokenizationError": "Comprueba la información e inténtalo de nuevo.",
  "hostedFieldTokenizationNetworkError": "Error de red. Inténtalo de nuevo.",
  "hostedFieldsFieldsInvalidError": "Comprueba la información e inténtalo de nuevo.",
  "paypalAccountTokenizationFailed": "Se ha producido un error al vincular la cuenta PayPal. Inténtalo de nuevo.",
  "paypalFlowFailedError": "Se ha producido un error al conectarse a PayPal. Inténtalo de nuevo.",
  "paypalTokenizationRequestActiveError": "Ya hay una autorización de pago de PayPal en curso.",
  "unsupportedCardTypeError": "No se admite este tipo de tarjeta. Prueba con otra tarjeta.",
  "cardNumberLabel": "Número de tarjeta",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 dígitos)",
  "cvvFourDigitLabelSubheading": "(4 dígitos)",
  "expirationDateLabel": "Fecha de vencimiento",
  "expirationDateLabelSubheading": "(MM/AA)",
  "expirationDatePlaceholder": "MM/AA",
  "postalCodeLabel": "Código postal",
  "payWithCard": "Pagar con tarjeta",
  "endingIn": "Terminada en •• {{lastTwoCardDigits}}",
  "Card": "Tarjeta",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],94:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Modifier le mode de paiement ",
  "choosePaymentMethod": "Choisir un mode de paiement",
  "savedPaymentMethods": "Modes de paiement enregistrés",
  "payingWith": "Payer avec {{paymentSource}}",
  "chooseAnotherWayToPay": "Choisir un autre mode de paiement",
  "chooseAWayToPay": "Choisir le mode de paiement",
  "otherWaysToPay": "Autres modes de paiement",
  "fieldEmptyForCvv": "Veuillez saisir un cryptogramme visuel.",
  "fieldEmptyForExpirationDate": "Veuillez saisir une date d'expiration.",
  "fieldEmptyForNumber": "Veuillez saisir un numéro.",
  "fieldEmptyForPostalCode": "Veuillez saisir un code postal.",
  "fieldInvalidForCvv": "Ce cryptogramme visuel n'est pas valide.",
  "fieldInvalidForExpirationDate": "Cette date d'expiration n'est pas valide.",
  "fieldInvalidForNumber": "Ce numéro de carte n'est pas valide.",
  "fieldInvalidForPostalCode": "Ce code postal n'est pas valide.",
  "genericError": "Une erreur s'est produite de notre côté.",
  "hostedFieldsFailedTokenizationError": "Vérifiez vos informations, puis réessayez.",
  "hostedFieldTokenizationNetworkError": "Erreur réseau. Veuillez réessayer.",
  "hostedFieldsFieldsInvalidError": "Vérifiez vos informations, puis réessayez.",
  "paypalAccountTokenizationFailed": "Une erreur s'est produite au cours de l'enregistrement du compte PayPal. Veuillez réessayer.",
  "paypalFlowFailedError": "Une erreur s'est produite au cours de la connexion à PayPal. Veuillez réessayer.",
  "paypalTokenizationRequestActiveError": "L'autorisation de paiement PayPal est déjà en cours.",
  "unsupportedCardTypeError": "Ce type de carte n'est pas pris en charge. Veuillez essayer une autre carte.",
  "cardNumberLabel": "Numéro de carte ",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 chiffres)",
  "cvvFourDigitLabelSubheading": "(4 chiffres)",
  "expirationDateLabel": "Date d\\'expiration ",
  "expirationDateLabelSubheading": "(MM/AA)",
  "expirationDatePlaceholder": "MM/AA",
  "postalCodeLabel": "Code postal",
  "payWithCard": "Payer par carte",
  "endingIn": "Se terminant par ••{{lastTwoCardDigits}}",
  "Card": "Carte",
  "PayPal": "PayPal",
  "PayPal Credit": "Crédit PayPal",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],95:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Modifier le mode de paiement",
  "choosePaymentMethod": "Choisir un mode de paiement",
  "savedPaymentMethods": "Modes de paiement enregistrés",
  "payingWith": "Payer avec {{paymentSource}}",
  "chooseAnotherWayToPay": "Choisissez une autre façon de payer.",
  "chooseAWayToPay": "Choisissez comment payer.",
  "otherWaysToPay": "Autres façons de payer",
  "fieldEmptyForCvv": "Entrez un cryptogramme visuel.",
  "fieldEmptyForExpirationDate": "Entrez une date d'expiration.",
  "fieldEmptyForNumber": "Entrez un numéro.",
  "fieldEmptyForPostalCode": "Entrez un code postal.",
  "fieldInvalidForCvv": "Ce cryptogramme visuel n'est pas valide.",
  "fieldInvalidForExpirationDate": "Cette date d'expiration n'est pas valide.",
  "fieldInvalidForNumber": "Ce numéro de carte n'est pas valide.",
  "fieldInvalidForPostalCode": "Ce code postal n'est pas valide.",
  "genericError": "Une erreur est survenue.",
  "hostedFieldsFailedTokenizationError": "Vérifiez vos informations et réessayez.",
  "hostedFieldTokenizationNetworkError": "Erreur réseau. Réessayez.",
  "hostedFieldsFieldsInvalidError": "Vérifiez vos informations et réessayez.",
  "paypalAccountTokenizationFailed": "Une erreur est survenue lors de l'ajout du compte PayPal. Réessayez.",
  "paypalFlowFailedError": "Une erreur est survenue lors de la connexion à PayPal. Réessayez.",
  "paypalTokenizationRequestActiveError": "L'autorisation de paiement PayPal est déjà en cours.",
  "unsupportedCardTypeError": "Ce type de carte n'est pas pris en charge. Essayez une autre carte.",
  "cardNumberLabel": "Nº de carte",
  "cvvLabel": "Cryptogramme visuel",
  "cvvThreeDigitLabelSubheading": "(3 chiffres)",
  "cvvFourDigitLabelSubheading": "(4 chiffres)",
  "expirationDateLabel": "Date d'expiration",
  "expirationDateLabelSubheading": "(MM/AA)",
  "expirationDatePlaceholder": "MM/AA",
  "postalCodeLabel": "Code postal",
  "payWithCard": "Payer par carte",
  "endingIn": "Se terminant par ••{{lastTwoCardDigits}}",
  "Card": "Carte",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],96:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Ubah Metode Pembayaran",
  "choosePaymentMethod": "Pilih metode pembayaran",
  "savedPaymentMethods": "Metode Pembayaran Tersimpan",
  "payingWith": "Membayar dengan {{paymentSource}}",
  "chooseAnotherWayToPay": "Pilih metode pembayaran lain",
  "chooseAWayToPay": "Pilih metode pembayaran",
  "otherWaysToPay": "Metode pembayaran lain",
  "fieldEmptyForCvv": "Masukkan CVV.",
  "fieldEmptyForExpirationDate": "Masukkan tanggal akhir berlaku.",
  "fieldEmptyForNumber": "Masukkan nomor.",
  "fieldEmptyForPostalCode": "Masukkan kode pos.",
  "fieldInvalidForCvv": "Kode keamanan ini tidak valid.",
  "fieldInvalidForExpirationDate": "Tanggal akhir berlaku ini tidak valid.",
  "fieldInvalidForNumber": "Nomor kartu ini tidak valid.",
  "fieldInvalidForPostalCode": "Kode pos ini tidak valid.",
  "genericError": "Terjadi kesalahan pada sistem kami. ",
  "hostedFieldsFailedTokenizationError": "Periksa informasi Anda dan coba lagi.",
  "hostedFieldTokenizationNetworkError": "Masalah jaringan. Coba lagi.",
  "hostedFieldsFieldsInvalidError": "Periksa informasi Anda dan coba lagi.",
  "paypalAccountTokenizationFailed": "Terjadi kesalahan saat menambahkan rekening PayPal. Coba lagi.",
  "paypalFlowFailedError": "Terjadi kesalahan saat menyambung ke PayPal. Coba lagi.",
  "paypalTokenizationRequestActiveError": "Otorisasi pembayaran PayPal sedang diproses.",
  "unsupportedCardTypeError": "Jenis kartu ini tidak didukung. Coba kartu lainnya.",
  "cardNumberLabel": "Nomor Kartu",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 angka)",
  "cvvFourDigitLabelSubheading": "(4 angka)",
  "expirationDateLabel": "Tanggal Kedaluwarsa",
  "expirationDateLabelSubheading": "(BB/TT)",
  "expirationDatePlaceholder": "BB/TT",
  "postalCodeLabel": "Kode Pos",
  "payWithCard": "Bayar dengan kartu",
  "endingIn": "Berakhiran ••{{lastTwoCardDigits}}",
  "Card": "Kartu",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],97:[function(require,module,exports){
/* eslint-disable camelcase */
'use strict';

module.exports = {
  da: require('./da_DK'),
  de: require('./de_DE'),
  en: require('./en_US'),
  en_AU: require('./en_AU'),
  en_GB: require('./en_GB'),
  es: require('./es_ES'),
  fr_CA: require('./fr_CA'),
  fr: require('./fr_FR'),
  id: require('./id_ID'),
  it: require('./it_IT'),
  ja: require('./ja_JP'),
  ko: require('./ko_KR'),
  nl: require('./nl_NL'),
  no: require('./no_NO'),
  pl: require('./pl_PL'),
  pt_BR: require('./pt_BR'),
  pt: require('./pt_PT'),
  ru: require('./ru_RU'),
  sv: require('./sv_SE'),
  th: require('./th_TH'),
  zh: require('./zh_CN'),
  zh_HK: require('./zh_HK'),
  zh_TW: require('./zh_TW')
};
/* eslint-enable camelcase */

},{"./da_DK":88,"./de_DE":89,"./en_AU":90,"./en_GB":91,"./en_US":92,"./es_ES":93,"./fr_CA":94,"./fr_FR":95,"./id_ID":96,"./it_IT":98,"./ja_JP":99,"./ko_KR":100,"./nl_NL":101,"./no_NO":102,"./pl_PL":103,"./pt_BR":104,"./pt_PT":105,"./ru_RU":106,"./sv_SE":107,"./th_TH":108,"./zh_CN":109,"./zh_HK":110,"./zh_TW":111}],98:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Modifica metodo di pagamento",
  "choosePaymentMethod": "Scegli un metodo di pagamento",
  "savedPaymentMethods": "Metodi di pagamento salvati",
  "payingWith": "Pagamento con {{paymentSource}}",
  "chooseAnotherWayToPay": "Scegli di pagare in un altro modo",
  "chooseAWayToPay": "Scegli come pagare",
  "otherWaysToPay": "Altri modi di pagare",
  "fieldEmptyForCvv": "Immetti il codice di sicurezza (CVV).",
  "fieldEmptyForExpirationDate": "Immetti la data di scadenza.",
  "fieldEmptyForNumber": "Immetti il numero di carta.",
  "fieldEmptyForPostalCode": "Immetti il CAP.",
  "fieldInvalidForCvv": "Il codice di sicurezza non è valido.",
  "fieldInvalidForExpirationDate": "La data di scadenza non è valida.",
  "fieldInvalidForNumber": "Il numero di carta non è valido.",
  "fieldInvalidForPostalCode": "Il CAP non è valido.",
  "genericError": "Si è verificato un errore nei nostri sistemi.",
  "hostedFieldsFailedTokenizationError": "Controlla e riprova.",
  "hostedFieldTokenizationNetworkError": "Errore di rete. Riprova.",
  "hostedFieldsFieldsInvalidError": "Controlla e riprova.",
  "paypalAccountTokenizationFailed": "Si è verificato un errore collegando il conto PayPal. Riprova.",
  "paypalFlowFailedError": "Si è verificato un errore di connessione a PayPal. Riprova.",
  "paypalTokenizationRequestActiveError": "L'autorizzazione di pagamento PayPal è già in corso.",
  "unsupportedCardTypeError": "Questo tipo di carta non è supportato. Prova con un'altra carta.",
  "cardNumberLabel": "Numero di carta",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 cifre)",
  "cvvFourDigitLabelSubheading": "(4 cifre)",
  "expirationDateLabel": "Data di scadenza",
  "expirationDateLabelSubheading": "(MM/AA)",
  "expirationDatePlaceholder": "MM/AA",
  "postalCodeLabel": "CAP",
  "payWithCard": "Paga con una carta",
  "endingIn": "Le cui ultime cifre sono ••{{lastTwoCardDigits}}",
  "Card": "Carta",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],99:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "支払方法を変更する",
  "choosePaymentMethod": "支払方法を選択する",
  "savedPaymentMethods": "保存済みの支払方法",
  "payingWith": "{{paymentSource}}で支払う",
  "chooseAnotherWayToPay": "別の支払方法を選択する",
  "chooseAWayToPay": "支払方法を選択する",
  "otherWaysToPay": "その他の支払方法",
  "fieldEmptyForCvv": "カード確認コードを入力してください。",
  "fieldEmptyForExpirationDate": "有効期限を入力してください。",
  "fieldEmptyForNumber": "番号を入力してください。",
  "fieldEmptyForPostalCode": "郵便番号を入力してください。",
  "fieldInvalidForCvv": "このセキュリティコードは無効です。",
  "fieldInvalidForExpirationDate": "この有効期限は無効です。",
  "fieldInvalidForNumber": "このカード番号は無効です。",
  "fieldInvalidForPostalCode": "この郵便番号は無効です。",
  "genericError": "弊社側で問題が発生しました。",
  "hostedFieldsFailedTokenizationError": "情報を確認してもう一度お試しください。",
  "hostedFieldTokenizationNetworkError": "ネットワークエラーです。もう一度お試しください。",
  "hostedFieldsFieldsInvalidError": "情報を確認してもう一度お試しください。",
  "paypalAccountTokenizationFailed": "PayPalアカウントの追加で問題が発生しました。もう一度お試しください。",
  "paypalFlowFailedError": "PayPalへの接続に問題が発生しました。もう一度お試しください。",
  "paypalTokenizationRequestActiveError": "PayPal支払いの承認はすでに処理中です。",
  "unsupportedCardTypeError": "このカードタイプはサポートされていません。別のカードをご使用ください。",
  "cardNumberLabel": "カード番号",
  "cvvLabel": "カード確認コード",
  "cvvThreeDigitLabelSubheading": "(3桁)",
  "cvvFourDigitLabelSubheading": "(4桁)",
  "expirationDateLabel": "有効期限",
  "expirationDateLabelSubheading": "(MM/YY)",
  "expirationDatePlaceholder": "MM/YY",
  "postalCodeLabel": "郵便番号",
  "payWithCard": "カードで支払う",
  "endingIn": "x-{{lastTwoCardDigits}}",
  "Card": "カード",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "銀聯(UnionPay)"
};

},{}],100:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "결제수단 변경",
  "choosePaymentMethod": "결제수단 선택",
  "savedPaymentMethods": "저장된 결제수단",
  "payingWith": "{{paymentSource}}(으)로 결제",
  "chooseAnotherWayToPay": "다른 결제수단 선택",
  "chooseAWayToPay": "결제수단 선택",
  "otherWaysToPay": "다른 방법으로 결제",
  "fieldEmptyForCvv": "CVV를 입력하세요.",
  "fieldEmptyForExpirationDate": "만료일을 입력하세요.",
  "fieldEmptyForNumber": "번호를 입력하세요.",
  "fieldEmptyForPostalCode": "우편번호를 입력하세요.",
  "fieldInvalidForCvv": "이 보안 코드가 올바르지 않습니다.",
  "fieldInvalidForExpirationDate": "이 만료일이 올바르지 않습니다.",
  "fieldInvalidForNumber": "이 카드 번호가 올바르지 않습니다.",
  "fieldInvalidForPostalCode": "이 우편번호가 올바르지 않습니다.",
  "genericError": "저희 쪽에 문제가 발생했습니다.",
  "hostedFieldsFailedTokenizationError": "정보를 확인하고 다시 시도해 주세요.",
  "hostedFieldTokenizationNetworkError": "네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
  "hostedFieldsFieldsInvalidError": "정보를 확인하고 다시 시도해 주세요.",
  "paypalAccountTokenizationFailed": "PayPal 계정을 추가하는 동안 문제가 발생했습니다. 다시 시도해 주세요.",
  "paypalFlowFailedError": "PayPal 계정을 연결하는 동안 문제가 발생했습니다. 다시 시도해 주세요.",
  "paypalTokenizationRequestActiveError": "PayPal 결제 승인이 이미 진행 중입니다.",
  "unsupportedCardTypeError": "이 카드 형식은 지원되지 않습니다. 다른 카드로 시도해 주세요.",
  "cardNumberLabel": "카드 번호",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3자리)",
  "cvvFourDigitLabelSubheading": "(4자리)",
  "expirationDateLabel": "만료일",
  "expirationDateLabelSubheading": "(MM/YY)",
  "expirationDatePlaceholder": "MM/YY",
  "postalCodeLabel": "우편번호",
  "payWithCard": "카드로 결제",
  "endingIn": "끝 번호: ••{{lastTwoCardDigits}}",
  "Card": "카드",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],101:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Betaalmethode wijzigen",
  "choosePaymentMethod": "Kies een betaalmethode",
  "savedPaymentMethods": "Opgeslagen betaalmethoden",
  "payingWith": "Betalen met {{paymentSource}}",
  "chooseAnotherWayToPay": "Kies een andere betaalmethode",
  "chooseAWayToPay": "Kies een betaalwijze",
  "otherWaysToPay": "Andere manieren om te betalen",
  "fieldEmptyForCvv": "Vul een CSC in.",
  "fieldEmptyForExpirationDate": "Vul een vervaldatum in.",
  "fieldEmptyForNumber": "Vul een nummer in.",
  "fieldEmptyForPostalCode": "Vul een postcode in.",
  "fieldInvalidForCvv": "Deze CSC is ongeldig.",
  "fieldInvalidForExpirationDate": "Deze vervaldatum is ongeldig.",
  "fieldInvalidForNumber": "Dit creditcardnummer is ongeldig.",
  "fieldInvalidForPostalCode": "Deze postcode is ongeldig.",
  "genericError": "Er is iets fout gegaan.",
  "hostedFieldsFailedTokenizationError": "Controleer uw gegevens en probeer het opnieuw.",
  "hostedFieldTokenizationNetworkError": "Netwerkfout. Probeer het opnieuw.",
  "hostedFieldsFieldsInvalidError": "Controleer uw gegevens en probeer het opnieuw.",
  "paypalAccountTokenizationFailed": "Er is iets misgegaan bij het toevoegen van de PayPal-rekening. Probeer het opnieuw.",
  "paypalFlowFailedError": "Er is iets misgegaan bij de verbinding met PayPal. Probeer het opnieuw.",
  "paypalTokenizationRequestActiveError": "De autorisatie van de PayPal-betaling is al in behandeling.",
  "unsupportedCardTypeError": "Dit type creditcard wordt niet ondersteund. Gebruik een andere creditcard.",
  "cardNumberLabel": "Creditcardnummer",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 cijfers)",
  "cvvFourDigitLabelSubheading": "(4 cijfers)",
  "expirationDateLabel": "Vervaldatum",
  "expirationDateLabelSubheading": "(MM/JJ)",
  "expirationDatePlaceholder": "MM/JJ",
  "postalCodeLabel": "Postcode",
  "payWithCard": "Betalen met creditcard",
  "endingIn": "Eindigend op •• {{lastTwoCardDigits}}",
  "Card": "Creditcard",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],102:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Endre betalingsmetode",
  "choosePaymentMethod": "Velg en betalingsmetode",
  "savedPaymentMethods": "Lagrede betalingsmetoder",
  "payingWith": "Betaling med {{paymentSource}}",
  "chooseAnotherWayToPay": "Velg en annen måte å betale på",
  "chooseAWayToPay": "Velg betalingsmåte",
  "otherWaysToPay": "Andre måter å betale på",
  "fieldEmptyForCvv": "Oppgi en kortsikkerhetskode (CVV).",
  "fieldEmptyForExpirationDate": "Oppgi en utløpsdato.",
  "fieldEmptyForNumber": "Oppgi et nummer.",
  "fieldEmptyForPostalCode": "Oppgi et postnummer.",
  "fieldInvalidForCvv": "Denne sikkerhetskoden er ikke gyldig.",
  "fieldInvalidForExpirationDate": "Denne utløpsdatoen er ikke gyldig.",
  "fieldInvalidForNumber": "Dette kortnummeret er ikke gyldig.",
  "fieldInvalidForPostalCode": "Dette postnummeret er ikke gyldig.",
  "genericError": "Noe gikk galt hos oss.",
  "hostedFieldsFailedTokenizationError": "Kontroller informasjonen og prøv på nytt.",
  "hostedFieldTokenizationNetworkError": "Nettverksfeil. Prøv på nytt.",
  "hostedFieldsFieldsInvalidError": "Kontroller informasjonen og prøv på nytt.",
  "paypalAccountTokenizationFailed": "Noe gikk galt da PayPal-kontoen ble lagt til. Prøv på nytt.",
  "paypalFlowFailedError": "Det oppsto et problem med tilkoblingen til PayPal. Prøv på nytt.",
  "paypalTokenizationRequestActiveError": "Godkjenning av PayPal-betalingen pågår allerede",
  "unsupportedCardTypeError": "Denne korttypen støttes ikke. Prøv med et annet kort.",
  "cardNumberLabel": "Kortnummer",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 siffer)",
  "cvvFourDigitLabelSubheading": "(4 siffer)",
  "expirationDateLabel": "Utløpsdato",
  "expirationDateLabelSubheading": "(MM/ÅÅ)",
  "expirationDatePlaceholder": "MM/ÅÅ",
  "postalCodeLabel": "Postnummer",
  "payWithCard": "Betal med kort",
  "endingIn": "Som slutter på •• {{lastTwoCardDigits}}",
  "Card": "Kort",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],103:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Zmień formę płatności",
  "choosePaymentMethod": "Wybierz formę płatności",
  "savedPaymentMethods": "Zapisane formy płatności",
  "payingWith": "Forma płatności: {{paymentSource}}",
  "chooseAnotherWayToPay": "Wybierz inną formę płatności",
  "chooseAWayToPay": "Wybierz sposób płatności",
  "otherWaysToPay": "Inne formy płatności",
  "fieldEmptyForCvv": "Podaj kod bezpieczeństwa.",
  "fieldEmptyForExpirationDate": "Podaj datę ważności.",
  "fieldEmptyForNumber": "Podaj numer.",
  "fieldEmptyForPostalCode": "Podaj kod pocztowy.",
  "fieldInvalidForCvv": "Podany kod bezpieczeństwa jest nieprawidłowy.",
  "fieldInvalidForExpirationDate": "Podana data ważności jest nieprawidłowa.",
  "fieldInvalidForNumber": "Podany numer karty jest nieprawidłowy.",
  "fieldInvalidForPostalCode": "Podany kod pocztowy jest nieprawidłowy.",
  "genericError": "Wystąpił błąd po naszej stronie. ",
  "hostedFieldsFailedTokenizationError": "Sprawdź swoje informacje i spróbuj ponownie.",
  "hostedFieldTokenizationNetworkError": "Błąd sieci. Spróbuj ponownie.",
  "hostedFieldsFieldsInvalidError": "Sprawdź swoje informacje i spróbuj ponownie.",
  "paypalAccountTokenizationFailed": "Coś poszło nie tak podczas dodawania konta PayPal. Spróbuj ponownie.",
  "paypalFlowFailedError": "Coś poszło nie tak podczas łączenia z systemem PayPal. Spróbuj ponownie.",
  "paypalTokenizationRequestActiveError": "Autoryzacja płatności PayPal jest już w trakcie realizacji.",
  "unsupportedCardTypeError": "Ten typ karty nie jest obsługiwany. Spróbuj użyć innej karty.",
  "cardNumberLabel": "Numer karty",
  "cvvLabel": "Kod CVC",
  "cvvThreeDigitLabelSubheading": "(3 cyfry)",
  "cvvFourDigitLabelSubheading": "(4 cyfry)",
  "expirationDateLabel": "Data ważności",
  "expirationDateLabelSubheading": "(MM/RR)",
  "expirationDatePlaceholder": "MM/RR",
  "postalCodeLabel": "Kod pocztowy",
  "payWithCard": "Zapłać kartą",
  "endingIn": "O numerze zakończonym cyframi •• {{lastTwoCardDigits}}",
  "Card": "Karta",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],104:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Alterar meio de pagamento",
  "choosePaymentMethod": "Escolha um meio de pagamento",
  "savedPaymentMethods": "Meios de pagamento salvos",
  "payingWith": "Pagando com {{paymentSource}}",
  "chooseAnotherWayToPay": "Escolher outro meio de pagamento",
  "chooseAWayToPay": "Escolher um meio de pagamento",
  "otherWaysToPay": "Outro meio de pagamento",
  "fieldEmptyForCvv": "Informe o Código de Segurança.",
  "fieldEmptyForExpirationDate": "Informe a data de vencimento.",
  "fieldEmptyForNumber": "Informe um número.",
  "fieldEmptyForPostalCode": "Informe um CEP.",
  "fieldInvalidForCvv": "Este código de segurança não é válido.",
  "fieldInvalidForExpirationDate": "Esta data de vencimento não é válida.",
  "fieldInvalidForNumber": "O número do cartão não é válido.",
  "fieldInvalidForPostalCode": "Este CEP não é válido.",
  "genericError": "Ocorreu um erro.",
  "hostedFieldsFailedTokenizationError": "Verifique as informações e tente novamente.",
  "hostedFieldTokenizationNetworkError": "Erro de rede. Tente novamente.",
  "hostedFieldsFieldsInvalidError": "Verifique as informações e tente novamente.",
  "paypalAccountTokenizationFailed": "Ocorreu um erro ao adicionar a conta do PayPal. Tente novamente.",
  "paypalFlowFailedError": "Ocorreu um erro de conexão com o PayPal. Tente novamente.",
  "paypalTokenizationRequestActiveError": "A autorização de pagamento do PayPal já está em andamento.",
  "unsupportedCardTypeError": "Este tipo de cartão não é aceito. Experimente outro cartão.",
  "cardNumberLabel": "Número do cartão",
  "cvvLabel": "Cód. Seg.",
  "cvvThreeDigitLabelSubheading": "(3 dígitos)",
  "cvvFourDigitLabelSubheading": "(4 dígitos)",
  "expirationDateLabel": "Data de vencimento",
  "expirationDateLabelSubheading": "(MM/AA)",
  "expirationDatePlaceholder": "MM/AA",
  "postalCodeLabel": "CEP",
  "payWithCard": "Pague com seu cartão",
  "endingIn": "Com final ••{{lastTwoCardDigits}}",
  "Card": "Cartão",
  "PayPal": "PayPal",
  "PayPal Credit": "Crédito do PayPal",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],105:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Alterar meio de pagamento",
  "choosePaymentMethod": "Escolha um meio de pagamento",
  "savedPaymentMethods": "Formas de pagamento guardadas",
  "payingWith": "Pagar com {{paymentSource}}",
  "chooseAnotherWayToPay": "Escolher outra forma de pagamento",
  "chooseAWayToPay": "Escolha um meio de pagamento",
  "otherWaysToPay": "Outras formas de pagamento",
  "fieldEmptyForCvv": "Introduza o código CVV.",
  "fieldEmptyForExpirationDate": "Introduza a data de validade.",
  "fieldEmptyForNumber": "Introduza um número.",
  "fieldEmptyForPostalCode": "Introduza o código postal.",
  "fieldInvalidForCvv": "Este código de segurança não é válido.",
  "fieldInvalidForExpirationDate": "Esta data de validade não é correta.",
  "fieldInvalidForNumber": "Este número de cartão não é válido.",
  "fieldInvalidForPostalCode": "Este código postal não é válido.",
  "genericError": "Tudo indica que ocorreu um problema.",
  "hostedFieldsFailedTokenizationError": "Verifique os dados e tente novamente.",
  "hostedFieldTokenizationNetworkError": "Erro de rede. Tente novamente.",
  "hostedFieldsFieldsInvalidError": "Verifique os dados e tente novamente.",
  "paypalAccountTokenizationFailed": "Ocorreu um erro ao associar a conta PayPal. Tente novamente.",
  "paypalFlowFailedError": "Ocorreu um erro na ligação com PayPal. Tente novamente.",
  "paypalTokenizationRequestActiveError": "Já há uma autorização de pagamento PayPal em curso.",
  "unsupportedCardTypeError": "Este tipo de cartão não é suportado. Tente usar outro cartão.",
  "cardNumberLabel": "Número do cartão",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 dígitos)",
  "cvvFourDigitLabelSubheading": "(4 dígitos)",
  "expirationDateLabel": "Data de validade",
  "expirationDateLabelSubheading": "(MM/AA)",
  "expirationDatePlaceholder": "MM/AA",
  "postalCodeLabel": "Código postal",
  "payWithCard": "Pagar com cartão",
  "endingIn": "Terminado em ••{{lastTwoCardDigits}}",
  "Card": "Cartão",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],106:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Изменить способ оплаты",
  "choosePaymentMethod": "Выберите способ оплаты",
  "savedPaymentMethods": "Сохраненные способы оплаты",
  "payingWith": "Способы оплаты: {{paymentSource}}",
  "chooseAnotherWayToPay": "Выберите другой способ оплаты",
  "chooseAWayToPay": "Выберите способ оплаты",
  "otherWaysToPay": "Другие способы оплаты",
  "fieldEmptyForCvv": "Укажите код безопасности.",
  "fieldEmptyForExpirationDate": "Укажите дату окончания срока действия.",
  "fieldEmptyForNumber": "Введите номер.",
  "fieldEmptyForPostalCode": "Укажите почтовый индекс.",
  "fieldInvalidForCvv": "Этот код безопасности недействителен.",
  "fieldInvalidForExpirationDate": "Эта дата окончания срока действия недействительна.",
  "fieldInvalidForNumber": "Этот номер карты недействителен.",
  "fieldInvalidForPostalCode": "Этот почтовый индекс недействителен.",
  "genericError": "Возникла проблема с нашей стороны.",
  "hostedFieldsFailedTokenizationError": "Проверьте правильность ввода данных и повторите попытку.",
  "hostedFieldTokenizationNetworkError": "Ошибка сети. Повторите попытку.",
  "hostedFieldsFieldsInvalidError": "Проверьте правильность ввода данных и повторите попытку.",
  "paypalAccountTokenizationFailed": "Что-то пошло не так — не удалось добавить учетную запись PayPal. Повторите попытку.",
  "paypalFlowFailedError": "Что-то пошло не так — не удалось подключиться к системе PayPal. Повторите попытку.",
  "paypalTokenizationRequestActiveError": "Выполняется авторизация платежа PayPal.",
  "unsupportedCardTypeError": "Этот тип карты не поддерживается. Попробуйте воспользоваться другой картой.",
  "cardNumberLabel": "Номер карты",
  "cvvLabel": "Код безопасности",
  "cvvThreeDigitLabelSubheading": "(3 цифры)",
  "cvvFourDigitLabelSubheading": "(4 цифры)",
  "expirationDateLabel": "Действует до",
  "expirationDateLabelSubheading": "(ММ/ГГ)",
  "expirationDatePlaceholder": "ММ/ГГ",
  "postalCodeLabel": "Индекс",
  "payWithCard": "Оплатить картой",
  "endingIn": "Последние две цифры номера карты: ••{{LastTwoCardDigits}}",
  "Card": "Карта",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],107:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "Ändra betalningsmetod",
  "choosePaymentMethod": "Välj betalningsmetod",
  "savedPaymentMethods": "Sparade betalningsmetoder",
  "payingWith": "Betalas med {{paymentSource}}",
  "chooseAnotherWayToPay": "Välj ett annat sätt att betala",
  "chooseAWayToPay": "Välj hur du vill betala",
  "otherWaysToPay": "Andra sätt att betala",
  "fieldEmptyForCvv": "Fyll i en CVV-kod.",
  "fieldEmptyForExpirationDate": "Fyll i ett utgångsdatum.",
  "fieldEmptyForNumber": "Fyll i ett nummer.",
  "fieldEmptyForPostalCode": "Fyll i ett postnummer.",
  "fieldInvalidForCvv": "Den här säkerhetskoden är inte giltig.",
  "fieldInvalidForExpirationDate": "Det här utgångsdatumet är inte giltigt.",
  "fieldInvalidForNumber": "Det här kortnumret är inte giltigt.",
  "fieldInvalidForPostalCode": "Det här postnumret är inte giltigt.",
  "genericError": "Ett fel uppstod.",
  "hostedFieldsFailedTokenizationError": "Kontrollera uppgifterna och försök igen.",
  "hostedFieldTokenizationNetworkError": "Nätverksfel. Försök igen.",
  "hostedFieldsFieldsInvalidError": "Kontrollera uppgifterna och försök igen.",
  "paypalAccountTokenizationFailed": "Ett fel uppstod när PayPal-kontot skulle läggas till. Försök igen.",
  "paypalFlowFailedError": "Ett fel uppstod när anslutningen till PayPal skulle upprättas. Försök igen.",
  "paypalTokenizationRequestActiveError": "Betalningsgodkännandet för PayPal behandlas redan.",
  "unsupportedCardTypeError": "Den här korttypen stöds inte. Pröva med ett annat kort.",
  "cardNumberLabel": "Kortnummer",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 siffror)",
  "cvvFourDigitLabelSubheading": "(4 siffror)",
  "expirationDateLabel": "Utgångsdatum",
  "expirationDateLabelSubheading": "(MM/ÅÅ)",
  "expirationDatePlaceholder": "MM/ÅÅ",
  "postalCodeLabel": "Postnummer",
  "payWithCard": "Betala med kort",
  "endingIn": "Slutar på ••{{lastTwoCardDigits}}",
  "Card": "Kort",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal-kredit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],108:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "เปลี่ยนวิธีการชำระเงิน",
  "choosePaymentMethod": "เลือกวิธีชำระเงิน",
  "savedPaymentMethods": "วิธีการชำระเงินที่บันทึกไว้",
  "payingWith": "การชำระเงินด้วย {{paymentSource}}",
  "chooseAnotherWayToPay": "เลือกวิธีอื่นเพื่อชำระเงิน",
  "chooseAWayToPay": "เลือกวิธีชำระเงิน",
  "otherWaysToPay": "วิธีอื่นๆ ในการชำระเงิน",
  "fieldEmptyForCvv": "โปรดกรอก CVV (รหัสการตรวจสอบยืนยันบัตร)",
  "fieldEmptyForExpirationDate": "โปรดกรอกวันที่หมดอายุ",
  "fieldEmptyForNumber": "โปรดกรอกหมายเลข",
  "fieldEmptyForPostalCode": "โปรดกรอกรหัสไปรษณีย์",
  "fieldInvalidForCvv": "รหัสความปลอดภัยนี้ไม่ถูกต้อง",
  "fieldInvalidForExpirationDate": "วันที่หมดอายุนี้ไม่ถูกต้อง",
  "fieldInvalidForNumber": "หมายเลขบัตรนี้ไม่ถูกต้อง",
  "fieldInvalidForPostalCode": "รหัสไปรษณีย์นี้ไม่ถูกต้อง",
  "genericError": "เกิดข้อผิดพลาดขึ้นในระบบของเรา",
  "hostedFieldsFailedTokenizationError": "โปรดตรวจสอบข้อมูลของคุณ แล้วลองอีกครั้ง",
  "hostedFieldTokenizationNetworkError": "ข้อผิดพลาดด้านเครือข่าย โปรดลองอีกครั้ง",
  "hostedFieldsFieldsInvalidError": "โปรดตรวจสอบข้อมูลของคุณ แล้วลองอีกครั้ง",
  "paypalAccountTokenizationFailed": "เกิดข้อผิดพลาดในการเพิ่มบัญชี PayPal โปรดลองอีกครั้ง",
  "paypalFlowFailedError": "เกิดข้อผิดพลาดในการเชื่อมต่อกับ PayPal โปรดลองอีกครั้ง",
  "paypalTokenizationRequestActiveError": "การอนุญาตการชำระเงินของ PayPal อยู่ในระหว่างดำเนินการ",
  "unsupportedCardTypeError": "ไม่รองรับบัตรประเภทนี้ โปรดลองใช้บัตรใบอื่น",
  "cardNumberLabel": "หมายเลขบัตร",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "(3 หลัก)",
  "cvvFourDigitLabelSubheading": "(4 หลัก)",
  "expirationDateLabel": "วันหมดอายุ",
  "expirationDateLabelSubheading": "(ดด/ปป)",
  "expirationDatePlaceholder": "ดด/ปป",
  "postalCodeLabel": "รหัสไปรษณีย์",
  "payWithCard": "ชำระเงินด้วยบัตร",
  "endingIn": "ลงท้ายด้วย ••{{lastTwoCardDigits}}",
  "Card": "บัตร",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],109:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "更改付款方式",
  "choosePaymentMethod": "选择付款方式",
  "savedPaymentMethods": "已保存的付款方式",
  "payingWith": "正在使用{{paymentSource}}付款",
  "chooseAnotherWayToPay": "选择其他付款方式",
  "chooseAWayToPay": "选择付款方式",
  "otherWaysToPay": "其他付款方式",
  "fieldEmptyForCvv": "请填写CVV。",
  "fieldEmptyForExpirationDate": "请填写有效期限。",
  "fieldEmptyForNumber": "请填写一个号码。",
  "fieldEmptyForPostalCode": "请填写邮政编码。",
  "fieldInvalidForCvv": "此安全代码无效。",
  "fieldInvalidForExpirationDate": "此有效期限无效。",
  "fieldInvalidForNumber": "此卡号无效。",
  "fieldInvalidForPostalCode": "此邮政编码无效。",
  "genericError": "我们遇到了一些问题",
  "hostedFieldsFailedTokenizationError": "请检查您的信息，然后重试。",
  "hostedFieldTokenizationNetworkError": "网络错误。请重试。",
  "hostedFieldsFieldsInvalidError": "请检查您的信息，然后重试。",
  "paypalAccountTokenizationFailed": "添加PayPal账户时出错。请重试。",
  "paypalFlowFailedError": "连接到PayPal时出错。请重试。",
  "paypalTokenizationRequestActiveError": "PayPal付款授权已在进行中。",
  "unsupportedCardTypeError": "不支持该卡类型。请尝试其他卡。",
  "cardNumberLabel": "卡号",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "（3位数）",
  "cvvFourDigitLabelSubheading": "（4位数）",
  "expirationDateLabel": "有效期限",
  "expirationDateLabelSubheading": "（MM/YY）",
  "expirationDatePlaceholder": "MM/YY",
  "postalCodeLabel": "邮政编码",
  "payWithCard": "用卡付款",
  "endingIn": "尾号为{{lastTwoCardDigits}}",
  "Card": "卡",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "American Express",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "银联"
};

},{}],110:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "變更付款方式",
  "choosePaymentMethod": "選擇付款方式",
  "savedPaymentMethods": "已儲存的付款方式",
  "payingWith": "付款方式為 {{paymentSource}}",
  "chooseAnotherWayToPay": "選擇其他付款方式",
  "chooseAWayToPay": "選擇付款方式",
  "otherWaysToPay": "其他付款方式",
  "fieldEmptyForCvv": "請填寫信用卡認證碼。",
  "fieldEmptyForExpirationDate": "請填寫到期日。",
  "fieldEmptyForNumber": "請填寫號碼。",
  "fieldEmptyForPostalCode": "請填寫郵遞區號。",
  "fieldInvalidForCvv": "此安全代碼無效。",
  "fieldInvalidForExpirationDate": "此到期日無效。",
  "fieldInvalidForNumber": "此卡號無效。",
  "fieldInvalidForPostalCode": "此郵遞區號無效。",
  "genericError": "系統發生錯誤。",
  "hostedFieldsFailedTokenizationError": "請檢查你的資料並再試一次。",
  "hostedFieldTokenizationNetworkError": "網絡錯誤。請重試。",
  "hostedFieldsFieldsInvalidError": "請檢查你的資料並再試一次。",
  "paypalAccountTokenizationFailed": "加入 PayPal 帳戶時發生錯誤。請重試。",
  "paypalFlowFailedError": "連接 PayPal 時發生錯誤。請重試。",
  "paypalTokenizationRequestActiveError": "PayPal 付款授權已在處理中。",
  "unsupportedCardTypeError": "不可使用此信用卡類型。請改用其他信用卡。",
  "cardNumberLabel": "卡號",
  "cvvLabel": "信用卡認證碼",
  "cvvThreeDigitLabelSubheading": "（3 位數）",
  "cvvFourDigitLabelSubheading": "（4 位數）",
  "expirationDateLabel": "到期日",
  "expirationDateLabelSubheading": "(MM/YY)",
  "expirationDatePlaceholder": "MM/YY",
  "postalCodeLabel": "郵遞區號",
  "payWithCard": "使用信用卡付款",
  "endingIn": "最後兩位數為••{{lastTwoCardDigits}}",
  "Card": "信用卡",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "美國運通",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],111:[function(require,module,exports){
'use strict';

module.exports = {
  "changePaymentMethod": "變更支付購物款項方式",
  "choosePaymentMethod": "選擇付款方式",
  "savedPaymentMethods": "已儲存的付款方式",
  "payingWith": "以 {{paymentSource}} 付款",
  "chooseAnotherWayToPay": "選擇支付款項的以其他方式付款",
  "chooseAWayToPay": "選擇支付款項的方式",
  "otherWaysToPay": "其他付款方式",
  "fieldEmptyForCvv": "請填妥信用卡驗證碼。",
  "fieldEmptyForExpirationDate": "請填妥到期日。",
  "fieldEmptyForNumber": "請填妥號碼。",
  "fieldEmptyForPostalCode": "請填寫郵遞區號。",
  "fieldInvalidForCvv": "這組安全代碼無效。",
  "fieldInvalidForExpirationDate": "此到期日無效。",
  "fieldInvalidForNumber": "此卡號無效。",
  "fieldInvalidForPostalCode": "此郵遞區號無效。",
  "genericError": "我們的系統發生問題。",
  "hostedFieldsFailedTokenizationError": "請檢查你的資料並重試。",
  "hostedFieldTokenizationNetworkError": "網路錯誤。請重試。",
  "hostedFieldsFieldsInvalidError": "請檢查你的資料並重試。",
  "paypalAccountTokenizationFailed": "新增 PayPal 帳戶時，系統發生錯誤。請重試。",
  "paypalFlowFailedError": "連結至 PayPal 時，系統發生錯誤。請重試。",
  "paypalTokenizationRequestActiveError": "PayPal 支付款項的授權已在處理中。",
  "unsupportedCardTypeError": "不支援此卡片類型。請嘗試其他卡片。",
  "cardNumberLabel": "卡號",
  "cvvLabel": "CVV",
  "cvvThreeDigitLabelSubheading": "（3 位數）",
  "cvvFourDigitLabelSubheading": "（4 位數）",
  "expirationDateLabel": "到期日",
  "expirationDateLabelSubheading": "（月 / 年）",
  "expirationDatePlaceholder": "月 / 年",
  "postalCodeLabel": "郵遞區號",
  "payWithCard": "使用信用卡 / 扣帳卡付款",
  "endingIn": "你的末兩碼為 •• {{lastTwoCardDigits}}",
  "Card": "信用卡或扣帳卡",
  "PayPal": "PayPal",
  "PayPal Credit": "PayPal Credit",
  "American Express": "美國運通",
  "Discover": "Discover",
  "Diners Club": "Diners Club",
  "MasterCard": "MasterCard",
  "Visa": "Visa",
  "JCB": "JCB",
  "Maestro": "Maestro",
  "UnionPay": "UnionPay"
};

},{}],112:[function(require,module,exports){
'use strict';

var assign = require('../lib/assign').assign;
var DropinError = require('../lib/dropin-error');
var errors = require('../constants').errors;

function BaseView(options) {
  options = options || {};

  assign(this, options);
}

BaseView.prototype.getElementById = function (id) {
  if (!this.element) { return null; }

  return this.element.querySelector('[data-braintree-id="' + id + '"]');
};

BaseView.prototype.requestPaymentMethod = function (callback) {
  callback(new DropinError(errors.NO_PAYMENT_METHOD_ERROR));
};

BaseView.prototype.getPaymentMethod = function () {
  return this.activeMethodView && this.activeMethodView.paymentMethod;
};

BaseView.prototype.onSelection = function () {};

BaseView.prototype.teardown = function (cb) {
  cb();
};

module.exports = BaseView;

},{"../constants":71,"../lib/assign":77,"../lib/dropin-error":81}],113:[function(require,module,exports){
'use strict';

var analytics = require('../lib/analytics');
var analyticsKinds = require('../constants').analyticsKinds;
var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var sheetViews = require('./payment-sheet-views');
var PaymentMethodsView = require('./payment-methods-view');
var PaymentOptionsView = require('./payment-options-view');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');
var supportsFlexbox = require('../lib/supports-flexbox');
var transitionHelper = require('../lib/transition-helper');

function MainView() {
  BaseView.apply(this, arguments);

  this.dependenciesInitializing = 0;

  this._initialize();
}

MainView.prototype = Object.create(BaseView.prototype);
MainView.prototype.constructor = MainView;

MainView.prototype._initialize = function () {
  var hasMultiplePaymentOptions = this.model.supportedPaymentOptions.length > 1;
  var paymentOptionsView;
  var paymentMethods = this.model.getPaymentMethods();

  this._views = {};

  this.sheetContainer = this.getElementById('sheet-container');
  this.sheetErrorText = this.getElementById('sheet-error-text');

  this.toggle = this.getElementById('toggle');
  this.lowerContainer = this.getElementById('lower-container');

  this.loadingContainer = this.getElementById('loading-container');
  this.loadingIndicator = this.getElementById('loading-indicator');
  this.dropinContainer = this.element.querySelector('.braintree-dropin');

  this.supportsFlexbox = supportsFlexbox();

  this.model.on('asyncDependenciesReady', this.hideLoadingIndicator.bind(this));

  this.model.on('errorOccurred', this.showSheetError.bind(this));
  this.model.on('errorCleared', this.hideSheetError.bind(this));

  this.paymentSheetViewIDs = Object.keys(sheetViews).reduce(function (ids, sheetViewKey) {
    var PaymentSheetView, paymentSheetView;

    if (this.model.supportedPaymentOptions.indexOf(sheetViewKey) !== -1) {
      PaymentSheetView = sheetViews[sheetViewKey];

      paymentSheetView = new PaymentSheetView({
        element: this.getElementById(PaymentSheetView.ID),
        mainView: this,
        model: this.model,
        client: this.client,
        strings: this.strings
      });

      this.addView(paymentSheetView);
      ids.push(paymentSheetView.ID);
    }

    return ids;
  }.bind(this), []);

  this.paymentMethodsViews = new PaymentMethodsView({
    element: this.element,
    model: this.model,
    strings: this.strings
  });
  this.addView(this.paymentMethodsViews);

  addSelectionEventHandler(this.toggle, this.toggleAdditionalOptions.bind(this));

  this.model.on('changeActivePaymentMethod', function () {
    this.setPrimaryView(PaymentMethodsView.ID);
  }.bind(this));

  this.model.on('changeActivePaymentView', function (id) {
    var activePaymentView = this.getView(id);

    if (id === PaymentMethodsView.ID) {
      classlist.add(this.paymentMethodsViews.container, 'braintree-methods--active');
      classlist.remove(this.sheetContainer, 'braintree-sheet--active');
    } else {
      setTimeout(function () {
        classlist.add(this.sheetContainer, 'braintree-sheet--active');
      }.bind(this), 0);
      classlist.remove(this.paymentMethodsViews.container, 'braintree-methods--active');
      if (!this.getView(id).getPaymentMethod()) {
        this.model.setPaymentMethodRequestable({
          isRequestable: false
        });
      }
    }

    activePaymentView.onSelection();
  }.bind(this));

  if (hasMultiplePaymentOptions) {
    paymentOptionsView = new PaymentOptionsView({
      client: this.client,
      element: this.getElementById(PaymentOptionsView.ID),
      mainView: this,
      model: this.model,
      strings: this.strings
    });

    this.addView(paymentOptionsView);
  }

  if (paymentMethods.length > 0) {
    this.model.changeActivePaymentMethod(paymentMethods[0]);
  } else if (hasMultiplePaymentOptions) {
    this.setPrimaryView(paymentOptionsView.ID);
  } else {
    this.setPrimaryView(this.paymentSheetViewIDs[0]);
  }
};

MainView.prototype.addView = function (view) {
  this._views[view.ID] = view;
};

MainView.prototype.getView = function (id) {
  return this._views[id];
};

MainView.prototype.setPrimaryView = function (id, secondaryViewId) {
  var paymentMethod;

  setTimeout(function () {
    this.element.className = prefixShowClass(id);
    if (secondaryViewId) {
      classlist.add(this.element, prefixShowClass(secondaryViewId));
    }
  }.bind(this), 0);

  this.primaryView = this.getView(id);
  this.model.changeActivePaymentView(id);

  if (this.paymentSheetViewIDs.indexOf(id) !== -1) {
    if (this.model.getPaymentMethods().length > 0 || this.getView(PaymentOptionsView.ID)) {
      this.showToggle();
    } else {
      this.hideToggle();
    }
  } else if (id === PaymentMethodsView.ID) {
    this.showToggle();
    // Move options below the upper-container
    this.getElementById('lower-container').appendChild(this.getElementById('options'));
  } else if (id === PaymentOptionsView.ID) {
    this.hideToggle();
  }

  if (!this.supportsFlexbox) {
    this.element.setAttribute('data-braintree-no-flexbox', true);
  }

  paymentMethod = this.primaryView.getPaymentMethod();

  this.model.setPaymentMethodRequestable({
    isRequestable: Boolean(paymentMethod),
    type: paymentMethod && paymentMethod.type
  });

  this.model.clearError();
};

MainView.prototype.requestPaymentMethod = function (callback) {
  var activePaymentView = this.getView(this.model.getActivePaymentView());

  activePaymentView.requestPaymentMethod(function (err, payload) {
    if (err) {
      analytics.sendEvent(this.client, 'request-payment-method.error');
      callback(err);
      return;
    }

    this.setPrimaryView(PaymentMethodsView.ID);

    analytics.sendEvent(this.client, 'request-payment-method.' + analyticsKinds[payload.type]);
    callback(null, payload);
  }.bind(this));
};

MainView.prototype.hideLoadingIndicator = function () {
  classlist.add(this.dropinContainer, 'braintree-loaded');
  transitionHelper.onTransitionEnd(this.loadingIndicator, 'transform', function () {
    this.loadingContainer.parentNode.removeChild(this.loadingContainer);
  }.bind(this));
};

MainView.prototype.toggleAdditionalOptions = function () {
  var sheetViewID;
  var hasMultiplePaymentOptions = this.model.supportedPaymentOptions.length > 1;
  var isPaymentSheetView = this.paymentSheetViewIDs.indexOf(this.primaryView.ID) !== -1;

  this.hideToggle();

  if (!hasMultiplePaymentOptions) {
    sheetViewID = this.paymentSheetViewIDs[0];

    classlist.add(this.element, prefixShowClass(sheetViewID));
    this.model.changeActivePaymentView(sheetViewID);
  } else if (isPaymentSheetView) {
    if (this.model.getPaymentMethods().length === 0) {
      this.setPrimaryView(PaymentOptionsView.ID);
    } else {
      this.setPrimaryView(PaymentMethodsView.ID, PaymentOptionsView.ID);
      this.hideToggle();
    }
  } else {
    classlist.add(this.element, prefixShowClass(PaymentOptionsView.ID));
  }
};

MainView.prototype.showToggle = function () {
  classlist.remove(this.toggle, 'braintree-hidden');
  classlist.add(this.lowerContainer, 'braintree-hidden');
};

MainView.prototype.hideToggle = function () {
  classlist.add(this.toggle, 'braintree-hidden');
  classlist.remove(this.lowerContainer, 'braintree-hidden');
};

MainView.prototype.showSheetError = function (error) {
  var translatedErrorMessage;
  var errorMessage = this.strings.genericError;

  if (this.strings.hasOwnProperty(error)) {
    translatedErrorMessage = this.strings[error];
  } else if (error && error.code) {
    translatedErrorMessage = this.strings[snakeCaseToCamelCase(error.code) + 'Error'];
  }

  if (translatedErrorMessage) {
    errorMessage = translatedErrorMessage;
  }

  classlist.add(this.sheetContainer, 'braintree-sheet--has-error');
  this.sheetErrorText.textContent = errorMessage;
};

MainView.prototype.hideSheetError = function () {
  classlist.remove(this.sheetContainer, 'braintree-sheet--has-error');
};

MainView.prototype.getOptionsElements = function () {
  return this._views.options.elements;
};

MainView.prototype.teardown = function (callback) {
  var viewNames = Object.keys(this._views);
  var numberOfViews = viewNames.length;
  var viewsTornDown = 0;
  var error;

  viewNames.forEach(function (view) {
    this._views[view].teardown(function (err) {
      if (err) {
        error = err;
      }
      viewsTornDown += 1;

      if (viewsTornDown >= numberOfViews) {
        callback(error);
      }
    });
  }.bind(this));
};

function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function (m) {
    return m[1].toUpperCase();
  });
}

function prefixShowClass(classname) {
  return 'braintree-show-' + classname;
}

module.exports = MainView;

},{"../constants":71,"../lib/add-selection-event-handler":75,"../lib/analytics":76,"../lib/classlist":79,"../lib/supports-flexbox":85,"../lib/transition-helper":86,"./base-view":112,"./payment-methods-view":115,"./payment-options-view":116,"./payment-sheet-views":119}],114:[function(require,module,exports){
'use strict';

var BaseView = require('./base-view');
var classlist = require('../lib/classlist');
var constants = require('../constants');

var addSelectionEventHandler = require('../lib/add-selection-event-handler');

var paymentMethodHTML = "<div class=\"braintree-method__logo\">\n  <svg height=\"24\" width=\"40\" class=\"@CLASSNAME\">\n    <use xlink:href=\"#@ICON\"></use>\n  </svg>\n</div>\n\n<div class=\"braintree-method__label\">@TITLE<br><div class=\"braintree-method__label--small\">@SUBTITLE</div></div>\n\n<div class=\"braintree-method__check-container\">\n  <div class=\"braintree-method__check\">\n    <svg height=\"30\" width=\"50\">\n      <use xlink:href=\"#iconCheck\"></use>\n    </svg>\n  </div>\n</div>\n";

function PaymentMethodView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodView.prototype = Object.create(BaseView.prototype);
PaymentMethodView.prototype.constructor = PaymentMethodView;

PaymentMethodView.prototype._initialize = function () {
  var endingInText;
  var html = paymentMethodHTML;
  var paymentMethodCardTypes = constants.paymentMethodCardTypes;
  var paymentMethodTypes = constants.paymentMethodTypes;

  this.element = document.createElement('div');
  this.element.className = 'braintree-method';
  this.element.setAttribute('tabindex', '0');

  addSelectionEventHandler(this.element, function () {
    this.model.changeActivePaymentMethod(this.paymentMethod);
  }.bind(this));

  switch (this.paymentMethod.type) {
    case paymentMethodTypes.card:
      endingInText = this.strings.endingIn.replace('{{lastTwoCardDigits}}', this.paymentMethod.details.lastTwo);
      html = html.replace(/@ICON/g, 'icon-' + paymentMethodCardTypes[this.paymentMethod.details.cardType])
        .replace(/@CLASSNAME/g, ' braintree-icon--bordered')
        .replace(/@TITLE/g, endingInText)
        .replace(/@SUBTITLE/g, this.strings[this.paymentMethod.details.cardType]);
      break;
    case paymentMethodTypes.paypal:
      html = html.replace(/@ICON/g, 'logoPayPal')
        .replace(/@CLASSNAME/g, '')
        .replace(/@TITLE/g, this.paymentMethod.details.email)
        .replace(/@SUBTITLE/g, this.strings.PayPal);
      break;
    default:
      break;
  }

  this.element.innerHTML = html;
};

PaymentMethodView.prototype.setActive = function (isActive) {
  // setTimeout required to animate addition of new payment methods
  setTimeout(function () {
    classlist.toggle(this.element, 'braintree-method--active', isActive);
  }.bind(this), 0);
};

module.exports = PaymentMethodView;

},{"../constants":71,"../lib/add-selection-event-handler":75,"../lib/classlist":79,"./base-view":112}],115:[function(require,module,exports){
'use strict';

var BaseView = require('./base-view');
var PaymentMethodView = require('./payment-method-view');

var PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING = {
  CreditCard: 'Card',
  PayPalAccount: 'PayPal'
};

function PaymentMethodsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentMethodsView.prototype = Object.create(BaseView.prototype);
PaymentMethodsView.prototype.constructor = PaymentMethodsView;
PaymentMethodsView.ID = PaymentMethodsView.prototype.ID = 'methods';

PaymentMethodsView.prototype._initialize = function () {
  var i;
  var paymentMethods = this.model.getPaymentMethods();

  this.views = [];
  this.container = this.getElementById('methods-container');
  this._headingLabel = this.getElementById('methods-label');

  this.model.on('addPaymentMethod', this._addPaymentMethod.bind(this));
  this.model.on('removePaymentMethod', this._removePaymentMethod.bind(this));
  this.model.on('changeActivePaymentMethod', this._changeActivePaymentMethodView.bind(this));

  for (i = paymentMethods.length - 1; i >= 0; i--) {
    this._addPaymentMethod(paymentMethods[i]);
  }
};

PaymentMethodsView.prototype._getPaymentMethodString = function () {
  var stringKey = PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING[this.activeMethodView.paymentMethod.type];
  var paymentMethodTypeString = this.strings[stringKey];

  return this.strings.payingWith.replace('{{paymentSource}}', paymentMethodTypeString);
};

PaymentMethodsView.prototype._addPaymentMethod = function (paymentMethod) {
  var paymentMethodView = new PaymentMethodView({
    model: this.model,
    paymentMethod: paymentMethod,
    strings: this.strings
  });

  if (this.model.isGuestCheckout && this.container.firstChild) {
    this.container.removeChild(this.container.firstChild);
    this.views.pop();
  }

  if (this.container.firstChild) {
    this.container.insertBefore(paymentMethodView.element, this.container.firstChild);
  } else {
    this.container.appendChild(paymentMethodView.element);
  }

  this.views.push(paymentMethodView);
};

PaymentMethodsView.prototype._removePaymentMethod = function (paymentMethod) {
  var i;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      this.container.removeChild(this.views[i].element);
      this._headingLabel.innerHTML = '&nbsp;';
      this.views.splice(i, 1);
      break;
    }
  }
};

PaymentMethodsView.prototype._changeActivePaymentMethodView = function (paymentMethod) {
  var i;
  var previousActiveMethodView = this.activeMethodView;

  for (i = 0; i < this.views.length; i++) {
    if (this.views[i].paymentMethod === paymentMethod) {
      this.activeMethodView = this.views[i];
      this._headingLabel.textContent = this._getPaymentMethodString();
      break;
    }
  }

  if (previousActiveMethodView) {
    previousActiveMethodView.setActive(false);
  }
  this.activeMethodView.setActive(true);
};

PaymentMethodsView.prototype.requestPaymentMethod = function (callback) {
  callback(null, this.activeMethodView.paymentMethod);
};

module.exports = PaymentMethodsView;

},{"./base-view":112,"./payment-method-view":114}],116:[function(require,module,exports){
'use strict';

var analytics = require('../lib/analytics');
var addSelectionEventHandler = require('../lib/add-selection-event-handler');
var BaseView = require('./base-view');

var paymentOptionIDs = require('../constants').paymentOptionIDs;

var paymentMethodOptionHTML = "<div class=\"braintree-option__logo\">\n  <svg height=\"28\" width=\"48\" class=\"@CLASSNAME\">\n    <use xlink:href=\"#@ICON\"></use>\n  </svg>\n</div>\n\n<div class=\"braintree-option__label\">\n  @OPTION_TITLE\n  <div class=\"braintree-option__disabled-message\"></div>\n</div>\n";

function PaymentOptionsView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

PaymentOptionsView.prototype = Object.create(BaseView.prototype);
PaymentOptionsView.prototype.constructor = PaymentOptionsView;
PaymentOptionsView.ID = PaymentOptionsView.prototype.ID = 'options';

PaymentOptionsView.prototype._initialize = function () {
  this.container = this.getElementById('payment-options-container');
  this.elements = {};

  this.model.supportedPaymentOptions.forEach(function (paymentOptionID) {
    this._addPaymentOption(paymentOptionID);
  }.bind(this));
};

PaymentOptionsView.prototype._addPaymentOption = function (paymentOptionID) {
  var div = document.createElement('div');
  var html = paymentMethodOptionHTML;
  var clickHandler = function clickHandler() {
    this.mainView.setPrimaryView(paymentOptionID);
    analytics.sendEvent(this.client, 'selected.' + paymentOptionIDs[paymentOptionID]);
  }.bind(this);

  div.className = 'braintree-option braintree-option__' + paymentOptionID;
  div.setAttribute('tabindex', '0');

  switch (paymentOptionID) {
    case paymentOptionIDs.card:
      html = html.replace(/@ICON/g, 'iconCardFront');
      html = html.replace(/@OPTION_TITLE/g, this.strings.Card);
      html = html.replace(/@CLASSNAME/g, 'braintree-icon--bordered');
      break;
    case paymentOptionIDs.paypal:
      html = html.replace(/@ICON/g, 'logoPayPal');
      html = html.replace(/@OPTION_TITLE/g, this.strings.PayPal);
      html = html.replace(/@CLASSNAME/g, '');
      break;
    case paymentOptionIDs.paypalCredit:
      html = html.replace(/@ICON/g, 'logoPayPalCredit');
      html = html.replace(/@OPTION_TITLE/g, this.strings['PayPal Credit']);
      html = html.replace(/@CLASSNAME/g, '');
      break;
    default:
      break;
  }

  div.innerHTML = html;

  addSelectionEventHandler(div, clickHandler);

  this.container.appendChild(div);
  this.elements[paymentOptionID] = {
    div: div,
    clickHandler: clickHandler
  };
};

module.exports = PaymentOptionsView;

},{"../constants":71,"../lib/add-selection-event-handler":75,"../lib/analytics":76,"./base-view":112}],117:[function(require,module,exports){
(function (global){
'use strict';

var assign = require('../../lib/assign').assign;
var BaseView = require('../base-view');
var btPaypal = require('braintree-web/paypal-checkout');
var DropinError = require('../../lib/dropin-error');

var ASYNC_DEPENDENCY_TIMEOUT = 30000;
var READ_ONLY_CONFIGURATION_OPTIONS = ['offerCredit', 'locale'];

function BasePayPalView() {
  BaseView.apply(this, arguments);
}

BasePayPalView.prototype = Object.create(BaseView.prototype);

BasePayPalView.prototype._initialize = function (isCredit) {
  var asyncDependencyTimeoutHandler;
  var self = this;
  var paypalType = isCredit ? 'paypalCredit' : 'paypal';
  var paypalConfiguration = this.model.merchantConfiguration[paypalType];

  this.paypalConfiguration = assign({}, paypalConfiguration);

  this.model.asyncDependencyStarting();
  asyncDependencyTimeoutHandler = setTimeout(function () {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError('There was an error connecting to PayPal.')
    });
  }, ASYNC_DEPENDENCY_TIMEOUT);

  btPaypal.create({client: this.client}, function (err, paypalInstance) {
    var checkoutJSConfiguration;
    var buttonSelector = '[data-braintree-id="paypal-button"]';
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';
    var locale = self.model.merchantConfiguration.locale;

    if (err) {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      return;
    }

    self.paypalInstance = paypalInstance;

    self.paypalConfiguration.offerCredit = Boolean(isCredit);
    checkoutJSConfiguration = {
      env: environment,
      locale: locale,
      payment: function () {
        return paypalInstance.createPayment(self.paypalConfiguration).catch(reportError);
      },
      onAuthorize: function (data) {
        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          if (self.paypalConfiguration.flow === 'vault' && !self.model.isGuestCheckout) {
            tokenizePayload.vaulted = true;
          }
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },
      onError: reportError
    };

    if (locale) {
      self.paypalConfiguration.locale = locale;
    }

    if (isCredit) {
      buttonSelector = '[data-braintree-id="paypal-credit-button"]';
      checkoutJSConfiguration.style = {label: 'credit'};
    }

    global.paypal.Button.render(checkoutJSConfiguration, buttonSelector).then(function () {
      self.model.asyncDependencyReady();
      clearTimeout(asyncDependencyTimeoutHandler);
    });
  });

  function reportError(err) {
    self.model.reportError(err);
  }
};

BasePayPalView.prototype.updateConfiguration = function (key, value) {
  if (READ_ONLY_CONFIGURATION_OPTIONS.indexOf(key) === -1) {
    this.paypalConfiguration[key] = value;
  }
};

module.exports = BasePayPalView;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../lib/assign":77,"../../lib/dropin-error":81,"../base-view":112,"braintree-web/paypal-checkout":49}],118:[function(require,module,exports){
'use strict';


var BaseView = require('../base-view');
var classlist = require('../../lib/classlist');
var constants = require('../../constants');
var DropinError = require('../../lib/dropin-error');
var hostedFields = require('braintree-web/hosted-fields');
var transitionHelper = require('../../lib/transition-helper');

var cardIconHTML = "<div data-braintree-id=\"visa-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-visa\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"master-card-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-master-card\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"unionpay-card-icon\" class=\"braintree-sheet__card-icon braintree-hidden\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-unionpay\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"american-express-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-american-express\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"jcb-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-jcb\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"diners-club-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-diners-club\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"discover-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-discover\"></use>\n    </svg>\n</div>\n<div data-braintree-id=\"maestro-card-icon\" class=\"braintree-sheet__card-icon\">\n    <svg height=\"24\" width=\"40\">\n        <use xlink:href=\"#icon-maestro\"></use>\n    </svg>\n</div>\n";

function CardView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

CardView.prototype = Object.create(BaseView.prototype);
CardView.prototype.constructor = CardView;
CardView.ID = CardView.prototype.ID = constants.paymentOptionIDs.card;

CardView.prototype._initialize = function () {
  var cvvFieldGroup, postalCodeFieldGroup;
  var cardIcons = this.getElementById('card-view-icons');
  var challenges = this.client.getConfiguration().gatewayConfiguration.challenges;
  var hasCVV = challenges.indexOf('cvv') !== -1;
  var hasPostal = challenges.indexOf('postal_code') !== -1;
  var hfOptions = {
    client: this.client,
    fields: {
      number: {
        selector: this._generateFieldSelector('number'),
        placeholder: '•••• •••• •••• ••••'
      },
      expirationDate: {
        selector: this._generateFieldSelector('expiration'),
        placeholder: this.strings.expirationDatePlaceholder
      },
      cvv: {
        selector: this._generateFieldSelector('cvv'),
        placeholder: '•••'
      },
      postalCode: {
        selector: this._generateFieldSelector('postal-code')
      }
    },
    styles: {
      input: {
        'font-size': '16px',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        color: '#000'
      },
      ':focus': {
        color: 'black'
      },
      '::-webkit-input-placeholder': {
        color: '#6a6a6a'
      },
      ':-moz-placeholder': {
        color: '#6a6a6a'
      },
      '::-moz-placeholder': {
        color: '#6a6a6a'
      },
      ':-ms-input-placeholder ': {
        color: '#6a6a6a'
      },
      'input::-ms-clear': {
        color: 'transparent'
      }
    }
  };

  cardIcons.innerHTML = cardIconHTML;
  this._hideUnsupportedCardIcons();

  this.hasCVV = hasCVV;
  this.cardNumberIcon = this.getElementById('card-number-icon');
  this.cardNumberIconSvg = this.getElementById('card-number-icon-svg');
  this.cvvIcon = this.getElementById('cvv-icon');
  this.cvvIconSvg = this.getElementById('cvv-icon-svg');
  this.cvvLabelDescriptor = this.getElementById('cvv-label-descriptor');
  this.fieldErrors = {};

  if (!hasCVV) {
    cvvFieldGroup = this.getElementById('cvv-field-group');

    cvvFieldGroup.parentNode.removeChild(cvvFieldGroup);
    delete hfOptions.fields.cvv;
  }
  if (!hasPostal) {
    postalCodeFieldGroup = this.getElementById('postal-code-field-group');

    postalCodeFieldGroup.parentNode.removeChild(postalCodeFieldGroup);
    delete hfOptions.fields.postalCode;
  }

  this.model.asyncDependencyStarting();

  hostedFields.create(hfOptions, function (err, hostedFieldsInstance) {
    if (err) {
      this.model.asyncDependencyFailed({
        view: this.ID,
        error: err
      });
      return;
    }

    this.hostedFieldsInstance = hostedFieldsInstance;
    this.hostedFieldsInstance.on('blur', this._onBlurEvent.bind(this));
    this.hostedFieldsInstance.on('cardTypeChange', this._onCardTypeChangeEvent.bind(this));
    this.hostedFieldsInstance.on('focus', this._onFocusEvent.bind(this));
    this.hostedFieldsInstance.on('notEmpty', this._onNotEmptyEvent.bind(this));
    this.hostedFieldsInstance.on('validityChange', this._onValidityChangeEvent.bind(this));

    this.model.asyncDependencyReady();
  }.bind(this));
};

CardView.prototype._validateForm = function (showFieldErrors) {
  var cardType, cardTypeSupported, state;
  var isValid = true;
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  if (!this.hostedFieldsInstance) {
    return false;
  }

  state = this.hostedFieldsInstance.getState();

  Object.keys(state.fields).forEach(function (key) {
    var field = state.fields[key];

    if (!showFieldErrors && !isValid) {
      // return early if form is already invalid
      // and we don't need to display all field errors
      return;
    }

    if (field.isEmpty) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError(key, this.strings['fieldEmptyFor' + capitalize(key)]);
      }
    } else if (!field.isValid) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError(key, this.strings['fieldInvalidFor' + capitalize(key)]);
      }
    }
  }.bind(this));

  if (state.fields.number.isValid) {
    cardType = constants.configurationCardTypes[state.cards[0].type];
    cardTypeSupported = supportedCardTypes.indexOf(cardType) !== -1;

    if (!cardTypeSupported) {
      isValid = false;

      if (showFieldErrors) {
        this.showFieldError('number', this.strings.unsupportedCardTypeError);
      }
    }
  }

  return isValid;
};

CardView.prototype.getPaymentMethod = function () { // eslint-disable-line consistent-return
  var formIsValid = this._validateForm();

  if (formIsValid) {
    return {
      type: constants.paymentMethodTypes.card
    };
  }
};

CardView.prototype.tokenize = function (callback) {
  var transitionCallback;
  var self = this;
  var state = self.hostedFieldsInstance.getState();

  this.model.clearError();

  if (this._validateForm(true)) {
    self._isTokenizing = true;

    self.hostedFieldsInstance.tokenize({
      vault: !self.model.isGuestCheckout
    }, function (err, payload) {
      if (err) {
        self._isTokenizing = false;
        self.model.reportError(err);
        callback(new DropinError({
          message: constants.errors.NO_PAYMENT_METHOD_ERROR,
          braintreeWebError: err
        }));
        classlist.remove(self.element, 'braintree-sheet--loading');
        return;
      }

      Object.keys(state.fields).forEach(function (field) {
        self.hostedFieldsInstance.clear(field);
      });

      if (!self.model.isGuestCheckout) {
        payload.vaulted = true;
      }

      transitionCallback = function () {
        // Wait for braintree-sheet--tokenized class to be added in IE 9
        // before attempting to remove it
        setTimeout(function () {
          self.model.addPaymentMethod(payload);
          callback(null, payload);
          classlist.remove(self.element, 'braintree-sheet--tokenized');
        }, 0);
        self._isTokenizing = false;
      };

      transitionHelper.onTransitionEnd(self.element, 'max-height', transitionCallback);

      classlist.remove(self.element, 'braintree-sheet--loading');
      classlist.add(self.element, 'braintree-sheet--tokenized');
    });
  } else {
    self.model.reportError('hostedFieldsFieldsInvalidError');
    callback(new DropinError(constants.errors.NO_PAYMENT_METHOD_ERROR));
    classlist.remove(self.element, 'braintree-sheet--loading');
  }
};

CardView.prototype.showFieldError = function (field, errorMessage) {
  var fieldError;
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(field) + '-field-group');

  if (!this.fieldErrors.hasOwnProperty(field)) {
    this.fieldErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-field-error');
  }

  classlist.add(fieldGroup, 'braintree-form__field-group--has-error');

  fieldError = this.fieldErrors[field];
  fieldError.textContent = errorMessage;
};

CardView.prototype.hideFieldError = function (field) {
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(field) + '-field-group');

  if (!this.fieldErrors.hasOwnProperty(field)) {
    this.fieldErrors[field] = this.getElementById(camelCaseToSnakeCase(field) + '-field-error');
  }

  classlist.remove(fieldGroup, 'braintree-form__field-group--has-error');
};

CardView.prototype.teardown = function (callback) {
  this.hostedFieldsInstance.teardown(callback);
};

CardView.prototype._generateFieldSelector = function (field) {
  return '#braintree--dropin__' + this.model.componentID + ' .braintree-form-' + field;
};

CardView.prototype._onBlurEvent = function (event) {
  var field = event.fields[event.emittedBy];
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(event.emittedBy) + '-field-group');
  var activeId = document.activeElement && document.activeElement.id;
  var isHostedFieldsElement = document.activeElement instanceof HTMLIFrameElement && activeId.indexOf('braintree-hosted-field') !== -1;

  classlist.remove(fieldGroup, 'braintree-form__field-group--is-focused');

  if (isHostedFieldsElement && field.isEmpty) {
    this.showFieldError(event.emittedBy, this.strings['fieldEmptyFor' + capitalize(event.emittedBy)]);
  } else if (!field.isEmpty && !field.isValid) {
    this.showFieldError(event.emittedBy, this.strings['fieldInvalidFor' + capitalize(event.emittedBy)]);
  } else if (event.emittedBy === 'number' && !this._isCardTypeSupported(event.cards[0].type)) {
    this.showFieldError('number', this.strings.unsupportedCardTypeError);
  }
};

CardView.prototype._onCardTypeChangeEvent = function (event) {
  var cardType;
  var cardNumberHrefLink = '#iconCardFront';
  var cvvHrefLink = '#iconCVVBack';
  var cvvDescriptor = '(3 digits)';
  var cvvPlaceholder = '•••';
  var numberFieldGroup = this.getElementById('number-field-group');

  if (event.cards.length === 1) {
    cardType = event.cards[0].type;
    cardNumberHrefLink = '#icon-' + cardType;
    if (cardType === 'american-express') {
      cvvHrefLink = '#iconCVVFront';
      cvvDescriptor = '(4 digits)';
      cvvPlaceholder = '••••';
    }
    // Keep icon visible when field is not focused
    classlist.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  } else {
    classlist.remove(numberFieldGroup, 'braintree-form__field-group--card-type-known');
  }

  this.cardNumberIconSvg.setAttribute('xlink:href', cardNumberHrefLink);

  if (this.hasCVV) {
    this.cvvIconSvg.setAttribute('xlink:href', cvvHrefLink);
    this.cvvLabelDescriptor.textContent = cvvDescriptor;
    this.hostedFieldsInstance.setAttribute({
      field: 'cvv',
      attribute: 'placeholder',
      value: cvvPlaceholder
    });
  }
};

CardView.prototype._onFocusEvent = function (event) {
  var fieldGroup = this.getElementById(camelCaseToSnakeCase(event.emittedBy) + '-field-group');

  classlist.add(fieldGroup, 'braintree-form__field-group--is-focused');
};

CardView.prototype._onNotEmptyEvent = function (event) {
  this.hideFieldError(event.emittedBy);
};

CardView.prototype._onValidityChangeEvent = function (event) {
  var isValid;
  var field = event.fields[event.emittedBy];

  if (event.emittedBy === 'number' && event.cards[0]) {
    isValid = field.isValid && this._isCardTypeSupported(event.cards[0].type);
  } else {
    isValid = field.isValid;
  }

  classlist.toggle(field.container, 'braintree-form__field--valid', isValid);

  if (field.isPotentiallyValid) {
    this.hideFieldError(event.emittedBy);
  }

  if (!this._isTokenizing) {
    this.model.setPaymentMethodRequestable({
      isRequestable: this._validateForm(),
      type: constants.paymentMethodTypes.card
    });
  }
};

CardView.prototype.requestPaymentMethod = function (callback) {
  classlist.add(this.element, 'braintree-sheet--loading');
  this.tokenize(callback);
};

CardView.prototype.onSelection = function () {
  if (this.hostedFieldsInstance) {
    this.hostedFieldsInstance.focus('number');
  }
};

CardView.prototype._hideUnsupportedCardIcons = function () {
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  Object.keys(constants.configurationCardTypes).forEach(function (paymentMethodCardType) {
    var cardIcon;
    var configurationCardType = constants.configurationCardTypes[paymentMethodCardType];

    if (supportedCardTypes.indexOf(configurationCardType) === -1) {
      cardIcon = this.getElementById(paymentMethodCardType + '-card-icon');
      classlist.add(cardIcon, 'braintree-hidden');
    }
  }.bind(this));
};

CardView.prototype._isCardTypeSupported = function (cardType) {
  var configurationCardType = constants.configurationCardTypes[cardType];
  var supportedCardTypes = this.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  return supportedCardTypes.indexOf(configurationCardType) !== -1;
};

function camelCaseToSnakeCase(string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function capitalize(string) {
  return string[0].toUpperCase() + string.substr(1);
}

module.exports = CardView;

},{"../../constants":71,"../../lib/classlist":79,"../../lib/dropin-error":81,"../../lib/transition-helper":86,"../base-view":112,"braintree-web/hosted-fields":17}],119:[function(require,module,exports){
'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;

var result = {};

result[paymentOptionIDs.card] = require('./card-view');
result[paymentOptionIDs.paypal] = require('./paypal-view');
result[paymentOptionIDs.paypalCredit] = require('./paypal-credit-view');

module.exports = result;

},{"../../constants":71,"./card-view":118,"./paypal-credit-view":120,"./paypal-view":121}],120:[function(require,module,exports){
'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var BasePayPalView = require('./base-paypal-view');

function PayPalCreditView() {
  BasePayPalView.apply(this, arguments);

  this._initialize(true);
}

PayPalCreditView.prototype = Object.create(BasePayPalView.prototype);
PayPalCreditView.prototype.constructor = PayPalCreditView;
PayPalCreditView.ID = PayPalCreditView.prototype.ID = paymentOptionIDs.paypalCredit;

module.exports = PayPalCreditView;

},{"../../constants":71,"./base-paypal-view":117}],121:[function(require,module,exports){
'use strict';

var paymentOptionIDs = require('../../constants').paymentOptionIDs;
var BasePayPalView = require('./base-paypal-view');

function PayPalView() {
  BasePayPalView.apply(this, arguments);

  this._initialize(false);
}

PayPalView.prototype = Object.create(BasePayPalView.prototype);
PayPalView.prototype.constructor = PayPalView;
PayPalView.ID = PayPalView.prototype.ID = paymentOptionIDs.paypal;

module.exports = PayPalView;

},{"../../constants":71,"./base-paypal-view":117}]},{},[74])(74)
});