'use strict';

var testHelper = require('../test-helper');
var uuid = require('uuid');

var expect = chai.expect;
var respoke = testHelper.respoke;
var respokeAdmin = testHelper.respokeAdmin;

describe("Respoke audio conferencing", function () {
    this.timeout(30000);

    var client;
    var roleId;
    var conference;

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
            var endpointId = uuid.v4();

            return respokeAdmin.auth.endpoint({
                endpointId: endpointId,
                appId: testHelper.config.appId,
                roleId: roleId
            }).then(function (token) {
                client = respoke.createClient();

                return client.connect({
                    appId: testHelper.config.appId,
                    baseURL: testHelper.config.baseURL,
                    token: token.tokenId
                });
            });
        });

        afterEach(function (done) {
            conference.listen('hangup', function () {
                client.disconnect().finally(function () {
                    done();
                }).done();
            });
            conference.leave();
        });

        describe("when placing a call", function () {
            this.timeout(30 * 60 * 60 * 1000);
            var localMedia;

            beforeEach(function (done) {
                var doneOnce = doneOnceBuilder(done);

                conference = client.joinConference({
                    id: "conference-service",
                    onLocalMedia: function (evt) {
                        localMedia = evt.stream;
                    },
                    onRemoteMedia: function () {
                        doneOnce();
                    },
                    onHangup: function () {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });

            it("succeeds and sets up outgoingMedia", function () {
                expect(localMedia).to.be.ok;
                expect(conference.call.outgoingMediaStreams.length).to.equal(1);
                expect(conference.call.incomingMediaStreams.length).to.equal(1);
                expect(conference.call.outgoingMedia).to.be.ok;
                expect(conference.call.outgoingMedia.className).to.equal('respoke.LocalMedia');
                expect(conference.call.incomingMedia).to.be.ok;
                expect(conference.call.incomingMedia.className).to.equal('respoke.RemoteMedia');
                expect(conference.call.outgoingMedia.hasVideo()).to.equal(false);
                expect(conference.call.outgoingMedia.hasAudio()).to.equal(true);
                expect(conference.call.incomingMedia.hasVideo()).to.equal(false);
                expect(conference.call.incomingMedia.hasAudio()).to.equal(true);
                expect(conference.call.hasMedia()).to.equal(true);
                expect(conference.call.hasAudio).to.equal(true);
                expect(conference.call.hasVideo).to.equal(false);
            });

            describe("the getParticipants method", function () {
                it("returns an array of connections", function () {
                    return conference.getParticipants().then(function (participants) {
                        expect(participants).to.be.an.Array;
                        expect(participants.length).to.equal(1);
                        expect(participants[0].className).to.equal("respoke.Connection");
                    });
                });
            });
        });
    });
});
