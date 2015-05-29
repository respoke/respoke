"use strict";

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;
var signalingMock = require('../util/mockSignalingChannel')(respoke);

describe("Respoke groups with mocked signaling channel", function () {
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

        sinon.stub(respoke, 'SignalingChannel', signalingMock.method);

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
                respoke.SignalingChannel.restore();
                if (roleId) {
                    return respokeAdmin.roles.delete({
                        roleId: roleId
                    });
                }
            });
    });

    describe("when group.getMembers is called", function () {

        var followeeGroup;

        beforeEach(function () {
            var groupId = uuid.v4();
            return followerClient.join({
                id: groupId
            }).then(function () {
                return followeeClient.join({ id: groupId });
            }).then(function (grp) {
                followeeGroup = grp;
            });
        });

        describe("the first time", function () {
            var getGroupMembersStub;

            beforeEach(function () {
                getGroupMembersStub = sinon.stub(signalingMock.instance, 'getGroupMembers',
                    signalingMock.instance.getGroupMembers);
                return followeeGroup.getMembers();
            });

            afterEach(function () {
                signalingMock.instance.getGroupMembers.restore();
            });

            it("makes a network request to get the group members", function () {
                expect(getGroupMembersStub.called).to.equal(true);
            });
        });

        describe("the second time", function () {
            var getGroupMembersStub;

            beforeEach(function () {
                getGroupMembersStub = sinon.stub(signalingMock.instance, 'getGroupMembers',
                    signalingMock.instance.getGroupMembers);
                return followeeGroup.getMembers().then(function () {
                    return followeeGroup.getMembers();
                });
            });

            afterEach(function () {
                signalingMock.instance.getGroupMembers.restore();
            });

            it("only makes a network request the first time", function () {
                expect(getGroupMembersStub.callCount).to.equal(1);
            });
        });
    });
});
