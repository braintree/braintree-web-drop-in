'use strict';

var browserDetection = require('../../../src/lib/browser-detection');
var onTransitionEnd = require('../../../src/lib/transition-helper').onTransitionEnd;
var {
  yields
} = require('../../helpers/yields');

describe('onTransitionEnd', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.fakePropertyName = 'fake-property-name';
    testContext.fakeEvent = {propertyName: testContext.fakePropertyName};
  });

  test('immediately calls callback when IE9', done => {
    var element = document.createElement('div');

    jest.spyOn(browserDetection, 'isIe9').mockReturnValue(true);

    onTransitionEnd(element, testContext.fakePropertyName, done);
  });

  test(
    'immediately calls callback when element has display: none',
    done => {
      var element = document.createElement('div');

      element.style.display = 'none';

      onTransitionEnd(element, testContext.fakePropertyName, done);
    }
  );

  test(
    'immediately calls callback when a parent element has display: none',
    done => {
      var topLevelElement = document.createElement('div');
      var middleElement = document.createElement('div');
      var element = document.createElement('div');

      topLevelElement.style.display = 'none';
      middleElement.appendChild(element);
      topLevelElement.appendChild(middleElement);

      onTransitionEnd(element, testContext.fakePropertyName, done);
    }
  );

  test(
    'calls callback after onTransitionEnd end when the event propertyName matches',
    done => {
      var element = document.createElement('div');

      jest.spyOn(element, 'addEventListener').mockImplementation((eventName, cb) => {
        cb(testContext.fakeEvent);
      });
      jest.spyOn(browserDetection, 'isIe9').mockReturnValue(false);

      onTransitionEnd(element, testContext.fakePropertyName, function () {
        expect(element.addEventListener).toBeCalledTimes(1);
        expect(element.addEventListener).toBeCalledWith('transitionend', expect.any(Function));

        done();
      });
    }
  );

  test('removes event listener after callback is called', done => {
    var element = document.createElement('div');

    jest.spyOn(element, 'addEventListener').mockImplementation(yields(testContext.fakeEvent));
    jest.spyOn(element, 'removeEventListener').mockImplementation();
    jest.spyOn(browserDetection, 'isIe9').mockReturnValue(false);

    onTransitionEnd(element, testContext.fakePropertyName, function () {
      expect(element.removeEventListener).toBeCalledTimes(1);
      expect(element.addEventListener).toBeCalledWith('transitionend', expect.any(Function));

      done();
    });
  });

  test(
    'does not call callback after onTransitionEnd end when the event propertyName does not match',
    () => {
      var callbackSpy = jest.fn();
      var element = document.createElement('div');
      var handler;

      jest.spyOn(element, 'addEventListener').mockImplementation(yields(testContext.fakeEvent));
      jest.spyOn(browserDetection, 'isIe9').mockReturnValue(false);

      onTransitionEnd(element, 'rogue-property-name', callbackSpy);

      expect(element.addEventListener).toBeCalledTimes(1);
      expect(element.addEventListener).toBeCalledWith('transitionend', expect.any(Function));

      handler = element.addEventListener.mock.calls[0][1];

      handler(testContext.fakeEvent);

      expect(callbackSpy).toBeCalledTimes(0);
    }
  );
});

