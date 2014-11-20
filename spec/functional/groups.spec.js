var expect = chai.expect;

describe("Respoke groups", function () {
    this.timeout(30000);

    var Q = respoke.Q;
    var testEnv;
    var follower = {};
    var followee = {};
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
            done();
        }).done(null, done);
    });

    describe("when an endpoint logs in", function () {
        var groupId = respoke.makeGUID();
        var followerGroup;
        var followeeGroup;

        it("there are no groups by default", function () {
            var groups = follower.getGroups();
            expect(groups).to.be.an.Array;
            expect(groups.length).to.equal(0);
        });

        describe("and joins a group", function () {
            beforeEach(function (done) {
                follower.join({id: groupId}).done(function(theGroup) {
                    followerGroup = theGroup;
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
                    expect(members[0].endpointId).to.equal(follower.endpointId);
                    expect(follower).not.to.be.undefined;
                    done();
                }, done);
            });

            it("isJoined() returns true", function () {
                expect(followerGroup.isJoined()).to.be.true;
            });
        });

        describe("when a second endpoint logs in", function () {
            it("there are no groups by default", function () {
                var groups = followee.getGroups();
                expect(groups).to.be.an.Array;
                expect(groups.length).to.equal(0);
            });

            describe("and joins the same group", function () {
                var joinSpy = sinon.spy();

                beforeEach(function (done) {
                    followerGroup = follower.getGroups()[0];
                    followerGroup.listen('join', joinSpy);
                    followee.join({id: groupId}).done(function(theGroup) {
                        followeeGroup = theGroup;
                        setTimeout(done, 50); // network traversal
                    }, done);
                });

                it("the group is given back", function () {
                    expect(followeeGroup.isJoined()).to.be.true;
                    expect(followeeGroup).not.to.be.undefined;
                    expect(followeeGroup).to.be.an.Object;
                });

                it("the group has the right id", function () {
                    expect(followeeGroup.isJoined()).to.be.true;
                    expect(followeeGroup.id).to.equal(groupId);
                });

                it("the only members of the group are both users", function (done) {
                    expect(followeeGroup.isJoined()).to.be.true;
                    followerGroup.getMembers().done(function (members) {
                        expect(members).to.be.an.Array;
                        expect(members.length).to.equal(2);
                        members.forEach(function (member) {
                            expect([follower.endpointId, followee.endpointId]).to.contain(member.endpointId);
                        });
                        done();
                    }, done);
                });

                it("the Group#join event is fired", function () {
                    expect(followeeGroup.isJoined()).to.be.true;
                    expect(joinSpy.called).to.be.ok;
                });

                afterEach(function (done) {
                    followeeGroup.leave().done(function() {
                        done();
                    }, done);
                });
            });

            describe("when the second endpoint leaves the group", function () {
                var leaveSpy = sinon.spy();
                var invalidSpy = sinon.spy();

                beforeEach(function (done) {
                    followerGroup = follower.getGroups()[0];
                    followerGroup.listen('leave', leaveSpy);
                    followee.join({id: groupId}).then(function (theGroup) {
                        followeeGroup = theGroup;
                        return followeeGroup.leave();
                    }).done(function() {
                        setTimeout(done, 50); // network traversal
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
                    expect(leaveSpy.called).to.be.ok;
                });

                it("the first client is only endpoint in the group", function (done) {
                    followerGroup.getMembers().done(function (members) {
                        expect(members).to.be.an.Array;
                        expect(members.length).to.equal(1);
                        expect(members[0].endpointId).to.equal(follower.endpointId);
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
                            done();
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

        describe("onJoin, onLeave, and onMessage fire when another group member joins, sends message, and leaves", function () {
            var onJoinSpy;
            var onMessageSpy;
            var onLeaveSpy;
            var gId = respoke.makeGUID();
            var aGroup1;
            var aGroup2;

            before(function (done) {
                onJoinSpy = sinon.spy();
                onMessageSpy = sinon.spy();
                onLeaveSpy = sinon.spy();
                //join the group with onJoin and onLeave handlers
                follower.join({id: gId, onJoin: onJoinSpy, onMessage: onMessageSpy, onLeave: onLeaveSpy}).then(function (theGroup) {
                    aGroup1 = theGroup;
                    done();
                });
            });

            after(function (done) {
                aGroup1.leave().done(function () {
                    setTimeout(done, 50);
                });
            });

            it("should call the onJoin handler", function (done) {
                followee.join({id: gId}).done(function(theGroup) {
                    setTimeout(function () {
                        aGroup2 = theGroup;
                        expect(onJoinSpy.called).to.be.ok;
                        done();
                    }, 50);
                }, done);
            });

            it("should call the onMessage handler", function (done) {
                aGroup2.sendMessage({message: "test message"}).done(function () {
                    setTimeout(function () {
                        expect(onMessageSpy.called).to.be.ok;
                        done();
                    }, 50); //network traversal
                }, done)
            });

            it("should call the onLeave handler", function (done) {
                //cllient 2 leaves the group
                aGroup2.leave().done(function () {
                    setTimeout(function () {
                        expect(onLeaveSpy.called).to.be.ok;
                        done();
                    }, 50); // network traversal
                }, done);
            });
        });

        describe("when an admin administers groups for an endpoint", function () {
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
        Q.all([follower.disconnect(), followee.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        }).done();
    });
});
