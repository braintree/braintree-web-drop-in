'use strict';

var addSelectionEventHandler = require('../../../src/lib/add-selection-event-handler');
var {
  yields
} = require('../../helpers/yields');

describe('addSelectionEventHandler', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  test('adds an event listener for click', () => {
    var event = {};
    var element = {
      addEventListener: jest.fn().mockImplementation(yields(event))
    };
    var func = jest.fn();

    addSelectionEventHandler(element, func);

    expect(element.addEventListener).toBeCalledWith('click', func);
    expect(func).toBeCalledWith(event);
  });

  test('adds an event listener for keyup', () => {
    var element = {
      addEventListener: jest.fn()
    };
    var func = jest.fn();

    addSelectionEventHandler(element, func);

    expect(element.addEventListener).toBeCalledWith('keyup', expect.any(Function));
  });

  test('calls handler for keyup when key is enter', () => {
    var event = {keyCode: 13};
    var element = {
      addEventListener: jest.fn()
    };
    var func = jest.fn();

    element.addEventListener.mockImplementation((eventName, cb) => {
      if (eventName === 'keyup') {
        cb(event);
      }
    });

    addSelectionEventHandler(element, func);

    expect(func).toBeCalled();
  });

  test('does not call handler for keyup when key is not enter', () => {
    var event = {keyCode: 26};
    var element = {
      addEventListener: jest.fn()
    };
    var func = jest.fn();

    element.addEventListener.mockImplementation((eventName, cb) => {
      if (eventName === 'keyup') {
        cb(event);
      }
    });

    addSelectionEventHandler(element, func);

    expect(func).not.toBeCalled();
  });
});
