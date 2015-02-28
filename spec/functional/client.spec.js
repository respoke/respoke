var expect = chai.expect;

describe("respoke.Client", function () {
    this.timeout(30000);

    var Q = respoke.Q;
    var testFixture = fixture("Client Functional test");
    var testEnv;
    var client;

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;
            testEnv.tokens = [];
            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, {});
        }).then(function (params) {
            // create 2 tokens
            testEnv.app = params.app;
            testEnv.role = params.role;
            return Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: params.role.id,
                appId: params.app.id
            });
        }).then(function (token) {
            testEnv.tokens.push(token);

            client = respoke.createClient();
            done();
        }).done(null, done);
    });

    describe("connecting to Respoke", function () {
        describe("with a valid token", function () {
            it("succeeds and assigns an endpointId", function (done) {
                client.connect({
                    baseURL: respokeTestConfig.baseURL,
                    token: testEnv.tokens[0].tokenId
                }).done(function onSuccess(params) {
                    expect(client.endpointId).not.to.be.undefined;
                    expect(client.endpointId).to.equal(testEnv.tokens[0].endpointId);
                    done();
                }, function onError(err) {
                    done(err);
                });
            });
        });

        xdescribe("over and over again with fast enough", function () {
            it("eventually hits the rate limit", function (done) {
                done = doneOnceBuilder(done);
                var clients = [];
                var tokens = [];
                var promises = [];
                var count = 0;
                var goal = 40;
                var timeout = 100;

                for (var i = 1; i <= goal; i += 1) {
                    clients.push(respoke.createClient({
                        baseURL: respokeTestConfig.baseURL,
                        appId: testEnv.app.id
                    }));
                }

                clients.forEach(function (client, index) {
                    var deferred = Q.defer();
                    promises.push(deferred.promise);

                    setTimeout(function () {
                        Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                            roleId: testEnv.role.id,
                            appId: testEnv.app.id
                        }).done(function (token) {
                            tokens.push(token.tokenId);
                            deferred.resolve()
                        }, function (err) {
                            // handled elsewhere
                            deferred.resolve();
                        });
                    }, timeout * index);
                });

                Q.all(promises).done(function () {
                    clients.forEach(function (client, index) {
                        if (!tokens[index]) {
                            return;
                        }
                        client.connect({token: tokens[index]}).done(function () {
                            count += 1;
                            if (count === clients.length) { // all succeeded
                                done(new Error("Didn't hit rate limit."));
                            }
                        }, function (err) {
                            if (err.message.indexOf('exceeded') > -1) {
                                done();
                                return;
                            }
                            count += 1;
                            if (count === clients.length) { // all succeeded
                                done(new Error("Didn't hit rate limit."));
                            }
                        });
                    });
                }, function (err) {
                    done(new Error("Couldn't get enough tokens to attempt the test. " + err.message));
                });
            });
        });

        describe("with a made-up token", function () {
            it("fails", function (done) {
                client.connect({
                    baseURL: respokeTestConfig.baseURL,
                    token: 'blahblahblahblah'
                }).done(function onSuccess(params) {
                    done(new Error("Connect with invalid token should not work!"));
                }, function onError(err) {
                    expect(client.endpointId).to.be.undefined;
                    done();
                });
            });
        });
    });

    after(function (done) {
        testFixture.afterTest(function (err) {
            if (err) {
                return done(err);
            }
            done();
        });
    });
});
