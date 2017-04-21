'use strict';

var addSelectionEventHandler = require('../../../../src/lib/add-selection-event-handler');

describe('addSelectionEventHandler', function () {
  it('adds an event listener for click', function () {
    var event = {};
    var element = {
      addEventListener: this.sandbox.stub().yields(event)
    };
    var func = this.sandbox.stub();

    addSelectionEventHandler(element, func);

    expect(element.addEventListener).to.be.calledWith('click', func);
    expect(func).to.be.calledWith(event);
  });

  it('adds an event listener for keyup', function () {
    var element = {
      addEventListener: this.sandbox.stub()
    };
    var func = this.sandbox.stub();

    addSelectionEventHandler(element, func);

    expect(element.addEventListener).to.be.calledWith('keyup', this.sandbox.match.func);
  });

  it('calls handler for keyup when key is enter', function () {
    var event = {keyCode: 13};
    var element = {
      addEventListener: this.sandbox.stub()
    };
    var func = this.sandbox.stub();

    element.addEventListener.withArgs('keyup').yields(event);

    addSelectionEventHandler(element, func);

    expect(func).to.be.called;
  });

  it('does not call handler for keyup when key is not enter', function () {
    var event = {keyCode: 26};
    var element = {
      addEventListener: this.sandbox.stub()
    };
    var func = this.sandbox.stub();

    element.addEventListener.withArgs('keyup').yields(event);

    addSelectionEventHandler(element, func);

    expect(func).to.not.be.called;
  });
});
