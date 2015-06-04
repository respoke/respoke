/* global sinon: true */
"use strict";

var testHelper = require('../test-helper');

var expect = chai.expect;
var respoke = testHelper.respoke;
var _actualSinon = sinon;
var instanceId = respoke.makeGUID();
var endpointId = respoke.makeGUID();

var client = respoke.createClient({
    instanceId: instanceId
});


describe("A respoke.Connection", function () {
    var connection;
    var connectionId;

    beforeEach(function () {
        sinon = sinon.sandbox.create();

        connectionId = respoke.makeGUID();
        endpointId = respoke.makeGUID() + ' foobar';
        connection = client.getConnection({
            connectionId: connectionId,
            endpointId: endpointId,
            gloveColor: "white"
        });
    });

    afterEach(function () {
        sinon.restore();
        sinon = _actualSinon;
    });

    describe("it's object structure", function () {
        it("extends respoke.EventEmitter.", function () {
            expect(typeof connection.listen).to.equal('function');
            expect(typeof connection.ignore).to.equal('function');
            expect(typeof connection.fire).to.equal('function');
        });

        it("has the correct class name.", function () {
            expect(connection.className).to.equal('respoke.Connection');
        });

        it("contains some important methods.", function () {
            expect(typeof connection.sendMessage).to.equal('function');
            expect(typeof connection.startAudioCall).to.equal('function');
            expect(typeof connection.startVideoCall).to.equal('function');
            expect(typeof connection.startCall).to.equal('function');
            expect(typeof connection.startDirectConnection).to.equal('function');
            expect(typeof connection.getEndpoint).to.equal('function');
        });

        it("saves unexpected developer-specified parameters.", function () {
            expect(connection.gloveColor).to.equal('white');
        });

        it("doesn't expose the signaling channel", function () {
            expect(connection.signalingChannel).to.not.exist;
            expect(connection.getSignalingChannel).to.not.exist;
        });
    });

    describe("when not connected", function () {
        describe("sendMessage()", function () {
            it("throws an error", function (done) {
                connection.sendMessage({
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
                    call = connection.startAudioCall();
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
                    call = connection.startVideoCall();
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
                    call = connection.startCall();
                } catch (err) {
                    expect(err.message).to.contain("not connected");
                }
                expect(call).to.be.undefined;
            });
        });

        describe("startDirectConnection()", function () {
            it("throws an error", function success(done) {
                connection.startDirectConnection().then(function failure() {
                    done(new Error("User presence succeeded with no connection!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
            });
        });

        describe("getEndpoint()", function () {
            it("returns the endpoint associated with the connection", function () {
                var endpoint = connection.getEndpoint();
                expect(endpoint).not.to.be.undefined;
                expect(endpoint.className).to.equal("respoke.Endpoint");
                expect(endpoint.id).to.equal(endpointId);
                expect(endpoint.connections[0].id).to.equal(connectionId);
            });
        });
    });

    describe("sendMessage", function () {

        describe("when passed a 'push' param", function () {

            var fakeEndpoint;

            beforeEach(function () {
                fakeEndpoint = {
                    sendMessage: sinon.stub()
                };

                sinon.stub(connection, 'getEndpoint').returns(fakeEndpoint);
            });

            it("passes it along when calling endpoint.sendMessage", function () {
                connection.sendMessage({
                    message: 'foo',
                    push: true
                });
                expect(fakeEndpoint.sendMessage.calledOnce).to.equal(true);
                var passedParams = fakeEndpoint.sendMessage.firstCall.args[0];
                expect(passedParams).to.include.property('push', true);
            });
        });
    });
});
