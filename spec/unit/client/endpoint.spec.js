var expect = chai.expect;

var instanceId = brightstream.makeGUID();
var connectionId = brightstream.makeGUID();
log.setLevel('error');

var client = brightstream.createClient({
    instanceId: instanceId
});

describe("A brightstream.Endpoint", function () {
    var endpoint;
    var endpointId;

    beforeEach(function () {
        endpointId = brightstream.makeGUID();
        endpoint = client.getEndpoint({
            connectionId: connectionId,
            id: endpointId,
            gloveColor: "white"
        });
    });

    describe("it's object structure", function () {
        it("extends brightstream.EventEmitter.", function () {
            expect(typeof endpoint.listen).to.equal('function');
            expect(typeof endpoint.ignore).to.equal('function');
            expect(typeof endpoint.fire).to.equal('function');
        });

        it("extends brightstream.Presentable.", function () {
            expect(typeof endpoint.getPresence).to.equal('function');
            expect(typeof endpoint.setPresence).to.equal('function');
        });

        it("has the correct class name.", function () {
            expect(endpoint.className).to.equal('brightstream.Endpoint');
        });

        it("contains some important methods.", function () {
            expect(typeof endpoint.sendMessage).to.equal('function');
            expect(typeof endpoint.resolvePresence).to.equal('function');
            expect(typeof endpoint.startAudioCall).to.equal('function');
            expect(typeof endpoint.startVideoCall).to.equal('function');
            expect(typeof endpoint.startCall).to.equal('function');
            expect(typeof endpoint.startDirectConnection).to.equal('function');
        });

        it("can set and get presence and fires the correct event.", function () {
            var newPresence = 'xa';

            sinon.spy(endpoint, "fire");
            try {
                endpoint.setPresence({
                    presence: newPresence,
                    connectionId: connectionId
                });

                expect(endpoint.getPresence()).to.equal(newPresence);
                expect(endpoint.fire.calledWith('presence')).to.equal(true);
            } finally {
                endpoint.fire.restore();
            }
        });

        it("saves unexpected developer-specified parameters.", function () {
            expect(endpoint.gloveColor).to.equal('white');
        });

        it("doesn't expose the signaling channel", function () {
            expect(endpoint.signalingChannel).to.not.exist;
            expect(endpoint.getSignalingChannel).to.not.exist;
        });
    });

    describe("when not connected", function () {
        describe("sendMessage()", function () {
            it("throws an error", function (done) {
                endpoint.sendMessage({
                    message: "Ain't nobody got time fo dat."
                }).then(function success() {
                    done(new Error("Shouldn't be able to send a message when not connected!"));
                }).catch(function failure(err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("startAudioCall()", function () {
            it("throws an error", function () {
                var call;
                try {
                    call = endpoint.startAudioCall();
                } catch (err) {
                    expect(err.message).to.contain("not connected");
                }
                expect(call).to.be.undefined;
            });
        });

        describe("startVideoCall()", function () {
            it("throws an error", function () {
                var call;
                try {
                    call = endpoint.startVideoCall();
                } catch (err) {
                    expect(err.message).to.contain("not connected");
                }
                expect(call).to.be.undefined;
            });
        });

        describe("startCall()", function () {
            it("throws an error", function () {
                var call;
                try {
                    call = endpoint.startCall();
                } catch (err) {
                    expect(err.message).to.contain("not connected");
                }
                expect(call).to.be.undefined;
            });
        });

        describe("startDirectConnection()", function () {
            it("throws an error", function success() {
                endpoint.startDirectConnection().then(function failure() {
                    done(new Error("User presence succeeded with no connection!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("resolvePresence()", function () {
            describe("when only one connection", function () {
                ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'].forEach(function (presString) {
                    describe("when presence is set to '" + presString + "'", function () {
                        it("endpoint.presence equals '" + presString + "'", function () {
                            endpoint.connections = [{presence: presString}]
                            endpoint.resolvePresence();
                            expect(endpoint.presence).to.equal(presString);
                        });
                    });
                });
            });

            describe("when there are two connections", function () {
                var presenceStrings = ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'];
                for (var i = 0; i < presenceStrings.length; i += 1) {
                    var presString1 = presenceStrings[i];
                    for (var j = i+1; j < presenceStrings.length; j += 1) {
                        var presString2 = presenceStrings[j];

                        if (presString1 === presString2) {
                            return;
                        }

                        describe("when presence is set to '" + presString1 + "' and '" + presString2 + "'", function (){
                            it("endpoint.presence equals the one that appears first in the array", function () {
                                endpoint.connections = [{presence: presString1}, {presence: presString2}]
                                endpoint.resolvePresence();
                                expect(endpoint.presence).to.equal((function () {
                                    if (presenceStrings.indexOf(presString1) > presenceStrings.indexOf(presString2)) {
                                        return presString2;
                                    }
                                    return presString1;
                                }()));
                            });
                        });
                    };
                };
            });
        });

        describe("getConnection()", function () {
            describe("when there is one connection", function () {
                beforeEach(function () {
                    endpoint.connections = [{
                        id: brightstream.makeGUID()
                    }];
                });

                describe("and no connectionId is specified", function () {
                    it("returns the connection", function () {
                        var connection = endpoint.getConnection();
                        expect(connection.id).to.equal(endpoint.connections[0].id);
                    });
                });

                describe("and the connectionId is specified", function () {
                    it("returns the connection", function () {
                        var connection = endpoint.getConnection({
                            connectionId: endpoint.connections[0].id
                        });
                        expect(connection.id).to.equal(endpoint.connections[0].id);
                    });
                });

                describe("and a wrong connectionId is specified", function () {
                    it("returns undefined", function () {
                        var connection = endpoint.getConnection({
                            connectionId: brightstream.makeGUID()
                        });
                        expect(connection).to.be.undefined;
                    });
                });
            });
        });
    });
});
