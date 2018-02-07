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
    var fakeClient = {
      getConfiguration: this.sandbox.stub().returns(fake.configuration()),
      getVersion: function () {}
    };

    this.model = new DropinModel(fake.modelOptions());

    this.div = document.createElement('div');
    this.div.innerHTML = mainHTML;

    document.body.appendChild(this.div);

    this.model.merchantConfiguration.venmo = true;
    this.venmoViewOptions = {
      client: fakeClient,
      element: document.body.querySelector('.braintree-sheet.braintree-venmo'),
      model: this.model,
      strings: {}
    };

    this.fakeVenmoInstance = {
      tokenize: this.sandbox.stub().resolves({
        type: 'VenmoAccount',
        nonce: 'fake-nonce'
      })
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
          client: this.view.client,
          allowNewBrowserTab: false
        }));
        expect(this.view.venmoInstance).to.equal(this.fakeVenmoInstance);
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
});
