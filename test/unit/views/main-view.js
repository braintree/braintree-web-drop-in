'use strict';

var MainView = require('../../../src/views/main-view');
var BaseView = require('../../../src/views/base-view');
var CardView = require('../../../src/views/payment-method-views/card-view');
var CompletedView = require('../../../src/views/completed-view');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var strings = require('../../../src/translations/en');
var templateHTML = require('../../../src/html/main.html');

describe('MainView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(MainView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new MainView(); // eslint-disable-line no-new

      expect(MainView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new MainView()).to.be.an.instanceof(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.model = new DropinModel();

      this.context = {
        addView: this.sandbox.stub(),
        dependenciesInitializing: 0,
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: function () {},
        hideLoadingIndicator: function () {},
        model: this.model,
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showLoadingIndicator: function () {},
        strings: {
          foo: 'bar'
        }
      };
    });
  });

  describe('addView', function () {
    beforeEach(function () {
      this.fakeView = {
        element: document.createElement('span'),
        ID: 'fake-id'
      };

      this.context = {
        element: document.createElement('div'),
        views: []
      };
    });

    it('adds the argument to the array of views', function () {
      MainView.prototype.addView.call(this.context, this.fakeView);

      expect(this.context.views[this.fakeView.ID]).to.equal(this.fakeView);
    });
  });

  describe('setActiveView', function () {
    beforeEach(function () {
      var wrapper = document.createElement('div');

      wrapper.innerHTML = templateHTML;

      function FakeView(id) {
        this.ID = id;
      }

      this.views = [
        new FakeView('id1'),
        new FakeView('id2'),
        new FakeView('id3')
      ];

      this.mainViewOptions = {
        dropinWrapper: wrapper,
        model: new DropinModel(),
        options: {
          authorization: 'fake_tokenization_key',
          client: {
            getConfiguration: fake.configuration
          }
        }
      };
    });

    it('shows the selected view', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.setActiveView('id1');

      expect(mainView.dropinWrapper.className).to.contain('id1');
      expect(mainView.dropinWrapper.className).to.not.contain('id2');
      expect(mainView.dropinWrapper.className).to.not.contain('id3');
    });

    it('clears any errors', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      this.sandbox.stub(DropinModel.prototype, 'clearError');

      mainView.setActiveView('id1');

      expect(DropinModel.prototype.clearError).to.have.been.calledOnce;
    });

    it('applies no-flexbox class when flexbox is not supported', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.supportsFlexbox = false;

      mainView.setActiveView('id1');

      expect(mainView.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.true;
    });

    it('does not apply no-flexbox class when flexbox is supported', function () {
      var mainView = new MainView(this.mainViewOptions);

      mainView.views = this.views;
      mainView.supportsFlexbox = true;

      mainView.setActiveView('id1');

      expect(mainView.dropinWrapper.classList.contains('braintree-dropin__no-flexbox')).to.be.false;
    });

    describe('CardView', function () {
      it('assigns the card view as the active view', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setActiveView(CardView.ID);

        expect(mainView.activeView).to.equal(mainView.cardView);
      });

      context('in vaulted flow', function () {
        it('shows the additional options button', function () {
          var mainView;

          this.mainViewOptions.options.authorization = fake.clientTokenWithCustomerID;

          mainView = new MainView(this.mainViewOptions);

          expect(mainView.additionalOptions.classList.contains('braintree-dropin__display--none')).to.be.false;
        });
      });

      context('in guest checkout flow', function () {
        it('does not show the additional options button', function () {
          var mainView = new MainView(this.mainViewOptions);

          expect(mainView.additionalOptions.classList.contains('braintree-dropin__display--none')).to.be.true;
        });
      });
    });

    describe('CompletedView', function () {
      it('assigns the completed view as the active view', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setActiveView(CompletedView.ID);

        expect(mainView.activeView).to.equal(mainView.completedView);
      });

      it('shows the additional options button', function () {
        var mainView = new MainView(this.mainViewOptions);

        mainView.setActiveView(CompletedView.ID);

        expect(mainView.additionalOptions.classList.contains('braintree-dropin__display--none')).to.be.false;
      });
    });
  });

  describe('showAlert', function () {
    beforeEach(function () {
      this.context = {
        alert: document.createElement('div'),
        strings: strings
      };
    });

    it('shows the alert', function () {
      MainView.prototype.showAlert.call(this.context, {});

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.false;
    });

    it('sets the alert to the expected message for the error code', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION',
        message: 'Some text we do not use'
      };

      MainView.prototype.showAlert.call(this.context, fakeError);

      expect(this.context.alert.textContent).to.equal('Please check your information and try again.');
    });

    it('shows the raw error message when the error has an unknown error code', function () {
      var fakeError = {
        code: 'AN_UNKNOWN_ERROR',
        message: 'Some text we will use because we do not know this error code'
      };

      MainView.prototype.showAlert.call(this.context, fakeError);

      expect(this.context.alert.textContent).to.equal('Some text we will use because we do not know this error code');
    });

    it('shows a fallback error message when the error code is unknown and the error is missing a message', function () {
      var fakeError = {
        code: 'AN_UNKNOWN_ERROR'
      };

      MainView.prototype.showAlert.call(this.context, fakeError);

      expect(this.context.alert.textContent).to.equal('Something went wrong on our end.');
    });
  });

  describe('hideAlert', function () {
    beforeEach(function () {
      this.context = {
        alert: document.createElement('div')
      };
    });

    it('hides the alert', function () {
      MainView.prototype.hideAlert.call(this.context);

      expect(this.context.alert.classList.contains('braintree-dropin__display--none')).to.be.true;
    });
  });

  describe('dropinErrorState events', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: this.sandbox.stub(),
        hideLoadingIndicator: function () {},
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showAlert: this.sandbox.stub(),
        showLoadingIndicator: function () {}
      };

      MainView.prototype._initialize.call(this.context);
    });

    // TODO: add these back in when error handling is ready
    // it('calls showAlert when errorOccurred is emitted', function () {
    //   var fakeError = {
    //     code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
    //   };
    //
    //   this.context.model._emit('errorOccurred', fakeError);
    //
    //   expect(this.context.showAlert).to.be.calledWith(fakeError);
    // });
    //
    // it('calls hideAlert when errorCleared is emitted', function () {
    //   this.context.model._emit('errorCleared');
    //
    //   expect(this.context.hideAlert).to.be.called;
    // });
  });

  describe('showLoadingIndicator', function () {
    it('shows the loading indicator', function () {
      var dropinContainer = document.createElement('div');
      var loadingContainer = document.createElement('div');
      var loadingIndicator = document.createElement('div');
      var context = {
        dropinContainer: dropinContainer,
        loadingContainer: loadingContainer,
        loadingIndicator: loadingIndicator
      };

      loadingContainer.className = 'braintree-dropin__loading-container--inactive';
      loadingIndicator.className = 'braintree-dropin__loading_indicator--inactive';

      MainView.prototype.showLoadingIndicator.call(context);

      expect(context.dropinContainer.classList.contains('braintree-dropin__hide')).to.be.true;
      expect(context.loadingContainer.classList.contains('braintree-dropin__loading-container--inactive')).to.be.false;
      expect(context.loadingIndicator.classList.contains('braintree-dropin__loading-indicator--inactive')).to.be.false;
    });
  });

  describe('hideLoadingIndicator', function () {
    var clock;

    beforeEach(function () {
      clock = sinon.useFakeTimers();
    });

    afterEach(function () {
      clock.restore();
    });

    it('hides the loading indicator', function () {
      var dropinContainer = document.createElement('div');
      var loadingContainer = document.createElement('div');
      var loadingIndicator = document.createElement('div');
      var context = {
        dropinContainer: dropinContainer,
        loadingContainer: loadingContainer,
        loadingIndicator: loadingIndicator
      };

      dropinContainer.className = 'braintree-dropin__hide';

      MainView.prototype.hideLoadingIndicator.call(context);
      clock.tick(1001);

      expect(context.dropinContainer.classList.contains('braintree-dropin__hide')).to.be.false;
      expect(context.loadingContainer.classList.contains('braintree-dropin__loading-container--inactive')).to.be.true;
      expect(context.loadingIndicator.classList.contains('braintree-dropin__loading-indicator--inactive')).to.be.true;
    });
  });

  describe('DropinModel events', function () {
    beforeEach(function () {
      var dropinWrapper = document.createElement('div');

      dropinWrapper.innerHTML = templateHTML;

      this.context = {
        addView: this.sandbox.stub(),
        dropinWrapper: dropinWrapper,
        element: dropinWrapper,
        getElementById: BaseView.prototype.getElementById,
        hideAlert: function () {},
        hideLoadingIndicator: this.sandbox.stub(),
        model: new DropinModel(),
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        },
        setActiveView: this.sandbox.stub(),
        showLoadingIndicator: this.sandbox.stub(),
        showAdditionalOptions: this.sandbox.stub()
      };

      MainView.prototype._initialize.call(this.context);
    });

    it('calls showLoadingIndicator on loadBegin', function () {
      this.context.model._emit('loadBegin');

      expect(this.context.showLoadingIndicator).to.be.calledOnce;
    });

    it('calls hideLoadingIndicator on loadEnd', function () {
      this.context.model._emit('loadEnd');

      expect(this.context.hideLoadingIndicator).to.be.calledOnce;
    });
  });

  describe('additional options', function () {
    it('has an click event listener that calls showAdditionalOptions', function () {
      var mainView;
      var wrapper = document.createElement('div');

      wrapper.innerHTML = templateHTML;
      this.sandbox.stub(MainView.prototype, 'showAdditionalOptions');

      mainView = new MainView({
        dropinWrapper: wrapper,
        model: new DropinModel(),
        options: {
          authorization: 'a_test_key',
          client: {
            getConfiguration: fake.configuration
          }
        }
      });

      mainView.additionalOptions.click();

      expect(mainView.showAdditionalOptions).to.have.been.called;
    });

    describe('in vaulted', function () {
      describe('card only', function () {
        it('sets the CardView as the active view from the CompletedView', function () {
          var completedView = 'completed-view';
          var context = {
            activeView: completedView,
            completedView: completedView,
            setActiveView: this.sandbox.stub()
          };

          MainView.prototype.showAdditionalOptions.call(context);

          expect(context.setActiveView).to.have.been.calledWith(CardView.ID);
        });

        it('sets the CompletedView as the active view from the CardView', function () {
          var context = {
            activeView: 'card-view',
            completedView: 'completed-view',
            setActiveView: this.sandbox.stub()
          };

          this.sandbox.stub(MainView.prototype, 'setActiveView');

          MainView.prototype.showAdditionalOptions.call(context);

          expect(context.setActiveView).to.have.been.calledWith(CompletedView.ID);
        });
      });
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        views: {
          'braintree-dropin__pay-with-card-view': {
            teardown: this.sandbox.stub().yields()
          }
        }
      };
    });

    it('calls teardown on each view', function (done) {
      var payWithCardView = this.context.views['braintree-dropin__pay-with-card-view'];

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('waits to call callback until asyncronous teardowns complete', function (done) {
      var payWithCardView = this.context.views['braintree-dropin__pay-with-card-view'];

      payWithCardView.teardown.yieldsAsync();

      MainView.prototype.teardown.call(this.context, function () {
        expect(payWithCardView.teardown).to.be.calledOnce;
        done();
      });
    });

    it('calls callback with error from teardown function', function (done) {
      var payWithCardView = this.context.views['braintree-dropin__pay-with-card-view'];
      var error = new Error('pay with card teardown error');

      payWithCardView.teardown.yields(error);

      MainView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
