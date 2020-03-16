const onTransitionEnd = require('../../../src/lib/transition-helper').onTransitionEnd;
const {
  yields
} = require('../../helpers/yields');

describe('onTransitionEnd', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.fakePropertyName = 'fake-property-name';
    testContext.fakeEvent = { propertyName: testContext.fakePropertyName };
  });

  test(
    'immediately calls callback when element has display: none',
    done => {
      const element = document.createElement('div');

      element.style.display = 'none';

      onTransitionEnd(element, testContext.fakePropertyName, done);
    }
  );

  test(
    'immediately calls callback when a parent element has display: none',
    done => {
      const topLevelElement = document.createElement('div');
      const middleElement = document.createElement('div');
      const element = document.createElement('div');

      topLevelElement.style.display = 'none';
      middleElement.appendChild(element);
      topLevelElement.appendChild(middleElement);

      onTransitionEnd(element, testContext.fakePropertyName, done);
    }
  );

  test(
    'calls callback after onTransitionEnd end when the event propertyName matches',
    done => {
      const element = document.createElement('div');

      jest.spyOn(element, 'addEventListener').mockImplementation((eventName, cb) => {
        cb(testContext.fakeEvent);
      });

      onTransitionEnd(element, testContext.fakePropertyName, () => {
        expect(element.addEventListener).toBeCalledTimes(1);
        expect(element.addEventListener).toBeCalledWith('transitionend', expect.any(Function));

        done();
      });
    }
  );

  test('removes event listener after callback is called', done => {
    const element = document.createElement('div');

    jest.spyOn(element, 'addEventListener').mockImplementation(yields(testContext.fakeEvent));
    jest.spyOn(element, 'removeEventListener').mockImplementation();

    onTransitionEnd(element, testContext.fakePropertyName, () => {
      expect(element.removeEventListener).toBeCalledTimes(1);
      expect(element.addEventListener).toBeCalledWith('transitionend', expect.any(Function));

      done();
    });
  });

  test(
    'does not call callback after onTransitionEnd end when the event propertyName does not match',
    () => {
      const callbackSpy = jest.fn();
      const element = document.createElement('div');
      let handler;

      jest.spyOn(element, 'addEventListener').mockImplementation(yields(testContext.fakeEvent));

      onTransitionEnd(element, 'rogue-property-name', callbackSpy);

      expect(element.addEventListener).toBeCalledTimes(1);
      expect(element.addEventListener).toBeCalledWith('transitionend', expect.any(Function));

      handler = element.addEventListener.mock.calls[0][1];

      handler(testContext.fakeEvent);

      expect(callbackSpy).toBeCalledTimes(0);
    }
  );
});

