var expect = chai.expect;

var client;
var instanceId;
var group;

describe("A respoke.Group", function () {
    beforeEach(function () {
        instanceId = respoke.makeGUID();
        client = respoke.createClient({
            instanceId: instanceId
        });
        group = respoke.Group({
            gloveColor: 'white',
            instanceId: instanceId,
            id: respoke.makeGUID()
        });
        expect(typeof group).to.equal('object');
        expect(group.className).to.equal('respoke.Group');
    });

    describe("it's object structure", function () {
        it("extends respoke.EventEmitter.", function () {
            expect(typeof group.listen).to.equal('function');
            expect(typeof group.ignore).to.equal('function');
            expect(typeof group.fire).to.equal('function');
        });

        it("has the correct class name.", function () {
            expect(group.className).to.equal('respoke.Group');
        });

        it("contains some important methods.", function () {
            expect(typeof group.leave).to.equal('function');
            expect(typeof group.removeMember).to.equal('function');
            expect(typeof group.addMember).to.equal('function');
            expect(typeof group.sendMessage).to.equal('function');
            expect(typeof group.getMembers).to.equal('function');
            expect(typeof group.isJoined).to.equal('function');
        });

        it("saves unexpected developer-specified parameters.", function () {
            expect(group.gloveColor).to.equal('white');
        });

        it("doesn't expose the signaling channel", function () {
            expect(group.signalingChannel).to.not.exist;
            expect(group.getSignalingChannel).to.not.exist;
            Object.keys(client).forEach(function (key) {
                expect(key).to.not.contain('signal');
            });
        });

        it("contains an array for connections", function () {
            expect(typeof group.connections).to.equal("object");
            expect(group.connections.length).not.to.be.undefined;
        });
    });

    describe("when not connected", function () {
        describe("sendMessage()", function () {
            describe("promise-style", function () {
                it("errors because of lack of connection", function (done) {
                    group.sendMessage({
                        message: "There's no place like home"
                    }).done(function () {
                        done(new Error("sendMessage() succeeded when not connected."));
                    }, function (err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain("not connected");
                        done();
                    });
                });
            });

            describe("callback-style", function () {
                it("errors because of lack of connection", function (done) {
                    group.sendMessage({
                        message: "There's no place like home",
                        onSuccess: function () {
                            done(new Error("sendMessage() succeeded when not connected."));
                        },
                        onError: function (err) {
                            expect(err).to.exist;
                            expect(err.message).to.contain("not connected");
                            done();
                        }
                    });
                });
            });
        });

        describe("getMembers()", function () {
            describe("promise-style", function () {
                it("errors because of lack of connection", function (done) {
                    group.getMembers().done(function () {
                        done(new Error("getMembers() succeeded when not connected."));
                    }, function (err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain("not connected");
                        done();
                    });
                });
            });

            describe("callback-style", function () {
                it("errors because of lack of connection", function (done) {
                    group.getMembers({
                        onSuccess: function () {
                            done(new Error("getMembers() succeeded when not connected."));
                        },
                        onError: function (err) {
                            expect(err).to.exist;
                            expect(err.message).to.contain("not connected");
                            done();
                        }
                    });
                });
            });
        });

        describe("leave()", function () {
            describe("promise-style", function () {
                it("errors because of lack of connection", function (done) {
                    group.leave().done(function () {
                        done(new Error("leave() succeeded when not connected."));
                    }, function (err) {
                        expect(err).to.exist;
                        expect(err.message).to.contain("not connected");
                        done();
                    });
                });
            });

            describe("callback-style", function () {
                it("errors because of lack of connection", function (done) {
                    group.leave({
                        onSuccess: function () {
                            done(new Error("leave() succeeded when not connected."));
                        },
                        onError: function (err) {
                            expect(err).to.exist;
                            expect(err.message).to.contain("not connected");
                            done();
                        }
                    });
                });
            });
        });

        describe("isJoined()", function () {
            it("is false", function () {
                expect(group.isJoined()).to.be.false;
            });
        });
    });
});
