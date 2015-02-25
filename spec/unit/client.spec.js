var expect = chai.expect;

describe("respoke.Client", function () {
    var instanceId;
    var client;

    describe("when not connected", function () {
        beforeEach(function () {
            instanceId = respoke.makeGUID();
            client = respoke.createClient({
                instanceId: instanceId,
                gloveColor: "white"
            });
        });

        describe("it's object structure", function () {
            it("extends respoke.EventEmitter.", function () {
                expect(typeof client.listen).to.equal('function');
                expect(typeof client.ignore).to.equal('function');
                expect(typeof client.fire).to.equal('function');
            });

            it("extends respoke.Presentable.", function () {
                expect(typeof client.getPresence).to.equal('function');
                expect(typeof client.setPresence).to.equal('function');
            });

            it("has the correct class name.", function () {
                expect(client.className).to.equal('respoke.Client');
            });

            it("contains some important methods.", function () {
                expect(typeof client.connect).to.equal('function');
                expect(typeof client.disconnect).to.equal('function');
                expect(typeof client.getCall).to.equal('function');
                expect(typeof client.getConnection).to.equal('function');
                expect(typeof client.getEndpoint).to.equal('function');
                expect(typeof client.getEndpoints).to.equal('function');
                expect(typeof client.getGroup).to.equal('function');
                expect(typeof client.getGroups).to.equal('function');
                expect(typeof client.join).to.equal('function');
                expect(typeof client.setOffline).to.equal('function');
                expect(typeof client.setOnline).to.equal('function');
                expect(typeof client.setPresence).to.equal('function');
                expect(typeof client.startCall).to.equal('function');
                expect(typeof client.startAudioCall).to.equal('function');
                expect(typeof client.startVideoCall).to.equal('function');
                expect(typeof client.startPhoneCall).to.equal('function');
                expect(typeof client.startSIPCall).to.equal('function');
            });

            it("saves unexpected developer-specified parameters.", function () {
                expect(client.gloveColor).to.equal('white');
            });

            it("doesn't expose the signaling channel", function () {
                expect(client.signalingChannel).to.not.exist;
                expect(client.getSignalingChannel).to.not.exist;
                Object.keys(client).forEach(function (key) {
                    expect(key).to.not.contain('signal');
                });
            });
        });

        describe("setPresence()", function () {
            it("tries to set presence and errors because of lack of connection", function (done) {
                var newPresence = 'xa';

                client.setPresence({
                    presence: newPresence,
                    onSuccess: function () {
                        done(new Error("User presence succeeded with no connection!"));
                    },
                    onError: function (err) {
                        expect(err.message).to.contain("not connected");
                        done();
                    }
                });
            });
        });

        describe("connect()", function () {
            describe("when called without developmentMode", function () {
                it("throws an error", function (done) {
                    client.connect({
                        appId: respoke.makeGUID(),
                        endpointId: respoke.makeGUID()
                    }).then(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }).catch(function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });

            describe("when called without appId", function () {
                it("throws an error", function (done) {
                    client.connect({
                        developmentMode: true,
                        endpointId: respoke.makeGUID()
                    }).then(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }).catch(function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });

            describe("when called without endpointId", function () {
                it("throws an error", function (done) {
                    client.connect({
                        appId: respoke.makeGUID(),
                        developmentMode: true
                    }).done(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }, function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });
        });

        describe("disconnect()", function () {
            var error;
            var oldConnected;
            var handler = sinon.spy();

            beforeEach(function (done) {
                oldConnected = client.isConnected();
                client.listen('disconnect', handler);
                client.disconnect().done(function () {
                    done();
                }, function (err) {
                    error = err;
                    done();
                });
            });

            it("doesn't change the client.isConnected() value", function () {
                expect(oldConnected).to.be.false;
                expect(oldConnected).to.equal(client.isConnected());
            });

            it("doesn't fire the disconnect event", function () {
                expect(handler.called).to.equal(false);
            });

            it("rejects the disconnect promise", function () {
                expect(error).to.be.ok;
            });
        });

        describe("setPresence()", function () {
            it("throws an error", function (done) {
                client.setPresence({presence: 'available'}).done(function () {
                    done(new Error("Shouldn't be able to set presence when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("setOnline()", function () {
            it("throws an error", function (done) {
                client.setOnline().done(function () {
                    done(new Error("Shouldn't be able to set presence when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("setOffline()", function () {
            it("throws an error", function (done) {
                client.setOffline().done(function () {
                    done(new Error("Shouldn't be able to set presence when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("sendMessage()", function () {
            it("throws an error", function (done) {
                client.sendMessage({
                    endpointId: respoke.makeGUID(),
                    message: "The rent is TOO DAMN HIGH!"
                }).done(function () {
                    done(new Error("Shouldn't be able to send a message when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("startCall()", function () {
            it("throws an error", function (done) {
                client.startCall({
                    endpointId: respoke.makeGUID()
                }).done(function () {
                    done(new Error("Shouldn't be able to start a call when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("startPhoneCall()", function () {
            it("throws an error", function (done) {
                client.startPhoneCall({
                    number: '5555555555'
                }).done(function () {
                    done(new Error("Shouldn't be able to start a phone call when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("join()", function () {
            it("throws an error", function (done) {
                expect(typeof client.join).to.equal('function');
                try {
                client.join({
                    id: respoke.makeGUID()
                }).done(function () {
                    done(new Error("Shouldn't be able to join a group when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
                } catch(e) {
                    expect(e ? e.stack: e).to.be.undefined;
                }
            });
        });

        describe("getGroup()", function () {
            it("returns undefined", function () {
                var group = client.getGroup({
                    id: respoke.makeGUID()
                });
                expect(group).to.equal.undefined;
            });
        });

        describe("getGroups()", function () {
            it("returns an empty array", function () {
                var groups = client.getGroups();
                expect(typeof groups).to.equal('object');
                expect(groups.length).to.equal(0);
            });
        });

        describe("getEndpoint()", function () {
            it("returns undefined", function () {
                var endpoint = client.getEndpoint({
                    id: respoke.makeGUID()
                });
                expect(endpoint).to.equal.undefined;
            });
        });

        describe("getEndpoints()", function () {
            it("returns an empty array", function () {
                var endpoints = client.getEndpoints();
                expect(typeof endpoints).to.equal('object');
                expect(endpoints.length).to.equal(0);
            });
        });

        describe("getConnection()", function () {
            it("returns undefined", function () {
                var connection = client.getConnection({
                    endpointId: respoke.makeGUID(),
                    connectionId: respoke.makeGUID()
                });
                expect(connection).to.equal.undefined;
            });
        });
    });

    describe("when connected", function () {
        var methodsWhichReturnPromises = { // and don't require lots of other stubbing
            'disconnect': 'close',
            'setPresence': 'sendPresence',
            'setOnline': 'sendPresence',
            'setOffline': 'sendPresence',
            'sendMessage': 'sendMessage'
        };

        var params = {
            number: '18005555555',
            uri: 'erin@localhost:5060',
            endpointId: 'test',
            message: 'test',
            presence: 'test',
            id: 'test'
        };

        beforeEach(function (done) {
            instanceId = respoke.makeGUID();

            respoke.SignalingChannel = MockSignalingChannel;
            client = respoke.createClient({
                instanceId: instanceId,
                gloveColor: "white"
            });
            client.connect({
                developmentMode: true,
                appId: '68783999-78BD-4079-8979-EBA65FD8873F',
                endpointId: 'test'
            }).done(function () {
                if (window.mockSignalingChannel.className !== "respoke.MockSignalingChannel") {
                    done(new Error("Not using mock signaling channel"));
                    return;
                }
                done();
            }, done);
        });

        afterEach(function () {
            client = null;
        });

        Object.keys(methodsWhichReturnPromises).forEach(function (method) {
            describe(method, function () {
                var stub;

                beforeEach(function (done) {
                    stub = sinon.stub(
                        window.mockSignalingChannel,
                        methodsWhichReturnPromises[method],
                        window.mockSignalingChannel[methodsWhichReturnPromises[method]]
                    );
                    client[method](params).done(function () {
                        done();
                    }, done);
                });

                it("calls SignalingChannel." + methodsWhichReturnPromises[method], function () {
                    expect(stub).to.be.called;
                });

                afterEach(function () {
                    stub.restore();
                });
            });
        });

        ['startPhoneCall', 'startCall', 'startSIPCall'].forEach(function (method) {
            describe(method, function () {
                var callStub;
                var getEndpointStub;
                var startCallStub;

                beforeEach(function () {
                    callStub = sinon.stub(respoke, "Call", function () {
                        return {
                            className: 'respoke.MockCall',
                            listen: function () {}
                        };
                    });
                    startCallStub = sinon.spy();
                    getEndpointStub = sinon.stub(client, "getEndpoint", function () {
                        return {
                            startCall: callStub,
                            startPhoneCall: callStub,
                            startSIPCall: callStub
                        };
                    });
                    client[method](params);
                });

                it("calls SignalingChannel." + method, function () {
                    expect(startCallStub).to.be.called;
                });

                afterEach(function () {
                    callStub.restore();
                    getEndpointStub.restore();
                });
            });
        });
    });
});
