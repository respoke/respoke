/* global respoke: false, sinon: true */
describe("respoke.SignalingChannel", function () {
    'use strict';
    var expect = chai.expect;
    var _actualSinon = sinon;
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
            var spy;
            beforeEach(function () {
                spy = sinon.spy(client.signalingChannel, 'isConnected');
            });
            it('uses signalingChannel.isConnected', function () {
                client.isConnected();
                expect(spy.callCount).to.equal(1);
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
});
