"use strict";

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;
var Q = testHelper.respoke.Q;

describe("Respoke presence", function () {
    this.timeout(30000);

    var followerClient;
    var followeeClient;
    var followerToken;
    var followeeToken;
    var roleId;

    function disconnectAll() {
        var clients = [followeeClient, followerClient].map(function (client) {
            if (client.isConnected()) {
                return client.disconnect();
            }
        });
        return Q.all(clients);
    }

    function doReconnect() {
        return disconnectAll().then(function () {
            return Q.all([
                followerClient.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: followerToken.tokenId
                }),
                followeeClient.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: followeeToken.tokenId
                })
            ]);
        }).finally(function () {
            expect(followerClient.endpointId).not.to.be.undefined;
            expect(followerClient.endpointId).to.equal(followerToken.endpointId);
            expect(followeeClient.endpointId).not.to.be.undefined;
            expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
        }).done();
    }

    before(function () {
        return respokeAdmin.auth.admin({
            username: testHelper.config.username,
            password: testHelper.config.password
        }).then(function () {
            return respokeAdmin.roles.create({
                appId: testHelper.config.appId,
                name: uuid.v4(),
                groups: {
                    "*": {
                        create: true,
                        publish: true,
                        subscribe: true,
                        unsubscribe: true,
                        getsubscribers: true
                    }
                }
            });
        }).then(function (role) {
            roleId = role.id;
        });
    });

    after(function () {
        if (roleId) {
            return respokeAdmin.roles.delete({
                roleId: roleId
            });
        }
    });

    beforeEach(function () {
        return Q.all([
            Q(respokeAdmin.auth.endpoint({
                endpointId: uuid.v4(),
                appId: testHelper.config.appId,
                roleId: roleId
            })),
            Q(respokeAdmin.auth.endpoint({
                endpointId: uuid.v4(),
                appId: testHelper.config.appId,
                roleId: roleId
            }))
        ]).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();
        });
    });

    afterEach(function (done) {
        var timer = setTimeout(function () {
            done();
        }, 5000);

        disconnectAll().finally(function () {
            clearTimeout(timer);
            done();
        }).done();
    });

    describe("with a resolveEndpointPresence function", function () {
        var presence;
        var endpoint2;

        beforeEach(function (done) {
            presence = uuid.v4();
            followerClient.connect({
                appId: testHelper.config.appId,
                baseURL: testHelper.config.baseURL,
                token: followerToken.tokenId,
                resolveEndpointPresence: function () {
                    return presence;
                }
            }).then(function () {
                return followeeClient.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: followeeToken.tokenId
                });
            }).then(function () {
                endpoint2 = followerClient.getEndpoint({id: followeeToken.endpointId});
                endpoint2.once('presence', function () {
                    done();
                });
                return followeeClient.setPresence({presence: 'nacho presence2'});
            }).done(null, done);
        });

        it("and presence is resolved", function () {
            expect(endpoint2.presence).to.equal(presence);
        });
    });

    describe("without a resolveEndpointPresence function", function () {
        beforeEach(function (done) {
            Q.all([followerClient.connect({
                appId: testHelper.config.appId,
                baseURL: testHelper.config.baseURL,
                token: followerToken.tokenId
            }), followeeClient.connect({
                appId: testHelper.config.appId,
                baseURL: testHelper.config.baseURL,
                token: followeeToken.tokenId
            })]).done(function () {
                expect(followerClient.endpointId).not.to.be.undefined;
                expect(followerClient.endpointId).to.equal(followerToken.endpointId);
                expect(followeeClient.endpointId).not.to.be.undefined;
                expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
                done();
            }, done);
        });

        describe("when an endpoint logs in", function () {
            it("presence is 'unavailable' by default", function () {
                expect(followerClient.presence).to.equal('unavailable');
            });

            describe("and sets itself online", function () {
                beforeEach(function (done) {
                    followerClient.setOnline().done(function () {
                        done();
                    }, done);
                });

                it("presence is set to 'available'", function () {
                    expect(followerClient.presence).to.equal('available');
                });

                describe("and sets itself offline", function () {
                    beforeEach(function (done) {
                        followerClient.setOffline().done(function () {
                            done();
                        }, done);
                    });

                    it("presence is set to 'unavailable'", function () {
                        expect(followerClient.presence).to.equal('unavailable');
                    });
                });
            });

            describe("and sets its presence to a string", function () {
                var presence = uuid.v4();

                beforeEach(function (done) {
                    followerClient.setPresence({presence: presence}).done(function () {
                        done();
                    }, done);
                });

                it("presence is set to " + presence, function () {
                    expect(followerClient.presence).to.equal(presence);
                });
            });

            describe("and sets its presence to an object", function () {
                var presence = {
                    hey: uuid.v4(),
                    hi: uuid.v4(),
                    ho: uuid.v4()
                };

                beforeEach(function (done) {
                    followerClient.setPresence({presence: presence}).done(function () {
                        done();
                    }, done);
                });

                it("presence is set to the object that was specified", function () {
                    var shownPresence = followerClient.presence;
                    Object.keys(presence).forEach(function (key) {
                        expect(shownPresence[key]).to.equal(presence[key]);
                    });

                    shownPresence = followerClient.presence;
                    Object.keys(presence).forEach(function (key) {
                        expect(shownPresence[key]).to.equal(presence[key]);
                    });
                });
            });

            describe("and a second endpoint logs in", function () {
                var endpoint;

                beforeEach(function () {
                    endpoint = followerClient.getEndpoint({id: followeeToken.endpointId});
                });

                it("presence is 'unavailable' by default", function () {
                    expect(endpoint.presence).to.equal('unavailable');
                });

                describe("and sets itself online", function () {
                    beforeEach(function (done) {
                        endpoint.once("presence", function () {
                            done();
                        });

                        followeeClient.setOnline().done();
                    });

                    it("presence is set to 'available'", function () {
                        expect(endpoint.presence).to.equal('available');
                    });
                });

                describe("and sets its presence to a string", function () {
                    var presence = uuid.v4();

                    beforeEach(function (done) {
                        endpoint.once("presence", function () {
                            done();
                        });

                        followeeClient.setPresence({presence: presence}).done();
                    });

                    it("presence is set to " + presence, function () {
                        expect(endpoint.presence).to.equal(presence);
                    });
                });

                describe("and sets its presence to an object", function () {
                    var presence = {
                        hey: uuid.v4(),
                        hi: uuid.v4(),
                        ho: uuid.v4()
                    };

                    beforeEach(function (done) {
                        endpoint.once("presence", function () {
                            done();
                        });

                        followeeClient.setPresence({presence: presence}).done();
                    });

                    it("presence is set to the object that was specified", function () {
                        var shownPresence = endpoint.presence;
                        Object.keys(presence).forEach(function (key) {
                            expect(shownPresence[key]).to.equal(presence[key]);
                        });

                        shownPresence = endpoint.presence;
                        Object.keys(presence).forEach(function (key) {
                            expect(shownPresence[key]).to.equal(presence[key]);
                        });
                    });
                });

                describe("a presence callback", function () {
                    var presenceListener;
                    var presence = uuid.v4();

                    describe("when the second user changes its presence", function () {
                        beforeEach(function (done) {
                            presenceListener = sinon.spy();
                            endpoint.once('presence', presenceListener);
                            endpoint.once('presence', function () {
                                done();
                            });
                            followeeClient.setPresence({presence: presence}).done();
                        });

                        it("fires with the new presence", function () {
                            expect(presenceListener.called).to.be.ok;
                            expect(endpoint.presence).to.equal(presence);
                        });
                    });

                    describe("when the second user disconnects", function () {
                        beforeEach(function (done) {
                            presenceListener = sinon.spy();
                            endpoint.once('presence', presenceListener);
                            endpoint.once('presence', function () {
                                done();
                            });
                            followeeClient.disconnect().done();
                        });

                        it("fires with presence 'unavailable'", function () {
                            expect(presenceListener.called).to.be.ok;
                            expect(endpoint.presence).to.equal("unavailable");
                        });
                    });
                });

                describe("and then disconnects", function () {
                    beforeEach(function (done) {
                        endpoint.once('presence', function () {
                            done();
                        });
                        followeeClient.disconnect().done();
                    });

                    it("presence is set to 'unavailable'", function () {
                        expect(endpoint.presence).to.equal('unavailable');
                    });

                    afterEach(doReconnect);
                });
            });

            describe("and then disconnects", function () {
                beforeEach(function (done) {
                    followerClient.disconnect().fin(function () {
                        done();
                    }).done();
                });

                it("presence is set to 'unavailable'", function () {
                    expect(followerClient.presence).to.equal('unavailable');
                });

                afterEach(doReconnect);
            });
        });
    });
});
