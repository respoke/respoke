var expect = chai.expect;

describe("A Direct Connection", function () {
    this.timeout(30000);

    var testEnv;
    var directConnection;
    var followerClient = {};
    var followeeClient = {};
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

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();

            return respoke.Q.all([followerClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followeeClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).then(function () {
            expect(followerClient.endpointId).not.to.be.undefined;
            expect(followerClient.endpointId).to.equal(followerToken.endpointId);
            expect(followeeClient.endpointId).not.to.be.undefined;
            expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
            followerClient.listen('call', function () {});
            followeeClient.listen('call', function () {});
        }).done(function () {
            followerEndpoint = followeeClient.getEndpoint({id: followerClient.endpointId});
            followeeEndpoint = followerClient.getEndpoint({id: followeeClient.endpointId});
            done();
        }, function (err) {
            expect(err).to.be.defined;
            expect(err.message).to.be.defined;
            done(err);
        });
    });

    describe("when starting a direct connection", function () {
        function callListener(evt) {
            if (!evt.directConnection.call.caller) {
                setTimeout(evt.directConnection.accept);
            }
        }

        // Still seeing intermittent failures.
        describe("with call listener specified", function () {
            var hangupReason;
            var dc;

            beforeEach(function (done) {
                done = doneCountBuilder(1, done);
                followeeClient.listen('direct-connection', callListener);

                directConnection = followeeEndpoint.startDirectConnection({
                    onOpen: function (evt) {
                        directConnection = followeeEndpoint.directConnection;
                        done();
                    },
                    onClose: function (evt) {
                        hangupReason = evt.reason;
                        done();
                    }
                }).done(null, done);
            });

            afterEach(function () {
                followeeClient.ignore('direct-connection', callListener);
            });

            it("succeeds", function () {
                expect(directConnection).to.be.ok;
                expect(hangupReason).to.equal(undefined);
            });
        });
    });

    afterEach(function (done) {
        if (directConnection) {
            directConnection.close();
        }

        respoke.Q.all([followerClient.disconnect(), followeeClient.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    done(err);
                    return;
                }
                done();
            });
        }).done();
    });
});
