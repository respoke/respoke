"use strict";

var testHelper = require('../test-helper.js');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;
var Q = testHelper.respoke.Q;

describe("respoke.Client", function () {
    this.timeout(30000);

    var testEnv = {
        tokens: []
    };

    before(function () {
        return respokeAdmin.apps.get({
            appId: testHelper.config.appId
        }).then(function (app) {
            testEnv.app = app;

            return Q(respokeAdmin.roles.create({
                appId: testHelper.config.appId,
                name: uuid.v4()
            }));
        }).then(function (role) {
            testEnv.role = role;
        });
    });

    after(function () {
        return respokeAdmin.roles.delete({
            roleId: testEnv.role.id
        });
    });

    describe("connecting to Respoke", function () {
        describe("with a valid token", function () {
            var client;
            var token;

            before(function () {
                client = respoke.createClient();

                return respokeAdmin.auth.endpoint({
                    endpointId: uuid.v4(),
                    appId: testHelper.config.appId,
                    roleId: testEnv.role.id
                }).then(function (tokenObject) {
                    token = tokenObject;
                });
            });

            it("succeeds and assigns an endpointId", function (done) {
                client.connect({
                    baseURL: testHelper.baseURL,
                    token: token.tokenId
                }).done(function onSuccess() {
                    expect(client.endpointId).not.to.be.undefined;
                    expect(client.endpointId).to.equal(token.endpointId);
                    done();
                }, function onError(err) {
                    done(err);
                });
            });
        });

        xdescribe("with connectionLimit error", function () {
            it("returns advert with connection limit error", function (done) {
                var clients = [];
                var tokens = [];
                var goal = 16;

                for (var i = 1; i <= goal; i += 1) {
                    clients.push(respoke.createClient({
                        baseURL: testHelper.baseURL,
                        appId: testEnv.app.id
                    }));
                }

                Q.all(clients.map(function () {
                    return Q(respokeAdmin.auth.endpoint({
                        endpointId: 'followee',
                        appId: testHelper.config.appId,
                        roleId: testEnv.role.id
                    })).then(function (token) {
                        tokens.push(token.tokenId);
                    });
                })).then(function () {
                    return Q.all(clients.map(function (client, index) {
                        return client.connect({ token: tokens[index] });
                    }));
                }).then(function () {
                    done(new Error("Clients should not connect successfully past connection limit!"));
                }).catch(function () {
                    done();
                }).done();
            });
        });

        xdescribe("over and over again with fast enough", function () {
            it("eventually hits the rate limit", function (done) {
                done();
            //     done = doneOnceBuilder(done);
            //     var clients = [];
            //     var tokens = [];
            //     var promises = [];
            //     var count = 0;
            //     var goal = 40;
            //     var timeout = 100;

            //     for (var i = 1; i <= goal; i += 1) {
            //         clients.push(respoke.createClient({
            //             baseURL: testHelper.baseURL,
            //             appId: testEnv.app.id
            //         }));
            //     }

            //     clients.forEach(function (client, index) {
            //         var deferred = Q.defer();
            //         promises.push(deferred.promise);

            //         setTimeout(function () {
            //             Q.nfcall(testFixture.createToken, testEnv.httpClient, {
            //                 roleId: testEnv.role.id,
            //                 appId: testEnv.app.id
            //             }).done(function (token) {
            //                 tokens.push(token.tokenId);
            //                 deferred.resolve();
            //             }, function () {
            //                 // handled elsewhere
            //                 deferred.resolve();
            //             });
            //         }, timeout * index);
            //     });

            //     Q.all(promises).done(function () {
            //         clients.forEach(function (client, index) {
            //             if (!tokens[index]) {
            //                 return;
            //             }
            //             client.connect({token: tokens[index]}).done(function () {
            //                 count += 1;
            //                 if (count === clients.length) { // all succeeded
            //                     done(new Error("Didn't hit rate limit."));
            //                 }
            //             }, function (err) {
            //                 if (err.message.indexOf('exceeded') > -1) {
            //                     done();
            //                     return;
            //                 }
            //                 count += 1;
            //                 if (count === clients.length) { // all succeeded
            //                     done(new Error("Didn't hit rate limit."));
            //                 }
            //             });
            //         });
            //     }, function (err) {
            //         done(new Error("Couldn't get enough tokens to attempt the test. " + err.message));
            //     });
            });
        });

        describe("with a made-up token", function () {
            var client;

            before(function () {
                client = respoke.createClient();
            });

            it("fails to connect", function (done) {
                client.connect({
                    baseURL: testHelper.baseURL,
                    token: 'blahblahblahblah'
                }).done(function onSuccess() {
                    done(new Error("Connect with invalid token should not work!"));
                }, function onError() {
                    expect(client.endpointId).to.be.undefined;
                    done();
                });
            });
        });
    });
});
