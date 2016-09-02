'use strict';

var dropin = require('../../src/index');
var Dropin = require('../../src/dropin');
var client = require('braintree-web/client');
var fake = require('../helpers/fake');
var dropinConstants = require('../../src/constants');

describe('dropin.create', function () {
  beforeEach(function () {
    this.form = document.createElement('form');

    this.container = document.createElement('div');
    this.container.id = 'foo';

    this.form.appendChild(this.container);
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
      getConfiguration: fake.configuration
    };

    this.sandbox.stub(Dropin.prototype, 'initialize', function (callback) {
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

  it('returns an error to callback if Drop-in initilization fails', function (done) {
    var fakeClient = {
      getConfiguration: fake.configuration
    };
    var dropinError = new Error('Dropin Error');

    this.sandbox.stub(Dropin.prototype, 'initialize').yields(dropinError);

    client.create.yields(null, fakeClient);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, function (err) {
      expect(err).to.equal(dropinError);

      done();
    });
  });

  it('sets the correct analytics metadata', function (done) {
    var fakeClient = {
      getConfiguration: fake.configuration
    };

    this.sandbox.stub(Dropin.prototype, 'initialize', function (callback) {
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
});
