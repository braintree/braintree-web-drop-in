'use strict';

var Promise = require('../../../src/lib/promise');
var loadScript = require('../../../src/lib/assets').loadScript;
var loadStylesheet = require('../../../src/lib/assets').loadStylesheet;

describe('assets', function () {
  beforeEach(function () {
    this.fakeContainer = {
      appendChild: this.sandbox.stub()
    };
  });

  describe('loadScript', function () {
    beforeEach(function () {
      this.options = {
        id: 'script-id',
        src: 'script-src'
      };
      this.fakeScriptTag = {
        setAttribute: this.sandbox.stub(),
        addEventListener: this.sandbox.stub().yieldsAsync()
      };

      this.sandbox.stub(document, 'createElement').returns(this.fakeScriptTag);
    });

    it('returns a promise that resolves when script has loaded', function () {
      expect(loadScript(this.fakeContainer, this.options)).to.be.an.instanceof(Promise);
    });

    it('appends a configured script tag to provided container', function () {
      return loadScript(this.fakeContainer, this.options).then(function () {
        var scriptTag = this.fakeContainer.appendChild.firstCall.args[0];

        expect(scriptTag).to.equal(this.fakeScriptTag);
        expect(scriptTag.async).to.equal(true);
        expect(scriptTag.id).to.equal('script-id');
        expect(scriptTag.src).to.equal('script-src');

        expect(scriptTag.addEventListener).to.be.calledOnce;
        expect(scriptTag.addEventListener).to.be.calledWith('load', this.sandbox.match.func);
      }.bind(this));
    });

    it('passes additional data-attributes', function () {
      this.options.dataAttributes = {
        'log-level': 'warn',
        foo: 'bar'
      };

      return loadScript(this.fakeContainer, this.options).then(function () {
        expect(this.fakeScriptTag.setAttribute).to.be.calledTwice;
        expect(this.fakeScriptTag.setAttribute).to.be.calledWith('data-log-level', 'warn');
        expect(this.fakeScriptTag.setAttribute).to.be.calledWith('data-foo', 'bar');
      }.bind(this));
    });
  });

  describe('loadStylesheet', function () {
    beforeEach(function () {
      this.fakeHead = {
        insertBefore: this.sandbox.stub(),
        appendChild: this.sandbox.stub()
      };
    });

    it('injects configured stylesheet', function () {
      var stylesheet;

      loadStylesheet({
        id: 'stylesheet-id',
        href: 'stylesheet-href',
        head: this.fakeHead
      });

      stylesheet = this.fakeHead.appendChild.firstCall.args[0];

      expect(stylesheet).to.exist;
      expect(stylesheet.id).to.equal('stylesheet-id');
      expect(stylesheet.href).to.match(/stylesheet-href/);
    });

    it('inserts it before the head firstChild', function () {
      var stylesheet;

      this.fakeHead.firstChild = 'some domnode';

      loadStylesheet({
        id: 'stylesheet-id-1',
        href: 'stylesheet-href',
        head: this.fakeHead
      });

      stylesheet = this.fakeHead.insertBefore.firstCall.args[0];

      expect(this.fakeHead.appendChild).to.not.be.called;
      expect(this.fakeHead.insertBefore).to.be.calledOnce;
      expect(this.fakeHead.insertBefore).to.be.calledWith(stylesheet, 'some domnode');
    });

    it('appends child to head if no firstChild exists', function () {
      var stylesheet;

      loadStylesheet({
        id: 'stylesheet-id-1',
        href: 'stylesheet-href',
        head: this.fakeHead
      });

      stylesheet = this.fakeHead.appendChild.firstCall.args[0];

      expect(this.fakeHead.insertBefore).to.not.be.called;
      expect(this.fakeHead.appendChild).to.be.calledOnce;
      expect(this.fakeHead.appendChild).to.be.calledWith(stylesheet);
    });
  });
});
