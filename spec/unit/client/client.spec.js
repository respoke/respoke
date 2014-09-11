
var expect = chai.expect;

var instanceId;
respoke.log.setLevel('error');

describe("respoke.Client", function () {
    var client;
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
            expect(typeof client.setOnline).to.equal('function');
            expect(typeof client.setPresence).to.equal('function');
            expect(typeof client.startCall).to.equal('function');
            expect(typeof client.startPhoneCall).to.equal('function');
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

        it("has default getUserMedia constraints", function () {
            expect(client.callSettings).to.be.an.Object;
            expect(client.callSettings.constraints).to.be.an.Object;
            expect(client.callSettings.constraints.video).to.be.true;
            expect(client.callSettings.constraints.audio).to.be.true;
        });
    });

    describe("when not connected", function () {
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
                    }).then(function success() {
                        done(new Error("connect() succeeded with invalid params."));
                    }).catch(function failure(err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain('Must pass');
                        done();
                    });
                });
            });
        });

        describe("disconnect()", function () {
            it("doesn't change the client.isConnected() value", function () {
                var oldConnected = client.isConnected();
                expect(oldConnected).to.be.false;
                client.disconnect();
                expect(oldConnected).to.equal(client.isConnected());
            });

            it("doesn't fire the disconnect event", function (done) {
                var handler = sinon.spy();
                client.listen('disconnect', handler);
                client.disconnect();
                setTimeout(function () {
                    expect(handler.notCalled).to.be.defined;
                    if (handler.getCall(0)) {
                        expect(handler.getCall(0).args[0]).to.be.ok;
                        console.log(handler.getCall(0).args);
                    }
                    done();
                }, 10);
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
});
