/* global respoke: false, sinon: true, expect: false, assert: false */
describe("respoke.SignalingChannel", function () {
    'use strict';
    var _actualSinon = sinon;
    var expect = chai.expect;
    var client;
    var instanceId;

    beforeEach(function () {
        sinon = sinon.sandbox.create();
        instanceId = respoke.makeGUID();
        client = respoke.createClient({
            instanceId: instanceId
        });
    });

    afterEach(function () {
        sinon.restore();
        sinon = _actualSinon;
    });

    describe('instance structure', function () {
        it('is exposed on the client', function () {
            expect(client.signalingChannel).to.be.an('object');
        });
        it('is a new instance per client', function () {
            client.jingle = 'bells';
            var otherClient = respoke.createClient({ instanceId: respoke.makeGUID() });
            expect(otherClient.signalingChannel.jingle).to.not.exist();
        });
        it('exposes the socket.io listeners', function () {
            var sigchan = client.signalingChannel;
            expect(sigchan.socketOnJoin).to.be.a('function');
            expect(sigchan.socketOnLeave).to.be.a('function');
            expect(sigchan.socketOnPubSub).to.be.a('function');
            expect(sigchan.socketOnMessage).to.be.a('function');
            expect(sigchan.socketOnPresence).to.be.a('function');
        });
        it('exposes the socket.io socket property after connecting', function () {
            expect(client.signalingChannel.socket).to.equal(null);
            client.signalingChannel.authenticate();
            expect(client.signalingChannel.socket).to.exist();
        });
        it('exposes wsCall for testing purposes', function () {
            expect(client.signalingChannel.wsCall).to.be.a('function');
        });
        it('exposes action over web socket methods', function () {
            expect(client.signalingChannel.wsCall).to.be.a('function');
        });
    });

    describe('isConnected()', function () {
        describe('when called via client.isConnected', function () {
            beforeEach(function () {
                sinon.spy(client.signalingChannel, 'isConnected');
            });
            it('uses signalingChannel.isConnected', function () {
                client.isConnected();
                expect(client.signalingChannel.isConnected.callCount).to.equal(1);
            });
        });
        describe('when called directly', function () {
            describe('before the socket is setup', function () {
                it('returns false', function () {
                    expect(client.signalingChannel.isConnected()).to.equal(false);
                });
            });
            describe('when the socket is connected', function () {
                beforeEach(function () {
                    client.signalingChannel.socket = {
                        socket: {
                            connected: true,
                            connecting: false
                        }
                    };
                });
                it('returns true', function () {
                    expect(client.signalingChannel.isConnected()).to.equal(true);
                });
            });
            describe('when the socket is not connected', function () {
                beforeEach(function () {
                    client.signalingChannel.socket = {
                        socket: {
                            connected: false,
                            connecting: true
                        }
                    };
                });
                it('returns false', function () {
                    expect(client.signalingChannel.isConnected()).to.equal(false);
                });
            });
        });
    });

    describe("routeSignal", function () {

        var routeSignal;

        beforeEach(function () {
            routeSignal = client.signalingChannel.routeSignal;
        });

        describe("when passed a signal with no target", function () {

            it("rejects the returned promise", function () {
                return routeSignal({ }).then(function () {
                    assert.fail('should not resolve');
                }, function (err) {
                    expect(err).to.exist();
                });
            });
        });

        describe("when passed a signal with a target of 'directConnection'", function () {

            describe("in all scenarios", function () {

                beforeEach(function () {
                    sinon.stub(client, 'getCall').returns({});
                });

                it("calls client.getCall with the appropriate params", function () {
                    var passedSignal = {
                        sessionId: 'someSessionId',
                        fromEndpoint: 'someEndpointId',
                        target: 'directConnection',
                        conferenceId: 'someConferenceId',
                        fromType: 'someFromType',
                        signalType: 'offer',
                        callerId: { number: '+12566666666' },
                        metadata: { orderNumber: 'lksdjfalskdjf' }
                    };

                    return routeSignal(passedSignal).then(function () {
                        expect(client.getCall.calledOnce).to.equal(true);
                        expect(client.getCall.firstCall.args[0]).to.deep.equal({
                            id: 'someSessionId',
                            endpointId: 'someEndpointId',
                            target: 'directConnection',
                            conferenceId: 'someConferenceId',
                            type: 'someFromType',
                            create: false, // because signal target is 'directConnection'
                            callerId: { number: '+12566666666' },
                            metadata: { orderNumber: 'lksdjfalskdjf' }
                        });
                    });
                });
            });

            describe("when the call associated with the signal is not found", function () {

                describe("in all scenarios", function () {

                    var fakeEndpoint;

                    beforeEach(function () {
                        fakeEndpoint = {
                            directConnection: {
                                call: { id: 'someSessionId', fire: sinon.stub() }
                            }
                        };

                        sinon.stub(client, 'getCall');
                        sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
                    });

                    it("looks up the endpoint associated with the signal", function () {
                        var passedSignal = {
                            sessionId: 'someSessionId',
                            fromEndpoint: 'someEndpointId',
                            target: 'directConnection',
                            conferenceId: 'someConferenceId',
                            fromType: 'someFromType',
                            signalType: 'offer',
                            callerId: { number: '+12566666666' },
                            metadata: { orderNumber: 'lksdjfalskdjf' }
                        };

                        return routeSignal(passedSignal).then(function () {
                            expect(client.getEndpoint.calledOnce).to.equal(true);
                            expect(client.getEndpoint.firstCall.args[0]).to.deep.equal({
                                id: 'someEndpointId',
                                skipPresence: true
                            });
                        });
                    });
                });

                describe("but the direct connection already exists", function () {

                    var fakeEndpoint;

                    beforeEach(function () {
                        fakeEndpoint = {
                            directConnection: {
                                call: { id: 'someSessionId', fire: sinon.stub() }
                            },
                            startDirectConnection: sinon.stub()
                        };

                        sinon.stub(client, 'getCall');
                        sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
                    });

                    it("does not call startDirectConnection", function () {
                        var passedSignal = {
                            sessionId: 'someSessionId',
                            fromEndpoint: 'someEndpointId',
                            target: 'directConnection',
                            conferenceId: 'someConferenceId',
                            fromType: 'someFromType',
                            signalType: 'offer',
                            callerId: { number: '+12566666666' },
                            metadata: { orderNumber: 'lksdjfalskdjf' }
                        };

                        return routeSignal(passedSignal).then(function () {
                            expect(fakeEndpoint.startDirectConnection.called).to.equal(false);
                        });
                    });
                });

                describe("and the direct connection does not exist", function () {

                    var fakeEndpoint;

                    beforeEach(function () {
                        fakeEndpoint = {
                            startDirectConnection: sinon.stub().returns({
                                call: { id: 'someSessionId', fire: sinon.stub() }
                            })
                        };

                        sinon.stub(client, 'getCall');
                        sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
                    });

                    it("calls startDirectConnection with relevant params", function () {
                        var passedSignal = {
                            sessionId: 'someSessionId',
                            fromEndpoint: 'someEndpointId',
                            target: 'directConnection',
                            conferenceId: 'someConferenceId',
                            fromType: 'someFromType',
                            signalType: 'offer',
                            callerId: { number: '+12566666666' },
                            metadata: { orderNumber: 'lksdjfalskdjf' }
                        };

                        return routeSignal(passedSignal).then(function () {
                            expect(fakeEndpoint.startDirectConnection.calledOnce).to.equal(true);
                            expect(fakeEndpoint.startDirectConnection.firstCall.args[0]).to.deep.equal({
                                id: 'someSessionId',
                                create: true,
                                caller: false,
                                metadata: { orderNumber: 'lksdjfalskdjf' }
                            });
                        });
                    });
                });
            });
        });

        describe("when passed a signal with a target that is not 'directConnection'", function () {

            describe("in all scenarios", function () {

                beforeEach(function () {
                    sinon.stub(client, 'getCall').returns({});
                });

                it("calls client.getCall with the appropriate params", function () {
                    var passedSignal = {
                        sessionId: 'someSessionId',
                        fromEndpoint: 'someEndpointId',
                        target: 'web',
                        conferenceId: 'someConferenceId',
                        fromType: 'someFromType',
                        signalType: 'offer',
                        callerId: { number: '+12566666666' },
                        metadata: { orderNumber: 'lksdjfalskdjf' }
                    };

                    return routeSignal(passedSignal).then(function () {
                        expect(client.getCall.calledOnce).to.equal(true);
                        expect(client.getCall.firstCall.args[0]).to.deep.equal({
                            id: 'someSessionId',
                            endpointId: 'someEndpointId',
                            target: 'web',
                            conferenceId: 'someConferenceId',
                            type: 'someFromType',
                            create: true, // because signalType is 'offer'
                            callerId: { number: '+12566666666' },
                            metadata: { orderNumber: 'lksdjfalskdjf' }
                        });
                    });
                });
            });
        });
    });
});
