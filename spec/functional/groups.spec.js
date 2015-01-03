var expect = chai.expect;

describe("Respoke groups", function () {
    this.timeout(10000);

    var Q = respoke.Q;
    var testEnv;
    var followerClient = {};
    var followeeClient = {};
    var app;
    var role;
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
    var testFixture = fixture("Groups Functional test", {
        roleParams: groupRole
    });

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;
            testEnv.tokens = [];

            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupRole);
        }).then(function (params) {
            app = params.app;
            role = params.role;
            // create 2 tokens
            return [Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: params.role.id,
                appId: params.app.id
            }), Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: params.role.id,
                appId: params.app.id
            })];
        }).spread(function (token1, token2) {
            testEnv.tokens.push(token1);
            testEnv.tokens.push(token2);

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();

            return Q.all([followerClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: testEnv.tokens[0].tokenId
            }), followeeClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: testEnv.tokens[1].tokenId
            })]);
        }).then(function () {
            expect(followerClient.endpointId).not.to.be.undefined;
            expect(followerClient.endpointId).to.equal(testEnv.tokens[0].endpointId);
            expect(followeeClient.endpointId).not.to.be.undefined;
            expect(followeeClient.endpointId).to.equal(testEnv.tokens[1].endpointId);
            done();
        }).done(null, done);
    });

    describe("when an endpoint logs in", function () {
        var groupId = respoke.makeGUID();
        var followerGroup;
        var followeeGroup;

        it("there are no groups by default", function () {
            var groups = followerClient.getGroups();
            expect(groups).to.be.an.Array;
            expect(groups.length).to.equal(0);
        });

        describe("and joins a group", function () {
            beforeEach(function (done) {
                followerClient.join({id: groupId}).done(function (theGroup) {
                    followerGroup = theGroup;
                    done();
                }, done);
            });

            afterEach(function (done) {
                followerGroup.leave().done(function () {
                    followerGroup = undefined;
                    done();
                }, done);
            });

            it("the group is given back", function () {
                expect(followerGroup).not.to.be.undefined;
                expect(followerGroup).to.be.an.Object;
            });

            it("the group has the right id", function () {
                expect(followerGroup.id).to.equal(groupId);
            });

            it("the only member of the group is the me", function (done) {
                followerGroup.getMembers().done(function (members) {
                    expect(members).to.be.an.Array;
                    expect(members.length).to.equal(1);
                    expect(members[0].endpointId).to.equal(followerClient.endpointId);
                    expect(followerClient).not.to.be.undefined;
                    done();
                }, done);
            });

            it("isJoined() returns true", function () {
                expect(followerGroup.isJoined()).to.be.true;
            });
        });

        describe("when a second endpoint logs in", function () {
            it("there are no groups by default", function () {
                var groups = followeeClient.getGroups();
                expect(groups).to.be.an.Array;
                expect(groups.length).to.equal(0);
            });

            describe("and joins the same group", function () {
                var joinEventSpy;
                var onJoinSpy;
                var onLeaveSpy;
                var onMessageSpy;

                beforeEach(function (done) {
                    joinEventSpy = sinon.spy();
                    onLeaveSpy = sinon.spy();
                    onJoinSpy = sinon.spy();
                    onMessageSpy = sinon.spy();

                    done = doneCountBuilder(2, done);

                    followerClient.join({
                        id: groupId,
                        onJoin: onJoinSpy,
                        onLeave: onLeaveSpy,
                        onMessage: onMessageSpy
                    }).then(function (theFollowerGroup) {
                        followerGroup = theFollowerGroup;
                        followerGroup.once('join', function () {
                            joinEventSpy();
                            done();
                        });
                        return followeeClient.join({
                            id: groupId
                        });
                    }).then(function (theFolloweeGroup) {
                        followeeGroup = theFolloweeGroup;
                        return followeeGroup.sendMessage({ // checked later
                            message: 'test'
                        });
                    }).done(function () {
                        done();
                    }, done);
                });

                afterEach(function (done) {
                    followerGroup.ignore('join', onJoinSpy);
                    followerGroup.ignore('leave', onLeaveSpy);
                    followerGroup.ignore('message', onMessageSpy);

                    Q.all([
                        followerGroup.leave(),
                        followeeGroup.leave()
                    ]).done(function () {
                        done();
                    }, done);
                });

                it("the group is given back", function () {
                    expect(followeeGroup).not.to.be.undefined;
                    expect(followeeGroup).to.be.an.Object;
                    expect(followeeGroup.isJoined()).to.be.true;
                });

                it("the group has the right id", function () {
                    expect(followeeGroup).not.to.be.undefined;
                    expect(followeeGroup).to.be.an.Object;
                    expect(followeeGroup.isJoined()).to.be.true;
                    expect(followeeGroup.id).to.equal(groupId);
                });

                it("the only members of the group are both users", function (done) {
                    expect(followeeGroup).not.to.be.undefined;
                    expect(followeeGroup).to.be.an.Object;
                    expect(followeeGroup.isJoined()).to.be.true;
                    expect(followerGroup.isJoined()).to.be.true;

                    followerGroup.getMembers().done(function (members) {
                        try {
                            expect(members).to.be.an.Array;
                            expect(members.length).to.equal(2);
                            members.forEach(function (member) {
                                expect([
                                    followerClient.endpointId,
                                    followeeClient.endpointId
                                ]).to.contain(member.endpointId);
                            });
                            done();
                        } catch (err) {
                            done(err);
                        }
                    }, done);
                });

                it("fires the Group#join event", function () {
                    expect(joinEventSpy.called).to.be.ok;
                });

                it("calls the onJoin callback", function () {
                    expect(onJoinSpy.called).to.be.ok;
                });

                describe("sending a message", function () {
                    var messageEventSpy;
                    var doneListener;

                    beforeEach(function (done) {
                        messageEventSpy = sinon.spy();
                        doneListener = function () {
                            messageEventSpy();
                            done();
                        };
                        followeeGroup.once('message', doneListener);
                        followerGroup.sendMessage({
                            message: 'test'
                        }).done(null, done);
                    });

                    it("calls the onMessage callback", function () {
                        expect(onMessageSpy.called).to.equal(true);
                    });

                    it("fires the Group#message event", function () {
                        expect(messageEventSpy.called).to.equal(true);
                    });
                });

                describe("when the second endpoint leaves the group", function () {
                    var leaveEventSpy;
                    var doneNum;
                    var invalidSpy = sinon.spy();

                    beforeEach(function (done) {
                        expect(followerGroup.isJoined()).to.equal(true);
                        expect(followeeGroup.isJoined()).to.equal(true);

                        followerGroup = followerClient.getGroups()[0];
                        doneNum = doneCountBuilder(2, done);
                        leaveEventSpy = sinon.spy();
                        followerGroup.once('leave', function () {
                            leaveEventSpy();
                            doneNum();
                        });

                        followeeGroup.leave().done(function () {
                            doneNum();
                        }, doneNum);
                    });

                    afterEach(function (done) {
                        followeeGroup.join({id: followeeGroup.id}).done(function () {
                            done();
                        }, done);
                    });

                    it("group.getMembers() returns an error", function (done) {
                        followeeGroup.getMembers().done(function (members) {
                            done(new Error("A group we're not a member of should error when getMembers() is called."));
                        }, function (err) {
                            expect(err).to.be.an.Error;
                            done();
                        });
                    });

                    it("the Group#leave event is fired", function () {
                        expect(leaveEventSpy.called).to.be.ok;
                    });

                    it("the onLeave callback is called", function () {
                        expect(onLeaveSpy.called).to.be.ok;
                    });

                    it("the first client is only endpoint in the group", function (done) {
                        followerGroup.getMembers().done(function (members) {
                            expect(members).to.be.an.Array;
                            expect(members.length).to.equal(1);
                            expect(members[0].endpointId).to.equal(followerClient.endpointId);
                            done();
                        }, done);
                    });

                    it("isJoined() returns false", function () {
                        expect(followeeGroup.isJoined()).to.be.false;
                    });

                    describe("when the first endpoint leaves the group", function () {
                        beforeEach(function (done) {
                            followeeGroup.listen('leave', invalidSpy);
                            followerGroup.leave().done(function() {
                                setTimeout(done, 1000);
                            }, done);
                        });

                        it("first endpoint's group.getMembers() returns an error", function (done) {
                            followerGroup.getMembers().done(function (members) {
                                done(new Error("A group we're not a member of should error when getMembers() is called."));
                            }, function (err) {
                                expect(err).to.be.an.Error;
                                done();
                            });
                        });

                        it("the second endpoint's Group#leave event is not fired", function () {
                            expect(invalidSpy.called).not.to.be.ok;
                        });

                        it("isJoined() returns false", function () {
                            expect(followerGroup.isJoined()).to.be.false;
                        });

                        afterEach(function (done) {
                            followerGroup.join().done(function() {
                                done();
                            }, done);
                        });
                    });
                });
            });
        });

        xdescribe("when an admin administers groups for an endpoint", function () {
            var groupName = respoke.makeGUID();
            var params;
            var client;

            before(function (done) {
                var tokenOptions = { roleId: role.id, appId: app.id };
                testFixture.createToken(testEnv.httpClient, tokenOptions, function (err, token) {
                    params = {
                        username: testEnv.accountParams.username,
                        password: testEnv.accountParams.password,
                        endpointId: token.endpointId,
                        groupName: groupName,
                        appId: app.id
                    };
                    client = respoke.createClient();
                    client.connect({
                        appId: app.id,
                        baseURL: respokeTestConfig.baseURL,
                        token: token.tokenId
                    }).then(done);
                });
            });

            describe("and adds an endpoint to a group", function () {
                it("the endpoint should receive join notification", function (done) {
                    var onJoin = function (evt) {
                        expect(evt.group).to.not.be.undefined;
                        expect(evt.group.id).to.equal(groupName);
                        done();
                    };
                    client.listen('join', onJoin)
                    testFixture.adminJoinEndpointToGroup(testEnv.httpClient, params, function (err) {
                        expect(err).to.be.undefined;
                    });
                });
            });

            describe("and removes an endpoint from a group", function () {
                it("endpoint should receive leave notification", function (done) {
                    var onLeave = function (evt) {
                        expect(evt.group).to.not.be.undefined;
                        expect(evt.group.id).to.equal(groupName);
                        done();
                    }
                    client.listen('leave', onLeave);
                    testFixture.adminRemoveEndpointFromGroup(testEnv.httpClient, params, function (err) {
                        expect(err).to.be.undefined;
                    });
                });
            });
        });
    });

    after(function (done) {
        Q.all([followerClient.disconnect(), followeeClient.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        }).done();
    });
});
