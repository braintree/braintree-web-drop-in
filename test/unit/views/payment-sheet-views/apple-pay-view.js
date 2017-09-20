'use strict';
/* eslint-disable no-new */

var BaseView = require('../../../../src/views/base-view');
var ApplePayView = require('../../../../src/views/payment-sheet-views/apple-pay-view');
var btApplePay = require('braintree-web/apple-pay');
var DropinModel = require('../../../../src/dropin-model');
var DropinError = require('../../../../src/lib/dropin-error');
var fake = require('../../../helpers/fake');
var fs = require('fs');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('ApplePayView', function () {
  beforeEach(function () {
    var model = new DropinModel(fake.modelOptions());
    var fakeClient = {
      getConfiguration: this.sandbox.stub().returns(fake.configuration()),
      getVersion: function () {}
    };

    this.div = document.createElement('div');

    global.ApplePaySession = {};
    global.ApplePaySession.canMakePayments = function () { return true; };
    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);

    this.applePayViewOptions = {
      client: fakeClient,
      element: document.body.querySelector('.braintree-sheet.braintree-applePay'),
      model: model,
      strings: {}
    };

    this.fakeApplePayInstance = {};
    this.sandbox.stub(btApplePay, 'create').resolves(this.fakeApplePayInstance);
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new ApplePayView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.view = new ApplePayView(this.applePayViewOptions);
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

    it('calls asyncDependencyFailed with an error when an ApplePaySession is not present', function () {
      global.ApplePaySession = null;
      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');

      this.view.initialize();

      expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
    });

    it('calls asyncDependencyFailed with an error when ApplePaySession.canMakePayments is not present', function () {
      global.ApplePaySession.canMakePayments = function () { return false; };
      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');

      this.view.initialize();

      expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
    });

    it('creates an ApplePay component', function () {
      return this.view.initialize().then(function () {
        expect(btApplePay.create).to.be.calledWith(this.sandbox.match({
          client: this.view.client
        }));
        expect(this.view.applePayInstance).to.equal(this.fakeApplePayInstance);
      }.bind(this));
    });

    it('calls asyncDependencyFailed when Apple Pay component creation fails', function () {
      var fakeError = new DropinError('A_FAKE_ERROR');

      this.sandbox.stub(this.view.model, 'asyncDependencyFailed');
      btApplePay.create.rejects(fakeError);

      return this.view.initialize().then(function () {
        expect(this.view.model.asyncDependencyFailed).to.be.calledOnce;
        expect(this.view.model.asyncDependencyFailed).to.be.calledWith(this.sandbox.match({
          error: fakeError,
          view: 'applePay'
        }));
      }.bind(this));
    });
  });
});
