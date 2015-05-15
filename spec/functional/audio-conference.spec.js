'use strict';

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;

describe("Respoke audio conferencing", function () {
    this.timeout(30000);

    var roleId;
    var conference1;
    var conference2;
    var client1;
    var client2;
    var endpointId1 = uuid.v4();
    var endpointId2 = uuid.v4();
    var conferenceId = "my-super-cool-meetup";

    before(function () {
        return respokeAdmin.auth.admin({
            username: testHelper.config.username,
            password: testHelper.config.password
        }).then(function () {
            return respokeAdmin.roles.create({
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
                },
                conferences: {
                    "*": {
                        join: true,
                        destroy: true,
                        removeparticipants: true
                    }
                }
            });
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

    describe('when the test is configured', function () {
        beforeEach(function () {
            return respoke.Q.all([respokeAdmin.auth.endpoint({
                endpointId: endpointId1,
                appId: testHelper.config.appId,
                roleId: roleId
            }), respokeAdmin.auth.endpoint({
                endpointId: endpointId2,
                appId: testHelper.config.appId,
                roleId: roleId
            })]).then(function (tokens) {
                client1 = respoke.createClient();
                client2 = respoke.createClient();

                return respoke.Q.all([client1.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: tokens[0].tokenId
                }), client2.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: tokens[1].tokenId
                })]);
            }, function (err) {
                console.log('error', err);
            });
        });

        afterEach(function (done) {
            return respoke.Q.all([conference1.leave(), conference2.leave()]).then(function () {

            setTimeout(function () {
            respoke.Q.all([client1, client2].map(function (client) {
                if (client.isConnected) {
                    return client.disconnect();
                }
            })).finally(function () {
                done();
            }).done();
            }, 1000);
            });
        });

        describe("when placing a call", function () {
            this.timeout(30 * 60 * 60 * 1000);
            var localMedia;

            beforeEach(function (done) {
                done = doneCountBuilder(2, done);

                conference1 = client1.joinConference({
                    id: conferenceId,
                    onLocalMedia: function (evt) {
                        localMedia = evt.stream;
                    },
                    onRemoteMedia: function () {
                        done();
                    }
                });

                conference2 = client2.joinConference({
                    id: conferenceId,
                    onRemoteMedia: function (evt) {
                        setTimeout(function () {
                            done();
                        }, 1000);
                    }
                });
            });

            it("succeeds and sets up outgoingMedia", function () {
                expect(localMedia).to.be.ok;
                expect(conference1.call.outgoingMediaStreams.length).to.equal(1);
                expect(conference1.call.incomingMediaStreams.length).to.equal(1);
                expect(conference1.call.outgoingMedia).to.be.ok;
                expect(conference1.call.outgoingMedia.className).to.equal('respoke.LocalMedia');
                expect(conference1.call.incomingMedia).to.be.ok;
                expect(conference1.call.incomingMedia.className).to.equal('respoke.RemoteMedia');
                expect(conference1.call.outgoingMedia.hasVideo()).to.equal(false);
                expect(conference1.call.outgoingMedia.hasAudio()).to.equal(true);
                expect(conference1.call.incomingMedia.hasVideo()).to.equal(false);
                expect(conference1.call.incomingMedia.hasAudio()).to.equal(true);
                expect(conference1.call.hasMedia()).to.equal(true);
                expect(conference1.call.hasAudio).to.equal(true);
                expect(conference1.call.hasVideo).to.equal(false);
            });

            describe("the getParticipants method", function () {
                it("returns an array of connections", function () {
                    return conference1.getParticipants().then(function (participants) {
                        expect(participants).to.be.an.Array;
                        expect(participants.length).to.equal(2);
                        expect(participants[0].className).to.equal("respoke.Connection");
                    });
                });
            });

            describe("the removeParticipants method", function () {
                it("hangs up on the removed participant", function (done) {
                    done = doneCountBuilder(2, done);
                    conference2.listen('hangup', function () {
                        done();
                    });

                    conference1.removeParticipant({
                        endpointId: endpointId2
                    }).then(function () {
                        return conference1.getParticipants();
                    }).done(function (participants) {
                        expect(participants).to.be.an.Array;
                        expect(participants.length).to.equal(1);
                        done();
                    }, done);
                });
            });

            describe("the destroy method", function () {
                it("hangs up all of the participants", function (done) {
                    done = doneCountBuilder(2, done);
                    conference1.listen('hangup', function () {
                        done();
                    });

                    conference2.listen('hangup', function () {
                        done();
                    });

                    conference1.destroy().done(null, done);
                });
            });
        });
    });
});
