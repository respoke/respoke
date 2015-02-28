var expect = chai.expect;

describe("Respoke presence", function () {
    this.timeout(10000);

    var Q = respoke.Q;
    var testFixture = fixture("Presence Functional test");
    var testEnv;
    var followerClient;
    var followeeClient;
    var followerToken;
    var followeeToken;
    var roleId;
    var appId;

    function disconnectAll(callback) {
        async.each([followerClient, followeeClient], function (client, done) {
            if (client.isConnected()) {
                client.disconnect().fin(done);
            } else {
                done();
            }
        }, callback);
    }

    function doReconnect(done) {
        Q.nfcall(
            disconnectAll
        ).done(function () {
            Q.all([Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            })]).spread(function (token1, token2) {
                followerToken = token1;
                followeeToken = token2;

                return Q.all([followerClient.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: followerToken.tokenId
                }), followeeClient.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: followeeToken.tokenId
                })]);
            }).done(function () {
                expect(followerClient.endpointId).not.to.be.undefined;
                expect(followerClient.endpointId).to.equal(followerToken.endpointId);
                expect(followeeClient.endpointId).not.to.be.undefined;
                expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
                done();
            }, done);
        }, done);
    }

    beforeEach(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;

            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, {});
        }).then(function (params) {
            // create 2 tokens
            roleId = params.role.id;
            appId = params.app.id;

            return [Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            })];
        }).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();
        }).done(function () {
            done();
        }, done);
    });

    describe("with a resolveEndpointPresence function", function () {
        var presence;
        var endpoint2;

        beforeEach(function (done) {
            presence = respoke.makeGUID();
            followerClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId,
                resolveEndpointPresence: function (presenceList) {
                    return presence;
                }
            }).then(function () {
                return followeeClient.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: followeeToken.tokenId
                })
            }).then(function () {
                endpoint2 = followerClient.getEndpoint({id: followeeToken.endpointId});
                endpoint2.once('presence', function (evt) {
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
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followeeClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
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
                expect(followerClient.getPresence()).to.equal('unavailable');
            });

            describe("and sets itself online", function () {
                beforeEach(function (done) {
                    followerClient.setOnline().done(function() {
                        done();
                    }, done);
                });

                it("presence is set to 'available'", function () {
                    expect(followerClient.presence).to.equal('available');
                    expect(followerClient.getPresence()).to.equal('available');
                });

                describe("and sets itself offline", function () {
                    beforeEach(function (done) {
                        followerClient.setOffline().done(function() {
                            done();
                        }, done);
                    });

                    it("presence is set to 'unavailable'", function () {
                        expect(followerClient.presence).to.equal('unavailable');
                        expect(followerClient.getPresence()).to.equal('unavailable');
                    });
                });
            });

            describe("and sets its presence to a string", function () {
                var presence = respoke.makeGUID();

                beforeEach(function (done) {
                    followerClient.setPresence({presence: presence}).done(function () {
                        done();
                    }, done);
                });

                it("presence is set to " + presence, function () {
                    expect(followerClient.presence).to.equal(presence);
                    expect(followerClient.getPresence()).to.equal(presence);
                });
            });

            describe("and sets its presence to an object", function () {
                var presence = {
                    hey: respoke.makeGUID(),
                    hi: respoke.makeGUID(),
                    ho: respoke.makeGUID()
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

                    shownPresence = followerClient.getPresence();
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
                    expect(endpoint.getPresence()).to.equal('unavailable');
                });

                describe("and sets itself online", function () {
                    beforeEach(function (done) {
                        endpoint.once("presence", function (evt) {
                            done();
                        });

                        followeeClient.setOnline().done();
                    });

                    it("presence is set to 'available'", function () {
                        expect(endpoint.presence).to.equal('available');
                        expect(endpoint.getPresence()).to.equal('available');
                    });
                });

                describe("and sets its presence to a string", function () {
                    var presence = respoke.makeGUID();

                    beforeEach(function (done) {
                        endpoint.once("presence", function (evt) {
                            done();
                        });

                        followeeClient.setPresence({presence: presence}).done();
                    });

                    it("presence is set to " + presence, function () {
                        expect(endpoint.presence).to.equal(presence);
                        expect(endpoint.getPresence()).to.equal(presence);
                    });
                });

                describe("and sets its presence to an object", function () {
                    var presence = {
                        hey: respoke.makeGUID(),
                        hi: respoke.makeGUID(),
                        ho: respoke.makeGUID()
                    };

                    beforeEach(function (done) {
                        endpoint.once("presence", function (evt) {
                            done();
                        });

                        followeeClient.setPresence({presence: presence}).done();
                    });

                    it("presence is set to the object that was specified", function () {
                        var shownPresence = endpoint.presence;
                        Object.keys(presence).forEach(function (key) {
                            expect(shownPresence[key]).to.equal(presence[key]);
                        });

                        shownPresence = endpoint.getPresence();
                        Object.keys(presence).forEach(function (key) {
                            expect(shownPresence[key]).to.equal(presence[key]);
                        });
                    });
                });

                describe("a presence callback", function () {
                    var presenceListener;
                    var presence = respoke.makeGUID();

                    describe("when the second user changes its presence", function () {
                        beforeEach(function (done) {
                            presenceListener = sinon.spy();
                            endpoint.once('presence', presenceListener);
                            endpoint.once('presence', function (evt) {
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
                            endpoint.once('presence', function (evt) {
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
                        endpoint.once('presence', function (evt) {
                            done();
                        });
                        followeeClient.disconnect().done();
                    });

                    it("presence is set to 'unavailable'", function () {
                        expect(endpoint.presence).to.equal('unavailable');
                        expect(endpoint.getPresence()).to.equal('unavailable');
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
                    expect(followerClient.getPresence()).to.equal('unavailable');
                });

                afterEach(doReconnect);
            });
        });

        afterEach(function (done) {
            async.series({
                disconnectClients: disconnectAll,
                fixtureCleanup: testFixture.afterTest
            }, done);
        });
    });
});
