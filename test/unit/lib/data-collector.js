'use strict';

var fake = require('../../helpers/fake');
var assets = require('@braintree/asset-loader');
var Promise = require('../../../src/lib/promise');
var analytics = require('../../../src/lib/analytics');
var DataCollector = require('../../../src/lib/data-collector');

describe('DataCollector', function () {
  beforeEach(function () {
    this.sandbox.stub(analytics, 'sendEvent');
    this.dataCollectorInstance = fake.dataCollectorInstance;
    this.sandbox.stub(this.dataCollectorInstance, 'teardown').resolves();
  });

  describe('initialize', function () {
    beforeEach(function () {
      var createStub = this.sandbox.stub().resolves(this.dataCollectorInstance);

      function makeFakeBraintree() {
        return {
          dataCollector: {
            create: createStub
          }
        };
      }

      this.config = {
        client: {
          getVersion: this.sandbox.stub().returns('1.2.3')
        },
        kount: true
      };

      global.braintree = makeFakeBraintree();

      this.sandbox.stub(assets, 'loadScript').callsFake(function () {
        global.braintree = makeFakeBraintree();

        return Promise.resolve();
      });
    });

    afterEach(function () {
      delete global.braintree;
    });

    it('loads datacollector script if data collector does not exist on braintree object', function () {
      var dc = new DataCollector(this.config);

      delete global.braintree.dataCollector;

      return dc.initialize().then(function () {
        expect(assets.loadScript).to.be.calledOnce;
        expect(assets.loadScript).to.be.calledWith({
          crossorigin: 'anonymous',
          src: 'https://js.braintreegateway.com/web/1.2.3/js/data-collector.min.js',
          id: 'braintree-dropin-data-collector-script'
        });
      });
    });

    it('loads datacollector script if braintree object does not exist', function () {
      var dc = new DataCollector(this.config);

      delete global.braintree;

      return dc.initialize().then(function () {
        expect(assets.loadScript).to.be.calledOnce;
        expect(assets.loadScript).to.be.calledWith({
          crossorigin: 'anonymous',
          src: 'https://js.braintreegateway.com/web/1.2.3/js/data-collector.min.js',
          id: 'braintree-dropin-data-collector-script'
        });
      });
    });

    it('does not load datacollector script if it already exists', function () {
      var dc = new DataCollector(this.config);

      return dc.initialize().then(function () {
        expect(assets.loadScript).to.not.be.called;
      });
    });

    it('creates a data collector instance', function () {
      var dc = new DataCollector(this.config);

      expect(dc._instance).to.not.exist;

      return dc.initialize().then(function () {
        expect(dc._instance).to.equal(this.dataCollectorInstance);
      }.bind(this));
    });

    it('resolves even if data collector setup fails', function () {
      var dc = new DataCollector(this.config);
      var err = new Error('fail');

      this.sandbox.stub(dc, 'log');
      global.braintree.dataCollector.create.rejects(err);

      return dc.initialize().then(function () {
        expect(dc._instance).to.not.exist;
        expect(dc.log).to.be.calledWith(err);
        expect(analytics.sendEvent).to.be.calledWith(this.config.client, 'data-collector.setup-failed');
      }.bind(this));
    });
  });

  describe('getDeviceData', function () {
    it('returns device data', function () {
      var dc = new DataCollector({});

      dc._instance = this.dataCollectorInstance;

      expect(dc.getDeviceData()).to.equal('device-data');
    });
  });

  describe('teardown', function () {
    it('calls teardown on data collector instance', function () {
      var dc = new DataCollector({});

      dc._instance = this.dataCollectorInstance;

      return dc.teardown().then(function () {
        expect(this.dataCollectorInstance.teardown).to.be.calledOnce;
      }.bind(this));
    });
  });
});
