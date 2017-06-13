'use strict';

var createFromScriptTag = require('../../../../src/lib/create-from-script-tag');
var findParentForm = require('../../../../src/lib/find-parent-form');

describe('createFromScriptTag', function () {
  beforeEach(function () {
    this.instance = {
      requestPaymentMethod: this.sandbox.stub().yields(null, {nonce: 'a-nonce'})
    };
    this.scriptTag = {
      getAttribute: this.sandbox.stub().returns('an-authorization')
    };
    this.createFunction = this.sandbox.stub().resolves(this.instance);
    this.fakeForm = {
      insertBefore: this.sandbox.stub(),
      addEventListener: this.sandbox.stub(),
      appendChild: this.sandbox.stub(),
      querySelector: this.sandbox.stub(),
      submit: this.sandbox.stub()
    };
    this.sandbox.stub(findParentForm, 'findParentForm').returns(this.fakeForm);
  });

  it('returns early if no script tag is provided', function () {
    this.sandbox.spy(document, 'createElement');

    createFromScriptTag(this.createFunction);

    expect(document.createElement).to.not.be.called;
  });

  it('throws an error if script tag does not include an authorization', function () {
    this.scriptTag.getAttribute.returns(null);
    this.sandbox.spy(document, 'createElement');

    expect(function () {
      createFromScriptTag(this.createFunction, this.scriptTag);
    }.bind(this)).to.throw('Authorization not found in data-braintree-dropin-authorization attribute');

    expect(document.createElement).to.not.be.called;
  });

  it('creates a container for Drop-in', function () {
    this.sandbox.spy(document, 'createElement');

    createFromScriptTag(this.createFunction, this.scriptTag);

    expect(document.createElement).to.be.calledOnce;
    expect(document.createElement).to.be.calledWith('div');
  });

  it('throws an error if no form can be found', function () {
    findParentForm.findParentForm.returns(null);

    expect(function () {
      createFromScriptTag(this.createFunction, this.scriptTag);
    }.bind(this)).to.throw('No form found for script tag integration.');
  });

  it('inserts container before script tag when form is found', function () {
    var fakeContainer = {};

    this.sandbox.stub(document, 'createElement').returns(fakeContainer);
    createFromScriptTag(this.createFunction, this.scriptTag);

    expect(this.fakeForm.insertBefore).to.be.calledOnce;
    expect(this.fakeForm.insertBefore).to.be.calledWith(fakeContainer, this.scriptTag);
  });

  it('calls create with authorization and container', function () {
    createFromScriptTag(this.createFunction, this.scriptTag);

    expect(this.createFunction).to.be.calledOnce;
    expect(this.createFunction).to.be.calledWith({
      authorization: 'an-authorization',
      container: this.sandbox.match.defined
    });
  });

  it('adds submit listener to form for requesting a payment method', function (done) {
    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      expect(this.fakeForm.addEventListener).to.be.calledTwice;
      expect(this.fakeForm.addEventListener).to.be.calledWith('submit');
      done();
    }.bind(this));
  });

  it('prevents default form submission', function (done) {
    var submitHandler;
    var fakeEvent = {
      preventDefault: this.sandbox.stub()
    };

    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(0).args[1];
      submitHandler(fakeEvent);

      expect(fakeEvent.preventDefault).to.be.calledOnce;
      done();
    }.bind(this));
  });

  it('calls requestPaymentMethod when form submits', function (done) {
    var submitHandler;

    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(1).args[1];
      submitHandler();

      expect(this.instance.requestPaymentMethod).to.be.calledOnce;
      done();
    }.bind(this));
  });

  it('prevents default form submission before Drop-in is created', function (done) {
    var submitHandler;
    var fakeEvent = {preventDefault: this.sandbox.stub()};

    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(0).args[1];
      submitHandler(fakeEvent);

      expect(fakeEvent.preventDefault).to.be.calledOnce;
      done();
    }.bind(this));
  });

  it('calls requestPaymentMethod when form submits', function (done) {
    var submitHandler;

    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(1).args[1];
      submitHandler();

      expect(this.instance.requestPaymentMethod).to.be.calledOnce;
      done();
    }.bind(this));
  });

  it('adds payment method nonce to form and submits form if payment method is requestable', function (done) {
    var submitHandler;
    var fakeInput = {};

    this.sandbox.stub(document, 'createElement').callThrough();
    document.createElement.withArgs('input').returns(fakeInput);
    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(1).args[1];
      submitHandler();

      expect(this.fakeForm.appendChild).to.be.calledOnce;
      expect(this.fakeForm.appendChild).to.be.calledWith(fakeInput);
      expect(fakeInput.type).to.equal('hidden');
      expect(fakeInput.name).to.equal('payment_method_nonce');
      expect(fakeInput.value).to.equal('a-nonce');
      expect(this.fakeForm.submit).to.be.calledOnce;
      done();
    }.bind(this));
  });

  it('does not add nonce and submit form if requestPaymentMethod fails', function (done) {
    var submitHandler;

    this.instance.requestPaymentMethod.yields(new Error('failure'));
    this.sandbox.spy(document, 'createElement');
    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(1).args[1];
      submitHandler();

      expect(document.createElement).to.not.be.calledWith('input');
      expect(this.fakeForm.submit).to.not.be.called;
      done();
    }.bind(this));
  });

  it('uses existing payment_method_nonce input if it already exists', function (done) {
    var submitHandler;
    var fakeInput = {};

    this.fakeForm.querySelector.returns(fakeInput);
    this.sandbox.spy(document, 'createElement');

    createFromScriptTag(this.createFunction, this.scriptTag);

    setTimeout(function () {
      submitHandler = this.fakeForm.addEventListener.getCall(1).args[1];
      submitHandler();

      expect(this.fakeForm.appendChild).to.not.be.called;
      expect(document.createElement).to.not.be.calledWith('input');
      expect(fakeInput.value).to.equal('a-nonce');
      expect(this.fakeForm.submit).to.be.calledOnce;
      done();
    }.bind(this));
  });
});
