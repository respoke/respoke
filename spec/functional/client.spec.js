var expect = chai.expect;
log.setLevel('error');

describe("respoke.Client", function () {
    this.timeout(30000);

    var testFixture = fixture("Client Functional test");
    var testEnv;
    var client;
    /* Example test fixture data
    {
        "accountParams": {
            "company": "autoAccountName_xdNb",
            "name":"autoAdminName_Xamt",
            "username":"autoAdminUserName_bNes",
            "password":"autoAdminPassword_webm",
            "email":"autoAdminEmail_dvZV",
            "subscriptions":["something"]
        },
        "admin":{
            "name":"autoAdminName_Xamt",
            "username":"autoAdminUserName_bNes",
            "email":"autoAdminEmail_dvZV",
            "accountId":"ED25E856-F31A-436E-8AAE-613D854F673D",
            "emailConfirmed":false,
            "locked":false,
            "id":"93a553f4-7221-464d-a58c-a7dc8295feb5",
            "createdAt":"2014-05-28T22:01:14.572Z",
            "updatedAt":"2014-05-28T22:01:14.572Z"
        },
        'allApps': {
            "4e2d3882-2714-431b-9608-0b0f492d8a86": {
                "app": {
                    "name":"autoAppName_T75e",
                    "description":"autoAppDescription_k3h0",
                    "authType":"hosted",
                    "permittedDomains":["https://localhost:8081","http://localhost:8081",'etc'],
                    "connectionLimit":-1,
                    "accountId":"3DFD0079-6169-466B-9095-4A998FC16DB4",
                    "locked":false,
                    "developmentMode":false,
                    "id":"4e2d3882-2714-431b-9608-0b0f492d8a86",
                    "secret":"2ef5fb1e-90ec-4779-b39d-01ace3d1d951",
                    "createdAt":"2014-06-02T19:12:34.631Z",
                    "updatedAt":"2014-06-02T19:12:34.631Z"
                }
            }
        }
    }
    */

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;
            testEnv.tokens = [];
            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, {});
        }).then(function (params) {
            // create 2 tokens
            return Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: params.permissions.id,
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
                    baseURL: 'https://testing.digiumlabs.com:2001',
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
                    baseURL: 'https://testing.digiumlabs.com:2001',
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
