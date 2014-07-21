var expect = chai.expect;
respoke.log.setLevel('error');

describe("Respoke presence", function () {
    this.timeout(30000);

    var Q = respoke.Q;
    var testFixture = fixture("Presence Functional test");
    var testEnv;
    var follower;
    var followee;
    var followerToken;
    var followeeToken;
    var roleId;
    var appId;

    function doReconnect(done) {
        Q.all([Q.nfcall(testFixture.createToken, testEnv.httpClient, {
            roleId: roleId,
            appId: appId
        }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
            roleId: roleId,
            appId: appId
        })]).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            return Q.all([follower.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followee.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).done(function () {
            expect(follower.endpointId).not.to.be.undefined;
            expect(follower.endpointId).to.equal(followerToken.endpointId);
            expect(followee.endpointId).not.to.be.undefined;
            expect(followee.endpointId).to.equal(followeeToken.endpointId);
            followerEndpoint = followee.getEndpoint({id: follower.endpointId});
            followeeEndpoint = follower.getEndpoint({id: followee.endpointId});
            done();
        }, done);
    }

    before(function (done) {
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

            follower = respoke.createClient();
            followee = respoke.createClient();

            return Q.all([follower.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followee.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).done(function () {
            expect(follower.endpointId).not.to.be.undefined;
            expect(follower.endpointId).to.equal(followerToken.endpointId);
            expect(followee.endpointId).not.to.be.undefined;
            expect(followee.endpointId).to.equal(followeeToken.endpointId);
            done();
        }, done);
    });

    describe("when an endpoint logs in", function () {
        it("presence is 'unavailable' by default", function () {
            expect(follower.getPresence()).to.equal('unavailable');
        });

        describe("and sets itself online", function () {
            beforeEach(function (done) {
                follower.setOnline().done(function() {
                    done();
                }, done);
            });

            it("presence is set to 'available'", function () {
                expect(follower.presence).to.equal('available');
                expect(follower.getPresence()).to.equal('available');
            });
        });

        describe("and sets its presence to a string", function () {
            var presence = respoke.makeGUID();

            beforeEach(function (done) {
                follower.setPresence({presence: presence}).done(function () {
                    done();
                }, done);
            });

            it("presence is set to " + presence, function () {
                expect(follower.presence).to.equal(presence);
                expect(follower.getPresence()).to.equal(presence);
            });
        });

        describe("and sets its presence to an object", function () {
            var presence = {
                hey: respoke.makeGUID(),
                hi: respoke.makeGUID(),
                ho: respoke.makeGUID()
            };

            beforeEach(function (done) {
                follower.setPresence({presence: presence}).done(function () {
                    done();
                }, done);
            });

            it("presence is set to the object that was specified", function () {
                var shownPresence = follower.presence;
                Object.keys(presence).forEach(function (key) {
                    expect(shownPresence[key]).to.equal(presence[key]);
                });

                shownPresence = follower.getPresence();
                Object.keys(presence).forEach(function (key) {
                    expect(shownPresence[key]).to.equal(presence[key]);
                });
            });
        });

        describe("and a second endpoint logs in", function () {
            var endpoint;

            beforeEach(function () {
                endpoint = follower.getEndpoint({id: followeeToken.endpointId});
            });

            it("presence is 'unavailable' by default", function () {
                expect(endpoint.presence).to.equal('unavailable');
                expect(endpoint.getPresence()).to.equal('unavailable');
            });

            describe("and sets itself online", function () {
                beforeEach(function (done) {
                    followee.setOnline().done(function () {
                        setTimeout(done, 100);
                    }, done);
                });

                it("presence is set to 'available'", function () {
                    expect(endpoint.presence).to.equal('available');
                    expect(endpoint.getPresence()).to.equal('available');
                });
            });

            describe("and sets its presence to a string", function () {
                var presence = respoke.makeGUID();

                beforeEach(function (done) {
                    followee.setPresence({presence: presence}).done(function () {
                        setTimeout(done, 100);
                    }, done);
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
                    followee.setPresence({presence: presence}).done(function () {
                        setTimeout(done, 100);
                    }, done);
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

            describe("resolveEndpointPresence", function () {
                var presence = respoke.makeGUID();
                var client1 = respoke.createClient();
                var client2 = respoke.createClient();
                var endpont2;

                beforeEach(function (done) {
                    client1.connect({
                        appId: Object.keys(testEnv.allApps)[0],
                        baseURL: respokeTestConfig.baseURL,
                        token: followerToken.tokenId,
                        resolveEndpointPresence: function (presenceList) {
                            return presence;
                        }
                    }).then(function () {
                        return client2.connect({
                            appId: Object.keys(testEnv.allApps)[0],
                            baseURL: respokeTestConfig.baseURL,
                            token: followeeToken.tokenId
                        })
                    }).then(function () {
                        endpoint2 = client1.getEndpoint({id: followeeToken.endpointId});
                        return client2.setPresence({presence: 'nacho presence2'});
                    }).done(function () {
                        setTimeout(done, 100);
                    }, done);
                });

                it("and presence is resolved", function () {
                    expect(endpoint2.presence).to.equal(presence);
                });
            });

            describe("a presence callback", function () {
                var presenceListener = sinon.spy();
                var presence = respoke.makeGUID();

                describe("when the second user changes its presence", function () {
                    beforeEach(function (done) {
                        endpoint.listen('presence', presenceListener);
                        followee.setPresence({presence: presence}).done(function () {
                            setTimeout(done, 100);
                        }, done);
                    });

                    it("fires with the new presence", function () {
                        expect(presenceListener.called).to.be.ok;
                        expect(endpoint.presence).to.equal(presence);
                    });

                    afterEach(function () {
                        endpoint.ignore('presence', presenceListener);
                    });
                });

                describe("when the second user disconnects", function () {
                    beforeEach(function (done) {
                        follower.disconnect().fin(function () {
                            setTimeout(done, 100);
                        }).done();
                    });

                    it("fires with presence 'unavailable'", function () {
                        expect(presenceListener.called).to.be.ok;
                    });
                });
            });

            describe("and then disconnects", function () {
                beforeEach(function (done) {
                    followee.disconnect().fin(function () {
                        setTimeout(done, 100);
                    }).done();
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
                follower.disconnect().fin(function () {
                    setTimeout(done, 100);
                }).done();
            });

            it("presence is set to 'unavailable'", function () {
                expect(follower.presence).to.equal('unavailable');
                expect(follower.getPresence()).to.equal('unavailable');
            });

            afterEach(doReconnect);
        });
    });

    after(function (done) {
        follower.disconnect().fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    return done(new Error(JSON.stringify(err)));
                }
                done();
            });
        }).done();
    });
});
