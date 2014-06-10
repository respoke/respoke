var expect = chai.expect;
log.setLevel('error');

describe("Respoke messaging", function () {
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
    var messagesFollowerReceived = [];
    var messagesFolloweeReceived = [];
    var messagesFollowerSent = [];
    var messagesFolloweeSent = [];
    var appId;
    var permissionsId;

    function followerListener(evt) {
        messagesFolloweeReceived.push(evt.message.message);
    }

    function followeeListener(evt) {
        messagesFollowerReceived.push(evt.message.message);
    }

    function sendFiveGroupMessagesEach(done) {
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

        Q.all(promises).done(function () {
            done();
        }, done);
    }

    function sendFiveMessagesEach(done) {
        var message;
        var promises = [];
        for (var i = 1; i <= 5; i += 1) {
            message = {
                message: respoke.makeGUID()
            };

            promises.push(followerEndpoint.sendMessage(message));
            messagesFolloweeSent.push(message.message);

            promises.push(followeeEndpoint.sendMessage(message));
            messagesFollowerSent.push(message.message);
        }

        Q.all(promises).done(function () {
            done();
        }, done);
    }

    function checkMessages(done) {
        var foundIndex;
        var i;

        for (i = messagesFollowerReceived.length - 1; i >= 0; i -= 1) {
            messagesFolloweeSent.every(function (item, index) {
                if (messagesFollowerReceived[i] === item) {
                    messagesFollowerReceived.splice(i, 1);
                    messagesFolloweeSent.splice(index, 1);
                    return false;
                }
                return true;
            });
        }

        for (i = messagesFolloweeReceived.length - 1; i >= 0; i -= 1) {
            messagesFollowerSent.every(function (item, index) {
                if (messagesFolloweeReceived[i] === item) {
                    messagesFolloweeReceived.splice(i, 1);
                    messagesFollowerSent.splice(index, 1);
                    return false;
                }
                return true;
            });
        }

        expect(messagesFollowerReceived.length).to.equal(0);
        expect(messagesFolloweeReceived.length).to.equal(0);
        expect(messagesFollowerSent.length).to.equal(0);
        expect(messagesFolloweeSent.length).to.equal(0);
        done();
    }

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;
            testEnv.tokens = [];

            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupPermissions);
        }).then(function (params) {
            // create 2 tokens
            permissionsId = params.permissions.id;
            appId = params.app.id;
            return [Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: params.permissions.id,
                appId: params.app.id
            }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                permissionsId: params.permissions.id,
                appId: params.app.id
            })];
        }).spread(function (token1, token2) {
            testEnv.tokens.push(token1);
            testEnv.tokens.push(token2);

            follower = respoke.createClient();
            followee = respoke.createClient();

            return Q.all([follower.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: testEnv.tokens[0].tokenId
            }), followee.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: testEnv.tokens[1].tokenId
            })]);
        }).then(function () {
            expect(follower.endpointId).not.to.be.undefined;
            expect(follower.endpointId).to.equal(testEnv.tokens[0].endpointId);
            expect(followee.endpointId).not.to.be.undefined;
            expect(followee.endpointId).to.equal(testEnv.tokens[1].endpointId);
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
                sendFiveMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(done);
                    }, 50);
                });
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
            }, done);
        });

        describe("point-to-point messaging", function () {
            beforeEach(function () {
                followerEndpoint.listen('message', followerListener);
                followeeEndpoint.listen('message', followeeListener);
            });

            it("all messages are received correctly", function (done) {
                sendFiveMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(done);
                    }, 50);
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
                sendFiveGroupMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(done);
                    }, 50);
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

    describe("when two endpoints are logged in & in different groups", function () {
        beforeEach(function (done) {
            var otherGroupId = respoke.makeGUID();
            Q.all([follower.join({id: groupId}), followee.join({id: otherGroupId})]).spread(function (group1, group2) {
                followerGroup = group1;
                followeeGroup = group2;
                done();
            }, done);
        });

        describe("point-to-point messaging", function () {
            beforeEach(function () {
                followerEndpoint.listen('message', followerListener);
                followeeEndpoint.listen('message', followeeListener);
            });

            it("all messages are received correctly", function (done) {
                sendFiveMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(done);
                    }, 50);
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
                sendFiveGroupMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(function (err) {
                            expect(err).to.be.defined;
                            expect(err).to.be.an.Object;
                            expect(err.message).to.be.defined;
                            done();
                        });
                    }, 50);
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
        beforeEach(function (done) {
            Q.all([follower.join({id: groupId}), followee.join({id: groupId})]).spread(function (group1, group2) {
                followerGroup = group1;
                followeeGroup = group2;
                return [follower.disconnect(), followee.disconnect()];
            }).done(function () {
                done();
            }, done);
        });

        describe("point-to-point messaging", function () {
            beforeEach(function () {
                followerEndpoint.listen('message', followerListener);
                followeeEndpoint.listen('message', followeeListener);
            });

            it("no messages are received", function (done) { // dependant upon socket.io timeout
                sendFiveMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(function (err) {
                            expect(err).to.be.defined;
                            expect(err.stack).to.be.undefined;
                            expect(err).to.be.an.Object;
                            expect(err.message).to.be.defined;
                            done();
                        });
                    }, 16 * 1000);
                });
            });

            afterEach(function (done) {
                followerEndpoint.ignore('message', followerListener);
                followeeEndpoint.ignore('message', followeeListener);
            });
        });

        describe("group messaging", function () {
            beforeEach(function () {
                followeeGroup.listen('message', followerListener);
                followerGroup.listen('message', followeeListener);
            });

            it("no group messages are received", function (done) { // dependant upon socket.io timeout
                sendFiveGroupMessagesEach(function () {
                    setTimeout(function () {
                        checkMessages(function (err) {
                            expect(err).to.be.defined;
                            expect(err).to.be.an.Object;
                            expect(err.message).to.be.defined;
                            done();
                        });
                    }, 50);
                });
            });

            afterEach(function () {
                followeeGroup.ignore('message', followerListener);
                followerGroup.ignore('message', followeeListener);
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
                testEnv.tokens.push(token1);
                testEnv.tokens.push(token2);

                follower = respoke.createClient();
                followee = respoke.createClient();

                return Q.all([follower.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: testEnv.tokens[0].tokenId
                }), followee.connect({
                    appId: Object.keys(testEnv.allApps)[0],
                    baseURL: respokeTestConfig.baseURL,
                    token: testEnv.tokens[1].tokenId
                })]);
            }).then(function () {
                expect(follower.endpointId).not.to.be.undefined;
                expect(follower.endpointId).to.equal(testEnv.tokens[0].endpointId);
                expect(followee.endpointId).not.to.be.undefined;
                expect(followee.endpointId).to.equal(testEnv.tokens[1].endpointId);
            }).done(function () {
                followerEndpoint = followee.getEndpoint({id: follower.endpointId});
                followeeEndpoint = follower.getEndpoint({id: followee.endpointId});
                done();
            }, done);
        });
*/
    });
    afterEach(function () {
        messagesFollowerReceived = [];
        messagesFolloweeReceived = [];
        messagesFollowerSent = [];
        messagesFolloweeSent = [];
    });

    after(function (done) {
        follower.disconnect();
        followee.disconnect();
        testFixture.afterTest(function (err) {
            if (err) {
                return done(new Error(JSON.stringify(err)));
            }
            done();
        });
    });
});
