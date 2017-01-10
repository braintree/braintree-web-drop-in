'use strict';

var dropin = require('../../src/index');
var Dropin = require('../../src/dropin');
var client = require('braintree-web/client');
var fake = require('../helpers/fake');
var dropinConstants = require('../../src/constants');
var analytics = require('../../src/lib/analytics');

describe('dropin.create', function () {
  beforeEach(function () {
    var container = document.createElement('div');

    this.form = document.createElement('form');

    container.id = 'foo';

    this.form.appendChild(container);
    document.body.appendChild(this.form);

    this.sandbox.stub(client, 'create');
  });

  afterEach(function () {
    document.body.removeChild(this.form);
  });

  it('errors out if no authorization given', function (done) {
    dropin.create({}, function (err, instance) {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.message).to.equal('options.authorization is required.');
      expect(instance).not.to.exist;
      done();
    });
  });

  it('returns an error if client.create errors', function (done) {
    var originalErr = new Error('you goofed!!');

    client.create.yields(originalErr);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, function (err, instance) {
      expect(err).to.equal(originalErr);
      expect(instance).not.to.exist;
      done();
    });
  });

  it('requires a callback', function (done) {
    try {
      dropin.create({
        authorization: 'tokenization_key',
        selector: '#foo'
      });
    } catch (err) {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.message).to.equal('create must include a callback function.');

      done();
    }
  });

  it('returns a Dropin instance if client.create returns successfully', function (done) {
    var fakeClient = {
      getConfiguration: fake.configuration,
      request: function () {},
      _request: function () {}
    };

    this.sandbox.stub(Dropin.prototype, '_initialize', function (callback) {
      callback(null, this);
    });

    client.create.yields(null, fakeClient);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, function (err, instance) {
      expect(err).not.to.exist;
      expect(instance).be.an.instanceOf(Dropin);

      done();
    });
  });

  it('returns an error to callback if Drop-in initialization fails', function (done) {
    var fakeClient = {
      getConfiguration: fake.configuration,
      request: function () {},
      _request: function () {}
    };
    var dropinError = new Error('Dropin Error');

    this.sandbox.stub(Dropin.prototype, '_initialize').yields(dropinError);

    client.create.yields(null, fakeClient);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, function (err, instance) {
      expect(err).to.equal(dropinError);
      expect(instance).not.to.exist;

      done();
    });
  });

  it('sets the correct analytics metadata', function (done) {
    var fakeClient = {
      getConfiguration: fake.configuration,
      request: function () {},
      _request: function () {}
    };

    this.sandbox.stub(Dropin.prototype, '_initialize', function (callback) {
      callback(null, this);
    });

    client.create.yields(null, fakeClient);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, function () {
      var configuration = fakeClient.toJSON();

      expect(configuration.analyticsMetadata.integration).to.equal(dropinConstants.INTEGRATION);
      expect(configuration.analyticsMetadata.integrationType).to.equal(dropinConstants.INTEGRATION);

      done();
    });
  });

  it('sends web.dropin.started.tokenization-key event when using a tokenization key', function (done) {
    var fakeClient = {
      getConfiguration: fake.configuration,
      request: function () {},
      _request: function () {}
    };

    this.sandbox.stub(Dropin.prototype, '_initialize', function (callback) {
      callback(null, this);
    });
    this.sandbox.stub(analytics, 'sendEvent');

    client.create.yields(null, fakeClient);

    dropin.create({
      authorization: fake.tokenizationKey,
      selector: '#foo'
    }, function () {
      expect(analytics.sendEvent).to.be.calledWith(fakeClient, 'started.tokenization-key');
      done();
    });
  });

  it('sends web.dropin.started.client-token event when using a client token', function (done) {
    var fakeConfiguration, fakeClient;

    fakeConfiguration = fake.configuration();
    fakeConfiguration.authorizationType = 'CLIENT_TOKEN';
    fakeConfiguration.authorization = fake.clientToken;

    fakeClient = {
      getConfiguration: function () { return fakeConfiguration; },
      request: function () {},
      _request: function () {}
    };

    this.sandbox.stub(Dropin.prototype, '_initialize', function (callback) {
      callback(null, this);
    });
    this.sandbox.stub(analytics, 'sendEvent');

    client.create.yields(null, fakeClient);

    dropin.create({
      authorization: fake.clientToken,
      selector: '#foo'
    }, function () {
      expect(analytics.sendEvent).to.be.calledWith(fakeClient, 'started.client-token');
      done();
    });
  });
});
