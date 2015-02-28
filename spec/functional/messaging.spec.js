var expect = chai.expect;

describe("Messaging", function () {
    this.timeout(30000);
    var now = function () {
        return new Date().getTime();
    };
    var Q = respoke.Q;
    var testEnv;
    var followerClient = {};
    var followeeClient = {};
    var followerEndpoint;
    var followeeEndpoint;
    var followerGroup;
    var followeeGroup;
    var followerToken;
    var followeeToken;
    var groupId = respoke.makeGUID();
    var appId;
    var roleId;
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

    function sendNumMessagesEach(num, thing1, thing2) {
        var message;
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

    beforeEach(function (done) {
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

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();

            return Q.all([followerClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followeeClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).then(function () {
            expect(followerClient.endpointId).to.equal(followerToken.endpointId);
            expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
        }).then(function () {
            followerEndpoint = followeeClient.getEndpoint({id: followerClient.endpointId});
            followeeEndpoint = followerClient.getEndpoint({id: followeeClient.endpointId});
            done();
        }).done(null, done);
    });

    describe("two endpoints", function () {
        var params;

        afterEach(function () {
            followeeEndpoint.ignore();
            followerEndpoint.ignore();
        });

        it("can send and receive messages", function (done) {
            params = sendNumMessagesEach(5, followerEndpoint, followeeEndpoint);
            params.send.then(function () {
                return params.receive;
            }).done(function (messages) {
                expect(messages).to.exist();
                expect(messages.length).to.equal(10);
                done();
            }, done);
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
            beforeEach(function (done) {
                Q.all([
                    followerClient.join({id: groupId}),
                    followeeClient.join({id: groupId})
                ]).spread(function (group1, group2) {
                    followerGroup = group1;
                    followeeGroup = group2;
                    done();
                }, done).done();
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
            beforeEach(function (done) {
                Q.all([
                    followerClient.join({id: groupId}),
                    followeeClient.join({id: "something different"})
                ]).spread(function (group1, group2) {
                    followerGroup = group1;
                    followeeGroup = group2;
                    done();
                }, done).done();
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
                this.timeout(4000);
                setTimeout(done, 3990); // sure wish I could do expect(this).to.timeout();

                params = sendNumMessagesEach(5, followerGroup, followeeGroup);
                params.send.then(function () {
                    return params.receive;
                }).done(function (messages) {
                    done(new Error("Something went wrong, wasn't supposed to receive any messages."));
                }, function () {
                    // who cares?
                });
            });
        });
    });

    describe("an endpoint", function () {
        describe("that is disconnected and trying to send", function () {
            beforeEach(function (done) {
                followerClient.disconnect().done(function () {
                    done();
                }, done);
            });

            it("can not send messages to another endpoint", function (done) {
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
            beforeEach(function (done) {
                followeeClient.disconnect().done(function () {
                    done();
                }, done);
            });

            it("can not receive messages from another endpoint", function (done) {
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

    afterEach(function (done) {
        Q.all([followerClient.disconnect(), followeeClient.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
            messagesFollowerReceived = [];
            messagesFolloweeReceived = [];
            messagesFollowerSent = [];
            messagesFolloweeSent = [];
                if (err) {
                    return done(err);
                }
                done();
            });
        }).done();
    });
});
