'use strict';

var browserDetection = require('../../../src/lib/browser-detection');
var onTransitionEnd = require('../../../src/lib/transition-helper').onTransitionEnd;

describe('onTransitionEnd', function () {
  beforeEach(function () {
    this.fakePropertyName = 'fake-property-name';
    this.fakeEvent = {propertyName: this.fakePropertyName};
  });

  it('immediately calls callback when IE9', function (done) {
    var element = document.createElement('div');

    this.sandbox.stub(browserDetection, 'isIe9').returns(true);

    onTransitionEnd(element, this.fakePropertyName, done);
  });

  it('immediately calls callback when element has display: none', function (done) {
    var element = document.createElement('div');

    element.style.display = 'none';

    onTransitionEnd(element, this.fakePropertyName, done);
  });

  it('immediately calls callback when a parent element has display: none', function (done) {
    var topLevelElement = document.createElement('div');
    var middleElement = document.createElement('div');
    var element = document.createElement('div');

    topLevelElement.style.display = 'none';
    middleElement.appendChild(element);
    topLevelElement.appendChild(middleElement);

    onTransitionEnd(element, this.fakePropertyName, done);
  });

  it('calls callback after onTransitionEnd end when the event propertyName matches', function (done) {
    var element = document.createElement('div');

    this.sandbox.stub(element, 'addEventListener').yields(this.fakeEvent);
    this.sandbox.stub(browserDetection, 'isIe9').returns(false);

    onTransitionEnd(element, this.fakePropertyName, function () {
      expect(element.addEventListener).to.have.been.calledOnce;
      expect(element.addEventListener).to.have.been.calledWith('transitionend');

      done();
    });
  });

  it('removes event listener after callback is called', function (done) {
    var element = document.createElement('div');

    this.sandbox.stub(element, 'addEventListener').yields(this.fakeEvent);
    this.sandbox.stub(element, 'removeEventListener');
    this.sandbox.stub(browserDetection, 'isIe9').returns(false);

    onTransitionEnd(element, this.fakePropertyName, function () {
      expect(element.removeEventListener).to.have.been.calledOnce;
      expect(element.addEventListener).to.have.been.calledWith('transitionend', this.sandbox.match.func);

      done();
    }.bind(this));
  });

  it('does not call callback after onTransitionEnd end when the event propertyName does not match', function () {
    var callbackSpy = this.sandbox.spy();
    var element = document.createElement('div');
    var handler;

    this.sandbox.stub(element, 'addEventListener').yields(this.fakeEvent);
    this.sandbox.stub(browserDetection, 'isIe9').returns(false);

    onTransitionEnd(element, 'rogue-property-name', callbackSpy);

    expect(element.addEventListener).to.have.been.calledOnce;
    expect(element.addEventListener).to.have.been.calledWith('transitionend');

    handler = element.addEventListener.getCall(0).args[1];

    handler(this.fakeEvent);

    expect(callbackSpy).not.to.be.called;
  });
});

