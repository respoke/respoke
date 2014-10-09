var expect = chai.expect;

// Call a function only if there's a error or on the $num attempt
function doneCountBuilder(num, done) {
   return (function () {
        var called = false;
        var count = 0;
        if (!num || num < 0) {
            throw new Error('First argument must be a positive integer.');
        }

        return function (err) {
            if (called === true) {
                return;
            }

            count += 1;
            if (count === num || err) {
                called = true;
                done(err);
            }
        };
    })();
};

xdescribe("doneCountBuilder", function () {
    var builderSpy;
    var doneOnce;

    beforeEach(function () {
        builderSpy = sinon.spy();
        doneOnce = doneCountBuilder(4, builderSpy);
    });

    describe("when it's called a fewer number of times as $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 2; i += 1) {
                doneOnce();
            }
        });

        it("doesn't call the function", function () {
            expect(builderSpy.called).to.equal(false);
            expect(builderSpy.callCount).to.equal(0);
        });
    });

    describe("when it's called the same number of times as $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 4; i += 1) {
                doneOnce();
            }
        });

        it("calls the function only once", function () {
            expect(builderSpy.called).to.equal(true);
            expect(builderSpy.callCount).to.equal(1);
        });
    });

    describe("when it's called a greater number of times than $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 12; i += 1) {
                doneOnce();
            }
        });

        it("calls the function only once", function () {
            expect(builderSpy.called).to.equal(true);
            expect(builderSpy.callCount).to.equal(1);
        });
    });
});

describe("A Direct Connection", function () {
    this.timeout(30000);

    var testEnv;
    var directConnection;
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
            follower.listen('call', function () {});
            followee.listen('call', function () {});
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
                followee.listen('direct-connection', callListener);

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
                followee.ignore('direct-connection', callListener);
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
