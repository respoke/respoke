
var expect = chai.expect;

xdescribe("respoke.CallState for calls as the caller", function () {
    var caller = true;
    var state;
    var fake = {hasMedia: false};
    var params = {
        receiveOnly: false,
        previewLocalMedia: function () {},
        approve: function () {},
        signal: false,
        reason: 'none'
    };

    afterEach(function () {
        state.dispatch('hangup');
    });

    describe("it's object structure", function () {
        beforeEach(function () {
            state = respoke.CallState({
                gloveColor: 'white',
                caller: caller,
                hasMedia: function () {
                    return fake.hasMedia;
                }
            });
        });

        it("has the correct class name.", function () {
            expect(state.className).to.equal('respoke.CallState');
        });

        it("contains some important methods.", function () {
            expect(typeof state.dispatch).to.equal('function');
            expect(typeof state.isModifying).to.equal('function');
            expect(typeof state.isState).to.equal('function');
            expect(typeof state.getState).to.equal('function');
        });

        it("saves unexpected attributes", function () {
            expect(state.gloveColor).to.equal('white');
        });

        it("has not been run", function () {
            expect(state.getState()).to.equal.undefined;
        });

        it("should not report modifying", function () {
            expect(state.isModifying()).to.equal(false);
        });
    });

    describe("when starting from 'idle'", function () {
        var idleSpy;

        beforeEach(function () {
            params = {
                caller: caller,
                previewLocalMedia: function () {},
                receiveOnly: false,
                approve: function () {}
            };
            state = respoke.CallState({
                hasMedia: function () {
                    return fake.hasMedia;
                },
                caller: caller,
                answerTimeout: 20,
                receiveAnswerTimeout: 20,
                connectionTimeout: 20,
                modifyTimeout: 20
            });
        });

        it("reports the correct state name", function () {
            expect(state.getState()).to.equal("idle");
        });

        it("should not report modifying", function () {
            expect(state.isModifying()).to.equal(false);
        });

        it("sets all the right flags", function () {
            expect(state.hasLocalMediaApproval).to.equal(false);
            expect(state.hasLocalMedia).to.equal(false);
            expect(state.receivedBye).to.equal(false);
            expect(state.sentSDP).to.equal(false);
            expect(state.processedRemoteSDP).to.equal(false);
        });

        describe('invalid event', function () {
            var invalidEvents = [
                'answer',
                'receiveLocalMedia',
                'approve',
                'sentOffer',
                'accept',
                'receiveRemoteMedia',
                'receiveAnswer',
                'modify'
            ];

            invalidEvents.forEach(function (evt) {
                describe("event " + evt, function () {
                    var currentState;

                    beforeEach(function () {
                        currentState = state.getState();
                        state.dispatch(evt);
                    });

                    it("invalid event " + evt + " doesn't move to a new state", function () {
                        expect(state.getState()).to.equal(currentState);
                    });
                });
            });
        });

        describe("event 'hangup'", function () {
            var terminatedEntrySpy;

            beforeEach(function (done) {
                terminatedEntrySpy = sinon.spy();
                state.listen('terminated:entry', terminatedEntrySpy);
                state.dispatch("hangup", params);
                setTimeout(done);
            });

            afterEach(function () {
                state.ignore('terminated:entry', terminatedEntrySpy);
            });

            it("leads to 'terminated'", function () {
                expect(state.getState()).to.equal("terminated");
            });

            it("should not report modifying", function () {
                expect(state.isModifying()).to.equal(false);
            });

            it("should fire the 'terminated:entry' event", function () {
                expect(terminatedEntrySpy.called).to.equal(true);
            });

            it("sets all the right flags", function () {
                expect(state.hasLocalMediaApproval).to.equal(false);
                expect(state.hasLocalMedia).to.equal(false);
                expect(state.receivedBye).to.equal(false);
                expect(state.sentSDP).to.equal(false);
                expect(state.processedRemoteSDP).to.equal(false);
            });
        });

        describe("event 'initiate'", function () {
            describe("when a call listener is attached", function () {
                var preparingEntrySpy;

                beforeEach(function (done) {
                    fake.hasMedia = false;
                    preparingEntrySpy = sinon.spy();
                    state.listen('preparing:entry', preparingEntrySpy);
                    state.dispatch("initiate", {
                        caller: caller,
                        client: {
                            hasListeners: function () { return true; }
                        }
                    });
                    setTimeout(done);
                });

                afterEach(function () {
                    state.ignore('preparing:entry', preparingEntrySpy);
                });

                it("leads to 'preparing'", function () {
                    expect(state.getState()).to.equal("preparing");
                });

                it("should not report modifying", function () {
                    expect(state.isModifying()).to.equal(false);
                });

                it("should fire the 'preparing:entry' event", function () {
                    expect(preparingEntrySpy.called).to.equal(true);
                });

                it("sets all the right flags", function () {
                    expect(state.hasLocalMediaApproval).to.equal(false);
                    expect(state.hasLocalMedia).to.equal(false);
                    expect(state.receivedBye).to.equal(false);
                    expect(state.sentSDP).to.equal(false);
                    expect(state.processedRemoteSDP).to.equal(false);
                });

                describe("when media is not flowing", function () {
                    describe("event 'hangup'", function () {
                        var terminatedEntrySpy;

                        beforeEach(function (done) {
                            terminatedEntrySpy = sinon.spy();
                            state.listen('terminated:entry', terminatedEntrySpy);
                            state.dispatch("hangup", params);
                            setTimeout(done);
                        });

                        afterEach(function () {
                            state.ignore('terminated:entry', terminatedEntrySpy);
                        });

                        it("leads to 'terminated'", function () {
                            expect(state.getState()).to.equal("terminated");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'terminated:entry' event", function () {
                            expect(terminatedEntrySpy.called).to.equal(true);
                        });

                        it("sets all the right flags", function () {
                            expect(state.hasLocalMediaApproval).to.equal(false);
                            expect(state.hasLocalMedia).to.equal(false);
                            expect(state.receivedBye).to.equal(false);
                            expect(state.sentSDP).to.equal(false);
                            expect(state.processedRemoteSDP).to.equal(false);
                        });
                    });

                    describe('invalid event', function () {
                        var invalidEvents = [
                            'initiate',
                            'receiveLocalMedia',
                            'approve',
                            'sentOffer',
                            'receiveRemoteMedia',
                            'accept',
                            'receiveAnswer',
                            'modify'
                        ];

                        invalidEvents.forEach(function (evt) {
                            describe("event " + evt, function () {
                                var currentState;

                                beforeEach(function () {
                                    currentState = state.getState();
                                    state.dispatch(evt);
                                });

                                it("doesn't move to a new state", function () {
                                    expect(state.getState()).to.equal(currentState);
                                });
                            });
                        });
                    });

                    describe("event 'reject'", function () {
                        var preparingExitSpy;
                        var terminatedEntrySpy;

                        beforeEach(function (done) {
                            preparingExitSpy = sinon.spy();
                            terminatedEntrySpy = sinon.spy();
                            state.listen('preparing:exit', preparingExitSpy);
                            state.listen('terminated:entry', terminatedEntrySpy);
                            state.dispatch("reject");
                            setTimeout(done);
                        });

                        afterEach(function () {
                            state.ignore('preparing:exit', preparingExitSpy);
                            state.ignore('terminated:entry', terminatedEntrySpy);
                        });

                        it("leads to 'terminated'", function () {
                            expect(state.getState()).to.equal("terminated");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'preparing:exit' event", function () {
                            expect(preparingExitSpy.called).to.equal(true);
                        });

                        it("should fire the 'terminated:entry' event", function () {
                            expect(terminatedEntrySpy.called).to.equal(true);
                        });

                        it("sets all the right flags", function () {
                            expect(state.hasLocalMediaApproval).to.equal(false);
                            expect(state.hasLocalMedia).to.equal(false);
                            expect(state.receivedBye).to.equal(false);
                            expect(state.sentSDP).to.equal(false);
                            expect(state.processedRemoteSDP).to.equal(false);
                        });

                        describe('invalid event', function () {
                            var invalidEvents = [
                                'initiate',
                                'reject',
                                'answer',
                                'receiveLocalMedia',
                                'accept',
                                'approve',
                                'sentOffer',
                                'receiveRemoteMedia',
                                'receiveAnswer',
                                'modify'
                            ];

                            invalidEvents.forEach(function (evt) {
                                describe("event " + evt, function () {
                                    var currentState;

                                    beforeEach(function () {
                                        currentState = state.getState();
                                        state.dispatch(evt);
                                    });

                                    it("doesn't move to a new state", function () {
                                        expect(state.getState()).to.equal(currentState);
                                    });
                                });
                            });
                        });
                    });

                    describe("event 'answer'", function () {
                        var approvingDeviceAccessEntrySpy = sinon.spy();

                        beforeEach(function (done) {
                            state.listen('approving-device-access:entry', approvingDeviceAccessEntrySpy);
                            state.dispatch('answer', params);
                            setTimeout(done);
                        });

                        afterEach(function () {
                            state.ignore('approving-device-access:entry', approvingDeviceAccessEntrySpy);
                        });

                        it("moves to 'approvingDeviceAccess'", function () {
                            expect(state.getState()).to.equal('approvingDeviceAccess');
                        });

                        it("fires 'approving-device-access:entry'", function () {
                            expect(approvingDeviceAccessEntrySpy.called).to.equal(true);
                        });

                        it("sets all the right flags", function () {
                            expect(state.hasLocalMediaApproval).to.equal(!params.previewLocalMedia);
                            expect(state.hasLocalMedia).to.equal(false);
                            expect(state.receivedBye).to.equal(false);
                            expect(state.sentSDP).to.equal(false);
                            expect(state.processedRemoteSDP).to.equal(false);
                        });

                        describe('invalid event', function () {
                            var invalidEvents = [
                                'initiate',
                                'answer',
                                'receiveLocalMedia',
                                'sentOffer',
                                'accept',
                                'receiveRemoteMedia',
                                'receiveAnswer',
                                'modify'
                            ];

                            invalidEvents.forEach(function (evt) {
                                describe("event " + evt, function () {
                                    var currentState;

                                    beforeEach(function () {
                                        currentState = state.getState();
                                        state.dispatch(evt, params || {});
                                    });

                                    it("doesn't move to a new state", function () {
                                        expect(state.getState()).to.equal(currentState);
                                    });
                                });
                            });
                        });

                        describe("event 'approve'", function () {
                            var approvingContentEntrySpy;

                            beforeEach(function (done) {
                                approvingContentEntrySpy = sinon.spy();
                                state.listen('approving-content:entry', approvingContentEntrySpy);
                                state.dispatch('approve', params);
                                setTimeout(done);
                            });

                            afterEach(function () {
                                state.ignore('approving-content:entry', approvingContentEntrySpy);
                            });

                            it("moves to 'approvingContent'", function () {
                                expect(state.getState()).to.equal('approvingContent');
                            });

                            it("fires 'approving-content:entry'", function () {
                                expect(approvingContentEntrySpy.called).to.equal(true);
                            });

                            it("sets all the right flags", function () {
                                expect(state.hasLocalMediaApproval).to.equal(!params.previewLocalMedia);
                                expect(state.hasLocalMedia).to.equal(false);
                                expect(state.receivedBye).to.equal(false);
                                expect(state.sentSDP).to.equal(false);
                                expect(state.processedRemoteSDP).to.equal(false);
                            });

                            describe('invalid event', function () {
                                var invalidEvents = [
                                    'initiate',
                                    'answer',
                                    'receiveLocalMedia',
                                    'sentOffer',
                                    'receiveRemoteMedia',
                                    'receiveAnswer',
                                    'accept',
                                    'modify'
                                ];

                                invalidEvents.forEach(function (evt) {
                                    describe("event " + evt, function () {
                                        var currentState;

                                        beforeEach(function () {
                                            currentState = state.getState();
                                            state.dispatch(evt, params || {});
                                        });

                                        it("doesn't move to a new state", function () {
                                            expect(state.getState()).to.equal(currentState);
                                        });
                                    });
                                });
                            });

                            describe("event 'approve'", function () {
                                var offeringEntrySpy;
                                var approvingContentExitSpy;

                                beforeEach(function (done) {
                                    offeringEntrySpy = sinon.spy();
                                    approvingContentExitSpy = sinon.spy();
                                    state.listen('offering:entry', offeringEntrySpy);
                                    state.listen('approving-content:exit', approvingContentExitSpy);
                                    setTimeout(done);
                                });

                                afterEach(function () {
                                    state.ignore('offering:entry', offeringEntrySpy);
                                });

                                describe("when we have received local media already", function () {
                                    beforeEach(function (done) {
                                        state.hasLocalMedia = true;
                                        state.dispatch('approve', params);
                                        setTimeout(done);
                                    });

                                    afterEach(function () {
                                        state.hasLocalMedia = false;
                                    });

                                    it("sets all the right flags", function () {
                                        expect(state.hasLocalMediaApproval).to.equal(true);
                                        expect(state.hasLocalMedia).to.equal(true);
                                        expect(state.receivedBye).to.equal(false);
                                        expect(state.sentSDP).to.equal(false);
                                        expect(state.processedRemoteSDP).to.equal(false);
                                    });

                                    it("moves to 'offering'", function () {
                                        expect(state.getState()).to.equal('offering');
                                    });

                                    it("fires 'approving-content:exit'", function () {
                                        expect(approvingContentExitSpy.called).to.equal(true);
                                    });

                                    it("fires 'offering:entry'", function () {
                                        expect(offeringEntrySpy.called).to.equal(true);
                                    });

                                    describe("not receiving an answer", function () {
                                        var offeringExitSpy;
                                        var terminatedEntrySpy;

                                        beforeEach(function (done) {
                                            offeringExitSpy = sinon.spy();
                                            terminatedEntrySpy = sinon.spy();
                                            state.listen('offering:exit', offeringExitSpy);
                                            state.listen('terminated:entry', terminatedEntrySpy);
                                            state.dispatch('sentOffer');
                                            setTimeout(function () {
                                                done();
                                            }, 50);
                                        });

                                        afterEach(function () {
                                            state.ignore('offering:exit', offeringExitSpy);
                                            state.ignore('terminated:entry', terminatedEntrySpy);
                                        });

                                        it("leads to 'terminated'", function () {
                                            expect(state.getState()).to.equal("terminated");
                                        });

                                        it("should not report modifying", function () {
                                            expect(state.isModifying()).to.equal(false);
                                        });

                                        it("should fire the 'offering:exit' event", function () {
                                            expect(offeringExitSpy.called).to.equal(true);
                                        });

                                        it("should fire the 'terminated:entry' event", function () {
                                            expect(terminatedEntrySpy.called).to.equal(true);
                                        });

                                        it("should set the terminate reason", function () {
                                            expect(state.hangupReason.indexOf('timer') > -1).to.equal(true);
                                        });
                                    });

                                    describe('invalid event', function () {
                                        var invalidEvents = [
                                            'initiate',
                                            'answer',
                                            'approve',
                                            'accept',
                                            'sentOffer',
                                            'modify'
                                        ];

                                        invalidEvents.forEach(function (evt) {
                                            describe("event " + evt, function () {
                                                var currentState;

                                                beforeEach(function () {
                                                    currentState = state.getState();
                                                    state.dispatch(evt, params || {});
                                                });

                                                it("doesn't move to a new state", function () {
                                                    expect(state.getState()).to.equal(currentState);
                                                });
                                            });
                                        });
                                    });

                                    describe("event 'receiveLocalMedia'", function () {
                                        beforeEach(function () {
                                            state.hasLocalMedia = false;
                                            state.dispatch('receiveLocalMedia');
                                        });

                                        it("sets all the right flags", function () {
                                            expect(state.hasLocalMediaApproval).to.equal(true);
                                            expect(state.hasLocalMedia).to.equal(true);
                                            expect(state.receivedBye).to.equal(false);
                                            expect(state.sentSDP).to.equal(false);
                                            expect(state.processedRemoteSDP).to.equal(false);
                                        });

                                        it("does not move to another state", function () {
                                            expect(state.getState()).to.equal('offering');
                                        });
                                    });

                                    describe("event 'receiveAnswer'", function () {
                                        var connectingEntrySpy;

                                        beforeEach(function (done) {
                                            connectingEntrySpy = sinon.spy();
                                            state.listen('connecting:entry', connectingEntrySpy);
                                            state.dispatch('sentOffer');
                                            state.dispatch('receiveAnswer');
                                            setTimeout(done);
                                        });

                                        afterEach(function () {
                                            state.ignore('connecting:entry', connectingEntrySpy);
                                        });

                                        it("moves to 'connecting'", function () {
                                            expect(state.getState()).to.equal('connecting');
                                        });

                                        it("fires 'connecting:entry'", function () {
                                            expect(connectingEntrySpy.called).to.equal(true);
                                        });

                                        it("sets all the right flags", function () {
                                            expect(state.hasLocalMediaApproval).to.equal(true);
                                            expect(state.hasLocalMedia).to.equal(true);
                                            expect(state.receivedBye).to.equal(false);
                                            expect(state.sentSDP).to.equal(false);
                                            expect(state.processedRemoteSDP).to.equal(true);
                                        });

                                        describe("not receiving ICE connected", function () {
                                            var connectingExitSpy;
                                            var terminatedEntrySpy;

                                            beforeEach(function (done) {
                                                connectingExitSpy = sinon.spy();
                                                terminatedEntrySpy = sinon.spy();
                                                state.listen('connecting:exit', connectingExitSpy);
                                                state.listen('terminated:entry', terminatedEntrySpy);
                                                setTimeout(function () {
                                                    done();
                                                }, 50);
                                            });

                                            afterEach(function () {
                                                state.ignore('connecting:exit', connectingExitSpy);
                                                state.ignore('terminated:entry', terminatedEntrySpy);
                                            });

                                            it("leads to 'terminated'", function () {
                                                expect(state.getState()).to.equal("terminated");
                                            });

                                            it("should not report modifying", function () {
                                                expect(state.isModifying()).to.equal(false);
                                            });

                                            it("should fire the 'connecting:exit' event", function () {
                                                expect(connectingExitSpy.called).to.equal(true);
                                            });

                                            it("should fire the 'terminated:entry' event", function () {
                                                expect(terminatedEntrySpy.called).to.equal(true);
                                            });

                                            it("should set the terminate reason", function () {
                                                expect(state.hangupReason.indexOf('timer') > -1).to.equal(true);
                                            });
                                        });

                                        describe('invalid event', function () {
                                            var invalidEvents = [
                                                'initiate',
                                                'answer',
                                                'receiveLocalMedia',
                                                'approve',
                                                'sentOffer',
                                                'accept',
                                                'receiveAnswer',
                                                'modify'
                                            ];

                                            invalidEvents.forEach(function (evt) {
                                                describe("event " + evt, function () {
                                                    var currentState;

                                                    beforeEach(function () {
                                                        currentState = state.getState();
                                                        state.dispatch(evt, params || {});
                                                    });

                                                    it("doesn't move to a new state", function () {
                                                        expect(state.getState()).to.equal(currentState);
                                                    });
                                                });
                                            });
                                        });

                                        describe("event 'receiveRemoteMedia'", function () {
                                            var connectedEntrySpy;

                                            beforeEach(function (done) {
                                                connectedEntrySpy = sinon.spy();
                                                state.listen('connected:entry', connectedEntrySpy);
                                                state.dispatch('receiveRemoteMedia');
                                                fake.hasMedia = true;
                                                setTimeout(done);
                                            });

                                            it("moves to the 'connected' state", function () {
                                                expect(state.getState()).to.equal('connected');
                                            });

                                            it("fires the 'connected:entry' event", function () {
                                                expect(connectedEntrySpy.called).to.equal(true);
                                            });

                                            describe('invalid event', function () {
                                                var invalidEvents = [
                                                    'initiate',
                                                    'answer',
                                                    'receiveLocalMedia',
                                                    'approve',
                                                    'sentOffer',
                                                    'accept',
                                                    'receiveRemoteMedia',
                                                    'receiveAnswer',
                                                ];

                                                invalidEvents.forEach(function (evt) {
                                                    describe("event " + evt, function () {
                                                        var currentState;

                                                        beforeEach(function () {
                                                            currentState = state.getState();
                                                            state.dispatch(evt, params || {});
                                                        });

                                                        it("doesn't move to a new state", function () {
                                                            expect(state.getState()).to.equal(currentState);
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });

                                describe("when we have not received local media yet", function () {
                                    beforeEach(function () {
                                        state.dispatch('approve', params);
                                    });

                                    it("sets the hasLocalMediaApproval flag", function () {
                                        expect(state.hasLocalMediaApproval).to.equal(true);
                                    });

                                    it("stays in 'approvingContent'", function () {
                                        expect(state.getState()).to.equal('approvingContent');
                                    });

                                    describe("event 'receiveLocalMedia'", function () {
                                        beforeEach(function (done) {
                                            state.dispatch('receiveLocalMedia', params);
                                            setTimeout(done);
                                        });

                                        it("sets all the right flags", function () {
                                            expect(state.hasLocalMediaApproval).to.equal(true);
                                            expect(state.hasLocalMedia).to.equal(true);
                                            expect(state.receivedBye).to.equal(false);
                                            expect(state.sentSDP).to.equal(false);
                                            expect(state.processedRemoteSDP).to.equal(false);
                                        });

                                        it("moves to 'offering'", function () {
                                            expect(state.getState()).to.equal('offering');
                                        });

                                        it("fires 'approving-content:exit'", function () {
                                            expect(approvingContentExitSpy.called).to.equal(true);
                                        });

                                        it("fires 'offering:entry'", function () {
                                            expect(offeringEntrySpy.called).to.equal(true);
                                        });
                                    });
                                });

                                describe("event 'reject'", function () {
                                    var terminatedSpy;

                                    beforeEach(function (done) {
                                        terminatedSpy = sinon.spy();
                                        state.listen('terminated:entry', terminatedSpy);
                                        state.dispatch("reject");
                                        setTimeout(done);
                                    });

                                    it("leads to 'terminated'", function () {
                                        expect(state.getState()).to.equal("terminated");
                                    });

                                    it("fires the 'terminated:entry' event", function () {
                                        expect(terminatedSpy.called).to.equal(true);
                                    })
                                });
                            });

                            describe("event 'reject'", function () {
                                var approvingContentExitSpy;
                                var preparingExitSpy;

                                beforeEach(function (done) {
                                    approvingContentExitSpy = sinon.spy();
                                    preparingExitSpy = sinon.spy();
                                    state.listen('approving-content:exit', approvingContentExitSpy);
                                    state.listen('preparing:exit', preparingExitSpy);
                                    state.dispatch("reject");
                                    setTimeout(done);
                                });

                                it("fires 'approving-content:exit'", function () {
                                    expect(approvingContentExitSpy.called).to.equal(true);
                                });

                                it("fires 'preparing:exit'", function () {
                                    expect(approvingContentExitSpy.called).to.equal(true);
                                });

                                it("leads to 'terminated'", function () {
                                    expect(state.getState()).to.equal("terminated");
                                });
                            });
                        });

                        describe("event 'reject'", function () {
                            beforeEach(function () {
                                state.dispatch("reject");
                            });

                            it("leads to 'terminated'", function () {
                                expect(state.getState()).to.equal("terminated");
                            });
                        });
                    });
                });

                describe("when media is flowing", function () {
                    beforeEach(function () {
                        fake.hasMedia = true;
                    });

                    afterEach(function () {
                        fake.hasMedia = false;
                    });

                    describe("event 'hangup'", function () {
                        var terminatedEntrySpy;

                        beforeEach(function (done) {
                            terminatedEntrySpy = sinon.spy();
                            state.listen('terminated:entry', terminatedEntrySpy);
                            state.dispatch("hangup", params);
                            setTimeout(done);
                        });

                        afterEach(function () {
                            state.ignore('terminated:entry', terminatedEntrySpy);
                        });

                        it("leads to 'terminated'", function () {
                            expect(state.getState()).to.equal("terminated");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'terminated:entry' event", function () {
                            expect(terminatedEntrySpy.called).to.equal(true);
                        });
                    });

                    describe("event 'reject'", function () {
                        var connectedEntrySpy;

                        beforeEach(function (done) {
                            connectedEntrySpy = sinon.spy();
                            state.listen('connected:entry', connectedEntrySpy);
                            state.dispatch("reject");
                            setTimeout(done);
                        });

                        afterEach(function () {
                            state.ignore('connected:entry', connectedEntrySpy);
                        });

                        it("leads to 'connected'", function () {
                            expect(state.getState()).to.equal("connected");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'connected:entry' event", function () {
                            expect(connectedEntrySpy.called).to.equal(true);
                        });

                        describe("event 'modify'", function () {
                            describe("as modify initiator", function () {
                                var connectedExitSpy;
                                var modifyingEntrySpy;

                                beforeEach(function (done) {
                                    connectedExitSpy = sinon.spy();
                                    modifyingEntrySpy = sinon.spy();
                                    state.listen('connected:exit', connectedExitSpy);
                                    state.listen('modifying:entry', function () {
                                        modifyingEntrySpy();
                                    });
                                    state.dispatch("modify");
                                    setTimeout(done);
                                });

                                afterEach(function () {
                                    state.ignore('connected:exit', connectedExitSpy);
                                    state.ignore('modifying:entry', modifyingEntrySpy);
                                });

                                it("leads to 'modifying'", function () {
                                    expect(state.getState()).to.equal("modifying");
                                });

                                it("should report modifying", function () {
                                    expect(state.isModifying()).to.equal(true);
                                });

                                it("should fire the 'connected:exit' event", function () {
                                    expect(connectedExitSpy.called).to.equal(true);
                                });

                                it("should fire the 'modifying:entry' event", function () {
                                    expect(modifyingEntrySpy.called).to.equal(true);
                                });

                                it("sets all the right flags", function () {
                                    expect(state.hasLocalMediaApproval).to.equal(false);
                                    expect(state.hasLocalMedia).to.equal(false);
                                    expect(state.receivedBye).to.equal(false);
                                    expect(state.sentSDP).to.equal(false);
                                    expect(state.processedRemoteSDP).to.equal(false);
                                });

                                describe("event 'accept'", function () {
                                    var preparingEntrySpy;
                                    var modifyingExitSpy;

                                    beforeEach(function (done) {
                                        preparingEntrySpy = sinon.spy();
                                        modifyingExitSpy = sinon.spy();
                                        state.listen('preparing:entry', function () {
                                            preparingEntrySpy();
                                        });
                                        state.listen('modifying:exit', function () {
                                            modifyingExitSpy();
                                        });
                                        state.dispatch("accept");
                                        setTimeout(done);
                                    });

                                    afterEach(function () {
                                        state.ignore('preparing:entry', preparingEntrySpy);
                                        state.ignore('modifying:exit', modifyingExitSpy);
                                    });

                                    it("leads to 'preparing'", function () {
                                        expect(state.getState()).to.equal("preparing");
                                    });

                                    it("should report modifying", function () {
                                        expect(state.isModifying()).to.equal(true);
                                    });

                                    it("should fire the 'preparing:entry' event", function () {
                                        expect(preparingEntrySpy.called).to.equal(true);
                                    });

                                    it("should fire the 'modifying:exit' event", function () {
                                        expect(modifyingExitSpy.called).to.equal(true);
                                    });

                                    it("should set hasLocalMediaApproval to false", function () {
                                        expect(state.hasLocalMediaApproval).to.equal(false);
                                    });

                                    it("should set hasLocalMedia to false", function () {
                                        expect(state.hasLocalMedia).to.equal(false);
                                    });

                                    it("should set caller to true", function () {
                                        expect(state.caller).to.equal(true);
                                    });
                                });

                                describe("event 'reject'", function () {
                                    var connectedEntrySpy;
                                    var modifyingExitSpy;

                                    beforeEach(function (done) {
                                        connectedEntrySpy = sinon.spy();
                                        modifyingExitSpy = sinon.spy();
                                        state.listen('connected:entry', function () {
                                            connectedEntrySpy();
                                        });
                                        state.listen('modifying:exit', function () {
                                            modifyingExitSpy();
                                        });
                                        state.dispatch("reject");
                                        setTimeout(done);
                                    });

                                    afterEach(function () {
                                        state.ignore('connected:entry', connectedEntrySpy);
                                        state.ignore('modifying:exit', modifyingExitSpy);
                                    });

                                    it("leads to 'connected'", function () {
                                        expect(state.getState()).to.equal("connected");
                                    });

                                    it("should not report modifying", function () {
                                        expect(state.isModifying()).to.equal(false);
                                    });

                                    it("should fire the 'connected:entry' event", function () {
                                        expect(connectedEntrySpy.called).to.equal(true);
                                    });

                                    it("should fire the 'modifying:exit' event", function () {
                                        expect(modifyingExitSpy.called).to.equal(true);
                                    });
                                });

                                describe('invalid event', function () {
                                    var invalidEvents = [
                                        'initiate',
                                        'answer',
                                        'receiveLocalMedia',
                                        'approve',
                                        'sentOffer',
                                        'receiveRemoteMedia',
                                        'receiveAnswer',
                                        'modify'
                                    ];

                                    invalidEvents.forEach(function (evt) {
                                        describe("event " + evt, function () {
                                            var currentState;

                                            beforeEach(function () {
                                                currentState = state.getState();
                                                state.dispatch(evt, params || {});
                                            });

                                            it("doesn't move to a new state", function () {
                                                expect(state.getState()).to.equal(currentState);
                                            });

                                            it("should report modifying", function () {
                                                expect(state.isModifying()).to.equal(true);
                                            });
                                        });
                                    });
                                });
                            });

                            describe("as modify receiver", function () {
                                var connectedExitSpy;
                                var preparingEntrySpy;

                                beforeEach(function (done) {
                                    connectedExitSpy = sinon.spy();
                                    preparingEntrySpy = sinon.spy();
                                    state.listen('connected:exit', connectedExitSpy);
                                    state.listen('preparing:entry', function () {
                                        preparingEntrySpy();
                                    });
                                    state.dispatch("modify", {receive: true});
                                    setTimeout(done);
                                });

                                afterEach(function () {
                                    state.ignore('connected:exit', connectedExitSpy);
                                    state.ignore('preparing:entry', preparingEntrySpy);
                                });

                                it("leads to 'preparing'", function () {
                                    expect(state.getState()).to.equal("preparing");
                                });

                                it("should report modifying", function () {
                                    expect(state.isModifying()).to.equal(true);
                                });

                                it("should fire the 'connected:exit' event", function () {
                                    expect(connectedExitSpy.called).to.equal(true);
                                });

                                it("should fire the 'preparing:entry' event", function () {
                                    expect(preparingEntrySpy.called).to.equal(true);
                                });

                                it("should set the caller to false", function () {
                                    expect(state.caller).to.equal(false);
                                });

                                it("sets all the right flags", function () {
                                    expect(state.hasLocalMediaApproval).to.equal(false);
                                    expect(state.hasLocalMedia).to.equal(false);
                                    expect(state.receivedBye).to.equal(false);
                                    expect(state.sentSDP).to.equal(false);
                                    expect(state.processedRemoteSDP).to.equal(false);
                                });

                                describe("event 'reject'", function () {
                                    var connectedEntrySpy;
                                    var preparingExitSpy;

                                    beforeEach(function (done) {
                                        connectedEntrySpy = sinon.spy();
                                        preparingExitSpy = sinon.spy();
                                        state.listen('connected:entry', function () {
                                            connectedEntrySpy();
                                        });
                                        state.listen('preparing:exit', function () {
                                            preparingExitSpy();
                                        });
                                        state.dispatch("reject");
                                        setTimeout(done);
                                    });

                                    afterEach(function () {
                                        state.ignore('connected:entry', connectedEntrySpy);
                                        state.ignore('preparing:exit', preparingExitSpy);
                                    });

                                    it("leads to 'connected'", function () {
                                        expect(state.getState()).to.equal("connected");
                                    });

                                    it("should not report modifying", function () {
                                        expect(state.isModifying()).to.equal(false);
                                    });

                                    it("should fire the 'connected:entry' event", function () {
                                        expect(connectedEntrySpy.called).to.equal(true);
                                    });

                                    it("should fire the 'preparing:exit' event", function () {
                                        expect(preparingExitSpy.called).to.equal(true);
                                    });
                                });

                                describe('invalid event', function () {
                                    var invalidEvents = [
                                        'initiate',
                                        'receiveLocalMedia',
                                        'approve',
                                        'sentOffer',
                                        'receiveRemoteMedia',
                                        'receiveAnswer',
                                        'modify',
                                        'accept'
                                    ];

                                    invalidEvents.forEach(function (evt) {
                                        describe("event " + evt, function () {
                                            var currentState;

                                            beforeEach(function () {
                                                currentState = state.getState();
                                                state.dispatch(evt, params || {});
                                            });

                                            it("doesn't move to a new state", function () {
                                                expect(state.getState()).to.equal(currentState);
                                            });

                                            it("should report modifying", function () {
                                                expect(state.isModifying()).to.equal(true);
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });

            describe("when a call listener is not attached", function () {
                var preparingEntrySpy;

                beforeEach(function (done) {
                    preparingEntrySpy = sinon.spy();
                    state.listen('preparing:entry', preparingEntrySpy);
                    state.dispatch("initiate", {
                        caller: caller,
                        client: {
                            hasListeners: function () { return false; }
                        }
                    });
                    setTimeout(done);
                });

                afterEach(function () {
                    state.ignore('preparing:entry', preparingEntrySpy);
                });

                it("leads to 'preparing'", function () {
                    expect(state.getState()).to.equal("preparing");
                });

                it("should not report modifying", function () {
                    expect(state.isModifying()).to.equal(false);
                });

                it("should fire the 'preparing:entry' event", function () {
                    expect(preparingEntrySpy.called).to.equal(true);
                });
            });
        });
    });
});
