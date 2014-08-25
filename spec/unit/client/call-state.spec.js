
var expect = chai.expect;

respoke.log.setLevel('warn');

describe("respoke.CallState", function () {
    var state;
    var call = {
        caller: true,
        directConnectionOnly: false,
        previewLocalMedia: function () {},
        hasListeners: function () {
            return true;
        }
    };

    describe("it's object structure", function () {
        beforeEach(function () {
            state = respoke.CallState({call: call});
        });

        it("has the correct class name.", function () {
            expect(state.className).to.equal('respoke.CallState');
        });

        it("contains some important methods.", function () {
            expect(typeof state.dispatch).to.equal('function');
        });

        it("has not been run", function () {
            expect(state.currentState()).to.equal.undefined;
        });

        it("should not report modifying", function () {
            expect(state.isModifying()).to.equal(false);
        });
    });

    describe("for the caller", function () {
        describe("when starting from 'idle'", function () {
            var idleSpy;

            beforeEach(function () {
                call = {
                    caller: true,
                    directConnectionOnly: false,
                    previewLocalMedia: function () {},
                    hasListeners: function () {
                        return true;
                    }
                };
                state = respoke.CallState({call: call});
            });

            it("reports the correct state name", function () {
                expect(state.currentState().name).to.equal("idle");
            });

            it("should not report modifying", function () {
                expect(state.isModifying()).to.equal(false);
            });

            describe("event 'initiate'", function () {
                var negotiatingEntrySpy;

                beforeEach(function () {
                    negotiatingEntrySpy = sinon.spy();
                    state.listen('negotiating:entry', negotiatingEntrySpy);
                    state.dispatch("initiate");
                });

                afterEach(function () {
                    state.ignore('negotiating:entry', negotiatingEntrySpy);
                });

                it("leads to 'negotiating'", function () {
                    expect(state.currentState().name).to.equal("negotiating");
                });

                it("should not report modifying", function () {
                    expect(state.isModifying()).to.equal(false);
                });

                it("should fire the 'negotiating:entry' event", function () {
                    expect(negotiatingEntrySpy.called).to.equal(true);
                });

                describe("when isMediaFlowing is false", function () {
                    beforeEach(function () {
                        state.isMediaFlowing = false;
                    });

                    describe("event 'reject'", function () {
                        var negotiatingExitSpy;
                        var terminatedEntrySpy;

                        beforeEach(function () {
                            negotiatingExitSpy = sinon.spy();
                            terminatedEntrySpy = sinon.spy();
                            state.listen('negotiating:exit', negotiatingExitSpy);
                            state.listen('terminated:entry', terminatedEntrySpy);
                            state.dispatch("reject", call);
                        });

                        afterEach(function () {
                            state.ignore('negotiating:exit', negotiatingExitSpy);
                            state.ignore('terminated:entry', terminatedEntrySpy);
                        });

                        it("leads to 'terminated'", function () {
                            expect(state.currentState().name).to.equal("terminated");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'negotiating:exit' event", function () {
                            expect(negotiatingExitSpy.called).to.equal(true);
                        });

                        it("should fire the 'terminated:entry' event", function () {
                            expect(terminatedEntrySpy.called).to.equal(true);
                        });
                    });

                    describe("event 'answer'", function () {
                        var approvingDeviceAccessEntrySpy = sinon.spy();

                        beforeEach(function () {
                            state.listen('approving-device-access:entry', approvingDeviceAccessEntrySpy);
                            state.dispatch('answer', {
                                call: call,
                                previewLocalMedia: function () {},
                                directConnectionOnly: false,
                                receiveOnly: false
                            });
                        });

                        afterEach(function () {
                            state.ignore('approving-device-access:entry', approvingDeviceAccessEntrySpy);
                        });

                        it("moves to 'approvingDeviceAccess'", function () {
                            expect(state.currentState().name).to.equal('approvingDeviceAccess');
                        });

                        it("fires 'approving-device-access:entry'", function () {
                            expect(approvingDeviceAccessEntrySpy.called).to.equal(true);
                        });

                        describe("event 'approve'", function () {
                            var approvingContentEntrySpy;

                            beforeEach(function () {
                                approvingContentEntrySpy = sinon.spy();
                                state.listen('approving-content:entry', approvingContentEntrySpy);
                                state.dispatch('approve');
                            });

                            afterEach(function () {
                                state.ignore('approving-content:entry', approvingContentEntrySpy);
                            });

                            it("moves to 'approvingContent'", function () {
                                expect(state.currentState().name).to.equal('approvingContent');
                            });

                            it("fires 'approving-content:entry'", function () {
                                expect(approvingContentEntrySpy.called).to.equal(true);
                            });

                            describe("event 'approve'", function () {
                                var offeringEntrySpy;
                                var approvingContentExitSpy;

                                beforeEach(function () {
                                    offeringEntrySpy = sinon.spy();
                                    approvingContentExitSpy = sinon.spy();
                                    state.listen('offering:entry', offeringEntrySpy);
                                    state.listen('approving-content:exit', approvingContentExitSpy);
                                    state.dispatch('approve');
                                });

                                afterEach(function () {
                                    state.ignore('offering:entry', offeringEntrySpy);
                                });

                                it("moves to 'offering'", function () {
                                    expect(state.currentState().name).to.equal('offering');
                                });

                                it("fires 'approving-content:exit'", function () {
                                    expect(approvingContentExitSpy.called).to.equal(true);
                                });

                                it("fires 'offering:entry'", function () {
                                    expect(offeringEntrySpy.called).to.equal(true);
                                });

                                describe("event 'receiveAnswer'", function () {
                                    var connectingEntrySpy;

                                    beforeEach(function () {
                                        connectingEntrySpy = sinon.spy();
                                        state.listen('connecting:entry', connectingEntrySpy);
                                        state.dispatch('receiveAnswer');
                                    });

                                    afterEach(function () {
                                        state.ignore('connecting:entry', connectingEntrySpy);
                                    });

                                    it("moves to 'connecting'", function () {
                                        expect(state.currentState().name).to.equal('connecting');
                                    });

                                    it("fires 'connecting:entry'", function () {
                                        expect(connectingEntrySpy.called).to.equal(true);
                                    });
                                });

                                describe("event 'reject'", function () {
                                    var terminatedSpy;

                                    beforeEach(function () {
                                        terminatedSpy = sinon.spy();
                                        state.listen('terminated:entry', terminatedSpy);
                                        state.dispatch("reject", call);
                                    });

                                    it("leads to 'terminated'", function () {
                                        expect(state.currentState().name).to.equal("terminated");
                                    });

                                    it("fires the 'terminated:entry' event", function () {
                                        expect(terminatedSpy.called).to.equal(true);
                                    })
                                });
                            });

                            describe("event 'reject'", function () {
                                var approvingContentExitSpy;
                                var negotiatingExitSpy;

                                beforeEach(function () {
                                    approvingContentExitSpy = sinon.spy();
                                    negotiatingExitSpy = sinon.spy();
                                    state.listen('approving-content:exit', approvingContentExitSpy);
                                    state.listen('negotiating:exit', negotiatingExitSpy);
                                    state.dispatch("reject", call);
                                });

                                it("fires 'approving-content:exit'", function () {
                                    expect(approvingContentExitSpy.called).to.equal(true);
                                });

                                it("fires 'negotiating:exit'", function () {
                                    expect(approvingContentExitSpy.called).to.equal(true);
                                });

                                it("leads to 'terminated'", function () {
                                    expect(state.currentState().name).to.equal("terminated");
                                });
                            });
                        });

                        describe("event 'reject'", function () {
                            beforeEach(function () {
                                state.dispatch("reject", call);
                            });

                            it("leads to 'terminated'", function () {
                                expect(state.currentState().name).to.equal("terminated");
                            });
                        });
                    });
                });

                describe("when isMediaFlowing is true", function () {
                    beforeEach(function () {
                        state.isMediaFlowing = true;
                    });

                    describe("event 'reject'", function () {
                        var connectedEntrySpy;

                        beforeEach(function () {
                            connectedEntrySpy = sinon.spy();
                            state.listen('connected:entry', connectedEntrySpy);
                            state.dispatch("reject", call);
                        });

                        afterEach(function () {
                            state.ignore('connected:entry', connectedEntrySpy);
                        });

                        it("leads to 'connected'", function () {
                            expect(state.currentState().name).to.equal("connected");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'connected:entry' event", function () {
                            expect(connectedEntrySpy.called).to.equal(true);
                        });

                        describe("event 'modify'", function () {
                            var connectedExitSpy;
                            var negotiatingEntrySpy;

                            beforeEach(function () {
                                connectedExitSpy = sinon.spy();
                                negotiatingEntrySpy = sinon.spy();
                                state.listen('connected:exit', connectedExitSpy);
                                state.listen('negotiating:entry', function () {
                                    negotiatingEntrySpy();
                                });
                                state.dispatch("modify");
                            });

                            afterEach(function () {
                                state.ignore('connected:exit', connectedExitSpy);
                                state.ignore('negotiating:entry', negotiatingEntrySpy);
                            });

                            it("leads to 'negotiating'", function () {
                                expect(state.currentState().name).to.equal("negotiating");
                            });

                            it("should report modifying", function () {
                                expect(state.isModifying()).to.equal(true);
                            });

                            it("should fire the 'connected:exit' event", function () {
                                expect(connectedExitSpy.called).to.equal(true);
                            });

                            it("should fire the 'negotiating:entry' event", function () {
                                expect(negotiatingEntrySpy.called).to.equal(true);
                            });
                        });
                    });
                });
            });
        });
    });

    describe("for the callee", function () {
        describe("when starting from 'idle'", function () {
            var idleSpy;

            beforeEach(function () {
                call = {
                    caller: false,
                    directConnectionOnly: false,
                    previewLocalMedia: function () {},
                    hasListeners: function () {
                        return true;
                    }
                };
                state = respoke.CallState({call: call});
            });

            it("reports the correct state name", function () {
                expect(state.currentState().name).to.equal("idle");
            });

            it("should not report modifying", function () {
                expect(state.isModifying()).to.equal(false);
            });

            describe("event 'answer'", function () {
                beforeEach(function () {
                    state.dispatch('answer', {
                        call: call,
                        previewLocalMedia: function () {},
                        directConnectionOnly: false,
                        receiveOnly: false
                    });
                });

                it("doesn't transition", function () {
                    expect(state.currentState().name).to.equal('idle');
                });
            });

            describe("event 'initiate'", function () {
                var negotiatingEntrySpy;

                beforeEach(function () {
                    negotiatingEntrySpy = sinon.spy();
                    state.listen('negotiating:entry', negotiatingEntrySpy);
                    state.dispatch("initiate", call);
                });

                afterEach(function () {
                    state.ignore('negotiating:entry', negotiatingEntrySpy);
                });

                it("leads to 'negotiating'", function () {
                    expect(state.currentState().name).to.equal("negotiating");
                });

                it("should not report modifying", function () {
                    expect(state.isModifying()).to.equal(false);
                });

                it("should fire the 'negotiating:entry' event", function () {
                    expect(negotiatingEntrySpy.called).to.equal(true);
                });

                describe("when isMediaFlowing is false", function () {
                    beforeEach(function () {
                        state.isMediaFlowing = false;
                    });

                    describe("event 'reject'", function () {
                        var negotiatingExitSpy;
                        var terminatedEntrySpy;

                        beforeEach(function () {
                            negotiatingExitSpy = sinon.spy();
                            terminatedEntrySpy = sinon.spy();
                            state.listen('negotiating:exit', negotiatingExitSpy);
                            state.listen('terminated:entry', terminatedEntrySpy);
                            state.dispatch("reject", call);
                        });

                        afterEach(function () {
                            state.ignore('negotiating:exit', negotiatingExitSpy);
                            state.ignore('terminated:entry', terminatedEntrySpy);
                        });

                        it("leads to 'terminated'", function () {
                            expect(state.currentState().name).to.equal("terminated");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'negotiating:exit' event", function () {
                            expect(negotiatingExitSpy.called).to.equal(true);
                        });

                        it("should fire the 'terminated:entry' event", function () {
                            expect(terminatedEntrySpy.called).to.equal(true);
                        });
                    });

                    describe("event 'answer'", function () {
                        var approvingDeviceAccessEntrySpy = sinon.spy();

                        beforeEach(function () {
                            state.listen('approving-device-access:entry', approvingDeviceAccessEntrySpy);
                            state.dispatch('answer', {
                                call: call,
                                previewLocalMedia: function () {},
                                directConnectionOnly: false,
                                receiveOnly: false
                            });
                        });

                        afterEach(function () {
                            state.ignore('approving-device-access:entry', approvingDeviceAccessEntrySpy);
                        });

                        it("moves to 'approvingDeviceAccess'", function () {
                            expect(state.currentState().name).to.equal('approvingDeviceAccess');
                        });

                        it("fires 'approving-device-access:entry'", function () {
                            expect(approvingDeviceAccessEntrySpy.called).to.equal(true);
                        });

                        describe("event 'approve'", function () {
                            var approvingContentEntrySpy;

                            beforeEach(function () {
                                approvingContentEntrySpy = sinon.spy();
                                state.listen('approving-content:entry', approvingContentEntrySpy);
                                state.dispatch('approve');
                            });

                            afterEach(function () {
                                state.ignore('approving-content:entry', approvingContentEntrySpy);
                            });

                            it("moves to 'approvingContent'", function () {
                                expect(state.currentState().name).to.equal('approvingContent');
                            });

                            it("fires 'approving-content:entry'", function () {
                                expect(approvingContentEntrySpy.called).to.equal(true);
                            });

                            describe("event 'approve'", function () {
                                var connectingEntrySpy;

                                beforeEach(function () {
                                    connectingEntrySpy = sinon.spy();
                                    state.listen('connecting:entry', connectingEntrySpy);
                                    state.dispatch('approve');
                                });

                                afterEach(function () {
                                    state.ignore('connecting:entry', connectingEntrySpy);
                                });

                                it("moves to 'connecting'", function () {
                                    expect(state.currentState().name).to.equal('connecting');
                                });

                                it("fires 'connecting:entry'", function () {
                                    expect(connectingEntrySpy.called).to.equal(true);
                                });

                                describe("event 'receiveMedia'", function () {
                                    var connectedEntrySpy;

                                    beforeEach(function () {
                                        connectedEntrySpy = sinon.spy();
                                        state.listen('connected:entry', connectedEntrySpy);
                                        state.dispatch('receiveMedia');
                                    });

                                    afterEach(function () {
                                        state.ignore('connected:entry', connectedEntrySpy);
                                    });

                                    it("moves to 'connected'", function () {
                                        expect(state.currentState().name).to.equal('connected');
                                    });

                                    it("fires 'connected:entry'", function () {
                                        expect(connectedEntrySpy.called).to.equal(true);
                                    });
                                });

                                describe("event 'reject'", function () {
                                    beforeEach(function () {
                                        state.dispatch("reject", call);
                                    });

                                    it("leads to 'terminated'", function () {
                                        expect(state.currentState().name).to.equal("terminated");
                                    });
                                });
                            });

                            describe("event 'reject'", function () {
                                beforeEach(function () {
                                    state.dispatch("reject", call);
                                });

                                it("leads to 'terminated'", function () {
                                    expect(state.currentState().name).to.equal("terminated");
                                });
                            });
                        });

                        describe("event 'reject'", function () {
                            beforeEach(function () {
                                state.dispatch("reject", call);
                            });

                            it("leads to 'terminated'", function () {
                                expect(state.currentState().name).to.equal("terminated");
                            });
                        });
                    });
                });

                describe("when isMediaFlowing is true", function () {
                    beforeEach(function () {
                        state.isMediaFlowing = true;
                    });

                    describe("event 'reject'", function () {
                        var connectedEntrySpy;

                        beforeEach(function () {
                            connectedEntrySpy = sinon.spy();
                            state.listen('connected:entry', connectedEntrySpy);
                            state.dispatch("reject", call);
                        });

                        afterEach(function () {
                            state.ignore('connected:entry', connectedEntrySpy);
                        });

                        it("leads to 'connected'", function () {
                            expect(state.currentState().name).to.equal("connected");
                        });

                        it("should not report modifying", function () {
                            expect(state.isModifying()).to.equal(false);
                        });

                        it("should fire the 'connected:entry' event", function () {
                            expect(connectedEntrySpy.called).to.equal(true);
                        });

                        describe("event 'modify'", function () {
                            beforeEach(function () {
                                state.dispatch("modify", call);
                            });

                            it("leads to 'negotiating'", function () {
                                expect(state.currentState().name).to.equal("negotiating");
                            });

                            it("should report modifying", function () {
                                expect(state.isModifying()).to.equal(true);
                            });

                            describe("event 'reject'", function () {
                                beforeEach(function () {
                                    state.dispatch("reject", call);
                                });

                                afterEach(function () {
                                    state.ignore('connected:entry', connectedEntrySpy);
                                });

                                it("leads to 'connected'", function () {
                                    expect(state.currentState().name).to.equal("connected");
                                });

                                it("should not report modifying", function () {
                                    expect(state.isModifying()).to.equal(false);
                                });
                            });
                        });

                        describe("event 'modify'", function () {
                            var connectedExitSpy;
                            var negotiatingEntrySpy;

                            beforeEach(function () {
                                connectedExitSpy = sinon.spy();
                                negotiatingEntrySpy = sinon.spy();
                                state.listen('connected:exit', connectedExitSpy);
                                state.listen('negotiating:entry', function (evt) {
                                    negotiatingEntrySpy();
                                });
                                state.dispatch("modify", call);
                            });

                            afterEach(function () {
                                state.ignore('connected:exit', connectedExitSpy);
                                state.ignore('negotiating:entry', negotiatingEntrySpy);
                            });

                            it("should fire the 'connected:exit' event", function () {
                                expect(connectedExitSpy.called).to.equal(true);
                            });

                            it("should fire the 'negotiating:entry' event", function () {
                                expect(negotiatingEntrySpy.called).to.equal(true);
                            });
                        });
                    });
                });
            });
        });
    });
});
