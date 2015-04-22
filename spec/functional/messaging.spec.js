"use strict";

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;
var Q = testHelper.respoke.Q;

describe("Messaging", function () {
    this.timeout(30000);

    var followerClient = {};
    var followeeClient = {};
    var followerEndpoint;
    var followeeEndpoint;
    var followerGroup;
    var followeeGroup;
    var groupId = respoke.makeGUID();
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

    function sendNumMessagesEach(num, thing1, thing2) {
        var sendPromises = [];
        var receiveDeferreds = [];
        num = num || 5;

        function listener(evt) {
            if (receiveDeferreds.length) {
                receiveDeferreds.pop().resolve(evt.message);
            }
        }

        thing1.listen('message', listener);
        thing2.listen('message', listener);

        for (var i = 1; i <= num; i += 1) {
            sendPromises.push(thing1.sendMessage({message: "test"}));
            receiveDeferreds.push(Q.defer());

            sendPromises.push(thing2.sendMessage({message: "test"}));
            receiveDeferreds.push(Q.defer());
        }

        return {
            send: Q.all(sendPromises),
            receive: Q.all(receiveDeferreds.map(function (def) {
                return def.promise;
            }))
        };
    }

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
        var followerToken;
        var followeeToken;

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
            followerEndpoint = followeeClient.getEndpoint({id: followerClient.endpointId});
            followeeEndpoint = followerClient.getEndpoint({id: followeeClient.endpointId});
        });
    });

    afterEach(function () {
        var disconnections = [];

        [followerClient, followeeClient].forEach(function (client) {
            if (client.isConnected()) {
                disconnections.push(client.disconnect());
            }
        });
        return Q.all(disconnections);
    });

    describe("two endpoints", function () {
        var params;

        afterEach(function () {
            followeeEndpoint.ignore();
            followerEndpoint.ignore();
        });

        it("can send and receive messages", function () {
            params = sendNumMessagesEach(5, followerEndpoint, followeeEndpoint);

            return params.send.then(function () {
                return params.receive;
            }).done(function (messages) {
                expect(messages).to.exist();
                expect(messages.length).to.equal(10);
            });
        });

        describe("message metadata", function () {
            it("contains all the correct information", function (done) {
                params = sendNumMessagesEach(1, followerEndpoint, followeeEndpoint);
                params.send.then(function () {
                    return params.receive;
                }).done(function (messages) {
                    try {
                        expect(messages).to.exist();
                        expect(messages.length).to.equal(2);
                        expect(messages[0].message).to.be.ok;
                        expect(messages[0].message).to.be.a.String;
                        expect(messages[0].timestamp).to.be.a.Number;
                        expect([
                            followeeClient.endpointId,
                            followerClient.endpointId
                        ]).to.contain(messages[0].endpointId);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, done);
            });
        });

        describe("in the same group", function () {
            beforeEach(function () {
                return Q.all([
                    followerClient.join({ id: groupId }),
                    followeeClient.join({ id: groupId })
                ]).spread(function (group1, group2) {
                    followerGroup = group1;
                    followeeGroup = group2;
                });
            });

            it("can send and receive messages directly", function (done) {
                params = sendNumMessagesEach(5, followerEndpoint, followeeEndpoint);
                params.send.then(function () {
                    return params.receive;
                }).done(function (messages) {
                    try {
                        expect(messages).to.exist();
                        expect(messages.length).to.equal(10);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, done);
            });

            it("can send and receive messages via that group", function (done) {
                params = sendNumMessagesEach(5, followerGroup, followeeGroup);
                params.send.then(function () {
                    return params.receive;
                }).done(function (messages) {
                    try {
                        expect(messages).to.exist();
                        expect(messages.length).to.equal(10);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, done);
            });

            describe("group message metadata", function () {
                it("contains all the correct information", function (done) {
                    params = sendNumMessagesEach(1, followerGroup, followeeGroup);
                    params.send.then(function () {
                        return params.receive;
                    }).done(function (messages) {
                        try {
                            expect(messages).to.exist();
                            expect(messages.length).to.equal(2);
                            expect(messages[0].message).to.be.ok;
                            expect(messages[0].message).to.be.a.String;
                            expect(messages[0].timestamp).to.be.a.Number;
                            expect([
                                followeeClient.endpointId,
                                followerClient.endpointId
                            ]).to.contain(messages[0].endpointId);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    }, done);
                });
            });
        });

        describe("in different groups", function () {
            beforeEach(function () {
                return Q.all([
                    followerClient.join({ id: groupId }),
                    followeeClient.join({ id: "something different" })
                ]).spread(function (group1, group2) {
                    followerGroup = group1;
                    followeeGroup = group2;
                });
            });

            it("can send and receive messages directly", function (done) {
                params = sendNumMessagesEach(5, followerEndpoint, followeeEndpoint);
                params.send.then(function () {
                    return params.receive;
                }).done(function (messages) {
                    try {
                        expect(messages).to.exist();
                        expect(messages.length).to.equal(10);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, done);
            });

            it("can not send and receive messages via that group", function (done) {
                this.timeout(6000);
                setTimeout(done, 5990); // sure wish I could do expect(this).to.timeout();

                params = sendNumMessagesEach(5, followerGroup, followeeGroup);
                params.send.then(function () {
                    return params.receive;
                }).done(function () {
                    done(new Error("Something went wrong, wasn't supposed to receive any messages."));
                }, function () {
                    // who cares?
                });
            });
        });
    });

    describe("an endpoint", function () {
        describe("that is disconnected and trying to send", function () {
            beforeEach(function () {
                return followerClient.disconnect();
            });

            it("cannot send messages to another endpoint", function (done) {
                var params;

                this.timeout(4000);
                setTimeout(done, 3990); // sure wish I could do expect(this).to.timeout();

                params = sendNumMessagesEach(1, followeeEndpoint, followerEndpoint);
                params.send.done(function () {
                    done(new Error("Something went wrong, wasn't supposed to send any messages."));
                }, function () {
                    // who cares?
                });
            });
        });

        describe("that is disconnected and trying to receive", function () {
            beforeEach(function () {
                return followeeClient.disconnect();
            });

            it("can not receive messages from another endpoint", function (done) {
                var params;

                this.timeout(4000);
                setTimeout(done, 3990); // sure wish I could do expect(this).to.timeout();

                params = sendNumMessagesEach(1, followeeEndpoint, followerEndpoint);
                params.send.then(function () {
                    return params.receive;
                }).done(function () {
                    done(new Error("Something went wrong, wasn't supposed to receive any messages."));
                }, function () {
                    // who cares?
                });
            });
        });
    });
});
