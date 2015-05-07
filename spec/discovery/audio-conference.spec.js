"use strict";
var expect = chai.expect;

describe("Respoke audio conferencing", function () {
    this.timeout(30000);

    var conf;
    var conf2;
    var client1;
    var client2;
    var endpointId1 = "user1";
    var endpointId2 = "user2";
    var conferenceId = "my-super-cool-meetup";

    it("is configured", function () {
        expect(respokeTestConfig.appId).not.to.equal("");
        expect(respokeTestConfig.appSecret).not.to.equal("");
        expect(respokeTestConfig.roleId).not.to.equal("");
    });

    function request(params, callback) {
        var xhr = new XMLHttpRequest();
        var paramString;
        var response = {};

        xhr.open(params.method, respokeTestConfig.baseURL + params.path);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        if (params.appSecret) {
            xhr.setRequestHeader("App-Secret", respokeTestConfig.appSecret);
        }

        if (['POST', 'PUT'].indexOf(params.method) > -1) {
            paramString = JSON.stringify(params.parameters);
        }

        try {
            xhr.send(paramString);
        } catch (err) {
            callback(err, null);
            return;
        }

        console.log(params.method, respokeTestConfig.baseURL + params.path, paramString);
        xhr.onreadystatechange = function () {
            if (this.readyState !== 4) {
                return;
            }

            if (this.status === 0) {
                callback(new Error("Status is 0: Incomplete request, SSL error, or CORS error."));
                return;
            }

            if ([200, 204, 205, 302, 401, 403, 404, 418].indexOf(this.status) > -1) {
                response.code = this.status;
                if (this.response) {
                    try {
                        response.result = JSON.parse(this.response);
                    } catch (e) {
                        response.result = this.response;
                        response.error = "Invalid JSON.";
                    }
                }
                callback(null, response);
            } else if (this.status === 429) {
                callback(new Error("Rate limit exceeded."), null);
            } else {
                callback(new Error('unexpected response ' + this.status), null);
            }
        };
    }

    describe('when the test is configured', function () {
        beforeEach(function (done) {
            request({
                method: "POST",
                path: "/v1/tokens",
                appSecret: true,
                parameters: {
                    appId: respokeTestConfig.appId,
                    endpointId: endpointId1,
                    roleId: respokeTestConfig.roleId,
                    ttl: 84600
                }
            }, function (err, response) {
                if (err) {
                    done(err);
                    return;
                }
                client1 = respoke.createClient();
                client1.connect({
                    appId: respokeTestConfig.appId,
                    baseURL: respokeTestConfig.baseURL,
                    token:  response.result.tokenId
                }).done(function () {
                    request({
                        method: "POST",
                        path: "/v1/tokens",
                        appSecret: true,
                        parameters: {
                            appId: respokeTestConfig.appId,
                            endpointId: endpointId2,
                            roleId: respokeTestConfig.roleId,
                            ttl: 84600
                        }
                    }, function (err, response) {
                        if (err) {
                            done(err);
                            return;
                        }

                        client2 = respoke.createClient();
                        client2.connect({
                            appId: respokeTestConfig.appId,
                            baseURL: respokeTestConfig.baseURL,
                            token:  response.result.tokenId
                        }).done(function () {
                            done();
                        }, done);
                    });
                });
            });
        });

        afterEach(function () {
            conf.leave();
            conf2.leave();
        });

        describe("when placing a call", function () {
            var localMedia;
            var remoteMedia;

            beforeEach(function (done) {
                done = doneCountBuilder(2, done);

                conf = client1.joinConference({
                    id: conferenceId,
                    onLocalMedia: function (evt) {
                        localMedia = evt.stream;
                    },
                    onRemoteMedia: function (evt) {
                        done();
                    }
                });

                conf2 = client2.joinConference({
                    id: conferenceId,
                    onRemoteMedia: function (evt) {
                        setTimeout(function () {
                            done();
                        }, 1000);
                    }
                });
            });

            it("succeeds and sets up outgoingMedia", function (done) {
                expect(localMedia).to.be.ok;
                expect(conf.call.outgoingMediaStreams.length).to.equal(1);
                expect(conf.call.incomingMediaStreams.length).to.equal(1);
                expect(conf.call.outgoingMedia).to.be.ok;
                expect(conf.call.outgoingMedia.className).to.equal('respoke.LocalMedia');
                expect(conf.call.incomingMedia).to.be.ok;
                expect(conf.call.incomingMedia.className).to.equal('respoke.RemoteMedia');
                expect(conf.call.outgoingMedia.hasVideo()).to.equal(false);
                expect(conf.call.outgoingMedia.hasAudio()).to.equal(true);
                expect(conf.call.incomingMedia.hasVideo()).to.equal(false);
                expect(conf.call.incomingMedia.hasAudio()).to.equal(true);
                expect(conf.call.hasMedia()).to.equal(true);
                expect(conf.call.hasAudio).to.equal(true);
                expect(conf.call.hasVideo).to.equal(false);
                conf.call.muteAudio();
                conf2.call.muteAudio();

                conf.getParticipants().done(function (participants) {
                    expect(participants).to.be.an.Array;
                    expect(participants.length).to.equal(2);
                    expect(participants[0].className).to.equal("respoke.Connection");

                    conf2.listen('hangup', function () {
                        done();
                    });

                    conf.removeParticipant({
                        endpointId: endpointId2
                    }).done(function () {
                        conf.getParticipants().done(function (participants) {
                            expect(participants).to.be.an.Array;
                            expect(participants.length).to.equal(1);
                        }, done);
                    }, done);
                }, done);
            });
        });
    });
});
