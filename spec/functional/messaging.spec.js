var expect = chai.expect;
respoke.log.setLevel('error');

describe("Respoke messaging", function () {
    this.timeout(30000);

    var Q = respoke.Q;
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
    var testFixture = fixture("Messaging Functional test", {
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

    function followerListener(evt) {
        messagesFolloweeReceived.push(evt.message);
    }

    function followeeListener(evt) {
        messagesFollowerReceived.push(evt.message);
    }

    function sendFiveGroupMessagesEach() {
        var message;
        var promises = [];
        for (var i = 1; i <= 5; i += 1) {
            message = {
                message: respoke.makeGUID()
            };

            promises.push(followerGroup.sendMessage(message));
            messagesFolloweeSent.push(message.message);

            promises.push(followeeGroup.sendMessage(message));
            messagesFollowerSent.push(message.message);
        }

        return Q.all(promises);
    }

    function sendMessage() {
        var message = {
            message: respoke.makeGUID()
        };
        var promises = [];

        promises.push(followerEndpoint.sendMessage(message));
        messagesFolloweeSent.push(message.message);

        promises.push(followeeEndpoint.sendMessage(message));
        messagesFollowerSent.push(message.message);

        return promises;
    }

    function sendFiveMessagesEach() {
        var flatPromises = [];
        var promises = [];

        for (var i = 1; i <= 5; i += 1) {
            promises.push(sendMessage());
        }
        flatPromises = flatPromises.concat.apply(flatPromises, promises);

        return Q.all(flatPromises);
    }

    function sendOneMessage() {
        return Q.all(sendMessage());
    }

    function checkMessages() {
        var foundIndex;
        var i;
        var deferred = Q.defer();

        setTimeout(function check() {
            for (i = messagesFollowerReceived.length - 1; i >= 0; i -= 1) {
                messagesFolloweeSent.every(function (item, index) {
                    if (messagesFollowerReceived[i].message === item) {
                        messagesFollowerReceived.splice(i, 1);
                        messagesFolloweeSent.splice(index, 1);
                        return false;
                    }
                    return true;
                });
            }

            for (i = messagesFolloweeReceived.length - 1; i >= 0; i -= 1) {
                messagesFollowerSent.every(function (item, index) {
                    if (messagesFolloweeReceived[i].message === item) {
                        messagesFolloweeReceived.splice(i, 1);
                        messagesFollowerSent.splice(index, 1);
                        return false;
                    }
                    return true;
                });
            }

            try {
                expect(messagesFollowerReceived.length).to.equal(0);
                expect(messagesFolloweeReceived.length).to.equal(0);
                expect(messagesFollowerSent.length).to.equal(0);
                expect(messagesFolloweeSent.length).to.equal(0);
                deferred.resolve();
            } catch (err) {
                deferred.reject(err);
            }
        }, 500);

        return deferred.promise;
    }

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;

            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupRole);
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
        }).then(function () {
            expect(follower.endpointId).not.to.be.undefined;
            expect(follower.endpointId).to.equal(followerToken.endpointId);
            expect(followee.endpointId).not.to.be.undefined;
            expect(followee.endpointId).to.equal(followeeToken.endpointId);
        }).then(function () {
            followerEndpoint = followee.getEndpoint({id: follower.endpointId});
            followeeEndpoint = follower.getEndpoint({id: followee.endpointId});
            done();
        }).done(null, done);
    });

    describe("when two endpoints are logged in but not in groups", function () {
        beforeEach(function () {
            followerEndpoint.listen('message', followerListener);
            followeeEndpoint.listen('message', followeeListener);
        });

        describe("point-to-point messaging", function () {
            it("all messages are received correctly", function (done) {
                sendFiveMessagesEach()
                    .then(checkMessages)
                    .done(function successHandler() {
                        done();
                    }, done);
            });
        });

        afterEach(function () {
            followerEndpoint.ignore('message', followerListener);
            followeeEndpoint.ignore('message', followeeListener);
        });
    });

    describe("when two endpoints are logged in & in the same group", function () {
        beforeEach(function (done) {
            Q.all([follower.join({id: groupId}), followee.join({id: groupId})]).spread(function (group1, group2) {
                followerGroup = group1;
                followeeGroup = group2;
                done();
            }, done).done();
        });

        describe("point-to-point messaging", function () {
            beforeEach(function () {
                followerEndpoint.listen('message', followerListener);
                followeeEndpoint.listen('message', followeeListener);
            });

            it("all messages are received correctly", function (done) {
                sendFiveMessagesEach()
                    .then(checkMessages)
                    .done(function successHandler() {
                        done();
                    }, done);
            });

            describe('the message metadata is correct', function () {
                var message;

                beforeEach(function () {
                    return sendOneMessage()
                        .then(function () {
                            message = messagesFolloweeReceived[0];
                        });
                });

                it('has endpointId', function () {
                    expect(message.endpointId).to.exist;
                });

                it('has message body', function () {
                    expect(message.message).to.exist;
                });

                it('has timestamp', function() {
                    expect(message.timestamp).to.exist;
                });
            });

            afterEach(function () {
                followerEndpoint.ignore('message', followerListener);
                followeeEndpoint.ignore('message', followeeListener);
            });
        });

        describe("group messaging", function () {
            beforeEach(function () {
                followeeGroup.listen('message', followerListener);
                followerGroup.listen('message', followeeListener);
            });

            it("all group messages are received correctly", function (done) {
                sendFiveGroupMessagesEach()
                    .then(checkMessages)
                    .done(function successHandler() {
                        done();
                    }, done);
            });

            afterEach(function () {
                followeeGroup.ignore('message', followerListener);
                followerGroup.ignore('message', followeeListener);
            });
        });

        afterEach(function (done) {
            Q.all([followerGroup.leave(), followeeGroup.leave()]).done(function () {
                done();
            }, done);
        });
    });

    describe("when two endpoints are logged in & in different groups", function () {
        beforeEach(function (done) {
            var otherGroupId = respoke.makeGUID();
            Q.all([follower.join({id: groupId}), followee.join({id: otherGroupId})]).spread(function (group1, group2) {
                followerGroup = group1;
                followeeGroup = group2;
                done();
            }, done).done();
        });

        describe("point-to-point messaging", function () {
            beforeEach(function () {
                followerEndpoint.listen('message', followerListener);
                followeeEndpoint.listen('message', followeeListener);
            });

            it("all messages are received correctly", function (done) {
                sendFiveMessagesEach()
                    .then(checkMessages)
                    .done(function successHandler() {
                        done();
                    }, done);
            });

            afterEach(function () {
                followerEndpoint.ignore('message', followerListener);
                followeeEndpoint.ignore('message', followeeListener);
            });
        });

        describe("group messaging", function () {
            beforeEach(function () {
                followeeGroup.listen('message', followerListener);
                followerGroup.listen('message', followeeListener);
            });

            it("no group messages are received", function (done) {
                sendFiveGroupMessagesEach()
                    .then(checkMessages)
                    .done(function successHandler() {
                        done(new Error("Not supposed to succeed"));
                    }, function (err) {
                        expect(err).to.be.an.Error;
                        done();
                    });
            });

            afterEach(function () {
                followeeGroup.ignore('message', followerListener);
                followerGroup.ignore('message', followeeListener);
            });
        });

        afterEach(function (done) {
            Q.all([followerGroup.leave(), followeeGroup.leave()]).done(function () {
                done();
            }, done);
        });
    });

    describe("when both endpoints are disconnected", function () {
        this.timeout(30000);

        beforeEach(function (done) {
            Q.all([follower.join({id: groupId}), followee.join({id: groupId})]).spread(function (group1, group2) {
                followerGroup = group1;
                followeeGroup = group2;
                return Q.all([follower.disconnect(), followee.disconnect()]);
            }).fin(function () {
                done();
            }).done();
        });

        describe("point-to-point messaging", function () {
            beforeEach(function () {
                followerEndpoint.listen('message', followerListener);
                followeeEndpoint.listen('message', followeeListener);
            });

            it("no messages are received", function (done) {
                expect(follower.isConnected()).to.be.false;
                expect(followee.isConnected()).to.be.false;
                sendFiveMessagesEach()
                    .then(checkMessages).done(function successHandler() {
                        done(new Error("Not supposed to succeed"));
                    }, function (err) {
                        expect(err).to.be.an.Error;
                        done();
                    });
            });

            afterEach(function () {
                followerEndpoint.ignore('message', followerListener);
                followeeEndpoint.ignore('message', followeeListener);
            });
        });

        describe("group messaging", function () {
            beforeEach(function () {
                followeeGroup.listen('message', followerListener);
                followerGroup.listen('message', followeeListener);
            });

            it("no group messages are received", function (done) {
                sendFiveGroupMessagesEach()
                    .then(checkMessages)
                    .done(function successHandler() {
                        done(new Error("Not supposed to succeed"));
                    }, function (err) {
                        expect(err).to.be.an.Error;
                        done();
                    });
            });

            afterEach(function () {
                followeeGroup.ignore('message', followerListener);
                followerGroup.ignore('message', followeeListener);
            });
        });

        afterEach(function (done) {
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
    });

    afterEach(function () {
        messagesFollowerReceived = [];
        messagesFolloweeReceived = [];
        messagesFollowerSent = [];
        messagesFolloweeSent = [];
    });

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
