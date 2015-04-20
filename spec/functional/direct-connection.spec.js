"use strict";

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;

describe("A Direct Connection", function () {
    this.timeout(30000);

    var directConnection;
    var followerClient = {};
    var followeeClient = {};
    var groupRole = {
        name: uuid.v4(),
        appId: testHelper.config.appId,
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

    var followerEndpoint;
    var followeeEndpoint;
    var followerToken;
    var followeeToken;
    var roleId;

    before(function () {
        return respokeAdmin.auth.admin({
            username: testHelper.config.username,
            password: testHelper.config.password
        }).then(function () {
            return respokeAdmin.roles.create(groupRole);
        }).then(function (role) {
            roleId = role.id;
        });
    });

    after(function () {
        if (roleId) {
            return respokeAdmin.roles.delete({
                roleId: roleId
            });
        }
    });

    beforeEach(function () {
        return respoke.Q.all([
            respoke.Q(respokeAdmin.auth.endpoint({
                endpointId: 'follower',
                appId: testHelper.config.appId,
                roleId: roleId
            })),
            respoke.Q(respokeAdmin.auth.endpoint({
                endpointId: 'followee',
                appId: testHelper.config.appId,
                roleId: roleId
            }))
        ]).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            expect(followerToken.tokenId).to.exist();
            expect(followeeToken.tokenId).to.exist();

            followerClient = respoke.createClient();

            return followerClient.connect({
                appId: testHelper.config.appId,
                baseURL: testHelper.config.baseURL,
                token: followerToken.tokenId
            });
        }).then(function () {
            followeeClient = respoke.createClient();

            return followeeClient.connect({
                appId: testHelper.config.appId,
                baseURL: testHelper.config.baseURL,
                token: followeeToken.tokenId
            });
        }).then(function () {
            followerEndpoint = followeeClient.getEndpoint({ id: followerClient.endpointId });
            followeeEndpoint = followerClient.getEndpoint({ id: followeeClient.endpointId });
            expect(followerEndpoint).to.exist();
            expect(followeeEndpoint).to.exist();
            expect(followerClient.endpointId).not.to.be.undefined;
            expect(followerClient.endpointId).to.equal(followerToken.endpointId);
            expect(followeeClient.endpointId).not.to.be.undefined;
            expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
        }, function (err) {
            expect(err).to.not.exist();
        });
    });

    afterEach(function () {
        if (directConnection) {
            directConnection.close();
        }

        return respoke.Q.all([
            followerClient.disconnect(),
            followeeClient.disconnect()
        ]);
    });

    function callListener(evt) {
        if (!evt.directConnection.call.caller) {
            setTimeout(evt.directConnection.accept);
        }
    }

    describe("when starting a direct connection", function () {
        beforeEach(function () {
            directConnection = undefined;
        });

        describe("with direct connection listener specified", function () {
            var hangupReason;

            beforeEach(function (done) {
                done = doneCountBuilder(1, done);
                followeeClient.listen('direct-connection', callListener);

                followeeEndpoint.startDirectConnection({
                    onOpen: function () {
                        directConnection = followeeEndpoint.directConnection;
                        done();
                    },
                    onClose: function (evt) {
                        hangupReason = evt.reason;
                        done();
                    }
                }).done(null, function (err) {
                    done(err);
                });
            });

            afterEach(function () {
                followeeClient.ignore('direct-connection', callListener);
            });

            it("succeeds", function () {
                expect(directConnection).to.be.ok;
                expect(hangupReason).to.equal(undefined);
                expect(directConnection.isActive()).to.equal(true);
            });
        });

        describe("with no direct connection listener specified", function () {
            var hangupReason;

            beforeEach(function (done) {
                done = doneCountBuilder(1, done);

                followeeEndpoint.startDirectConnection({
                    onOpen: function () {
                        directConnection = followeeEndpoint.directConnection;
                        done();
                    },
                    onClose: function (evt) {
                        hangupReason = evt.reason;
                        done();
                    }
                }).done(null, done);
            });

            it("fails", function () {
                expect(directConnection).to.equal(undefined);
            });
        });
    });

    describe("when starting two direct connections in a row without logging out", function () {
        var hangupReason;

        beforeEach(function (done) {
            done = doneCountBuilder(1, done);
            followeeClient.listen('direct-connection', callListener);

            followeeEndpoint.startDirectConnection({
                onOpen: function () {
                    followeeEndpoint.directConnection.close();
                },
                onClose: function () {
                    setTimeout(function () {
                        followeeEndpoint.startDirectConnection({
                            onOpen: function () {
                                directConnection = followeeEndpoint.directConnection;
                                done();
                            },
                            onClose: function (evt) {
                                hangupReason = evt.reason;
                                done();
                            }
                        }).done(null, done);
                    }, 1000); // tried timeout of zero, but even 100 fails occasionally.
                }
            }).done(null, done);
        });

        afterEach(function () {
            followeeClient.ignore('direct-connection', callListener);
        });

        it("succeeds", function () {
            expect(directConnection).to.be.ok;
            expect(hangupReason).to.equal(undefined);
            expect(directConnection.isActive()).to.equal(true);
        });
    });
});
