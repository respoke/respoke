/* global respoke: false, sinon: true */
describe("respoke.Client", function () {
    'use strict';
    var expect = chai.expect;
    var Q = respoke.Q;
    var instanceId;
    var client;
    var actualSinon = sinon;

    beforeEach(function () {
        sinon = sinon.sandbox.create();
    });

    afterEach(function () {
        sinon.restore();
        sinon = actualSinon;
    });

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

            it("has the correct class name.", function () {
                expect(client.className).to.equal('respoke.Client');
            });

            it("contains some important methods.", function () {
                expect(typeof client.setPresence).to.equal('function');
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

            it("exposes the signaling channel", function () {
                expect(client.signalingChannel).to.exist;
                expect(client.getSignalingChannel).to.exist;
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
            it("throws an error", function () {
                try {
                    client.startCall({
                        endpointId: respoke.makeGUID()
                    });
                } catch (err) {
                    expect(err.message).to.contain("not connected");
                    return;
                }
                throw new Error("Shouldn't be able to start a call when not connected!");
            });
        });

        describe("startPhoneCall()", function () {
            it("throws an error", function () {
                try {
                    client.startPhoneCall({
                        number: '5555555555'
                    });
                } catch (err) {
                    expect(err.message).to.contain("not connected");
                    return;
                }
                throw new Error("Shouldn't be able to start a call when not connected!");
            });
        });

        describe("join()", function () {
            it("throws an error", function (done) {
                client.join({
                    id: respoke.makeGUID()
                }).done(function () {
                    done(new Error("Shouldn't be able to join a group when not connected!"));
                }, function (err) {
                    expect(err.message).to.contain("not connected");
                    done();
                });
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

        beforeEach(function () {
            instanceId = respoke.makeGUID();

            sinon.stub(respoke, 'SignalingChannel', window.MockSignalingChannel);
            client = respoke.createClient({
                instanceId: instanceId,
                gloveColor: "white"
            });

            return client.connect({
                developmentMode: true,
                appId: '68783999-78BD-4079-8979-EBA65FD8873F',
                endpointId: 'test'
            });
        });

        afterEach(function () {
            client = null;
            respoke.SignalingChannel.restore();
        });

        Object.keys(methodsWhichReturnPromises).forEach(function (method) {
            describe(method, function () {
                var stub;

                beforeEach(function () {
                    stub = sinon.stub(
                        window.mockedSignalingChannel,
                        methodsWhichReturnPromises[method],
                        window.mockedSignalingChannel[methodsWhichReturnPromises[method]]
                    );

                    return client[method](params);
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
                    startCallStub = sinon.spy();
                    callStub = sinon.stub(respoke, "Call", function () {
                        startCallStub();
                        return {
                            className: 'respoke.MockCall',
                            listen: function () {}
                        };
                    });
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

    describe("getCall", function () {

        describe("when called with an id of a call that exists", function () {

            var existingCall = { id: 'foo' };

            beforeEach(function () {
                client = respoke.createClient();
                client.calls = [existingCall];
            });

            afterEach(function () {
                client = null;
            });

            it("returns the call", function () {
                var foundCall = client.getCall({ id: 'foo' });
                expect(foundCall).to.equal(existingCall);
            });
        });

        describe("when called with an endpointId that has a call", function () {

            var existingCall = { remoteEndpoint: { id: 'foo' } };

            beforeEach(function () {
                client = respoke.createClient();
                client.calls = [existingCall];
            });

            afterEach(function () {
                client = null;
            });

            it("returns the call", function () {
                var foundCall = client.getCall({ endpointId: 'foo' });
                expect(foundCall).to.equal(existingCall);
            });
        });

        describe("when called with an endpointId that has multiple calls", function () {

            var firstCall = { id: 'firstCall', remoteEndpoint: { id: 'foo' } };

            beforeEach(function () {
                client = respoke.createClient();
                client.calls = [
                    firstCall,
                    { id: 'secondCall', remoteEndpoint: { id: 'foo' } }
                ];
            });

            afterEach(function () {
                client = null;
            });

            it("returns the first call", function () {
                var foundCall = client.getCall({ endpointId: 'foo' });
                expect(foundCall).to.equal(firstCall);
            });
        });

        describe("when called with an id of a call that does not exist", function () {

            describe("and create != true", function () {

                beforeEach(function () {
                    client = respoke.createClient();
                    client.calls = [{ id: 'foo' }];
                });

                afterEach(function () {
                    client = null;
                });

                it("returns null", function () {
                    var foundCall = client.getCall({ id: 'bar', create: false });
                    expect(foundCall).to.equal(null);
                });
            });
        });

        describe("when called with an endpointId that does not have a call", function () {

            describe("and create != true", function () {

                beforeEach(function () {
                    client = respoke.createClient();
                    client.calls = [{ id: 'foo', remoteEndpoint: { id: 'foo' } }];
                });

                afterEach(function () {
                    client = null;
                });

                it("returns null", function () {
                    var foundCall = client.getCall({ endpointId: 'bar', create: false });
                    expect(foundCall).to.equal(null);
                });
            });
        });

        describe("when called with create == true and a create is needed", function () {

            describe("and type == did", function () {

                var startPhoneCallResult = { foo: 'bar' };

                beforeEach(function () {
                    client = respoke.createClient();
                    sinon.stub(client, 'startPhoneCall').returns(startPhoneCallResult);
                });

                afterEach(function () {
                    client = null;
                });

                it("calls client.startPhoneCall with the specified params", function () {
                    client.getCall({
                        id: 'foo',
                        endpointId: '+12561231234',
                        type: 'did',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        create: true
                    });

                    expect(client.startPhoneCall.calledOnce).to.equal(true);
                    expect(client.startPhoneCall.firstCall.args[0]).to.deep.equal({
                        id: 'foo',
                        caller: false,
                        fromType: 'web',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        number: '+12561231234',
                        toType: 'did'
                    });
                });

                it("returns the result of client.startPhoneCall", function () {
                    var createdCall = client.getCall({
                        id: 'foo',
                        endpointId: '+12561231234',
                        type: 'did',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        create: true
                    });

                    expect(createdCall).to.equal(startPhoneCallResult);
                });
            });

            describe("and type == sip", function () {

                var startSIPCallResult = { foo: 'bar' };

                beforeEach(function () {
                    client = respoke.createClient();
                    sinon.stub(client, 'startSIPCall').returns(startSIPCallResult);
                });

                afterEach(function () {
                    client = null;
                });

                it("calls client.startSIPCall with the specified params", function () {
                    client.getCall({
                        id: 'foo',
                        endpointId: 'sipendpoint',
                        type: 'sip',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        create: true
                    });

                    expect(client.startSIPCall.calledOnce).to.equal(true);
                    expect(client.startSIPCall.firstCall.args[0]).to.deep.equal({
                        id: 'foo',
                        caller: false,
                        fromType: 'web',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        uri: 'sipendpoint',
                        toType: 'sip'
                    });
                });

                it("returns the result of client.startSIPCall", function () {
                    var createdCall = client.getCall({
                        id: 'foo',
                        endpointId: 'sipendpoint',
                        type: 'sip',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        create: true
                    });

                    expect(createdCall).to.equal(startSIPCallResult);
                });
            });

            describe("and type == conference", function () {

                var joinConferenceResult = { foo: 'bar' };

                beforeEach(function () {
                    client = respoke.createClient();
                    sinon.stub(client, 'joinConference').returns(joinConferenceResult);
                });

                afterEach(function () {
                    client = null;
                });

                it("calls client.joinConference with the specified params", function () {
                    client.getCall({
                        id: 'foo',
                        conferenceId: 'someConferenceId',
                        type: 'conference',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'conference',
                        create: true
                    });

                    expect(client.joinConference.calledOnce).to.equal(true);
                    expect(client.joinConference.firstCall.args[0]).to.deep.equal({
                        id: 'someConferenceId',
                        caller: false,
                        fromType: 'web',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'conference'
                    });
                });

                it("returns the result of client.joinConference", function () {
                    var createdCall = client.getCall({
                        id: 'foo',
                        conferenceId: 'someConferenceId',
                        type: 'conference',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'conference',
                        create: true
                    });

                    expect(createdCall).to.equal(joinConferenceResult);
                });
            });

            describe("and type == web", function () {

                var startCallResult = { foo: 'bar' };

                beforeEach(function () {
                    client = respoke.createClient();
                    sinon.stub(client, 'startCall').returns(startCallResult);
                });

                afterEach(function () {
                    client = null;
                });

                it("calls client.startCall with the specified params", function () {
                    client.getCall({
                        id: 'foo',
                        endpointId: 'someEndpointId',
                        type: 'web',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        create: true
                    });

                    expect(client.startCall.calledOnce).to.equal(true);
                    expect(client.startCall.firstCall.args[0]).to.deep.equal({
                        id: 'foo',
                        caller: false,
                        fromType: 'web',
                        toType: 'web',
                        endpointId: 'someEndpointId',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web'
                    });
                });

                it("returns the result of client.startCall", function () {
                    var createdCall = client.getCall({
                        id: 'foo',
                        endpointId: 'someEndpointId',
                        type: 'web',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'web',
                        create: true
                    });

                    expect(createdCall).to.equal(startCallResult);
                });
            });

            describe("and type == screenshare", function () {

                var startScreenShareResult = { foo: 'bar' };

                beforeEach(function () {
                    client = respoke.createClient();
                    sinon.stub(client, 'startScreenShare').returns(startScreenShareResult);
                });

                afterEach(function () {
                    client = null;
                });

                it("calls client.startScreenShare with the specified params", function () {
                    client.getCall({
                        id: 'foo',
                        endpointId: 'someEndpointId',
                        type: 'screenshare',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'screenshare',
                        create: true
                    });

                    expect(client.startScreenShare.calledOnce).to.equal(true);
                    expect(client.startScreenShare.firstCall.args[0]).to.deep.equal({
                        id: 'foo',
                        caller: false,
                        fromType: 'web',
                        toType: 'web',
                        endpointId: 'someEndpointId',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'screenshare'
                    });
                });

                it("returns the result of client.startScreenShare", function () {
                    var createdCall = client.getCall({
                        id: 'foo',
                        endpointId: 'someEndpointId',
                        type: 'screenshare',
                        callerId: { number: '+12568675309' },
                        metadata: { orderNumber: '12131313' },
                        target: 'screenshare',
                        create: true
                    });

                    expect(createdCall).to.equal(startScreenShareResult);
                });
            });

            describe("and an unknown type is passed in", function () {

                beforeEach(function () {
                    client = respoke.createClient();
                });

                afterEach(function () {
                    client = null;
                });

                it("returns null", function () {
                    var getCallResult = client.getCall({
                        id: 'foo',
                        create: true,
                        type: 'somethingStrange'
                    });

                    expect(getCallResult).to.equal(null);
                });
            });
        });
    });

    describe("startCall", function () {

        var fakeEndpoint;

        beforeEach(function () {
            fakeEndpoint = { startCall: sinon.stub() };

            client = respoke.createClient();
            sinon.stub(client, 'verifyConnected');
            sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
        });

        it("verifies that the client is connected", function () {
            client.startCall({
                endpointId: 'someEndpointId'
            });

            expect(client.verifyConnected.calledOnce).to.equal(true);
        });

        it("calls getEndpoint to retrieve the endpoint specified", function () {
            client.startCall({
                endpointId: 'someEndpointId'
            });

            expect(client.getEndpoint.calledOnce).to.equal(true);
            expect(client.getEndpoint.firstCall.args[0]).to.deep.equal({
                skipPresence: true,
                id: 'someEndpointId'
            });
        });

        it("removes the endpointId from params before passing to startCall", function () {
            client.startCall({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startCall.calledOnce).to.equal(true);
            expect(fakeEndpoint.startCall.firstCall.args[0]).to.not.include.property('endpointId');
        });

        it("calls startCall on the found/created endpoint with all passed params besides endpointId", function () {
            client.startCall({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startCall.calledOnce).to.equal(true);
            expect(fakeEndpoint.startCall.firstCall.args[0]).to.deep.equal({
                metadata: { orderNumber: 'foo' }
            });
        });
    });

    describe("startPhoneCall", function () {

        describe("in all scenarios", function () {
            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(respoke, 'Call').returns({
                    listen: sinon.stub()
                });
                sinon.stub(client, 'verifyConnected');
            });

            it("verifies that the client is connected", function () {
                client.startPhoneCall({
                    number: '+12566875309',
                    metadata: { orderNumber: 'foo' }
                });

                expect(client.verifyConnected.calledOnce).to.equal(true);
            });
        });

        describe("when not passed a number param", function () {

            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(client, 'verifyConnected');
            });

            it("throws an error", function () {
                expect(function () {
                    client.startPhoneCall({
                        metadata: { orderNumber: 'foo' }
                    });
                }).to.throw();
            });
        });

        describe("when passed a number param", function () {

            var fakeCall;

            beforeEach(function () {
                fakeCall = { listen: sinon.stub() };
                client = respoke.createClient({ instanceId: 'adfglkjawego;iawdjvaw' });
                sinon.stub(respoke, 'Call').returns(fakeCall);
                sinon.stub(client, 'verifyConnected');
            });

            it("creates a call with added and passed-through params", function () {
                client.startPhoneCall({
                    number: '+12566875309',
                    metadata: { orderNumber: 'foo' }
                });

                expect(respoke.Call.calledOnce).to.equal(true);
                var callParams = respoke.Call.firstCall.args[0];
                expect(callParams).to.include.property('number', '+12566875309');
                expect(callParams).to.include.property('constraints');
                expect(callParams.constraints).to.deep.equal([{
                    video: false,
                    audio: true,
                    mandatory: {},
                    optional: []
                }]);
                expect(callParams).to.include.property('caller', true);
                expect(callParams).to.include.property('instanceId', 'adfglkjawego;iawdjvaw');
                expect(callParams).to.include.property('remoteEndpoint');
                expect(callParams.remoteEndpoint).to.deep.equal({ id: '+12566875309' });
                expect(callParams).to.include.property('toType', 'did');
                expect(callParams).to.include.property('fromType', 'web');
                expect(callParams).to.include.property('metadata');
                expect(callParams.metadata).to.deep.equal({ orderNumber: 'foo' });
                expect(callParams.signalOffer).to.be.a('function');
                expect(callParams.signalAnswer).to.be.a('function');
                expect(callParams.signalConnected).to.be.a('function');
                expect(callParams.signalModify).to.be.a('function');
                expect(callParams.signalCandidate).to.be.a('function');
                expect(callParams.signalHangup).to.be.a('function');
                expect(callParams.signalReport).to.be.a('function');
                expect(callParams.signalingChannel).to.equal(client.signalingChannel);
            });

            it("returns the created call", function () {
                var returnedCall = client.startPhoneCall({
                    number: '+12566875309',
                    metadata: { orderNumber: 'foo' }
                });

                expect(returnedCall).to.equal(fakeCall);
            });

            it("adds the call to the client's list of calls", function () {
                client.startPhoneCall({
                    number: '+12566875309',
                    metadata: { orderNumber: 'foo' }
                });

                expect(client.calls).to.include(fakeCall);
            });

            it("adds a hangup listener to the call", function () {
                var returnedCall = client.startPhoneCall({
                    number: '+12566875309',
                    metadata: { orderNumber: 'foo' }
                });

                expect(returnedCall.listen.calledOnce).to.equal(true);
                expect(returnedCall.listen.firstCall.args[0]).to.equal('hangup');
                expect(returnedCall.listen.firstCall.args[1]).to.be.a('function');
            });
        });

        describe("the passed signalOffer", function () {

            var fakeCall;
            var signalOffer;

            beforeEach(function () {
                fakeCall = { listen: sinon.stub() };
                client = respoke.createClient({ instanceId: 'aoflewkjflasdkjvao;iw3jvads' });
                sinon.stub(respoke, 'Call').returns(fakeCall);
                sinon.stub(client, 'verifyConnected');
                sinon.stub(client.signalingChannel, 'sendSDP').returns(Q());

                client.startPhoneCall({
                    number: '+12566875309',
                    metadata: { orderNumber: 'foo' }
                });

                signalOffer = respoke.Call.firstCall.args[0].signalOffer;
            });

            it("passes any metadata into the signal", function () {
                signalOffer({});

                expect(client.signalingChannel.sendSDP.calledOnce).to.equal(true);
                var sendSDPParams = client.signalingChannel.sendSDP.firstCall.args[0];
                expect(sendSDPParams).to.include.property('metadata');
                expect(sendSDPParams.metadata).to.deep.equal({ orderNumber: 'foo' });
            });
        });
    });

    describe("startSIPCall", function () {

        describe("in all scenarios", function () {
            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(respoke, 'Call').returns({
                    listen: sinon.stub()
                });
                sinon.stub(client, 'verifyConnected');
            });

            it("verifies that the client is connected", function () {
                client.startSIPCall({
                    uri: 'sometrunk/someuser',
                    metadata: { orderNumber: 'foo' }
                });

                expect(client.verifyConnected.calledOnce).to.equal(true);
            });
        });

        describe("when not passed a uri param", function () {

            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(client, 'verifyConnected');
            });

            it("throws an error", function () {
                expect(function () {
                    client.startSIPCall({
                        metadata: { orderNumber: 'foo' }
                    });
                }).to.throw();
            });
        });

        describe("when passed a uri param", function () {

            var fakeCall;

            beforeEach(function () {
                fakeCall = { listen: sinon.stub() };
                client = respoke.createClient({ instanceId: '2q3r0a9sdvuia0vw' });
                sinon.stub(respoke, 'Call').returns(fakeCall);
                sinon.stub(client, 'verifyConnected');
            });

            it("creates a call with added and passed-through params", function () {
                client.startSIPCall({
                    uri: 'sometrunk/someuser',
                    metadata: { orderNumber: 'foo' }
                });

                expect(respoke.Call.calledOnce).to.equal(true);
                var callParams = respoke.Call.firstCall.args[0];
                expect(callParams).to.include.property('uri', 'sometrunk/someuser');
                expect(callParams).to.include.property('constraints');
                expect(callParams.constraints).to.deep.equal([{
                    video: false,
                    audio: true,
                    mandatory: {},
                    optional: []
                }]);
                expect(callParams).to.include.property('caller', true);
                expect(callParams).to.include.property('instanceId', '2q3r0a9sdvuia0vw');
                expect(callParams).to.include.property('remoteEndpoint');
                expect(callParams.remoteEndpoint).to.deep.equal({ id: 'sometrunk/someuser' });
                expect(callParams).to.include.property('toType', 'sip');
                expect(callParams).to.include.property('fromType', 'web');
                expect(callParams).to.include.property('metadata');
                expect(callParams.metadata).to.deep.equal({ orderNumber: 'foo' });
                expect(callParams.signalOffer).to.be.a('function');
                expect(callParams.signalAnswer).to.be.a('function');
                expect(callParams.signalConnected).to.be.a('function');
                expect(callParams.signalModify).to.be.a('function');
                expect(callParams.signalCandidate).to.be.a('function');
                expect(callParams.signalHangup).to.be.a('function');
                expect(callParams.signalReport).to.be.a('function');
                expect(callParams.signalingChannel).to.equal(client.signalingChannel);
            });

            it("returns the created call", function () {
                var returnedCall = client.startSIPCall({
                    uri: 'sometrunk/someuser',
                    metadata: { orderNumber: 'foo' }
                });

                expect(returnedCall).to.equal(fakeCall);
            });

            it("adds the call to the client's list of calls", function () {
                client.startSIPCall({
                    uri: 'sometrunk/someuser',
                    metadata: { orderNumber: 'foo' }
                });

                expect(client.calls).to.include(fakeCall);
            });

            it("adds a hangup listener to the call", function () {
                var returnedCall = client.startSIPCall({
                    uri: 'sometrunk/someuser',
                    metadata: { orderNumber: 'foo' }
                });

                expect(returnedCall.listen.calledOnce).to.equal(true);
                expect(returnedCall.listen.firstCall.args[0]).to.equal('hangup');
                expect(returnedCall.listen.firstCall.args[1]).to.be.a('function');
            });
        });

        describe("the passed signalOffer", function () {

            var fakeCall;
            var signalOffer;

            beforeEach(function () {
                fakeCall = { listen: sinon.stub() };
                client = respoke.createClient({ instanceId: 'aoflewkjflasdkjvao;iw3jvads' });
                sinon.stub(respoke, 'Call').returns(fakeCall);
                sinon.stub(client, 'verifyConnected');
                sinon.stub(client.signalingChannel, 'sendSDP').returns(Q());

                client.startSIPCall({
                    uri: 'sometrunk/someuser',
                    metadata: { orderNumber: 'foo' }
                });

                signalOffer = respoke.Call.firstCall.args[0].signalOffer;
            });

            it("passes any metadata into the signal", function () {
                signalOffer({});

                expect(client.signalingChannel.sendSDP.calledOnce).to.equal(true);
                var sendSDPParams = client.signalingChannel.sendSDP.firstCall.args[0];
                expect(sendSDPParams).to.include.property('metadata');
                expect(sendSDPParams.metadata).to.deep.equal({ orderNumber: 'foo' });
            });
        });
    });

    describe("joinConference", function () {

        describe("when not passed an id param", function () {

            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(respoke, 'Conference').returns({
                    call: { listen: sinon.stub() }
                });
                sinon.stub(client, 'verifyConnected');
            });

            it("generates an id to pass to Conference", function () {
                client.joinConference({
                    metadata: { orderNumber: 'foo' }
                });

                expect(respoke.Conference.calledOnce).to.equal(true);
                var conferenceParams = respoke.Conference.firstCall.args[0];
                expect(conferenceParams).to.include.property('id');
                expect(conferenceParams.id).to.not.be.empty();
            });
        });

        describe("when passed `open: true` as a param", function () {

            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(respoke, 'Conference').returns({
                    call: { listen: sinon.stub() }
                });
                sinon.stub(client, 'verifyConnected');
            });

            it("does not set the key on the params passed to Conference", function () {
                client.joinConference({
                    id: 'someConferenceId',
                    open: true,
                    metadata: { orderNumber: 'foo' }
                });

                expect(respoke.Conference.calledOnce).to.equal(true);
                var conferenceParams = respoke.Conference.firstCall.args[0];
                expect(conferenceParams.key).to.equal(undefined);
            });
        });

        describe("when open param is falsy and key is not set", function () {

            beforeEach(function () {
                client = respoke.createClient();
                sinon.stub(respoke, 'Conference').returns({
                    call: { listen: sinon.stub() }
                });
                sinon.stub(client, 'verifyConnected');
            });

            it("generates a key to pass to Call", function () {
                client.joinConference({
                    id: 'someConferenceId',
                    metadata: { orderNumber: 'foo' }
                });

                expect(respoke.Conference.calledOnce).to.equal(true);
                var conferenceParams = respoke.Conference.firstCall.args[0];
                expect(conferenceParams).to.include.property('key');
                expect(conferenceParams.key).to.not.be.empty();
            });
        });

        describe("in all scenarios", function () {

            var fakeConference;

            beforeEach(function () {
                fakeConference = { call: { listen: sinon.stub() } };
                client = respoke.createClient({ instanceId: 'aoflewkjflasdkjvao;iw3jvads' });
                sinon.stub(respoke, 'Conference').returns(fakeConference);
                sinon.stub(client, 'verifyConnected');
            });

            it("verifies that the client is connected", function () {
                client.joinConference({
                    id: 'someConferenceId',
                    metadata: { orderNumber: 'foo' }
                });

                expect(client.verifyConnected.calledOnce).to.equal(true);
            });

            it("creates a Conference with added and passed-through params", function () {
                client.joinConference({
                    id: 'someConferenceId',
                    key: 'someFancyKey',
                    metadata: { orderNumber: 'foo' }
                });

                expect(respoke.Conference.calledOnce).to.equal(true);
                var conferenceParams = respoke.Conference.firstCall.args[0];
                expect(conferenceParams).to.include.property('id', 'someConferenceId');
                expect(conferenceParams).to.include.property('key', 'someFancyKey');
                expect(conferenceParams).to.include.property('constraints');
                expect(conferenceParams.constraints).to.deep.equal([{
                    video: false,
                    audio: true,
                    mandatory: {},
                    optional: []
                }]);
                expect(conferenceParams).to.include.property('instanceId', 'aoflewkjflasdkjvao;iw3jvads');
                expect(conferenceParams).to.include.property('target', 'conference');
                expect(conferenceParams).to.include.property('metadata');
                expect(conferenceParams.metadata).to.deep.equal({ orderNumber: 'foo' });
                expect(conferenceParams.signalOffer).to.be.a('function');
                expect(conferenceParams.signalAnswer).to.be.a('function');
                expect(conferenceParams.signalConnected).to.be.a('function');
                expect(conferenceParams.signalModify).to.be.a('function');
                expect(conferenceParams.signalCandidate).to.be.a('function');
                expect(conferenceParams.signalHangup).to.be.a('function');
                expect(conferenceParams.signalReport).to.be.a('function');
                expect(conferenceParams.signalingChannel).to.equal(client.signalingChannel);
            });

            it("returns the created conference", function () {
                var returnedConference = client.joinConference({
                    id: 'someConferenceId',
                    metadata: { orderNumber: 'foo' }
                });

                expect(returnedConference).to.equal(fakeConference);
            });

            it("adds the conference call to the client's list of calls", function () {
                client.joinConference({
                    id: 'someConferenceId',
                    metadata: { orderNumber: 'foo' }
                });

                expect(client.calls).to.include(fakeConference.call);
            });

            it("adds a hangup listener to the conference call", function () {
                var returnedConference = client.joinConference({
                    id: 'someConferenceId',
                    metadata: { orderNumber: 'foo' }
                });

                expect(returnedConference.call.listen.calledOnce).to.equal(true);
                expect(returnedConference.call.listen.firstCall.args[0]).to.equal('hangup');
                expect(returnedConference.call.listen.firstCall.args[1]).to.be.a('function');
            });
        });

        describe("the passed signalOffer", function () {

            var fakeConference;
            var signalOffer;

            beforeEach(function () {
                fakeConference = { call: { listen: sinon.stub() } };
                client = respoke.createClient({ instanceId: 'aoflewkjflasdkjvao;iw3jvads' });
                sinon.stub(respoke, 'Conference').returns(fakeConference);
                sinon.stub(client, 'verifyConnected');
                sinon.stub(client.signalingChannel, 'sendSDP').returns(Q());

                client.joinConference({
                    id: 'someConferenceId',
                    metadata: { orderNumber: 'foo' }
                });

                signalOffer = respoke.Conference.firstCall.args[0].signalOffer;
            });

            it("passes any metadata into the signal", function () {
                signalOffer({});

                expect(client.signalingChannel.sendSDP.calledOnce).to.equal(true);
                var sendSDPParams = client.signalingChannel.sendSDP.firstCall.args[0];
                expect(sendSDPParams).to.include.property('metadata');
                expect(sendSDPParams.metadata).to.deep.equal({ orderNumber: 'foo' });
            });
        });
    });

    describe("startScreenShare", function () {

        var fakeEndpoint;

        beforeEach(function () {
            fakeEndpoint = { startScreenShare: sinon.stub() };

            client = respoke.createClient();
            sinon.stub(client, 'verifyConnected');
            sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
        });

        it("verifies that the client is connected", function () {
            client.startScreenShare({
                endpointId: 'someEndpointId'
            });

            expect(client.verifyConnected.calledOnce).to.equal(true);
        });

        it("calls getEndpoint to retrieve the endpoint specified", function () {
            client.startScreenShare({
                endpointId: 'someEndpointId'
            });

            expect(client.getEndpoint.calledOnce).to.equal(true);
            expect(client.getEndpoint.firstCall.args[0]).to.deep.equal({
                skipPresence: true,
                id: 'someEndpointId'
            });
        });

        it("removes the endpointId from params before passing to startScreenShare", function () {
            client.startScreenShare({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startScreenShare.calledOnce).to.equal(true);
            expect(fakeEndpoint.startScreenShare.firstCall.args[0]).to.not.include.property('endpointId');
        });

        it("calls startScreenShare on the found/created endpoint with all passed params besides endpointId", function () {
            client.startScreenShare({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startScreenShare.calledOnce).to.equal(true);
            expect(fakeEndpoint.startScreenShare.firstCall.args[0]).to.deep.equal({
                metadata: { orderNumber: 'foo' }
            });
        });
    });

    describe("startAudioCall", function () {

        var fakeEndpoint;

        beforeEach(function () {
            fakeEndpoint = { startAudioCall: sinon.stub() };

            client = respoke.createClient();
            sinon.stub(client, 'verifyConnected');
            sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
        });

        it("verifies that the client is connected", function () {
            client.startAudioCall({
                endpointId: 'someEndpointId'
            });

            expect(client.verifyConnected.calledOnce).to.equal(true);
        });

        it("calls getEndpoint to retrieve the endpoint specified", function () {
            client.startAudioCall({
                endpointId: 'someEndpointId'
            });

            expect(client.getEndpoint.calledOnce).to.equal(true);
            expect(client.getEndpoint.firstCall.args[0]).to.deep.equal({
                skipPresence: true,
                id: 'someEndpointId'
            });
        });

        it("removes the endpointId from params before passing to startAudioCall", function () {
            client.startAudioCall({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startAudioCall.calledOnce).to.equal(true);
            expect(fakeEndpoint.startAudioCall.firstCall.args[0]).to.not.include.property('endpointId');
        });

        it("calls startAudioCall on the found/created endpoint with all passed params besides endpointId", function () {
            client.startAudioCall({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startAudioCall.calledOnce).to.equal(true);
            expect(fakeEndpoint.startAudioCall.firstCall.args[0]).to.deep.equal({
                metadata: { orderNumber: 'foo' }
            });
        });
    });

    describe("startVideoCall", function () {

        var fakeEndpoint;

        beforeEach(function () {
            fakeEndpoint = { startVideoCall: sinon.stub() };

            client = respoke.createClient();
            sinon.stub(client, 'verifyConnected');
            sinon.stub(client, 'getEndpoint').returns(fakeEndpoint);
        });

        it("verifies that the client is connected", function () {
            client.startVideoCall({
                endpointId: 'someEndpointId'
            });

            expect(client.verifyConnected.calledOnce).to.equal(true);
        });

        it("calls getEndpoint to retrieve the endpoint specified", function () {
            client.startVideoCall({
                endpointId: 'someEndpointId'
            });

            expect(client.getEndpoint.calledOnce).to.equal(true);
            expect(client.getEndpoint.firstCall.args[0]).to.deep.equal({
                skipPresence: true,
                id: 'someEndpointId'
            });
        });

        it("removes the endpointId from params before passing to startVideoCall", function () {
            client.startVideoCall({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startVideoCall.calledOnce).to.equal(true);
            expect(fakeEndpoint.startVideoCall.firstCall.args[0]).to.not.include.property('endpointId');
        });

        it("calls startVideoCall on the found/created endpoint with all passed params besides endpointId", function () {
            client.startVideoCall({
                endpointId: 'someEndpointId',
                metadata: { orderNumber: 'foo' }
            });

            expect(fakeEndpoint.startVideoCall.calledOnce).to.equal(true);
            expect(fakeEndpoint.startVideoCall.firstCall.args[0]).to.deep.equal({
                metadata: { orderNumber: 'foo' }
            });
        });
    });
});
