var expect = chai.expect;
log.setLevel('error');

describe("Respoke groups", function () {
    this.timeout(30000);

    var testEnv;
    var follower = {};
    var followee = {};
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
    var testFixture = fixture("Groups Functional test", {
        permissionParams: groupPermissions
    });

    before(function (done) {
        Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;
            testEnv.tokens = [];

            return Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupPermissions);
        }).then(function (params) {
            // create 2 tokens
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
            done();
        }).done(null, done);
    });

    describe("when an endpoint logs in", function () {
        var groupId = respoke.makeGUID();

        it("there are no groups by default", function () {
            var groups = follower.getGroups();
            expect(groups).to.be.an.Array;
            expect(groups.length).to.equal(0);
        });

        describe("and joins a group", function () {
            var group;

            beforeEach(function (done) {
                follower.join({id: groupId}).done(function(theGroup) {
                    group = theGroup;
                    done();
                }, done);
            });

            it("the group is given back", function () {
                expect(group).not.to.be.undefined;
                expect(group).to.be.an.Object;
            });

            it("the group has the right id", function () {
                expect(group.id).to.equal(groupId);
            });

            it("the only member of the group is the me", function (done) {
                group.getMembers().done(function (members) {
                    expect(members).to.be.an.Array;
                    expect(members.length).to.equal(1);
                    expect(members[0].endpointId).to.equal(follower.endpointId);
                    expect(follower).not.to.be.undefined;
                    done();
                }, done);
            });
        });

        describe("when a second endpoint logs in", function () {
            var group;

            it("there are no groups by default", function () {
                var groups = followee.getGroups();
                expect(groups).to.be.an.Array;
                expect(groups.length).to.equal(0);
            });

            describe("and joins the same group", function () {
                var joinSpy = sinon.spy();
                var followerGroup;

                beforeEach(function (done) {
                    followerGroup = follower.getGroups()[0];
                    followerGroup.listen('join', joinSpy);
                    followee.join({id: groupId}).done(function(theGroup) {
                        group = theGroup;
                        done();
                    }, done);
                });

                it("the group is given back", function () {
                    expect(group).not.to.be.undefined;
                    expect(group).to.be.an.Object;
                });

                it("the group has the right id", function () {
                    expect(group.id).to.equal(groupId);
                });

                it("the only members of the group are both users", function (done) {
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
                    expect(joinSpy.called).to.be.ok;
                });

                afterEach(function (done) {
                    group.leave().done(function() {
                        done();
                    }, done);
                });
            });

            describe("when the second endpoint leaves the group", function () {
                var leaveSpy = sinon.spy();
                var invalidSpy = sinon.spy();
                var followerGroup;

                beforeEach(function (done) {
                    followerGroup = follower.getGroups()[0];
                    followerGroup.listen('leave', leaveSpy);
                    followee.join({id: groupId}).then(function (theGroup) {
                        group = theGroup;
                        return group.leave();
                    }).done(function() {
                        done();
                    }, done);
                });

                it("group.getMembers() returns an error", function (done) {
                    group.getMembers().done(function (members) {
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

                describe("when the first endpoint leaves the group", function () {
                    beforeEach(function (done) {
                        group.listen('leave', invalidSpy);
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
                });
            });
        });
    });

    afterEach(function () {
        expect(follower).not.to.be.undefined;
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
