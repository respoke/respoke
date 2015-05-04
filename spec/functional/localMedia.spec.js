"use strict";

var expect = chai.expect;

describe("Respoke local media", function () {
    this.timeout(30000);
    respoke.useFakeMedia = true;

    it('re-uses streams when using fake media', function (done) {
        var localMedia1 = respoke.LocalMedia({ constraints: { audio: false, video: true } });
        var localMedia2 = respoke.LocalMedia({ constraints: { audio: false, video: true } });

        function localMedia2StreamReceivedHandler() {
            expect(localMedia1.stream).to.deep.equal(localMedia2.stream);
            done();
        }

        function localMedia1StreamReceivedHandler() {
            localMedia2.start().done(localMedia2StreamReceivedHandler, done);
        }

        localMedia1.start().done(localMedia1StreamReceivedHandler, done);
    });

    describe("when obtaining local media", function () {
        var localMedia;
        var allowSpy;
        var errorSpy;
        var audioTracks;
        var videoTracks;
        var promiseResolvedSpy;
        var requestingMediaSpy;

        beforeEach(function () {
            sinon.stub(respoke, 'getClient').returns({endpointId: 'blah'});
            allowSpy = sinon.spy();
            promiseResolvedSpy = sinon.spy();
            requestingMediaSpy = sinon.spy();
            errorSpy = sinon.spy();
        });

        afterEach(function () {
            respoke.getClient.restore();
            allowSpy = null;
            promiseResolvedSpy = null;
            errorSpy = null;
            audioTracks = null;
            videoTracks = null;
        });

        describe("with audio and video", function () {
            beforeEach(function (done) {
                localMedia = respoke.LocalMedia({
                    hasScreenShare: false,
                    constraints: {
                        audio: true,
                        video: true,
                        mandatory: [],
                        optional: {}
                    }
                });
                localMedia.listen('allow', allowSpy);
                /*
                 * Can't test "requesting-media" eventbc we put a 500ms timeout on it as to not flash UI
                 * when auto-answered.
                 */
                localMedia.start().done(function () {
                    audioTracks = localMedia.getAudioTracks();
                    videoTracks = localMedia.getVideoTracks();
                    promiseResolvedSpy();
                    setTimeout(done);
                }, done);
            });

            afterEach(function () {
                localMedia.stop();
            });

            it("gets audio and video", function () {
                expect(audioTracks).to.be.an.Array;
                expect(videoTracks).to.be.an.Array;
                expect(audioTracks.length).to.equal(1);
                expect(videoTracks.length).to.equal(1);
            });

            it("fires the 'allow' event", function () {
                expect(allowSpy.called).to.equal(true);
            });

            it("resolves the promise", function () {
                expect(promiseResolvedSpy.called).to.equal(true);
            });

            it("does not fire the 'error' event", function () {
                expect(errorSpy.called).to.equal(false);
            });

            describe("hasAudio", function () {
                it("returns true", function () {
                    expect(localMedia.hasAudio()).to.equal(true);
                });
            });

            describe("hasVideo", function () {
                it("returns true", function () {
                    expect(localMedia.hasVideo()).to.equal(true);
                });
            });

            describe("hasScreenShare", function () {
                it("returns false", function () {
                    expect(localMedia.hasScreenShare()).to.equal(false);
                });
            });

            describe("isVideoMuted", function () {
                it("returns false", function () {
                    expect(localMedia.isVideoMuted()).to.equal(false);
                });
            });

            describe("isAudioMuted", function () {
                it("returns false", function () {
                    expect(localMedia.isAudioMuted()).to.equal(false);
                });
            });

            describe("muteVideo", function () {
                var muteSpy;

                beforeEach(function (done) {
                    muteSpy = sinon.spy();
                    localMedia.listen('mute', function (evt) {
                        muteSpy(evt);
                        done();
                    });
                    localMedia.muteVideo();
                });

                afterEach(function () {
                    localMedia.ignore('mute');
                    localMedia.unmuteVideo();
                });

                it("mutes the video", function () {
                    var videoTracks = localMedia.getVideoTracks();
                    var muted = videoTracks.every(function (track) {
                        return track.enabled === false;
                    });
                    if (!muted) {
                        throw new Error("Video not muted after calling muteVideo().");
                    }
                });

                it("does not affect the audio", function () {
                    var audioTracks = localMedia.getAudioTracks();
                    var muted = audioTracks.every(function (track) {
                        return track.enabled !== true;
                    });
                    if (muted) {
                        throw new Error("Audio got muted after calling muteVideo().");
                    }
                });

                it("fires the mute event with the right info", function () {
                    expect(muteSpy.called).to.equal(true);
                    expect(typeof muteSpy.args[0]).to.equal('object');
                    expect(muteSpy.args[0][0].type).to.equal('video');
                    expect(muteSpy.args[0][0].muted).to.equal(true);
                });
            });

            describe("muteAudio", function () {
                var muteSpy;

                beforeEach(function (done) {
                    muteSpy = sinon.spy();
                    localMedia.listen('mute', function (evt) {
                        muteSpy(evt);
                        done();
                    });
                    localMedia.muteAudio();
                });

                afterEach(function () {
                    localMedia.ignore('mute');
                    localMedia.unmuteAudio();
                });

                it("mutes the audio", function () {
                    var audioTracks = localMedia.getAudioTracks();
                    var muted = audioTracks.every(function (track) {
                        return track.enabled === false;
                    });
                    if (!muted) {
                        throw new Error("Audio not muted after calling muteAudio().");
                    }
                });

                it("does not affect the video", function () {
                    var videoTracks = localMedia.getVideoTracks();
                    var muted = videoTracks.every(function (track) {
                        return track.enabled !== true;
                    });
                    if (muted) {
                        throw new Error("Video got muted after calling muteAudio().");
                    }
                });

                it("fires the mute event with the right info", function () {
                    expect(muteSpy.called).to.equal(true);
                    expect(typeof muteSpy.args[0][0]).to.equal('object');
                    expect(muteSpy.args[0][0].type).to.equal('audio');
                    expect(muteSpy.args[0][0].muted).to.equal(true);
                });
            });
        });

        describe("with only audio", function () {
            beforeEach(function (done) {
                localMedia = respoke.LocalMedia({
                    hasScreenShare: false,
                    constraints: {
                        audio: true,
                        video: false,
                        mandatory: [],
                        optional: {}
                    }
                });
                localMedia.listen('allow', allowSpy);
                /*
                 * Can't test "requesting-media" eventbc we put a 500ms timeout on it as to not flash UI
                 * when auto-answered.
                 */
                localMedia.start().done(function () {
                    audioTracks = localMedia.getAudioTracks();
                    videoTracks = localMedia.getVideoTracks();
                    promiseResolvedSpy();
                    setTimeout(done);
                }, errorSpy);
            });

            afterEach(function () {
                localMedia.stop();
            });

            it("gets audio only", function () {
                expect(audioTracks).to.be.an.Array;
                expect(videoTracks).to.be.an.Array;
                expect(audioTracks.length).to.equal(1);
                expect(videoTracks.length).to.equal(0);
            });

            it("fires the 'allow' event", function () {
                expect(allowSpy.called).to.equal(true);
            });

            it("resolves the promise", function () {
                expect(promiseResolvedSpy.called).to.equal(true);
            });

            it("does not fire the 'error' event", function () {
                expect(errorSpy.called).to.equal(false);
            });

            describe("hasAudio", function () {
                it("returns true", function () {
                    expect(localMedia.hasAudio()).to.equal(true);
                });
            });

            describe("hasVideo", function () {
                it("returns false", function () {
                    expect(localMedia.hasVideo()).to.equal(false);
                });
            });

            describe("hasScreenShare", function () {
                it("returns false", function () {
                    expect(localMedia.hasScreenShare()).to.equal(false);
                });
            });

            describe("isVideoMuted", function () {
                it("returns undefined", function () {
                    expect(!localMedia.getVideoTracks()).to.equal(false);
                    expect(localMedia.isVideoMuted()).to.equal(undefined);
                });
            });

            describe("isAudioMuted", function () {
                it("returns false", function () {
                    expect(localMedia.isAudioMuted()).to.equal(false);
                });
            });

            describe("muteAudio", function () {
                var muteSpy;

                beforeEach(function (done) {
                    muteSpy = sinon.spy();
                    localMedia.listen('mute', function (evt) {
                        muteSpy(evt);
                        done();
                    });
                    localMedia.muteAudio();
                });

                afterEach(function () {
                    localMedia.ignore('mute');
                    localMedia.unmuteAudio();
                });

                it("mutes the audio", function () {
                    var audioTracks = localMedia.getAudioTracks();
                    var muted = audioTracks.every(function (track) {
                        return track.enabled === false;
                    });
                    if (!muted) {
                        throw new Error("Audio not muted after calling muteAudio().");
                    }
                });

                it("fires the mute event with the right info", function () {
                    expect(muteSpy.called).to.equal(true);
                    expect(typeof muteSpy.args[0][0]).to.equal('object');
                    expect(muteSpy.args[0][0].type).to.equal('audio');
                    expect(muteSpy.args[0][0].muted).to.equal(true);
                });
            });
        });

        describe("with only video", function () {
            beforeEach(function (done) {
                localMedia = respoke.LocalMedia({
                    hasScreenShare: false,
                    constraints: {
                        audio: false,
                        video: true,
                        mandatory: [],
                        optional: {}
                    }
                });
                localMedia.listen('allow', allowSpy);
                /*
                 * Can't test "requesting-media" eventbc we put a 500ms timeout on it as to not flash UI
                 * when auto-answered.
                 */
                localMedia.start().done(function () {
                    audioTracks = localMedia.getAudioTracks();
                    videoTracks = localMedia.getVideoTracks();
                    promiseResolvedSpy();
                    setTimeout(done);
                }, errorSpy);
            });

            afterEach(function () {
                localMedia.stop();
            });

            it("gets video only", function () {
                expect(audioTracks).to.be.an.Array;
                expect(videoTracks).to.be.an.Array;
                expect(audioTracks.length).to.equal(0);
                expect(videoTracks.length).to.equal(1);
            });

            it("fires the 'allow' event", function () {
                expect(allowSpy.called).to.equal(true);
            });

            it("resolves the promise", function () {
                expect(promiseResolvedSpy.called).to.equal(true);
            });

            it("does not fire the 'error' event", function () {
                expect(errorSpy.called).to.equal(false);
            });

            describe("hasVideo", function () {
                it("returns true", function () {
                    expect(localMedia.hasVideo()).to.equal(true);
                });
            });

            describe("hasAudio", function () {
                it("returns false", function () {
                    expect(localMedia.hasAudio()).to.equal(false);
                });
            });

            describe("hasScreenShare", function () {
                it("returns false", function () {
                    expect(localMedia.hasScreenShare()).to.equal(false);
                });
            });

            describe("isAudioMuted", function () {
                it("returns undefined", function () {
                    expect(localMedia.isAudioMuted()).to.equal(undefined);
                });
            });

            describe("isVideoMuted", function () {
                it("returns false", function () {
                    expect(localMedia.isVideoMuted()).to.equal(false);
                });
            });

            describe("muteVideo", function () {
                var muteSpy;

                beforeEach(function (done) {
                    muteSpy = sinon.spy();
                    localMedia.listen('mute', function (evt) {
                        muteSpy(evt);
                        done();
                    });
                    localMedia.muteVideo();
                });

                afterEach(function () {
                    localMedia.ignore('mute');
                    localMedia.unmuteVideo();
                });

                it("mutes the video", function () {
                    var videoTracks = localMedia.getVideoTracks();
                    var muted = videoTracks.every(function (track) {
                        return track.enabled === false;
                    });
                    if (!muted) {
                        throw new Error("Video not muted after calling muteVideo().");
                    }
                });

                it("fires the mute event with the right info", function () {
                    expect(muteSpy.called).to.equal(true);
                    expect(typeof muteSpy.args[0][0]).to.equal('object');
                    expect(muteSpy.args[0][0].type).to.equal('video');
                    expect(muteSpy.args[0][0].muted).to.equal(true);
                });
            });
        });
    });
});
