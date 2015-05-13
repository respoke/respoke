"use strict";

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;

describe("Respoke groups", function () {
    this.timeout(30000);

    var followerClient = {};
    var followeeClient = {};
    var roleId;
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

    before(function () {
        var followerToken;
        var followeeToken;

        return respoke.Q(respokeAdmin.auth.admin({
            username: testHelper.config.username,
            password: testHelper.config.password
        })).then(function () {
            return respokeAdmin.roles.create(groupRole);
        }).then(function (role) {
            roleId = role.id;

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
            ]);
        }).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();

            return respoke.Q.all([
                followerClient.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: followerToken.tokenId
                }),
                followeeClient.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: followeeToken.tokenId
                })
            ]);
        }).finally(function () {
            expect(followerClient.endpointId).not.to.be.undefined;
            expect(followerClient.endpointId).to.equal(followerToken.endpointId);
            expect(followeeClient.endpointId).not.to.be.undefined;
            expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
        }).catch(function (error) {
            expect(error).to.be.defined;
            expect(error.message).to.be.defined;
        });
    });

    after(function () {
        return respoke.Q.all([followerClient.disconnect(), followeeClient.disconnect()])
            .finally(function () {
                if (roleId) {
                    return respokeAdmin.roles.delete({
                        roleId: roleId
                    });
                }
            });
    });

    describe("when an endpoint logs in", function () {
        var groupId = uuid.v4();
        var followerGroup;
        var followeeGroup;

        it("there are no groups by default", function () {
            var groups = followerClient.getGroups();
            expect(groups).to.be.an.Array;
            expect(groups.length).to.equal(0);
        });

        describe("and joins a group", function () {
            before(function (done) {
                followerClient.join({id: groupId}).done(function (theGroup) {
                    followerGroup = theGroup;
                    done();
                }, done);
            });

            after(function (done) {
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

                before(function (done) {
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

                after(function () {
                    followerGroup.ignore('join', onJoinSpy);
                    followerGroup.ignore('leave', onLeaveSpy);
                    followerGroup.ignore('message', onMessageSpy);

                    var leavePromises = [];

                    followerGroup.isJoined() && leavePromises.push(followerGroup.leave);
                    followeeGroup.isJoined() && leavePromises.push(followeeGroup.leave);

                    return respoke.Q.all(leavePromises);
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

                    before(function (done) {
                        messageEventSpy = sinon.spy();
                        var doneListener = function () {
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

                    before(function (done) {
                        respoke.Q.all([
                            followerGroup.join(),
                            followeeGroup.join()
                        ]).then(function () {
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
                    });

                    it("group.getMembers() returns an error", function (done) {
                        followeeGroup.getMembers().done(function () {
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

                });

                describe("when the first endpoint leaves the group", function () {
                    var invalidSpy = sinon.spy();

                    before(function (done) {
                        respoke.Q.all([
                            followerGroup.join(),
                            followeeGroup.join()
                        ]).then(function () {
                            followeeGroup.listen('leave', invalidSpy);
                            followerGroup.leave().done(function () {
                                done();
                            }, done);
                        });
                    });

                    it("first endpoint's group.getMembers() returns an error", function (done) {
                        followerGroup.getMembers().done(function () {
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
                });
            });
        });

        xdescribe("when an admin administers groups for an endpoint", function () {
            // var groupName = uuid.v4();
            // var params;
            // var client;

            // before(function (done) {
            //     var tokenOptions = { roleId: roleId, appId: testHelper.config.appId };
            //     testFixture.createToken(testEnv.httpClient, tokenOptions, function (err, token) {
            //         params = {
            //             username: testEnv.accountParams.username,
            //             password: testEnv.accountParams.password,
            //             endpointId: token.endpointId,
            //             groupName: groupName,
            //             appId: testHelper.config.appId
            //         };
            //         client = respoke.createClient();
            //         client.connect({
            //             appId: testHelper.config.appId,
            //             baseURL: testHelper.config.baseURL,
            //             token: token.tokenId
            //         }).then(done);
            //     });
            // });

            // describe("and adds an endpoint to a group", function () {
            //     it("the endpoint should receive join notification", function (done) {
            //         var onJoin = function (evt) {
            //             expect(evt.group).to.not.be.undefined;
            //             expect(evt.group.id).to.equal(groupName);
            //             done();
            //         };
            //         client.listen('join', onJoin);
            //         testFixture.adminJoinEndpointToGroup(testEnv.httpClient, params, function (err) {
            //             expect(err).to.be.undefined;
            //         });
            //     });
            // });

            // describe("and removes an endpoint from a group", function () {
            //     it("endpoint should receive leave notification", function (done) {
            //         var onLeave = function (evt) {
            //             expect(evt.group).to.not.be.undefined;
            //             expect(evt.group.id).to.equal(groupName);
            //             done();
            //         };
            //         client.listen('leave', onLeave);
            //         // testFixture.adminRemoveEndpointFromGroup(testEnv.httpClient, params, function (err) {
            //         //     expect(err).to.be.undefined;
            //         // });
            //     });
            // });
        });
    });

    describe("when group.getMembers is called", function () {

        var followeeGroup;

        before(function () {
            var groupId = uuid.v4();
            return followerClient.join({
                id: groupId
            }).then(function () {
                return followeeClient.join({ id: groupId });
            }).then(function (grp) {
                followeeGroup = grp;
            });
        });

        describe("and then client.getEndpoint is called on one of the group members", function () {

            it("registers for that endpoint's presence", function (done) {
                followeeGroup.getMembers().then(function (members) {
                    expect(members.length).to.equal(2);
                    return followeeClient.getEndpoint({ id: followerClient.endpointId });
                }).then(function (followerEndpoint) {
                    followerEndpoint.once('presence', function (evt) {
                        expect(evt).to.include.property('presence');
                        expect(evt.presence).to.equal('away');
                        done();
                    });
                    followerClient.setPresence({ presence: 'away' });
                });
            });
        });
    });
});
