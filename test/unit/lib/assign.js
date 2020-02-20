
const assignModule = require('../../../src/lib/assign');

describe('assign', () => {
  describe('exported function', () => {
    runTest(assignModule.assign);
  });

  describe('polyfill', () => {
    runTest(assignModule._assign);
  });
});

function runTest(assign) {
  test('does nothing to one object', () => {
    const obj = { foo: 'bar' };

    expect(assign(obj)).toBe(obj);
  });

  test('merges two objects', () => {
    const a = { foo: 'yas', bar: 'ugh' };
    const b = { foo: 'nope', baz: 'wow' };

    expect(assign(a, b)).toEqual({
      foo: 'nope',
      bar: 'ugh',
      baz: 'wow'
    });
  });

  test('merges three objects', () => {
    const a = { foo: 'yas', bar: 'ugh' };
    const b = { foo: 'nope' };
    const c = { foo: 'wow', baz: 'cool' };

    expect(assign(a, b, c)).toEqual({
      foo: 'wow',
      bar: 'ugh',
      baz: 'cool'
    });
  });

  test('returns the first object passed', () => {
    const a = { foo: 'yas', bar: 'ugh' };
    const b = { foo: 'nope', baz: 'wow' };

    expect(assign(a, b)).toBe(a);
  });

  test("doesn't take inherited properties", () => {
    let a, b;

    function Klass() {
      this.foo = 'yas';
    }

    Klass.prototype.bar = 'ugh';

    a = { foo: 'nope', baz: 'wow' };
    b = new Klass();

    expect(assign(a, b)).toEqual({
      foo: 'yas',
      baz: 'wow'
    });
  });
}
