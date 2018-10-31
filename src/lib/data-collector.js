'use strict';

var constants = require('../constants');
var assets = require('@braintree/asset-loader');
var Promise = require('./promise');

function DataCollector(config) {
  this._config = config;
}

DataCollector.prototype.initialize = function () {
  var self = this;

  return Promise.resolve().then(function () {
    var braintreeWebVersion;

    if (global.braintree && global.braintree.dataCollector) {
      return Promise.resolve();
    }

    braintreeWebVersion = self._config.client.getVersion();

    return assets.loadScript({
      src: 'https://js.braintreegateway.com/web/' + braintreeWebVersion + '/js/data-collector.min.js',
      id: constants.DATA_COLLECTOR_SCRIPT_ID
    });
  }).then(function () {
    return global.braintree.dataCollector.create(self._config);
  }).then(function (instance) {
    self._instance = instance;
  });
};

DataCollector.prototype.getDeviceData = function () {
  return this._instance.deviceData;
};

DataCollector.prototype.teardown = function () {
  return this._instance.teardown();
};

module.exports = DataCollector;
