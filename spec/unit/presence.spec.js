/* global respoke: false, sinon: true */
// Note: presence resolution on an endpoint is tested also in endpoint.spec.js
// Those tests mock out a lot of en
describe("Presence", function () {
    'use strict';
    var expect = chai.expect;
    var _actualSinon = sinon;
    var _actualRespoke = respoke;
    var instanceId;

    var client;
    var endpoint;

    beforeEach(function () {
        sinon = sinon.sandbox.create({
            useFakeServer: true
        });
        sinon.server.autoRespond = true;
        instanceId = respoke.makeGUID();
        client = respoke.createClient({
            instanceId: instanceId,
            endpointId: respoke.makeGUID()
        });
    });
    afterEach(function () {
        sinon.restore();
        sinon = _actualSinon;
    });
    describe('when setPresence() is called on an endpoint', function () {
        var endpointResolvePresenceSpy;
        var clientResolvePresenceSpy;
        beforeEach(function () {
            client.clientSettings.resolveEndpointPresence = function (presenceList) {
                return presenceList[0];
            };
            clientResolvePresenceSpy = sinon.spy(client.clientSettings, 'resolveEndpointPresence');
            endpoint = client.getEndpoint({ id: 'not_cmcelligott_digium_com' });
            endpoint.connections = [
                client.getConnection({
                    connectionId: 'conn1',
                    endpointId: 'not_cmcelligott_digium_com'
                }),
                client.getConnection({
                    connectionId: 'conn2',
                    endpointId: 'not_cmcelligott_digium_com'
                })
            ];
            endpointResolvePresenceSpy = sinon.spy(endpoint, 'resolvePresence');
            expect(endpoint.presence).to.equal('unavailable');
        });
        describe('using default presence resolution', function () {
            it('triggers default resolvePresence() on that endpoint', function () {
                endpoint.setPresence({ presence: 'too busy', connectionId: 'conn1' });
                expect(endpoint.connections.length).to.equal(2);
                expect(endpoint.connections[0].presence).to.equal('too busy');
                expect(endpointResolvePresenceSpy.callCount).to.equal(1);
                expect(endpoint.presence).to.equal('too busy');
            });
        });
        describe('using a custom presence resolution function', function () {
            describe('is passed an array of presence strings', function () {
                it('is called with a list of presences', function () {
                    endpoint.setPresence({ presence: 'away', connectionId: 'conn1' });
                    expect(clientResolvePresenceSpy.callCount).to.equal(1);
                    expect(clientResolvePresenceSpy.calledWith(['away', 'unavailable'])).to.equal(true);
                });
            });
            describe('when passed as a param during respoke.createClient', function () {
                var client2;
                var endpoint2;
                var endpoint2ResolvePresenceSpy;
                beforeEach(function () {
                    endpoint2ResolvePresenceSpy = sinon.stub().returns('too busy');
                    client2 = respoke.createClient({
                        instanceId: respoke.makeGUID(),
                        resolveEndpointPresence: endpoint2ResolvePresenceSpy
                    });
                    endpoint2 = client2.getEndpoint({ id: 'think-local-code-global' });
                    endpoint2.connections = [
                        client.getConnection({
                            connectionId: 'conn1',
                            endpointId: 'not_cmcelligott_digium_com'
                        })
                    ];
                });
                it('triggers the custom resolvePresence() when on that endpoint', function () {
                    endpoint2.setPresence({ presence: 'too busy', connectionId: 'conn1' });
                    expect(endpoint2ResolvePresenceSpy.callCount).to.equal(1);
                    expect(endpoint2.presence).to.equal('too busy');
                });
            });
        });
    });
    describe('when a presence event comes over the web socket', function () {
        var endpointSetPresenceSpy;
        var endpointResolvePresenceSpy;
        beforeEach(function () {
            // simulate the minimally 'connected' client
            var settings = {
                instanceId: instanceId,
                clientSettings: { }
            };
            client.signalingChannel = respoke.SignalingChannel(settings);

            // simulate an endpoint with a connection different than our own
            endpoint = client.getEndpoint({ id: 'not_cmcelligott_digium_com' });
            endpoint.connections = [client.getConnection({
                connectionId: 'conn1',
                endpointId: 'not_cmcelligott_digium_com'
            })];
            endpointSetPresenceSpy = sinon.spy(endpoint, 'setPresence');
            endpointResolvePresenceSpy = sinon.spy(endpoint, 'resolvePresence');
            // trigger the presence handler manually
            client.signalingChannel.socketOnPresence({
                name: "presence",
                header: {
                    channel: "presence:not_cmcelligott_digium_com",
                    from: "not_cmcelligott_digium_com",
                    fromConnection: "conn1",
                    requestId: "68dae395-89fd-442c-b040-7cf9b5a2e1f0",
                    type: "presence"
                },
                type: "busy"
            });
        });
        it('calls setPresence on the endpoint', function () {
            expect(endpoint.setPresence.callCount).to.equal(1);
        });
        it('triggers the endpoint for that connection to call resolvePresence()', function () {
            expect(endpoint.resolvePresence.callCount).to.equal(1);
        });
        it('updates the presence text', function () {
            expect(endpoint.presence).to.equal('busy');
        });
        it('does not call setPresence when the endpoint is the same as the client', function () {
            client.endpointId = 'not_cmcelligott_digium_com';
            // trigger it again
            client.signalingChannel.socketOnPresence({
                name: "presence",
                header: {
                    channel: "presence:not_cmcelligott_digium_com",
                    from: "not_cmcelligott_digium_com",
                    fromConnection: "conn1",
                    requestId: "94935894-4354-4434-5555-949394589439",
                    type: "presence"
                },
                type: "away"
            });
            expect(endpoint.resolvePresence.callCount).to.equal(1);
            expect(endpoint.presence).to.equal('busy');
        });
    });
});
