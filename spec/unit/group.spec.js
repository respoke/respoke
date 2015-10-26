/* global respoke: false */
describe("A respoke.Group", function () {
    'use strict';
    var expect = chai.expect;
    var Q = respoke.Q;
    var client;
    var instanceId;
    var group;

    ['', ' foobar', '/foobar'].forEach(function (append) {
        describe('with groupId appended with "' + append + '"', function () {

            beforeEach(function () {
                instanceId = respoke.makeGUID();
                client = respoke.createClient({
                    instanceId: instanceId
                });
                group = respoke.Group({
                    gloveColor: 'white',
                    instanceId: instanceId,
                    id: respoke.makeGUID() + append
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

                it("exposes the signaling channel", function () {
                    expect(group.signalingChannel).to.exist;
                    expect(group.getSignalingChannel).to.exist;
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

            describe("sendMessage", function () {

                describe("when passed a 'push' param", function () {

                    var messageGrp;
                    var fakeSignalingChannel;

                    beforeEach(function () {
                        fakeSignalingChannel = {
                            publish: sinon.stub().returns(Q.resolve()),
                            isConnected: sinon.stub().returns(true)
                        };

                        messageGrp = respoke.Group({
                            id: 'foogrp',
                            signalingChannel: fakeSignalingChannel,
                            instanceId: instanceId
                        });

                        sinon.stub(messageGrp, 'isJoined').returns(true);
                    });

                    it("passes it along to signalingChannel.publish", function () {
                        messageGrp.sendMessage({
                            message: 'foo',
                            push: true
                        });

                        expect(fakeSignalingChannel.publish.calledOnce).to.equal(true);
                        var passedParams = fakeSignalingChannel.publish.firstCall.args[0];
                        expect(passedParams).to.include.property('push', true);
                    });
                });
            });
        });
    });
});
