'use strict';
/* eslint-disable no-new */

var BaseView = require('../../../../src/views/base-view');
var VenmoView = require('../../../../src/views/payment-sheet-views/venmo-view');
var btVenmo = require('braintree-web/venmo');
var DropinModel = require('../../../../src/dropin-model');
var DropinError = require('../../../../src/lib/dropin-error');
var fake = require('../../../helpers/fake');
var fs = require('fs');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('VenmoView', function () {
  beforeEach(function () {
    this.fakeClient = {
      getConfiguration: this.sandbox.stub().returns(fake.configuration()),
      getVersion: function () {}
    };

    this.model = new DropinModel(fake.modelOptions());
    this.sandbox.stub(this.model, 'reportAppSwitchPayload');
    this.sandbox.stub(this.model, 'reportAppSwitchError');

    this.div = document.createElement('div');
    this.div.innerHTML = mainHTML;

    document.body.appendChild(this.div);

    this.model.merchantConfiguration.venmo = true;
    this.venmoViewOptions = {
      client: this.fakeClient,
      element: document.body.querySelector('.braintree-sheet.braintree-venmo'),
      model: this.model,
      strings: {}
    };

    this.fakeVenmoInstance = {
      tokenize: this.sandbox.stub().resolves({
        type: 'VenmoAccount',
        nonce: 'fake-nonce'
      }),
      hasTokenizationResult: this.sandbox.stub().returns(false)
    };
    this.sandbox.stub(btVenmo, 'create').resolves(this.fakeVenmoInstance);
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new VenmoView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.view = new VenmoView(this.venmoViewOptions);
    });

    it('starts async dependency', function () {
      this.sandbox.stub(this.view.model, 'asyncDependencyStarting');

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyStarting).to.be.calledOnce;
      }.bind(this));
    });

    it('notifies async dependency', function () {
      this.sandbox.stub(this.view.model, 'asyncDependencyReady');

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyReady).to.be.calledOnce;
      }.bind(this));
    });

    it('creates an Venmo component', function () {
      return this.view.initialize().then(function () {
        expect(btVenmo.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client
        }));
        expect(this.view.venmoInstance).to.equal(this.fakeVenmoInstance);
      }.bind(this));
    });

    it('passes in merchant configuration when creating venmo component', function () {
      this.view.model.merchantConfiguration.venmo = {allowNewBrowserTab: false};

      return this.view.initialize().then(function () {
        expect(btVenmo.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client,
          allowNewBrowserTab: false
        }));
      }.bind(this));
    });

    it('checks if there is a tokenization result on the page already', function () {
      return this.view.initialize().then(function () {
        expect(this.fakeVenmoInstance.hasTokenizationResult).to.be.calledOnce;
      }.bind(this));
    });

    it('reports app switch payload if page has a successful tokenization result', function () {
      var payload = {type: 'VenmoAccount', nonce: 'fake-venmo-nonce'};

      this.fakeVenmoInstance.hasTokenizationResult.returns(true);
      this.fakeVenmoInstance.tokenize.resolves(payload);

      return this.view.initialize().then(function () {
        expect(this.fakeVenmoInstance.tokenize).to.be.calledOnce;
        expect(this.model.reportAppSwitchPayload).to.be.calledOnce;
        expect(this.model.reportAppSwitchPayload).to.be.calledWith(payload);
        expect(this.model.reportAppSwitchError).to.not.be.called;
      }.bind(this));
    });

    it('reports app switch error if page has an unsuccessful tokenization result', function () {
      var error = new Error('failure');

      this.fakeVenmoInstance.hasTokenizationResult.returns(true);
      this.fakeVenmoInstance.tokenize.rejects(error);

      return this.view.initialize().then(function () {
        expect(this.fakeVenmoInstance.tokenize).to.be.calledOnce;
        expect(this.model.reportAppSwitchError).to.be.calledOnce;
        expect(this.model.reportAppSwitchError).to.be.calledWith('venmo', error);
        expect(this.model.reportAppSwitchPayload).to.not.be.called;
      }.bind(this));
    });

    it('does not report app switch error for VENMO_APP_CANCELLED error', function () {
      var error = new Error('failure');

      error.code = 'VENMO_APP_CANCELED';

      this.fakeVenmoInstance.hasTokenizationResult.returns(true);
      this.fakeVenmoInstance.tokenize.rejects(error);

      return this.view.initialize().then(function () {
        expect(this.fakeVenmoInstance.tokenize).to.be.calledOnce;
        expect(this.model.reportAppSwitchError).to.not.be.called;
        expect(this.model.reportAppSwitchPayload).to.not.be.called;
      }.bind(this));
    });

    it('calls asyncDependencyFailed when Venmo component creation fails', function () {
      var fakeError = new DropinError('A_FAKE_ERROR');

      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');
      btVenmo.create.rejects(fakeError);

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.view.model.asyncDependencyFailed).to.be.calledWith(this.sandbox.match({
          error: fakeError,
          view: 'venmo'
        }));
      }.bind(this));
    });

    it('sets up a button click handler', function () {
      var button = document.querySelector('[data-braintree-id="venmo-button"]');

      this.sandbox.spy(button, 'addEventListener');

      return this.view.initialize().then(function () {
        expect(button.addEventListener).to.be.calledOnce;
        expect(button.addEventListener).to.be.calledWith('click', this.sandbox.match.func);
      }.bind(this));
    });

    describe('button click handler', function () {
      beforeEach(function () {
        var button = document.querySelector('[data-braintree-id="venmo-button"]');
        var self = this;
        var view = new VenmoView(this.venmoViewOptions);

        this.sandbox.stub(this.model, 'addPaymentMethod');
        this.sandbox.stub(this.model, 'reportError');
        this.sandbox.spy(button, 'addEventListener');
        this.fakeEvent = {
          preventDefault: this.sandbox.stub()
        };

        return view.initialize().then(function () {
          self.clickHandler = button.addEventListener.getCall(0).args[1];
        });
      });

      it('tokenizes with venmo', function () {
        return this.clickHandler(this.fakeEvent).then(function () {
          expect(this.fakeVenmoInstance.tokenize).to.be.calledOnce;
        }.bind(this));
      });

      it('adds payment method to model if tokenization is succesful succesful', function () {
        return this.clickHandler(this.fakeEvent).then(function () {
          expect(this.model.addPaymentMethod).to.be.calledOnce;
          expect(this.model.addPaymentMethod).to.be.calledWith({
            type: 'VenmoAccount',
            nonce: 'fake-nonce'
          });
        }.bind(this));
      });

      it('reports error if tokenization fails', function () {
        var error = new Error('venmo failed');

        this.fakeVenmoInstance.tokenize.rejects(error);

        return this.clickHandler(this.fakeEvent).then(function () {
          expect(this.model.reportError).to.be.calledOnce;
          expect(this.model.reportError).to.be.calledWith(error);
        }.bind(this));
      });

      it('ignores error if code is VENMO_APP_CANCELLED', function () {
        var error = new Error('venmo failed');

        error.code = 'VENMO_APP_CANCELED';

        this.fakeVenmoInstance.tokenize.rejects(error);

        return this.clickHandler(this.fakeEvent).then(function () {
          expect(this.model.reportError).to.not.be.called;
        }.bind(this));
      });
    });
  });

  describe('isEnabled', function () {
    beforeEach(function () {
      this.options = {
        client: this.fakeClient,
        merchantConfiguration: this.model.merchantConfiguration
      };
      this.sandbox.stub(btVenmo, 'isBrowserSupported').returns(true);
    });

    it('resolves with false when Venmo Pay is not enabled on the gateway', function () {
      var configuration = fake.configuration();

      delete configuration.gatewayConfiguration.payWithVenmo;

      this.fakeClient.getConfiguration.returns(configuration);

      return VenmoView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves with false when Venmo Pay is not enabled by merchant', function () {
      delete this.options.merchantConfiguration.venmo;

      return VenmoView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(false);
      });
    });

    it('resolves with false when browser not supported by Venmo', function () {
      var merchantConfig = this.options.merchantConfiguration.venmo = {
        allowNewBrowserTab: false
      };

      btVenmo.isBrowserSupported.returns(false);

      return VenmoView.isEnabled(this.options).then(function (result) {
        expect(btVenmo.isBrowserSupported).to.be.calledWith(merchantConfig);
        expect(result).to.equal(false);
      });
    });

    it('resolves with true when everything is setup for Venmo', function () {
      return VenmoView.isEnabled(this.options).then(function (result) {
        expect(result).to.equal(true);
      });
    });
  });
});
