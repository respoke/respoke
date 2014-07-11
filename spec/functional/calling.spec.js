var expect = chai.expect;
respoke.log.setLevel('error');

describe("Respoke calling", function () {
    this.timeout(30000);

    var testEnv;
    var follower = {};
    var followee = {};
    var groupId = respoke.makeGUID();
    var groupRole = {
        name: 'fixturerole',
        groups: {
            "*": {
                create: true,
                publish: true,
                subscribe: true,
                unsubscribe: true,
                getsubscribers: true
            }
        }
    };
    var testFixture = fixture("Calling Functional test", {
        roleParams: groupRole
    });

    var followerEndpoint;
    var followeeEndpoint;
    var followerGroup;
    var followeeGroup;
    var followerToken;
    var followeeToken;
    var messagesFollowerReceived = [];
    var messagesFolloweeReceived = [];
    var messagesFollowerSent = [];
    var messagesFolloweeSent = [];
    var appId;
    var roleId;

    beforeEach(function (done) {
        respoke.Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;

            return respoke.Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupRole);
        }).then(function (params) {
            // create 2 tokens
            roleId = params.role.id;
            appId = params.app.id;
            return [respoke.Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            }), respoke.Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            })];
        }).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            follower = respoke.createClient();
            followee = respoke.createClient();

            return respoke.Q.all([follower.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followee.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).then(function () {
            expect(follower.endpointId).not.to.be.undefined;
            expect(follower.endpointId).to.equal(followerToken.endpointId);
            expect(followee.endpointId).not.to.be.undefined;
            expect(followee.endpointId).to.equal(followeeToken.endpointId);
        }).done(function () {
            followerEndpoint = followee.getEndpoint({id: follower.endpointId});
            followeeEndpoint = follower.getEndpoint({id: followee.endpointId});
            done();
        }, function (err) {
            expect(err).to.be.defined;
            expect(err.message).to.be.defined;
            done(err);
        });
    });

    describe("when placing a call", function () {
        var call;
        function callListener(evt) {
            if (evt.call.initiator !== true) {
                evt.call.answer();
            }
        }

        beforeEach(function () {
            followee.listen('call', callListener);
        });

        it("succeeds", function (done) {
            call = followeeEndpoint.startCall({
                onLocalMedia: function (evt) {
                    expect(evt.stream).to.be.ok;
                    expect(evt.element).to.be.ok;
                },
                onConnect: function (evt) {
                    try {
                        expect(evt.element).to.be.ok;
                        done();
                    } catch (e) {
                        done(e);
                    }
                }
            });
        });

        afterEach(function () {
            followee.ignore('call', callListener);
            call.hangup();
        });
    });

    /*
        afterEach(function (done) {
            respoke.Q.all([respoke.Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            }), respoke.Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            })]).spread(function (token1, token2) {
                followerToken = token1;
                followeeToken = token2;

                return respoke.Q.all([follower.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: followerToken.tokenId
                }), followee.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: followeeToken.tokenId
                })]);
            }).then(function () {
                expect(follower.endpointId).not.to.be.undefined;
                expect(follower.endpointId).to.equal(followerToken.endpointId);
                expect(followee.endpointId).not.to.be.undefined;
                expect(followee.endpointId).to.equal(followeeToken.endpointId);
            }).done(function () {
                followerEndpoint = followee.getEndpoint({id: follower.endpointId});
                followeeEndpoint = follower.getEndpoint({id: followee.endpointId});
                done();
            }, done);
        });
        */

    afterEach(function (done) {
        respoke.Q.all([follower.disconnect(), followee.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    done(new Error(JSON.stringify(err)));
                    return;
                }
                done();
            });
        }).done();
    });
});
