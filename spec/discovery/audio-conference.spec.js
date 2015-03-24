"use strict";
var expect = chai.expect;

describe("Respoke audio conferencing", function () {
    this.timeout(30000);

    var conf;
    var client;
    var baseURL = "https://api-int.respoke.io";
    var appId = "";
    var appSecret = "";
    var roleId = "";

    it("is configured", function () {
        expect(appId).not.to.equal("");
        expect(appSecret).not.to.equal("");
        expect(roleId).not.to.equal("");
    });

    function request(params, callback) {
        var xhr = new XMLHttpRequest();
        var paramString;
        var response = {};

        xhr.open(params.method, baseURL + params.path);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        if (params.appSecret) {
            xhr.setRequestHeader("App-Secret", appSecret);
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

        console.log(params.method, baseURL + params.path, paramString);
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
                    appId: appId,
                    endpointId: "test",
                    roleId: roleId,
                    ttl: 84600
                }
            }, function (err, response) {
                if (err) {
                    done(err);
                    return;
                }

                client = respoke.createClient();
                client.connect({
                    appId: appId,
                    baseURL: baseURL,
                    token:  response.result.tokenId
                }).done(function () {
                    expect(client.endpointId).not.to.be.undefined;
                    expect(client.endpointId).to.equal("test");
                    done();
                }, done);
            });
        });

        afterEach(function (done) {
            conf.listen('hangup', function () {
                client.disconnect().fin(function () {
                    done();
                }).done();
            });
            conf.hangup();
        });

        describe("when placing a call", function () {
        this.timeout(30*60*60*1000);
            var localMedia;
            var remoteMedia;

            beforeEach(function (done) {
                var doneOnce = doneOnceBuilder(done);

                conf = client.startConferenceCall({
                    conferenceId: "conference-service",
                    open: true,
                    onLocalMedia: function (evt) {
                        localMedia = evt.stream;
                    },
                    onConnect: function (evt) {
                        doneOnce();
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });

            it("succeeds and sets up outgoingMedia", function () {
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
            });
        });
    });
});
