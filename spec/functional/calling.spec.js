var expect = chai.expect;
log.setLevel('error');

describe("Respoke calling", function () {
    this.timeout(30000);

    var testEnv;
    var follower = {};
    var followee = {};
    var groupId = respoke.makeGUID();
    var groupPermissions = {
        name: 'fixturepermissions',
        permList: [
            {
                resourceType: "channels:create",
                actions: "allow",
                resourceIds: ['*']
            }, {
                resourceType: 'channels',
                actions: 'publish',
                resourceIds: ['*']
            }, {
                resourceType: 'channels',
                actions: 'subscribe',
                resourceIds: ['*']
            }, {
                resourceType: 'channels',
                actions: 'unsubscribe',
                resourceIds: ['*']
            }, {
                resourceType: 'channels:subscribers',
                actions: 'get',
                resourceIds: ['*']
            }
        ]
    };
    var testFixture = fixture("Messaging Functional test", {
        permissionParams: groupPermissions
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
    var permissionsId;

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;

            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupPermissions);
        }).then(function (params) {
            // create 2 tokens
            permissionsId = params.permissions.id;
            appId = params.app.id;
            return [Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: permissionsId,
                appId: appId
            }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: permissionsId,
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
            done(new Error("test"));
        });
    });

    describe("when placing a call", function () {
        var call;
        function callListener(evt) {
            evt.call.answer();
        }

        beforeEach(function () {
            followee.listen('call', callListener);
        });

        it("succeeds", function (done) {
            call = followeeEndpoint.startCall({
                onLocalMedia: function (evt) {
                    expect(evt.stream instanceof MediaStream).to.be.true;
                    expect(evt.element instanceof Video).to.be.true;
                    done();
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
            Q.all([Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: permissionsId,
                appId: appId
            }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: permissionsId,
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

    after(function (done) {
        Q.all([follower.disconnect(), followee.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    return done(new Error(JSON.stringify(err)));
                }
                done();
            });
        }).done();
    });
});
