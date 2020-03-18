const addSelectionEventHandler = require('../../../src/lib/add-selection-event-handler');
const { yields } = require('../../helpers/yields');

describe('addSelectionEventHandler', () => {
  it('adds an event listener for click', () => {
    const event = {};
    const element = {
      addEventListener: jest.fn().mockImplementation(yields(event))
    };
    const func = jest.fn();

    addSelectionEventHandler(element, func);

    expect(element.addEventListener).toBeCalledWith('click', func);
    expect(func).toBeCalledWith(event);
  });

  it('adds an event listener for keyup', () => {
    const element = {
      addEventListener: jest.fn()
    };
    const func = jest.fn();

    addSelectionEventHandler(element, func);

    expect(element.addEventListener).toBeCalledWith('keyup', expect.any(Function));
  });

  it('calls handler for keyup when key is enter', () => {
    const event = { keyCode: 13 };
    const element = {
      addEventListener: jest.fn()
    };
    const func = jest.fn();

    element.addEventListener.mockImplementation((eventName, cb) => {
      if (eventName === 'keyup') {
        cb(event);
      }
    });

    addSelectionEventHandler(element, func);

    expect(func).toBeCalled();
  });

  it('does not call handler for keyup when key is not enter', () => {
    const event = { keyCode: 26 };
    const element = {
      addEventListener: jest.fn()
    };
    const func = jest.fn();

    element.addEventListener.mockImplementation((eventName, cb) => {
      if (eventName === 'keyup') {
        cb(event);
      }
    });

    addSelectionEventHandler(element, func);

    expect(func).not.toBeCalled();
  });
});
