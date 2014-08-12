var expect = chai.expect;
respoke.log.setLevel('error');

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
                return done(new Error(JSON.stringify(err)));
            }
            done();
        });
    });
});
