"use strict";

var expect = chai.expect;

describe("Respoke local media", function () {
    this.timeout(30000);
    respoke.useFakeMedia = true;

    var call;

    describe("when obtaining local media", function () {
        var state = {};
        var localMedia;
        var allowSpy;
        var errorSpy;
        var audioTracks;
        var videoTracks;
        var streamReceivedSpy;
        var requestingMediaSpy;

        beforeEach(function () {
            sinon.stub(respoke, 'getClient').returns({endpointId: 'blah'});
            allowSpy = sinon.spy();
            streamReceivedSpy = sinon.spy();
            requestingMediaSpy = sinon.spy();
            errorSpy = sinon.spy();
        });

        afterEach(function () {
            respoke.getClient.restore();
            allowSpy = null;
            streamReceivedSpy = null;
            errorSpy = null;
            audioTracks = null;
            videoTracks = null;
        });

        describe("with receiveOnly=false", function () {
            describe("with audio and video", function () {
                beforeEach(function (done) {
                    state.receiveOnly = false;
                    localMedia = respoke.LocalMedia({
                        state: state,
                        hasScreenShare: false,
                        constraints: {
                            audio: true,
                            video: true,
                            mandatory: [],
                            optional: {}
                        }
                    });
                    localMedia.listen('allow', allowSpy);
                    localMedia.listen('stream-received', function (evt) {
                        audioTracks = evt.stream.getAudioTracks();
                        videoTracks = evt.stream.getVideoTracks();
                        streamReceivedSpy();
                        done();
                    });
                    /*
                     * Can't test "requesting-media" eventbc we put a 500ms timeout on it as to not flash UI
                     * when auto-answered.
                     */
                    localMedia.listen('error', function () {
                        errorSpy();
                    });
                    localMedia.start();
                });

                afterEach(function () {
                    delete state.receiveOnly;
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

                it("fires the 'stream-received' event", function () {
                    expect(streamReceivedSpy.called).to.equal(true);
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
                    state.receiveOnly = false;
                    localMedia = respoke.LocalMedia({
                        state: state,
                        hasScreenShare: false,
                        constraints: {
                            audio: true,
                            video: false,
                            mandatory: [],
                            optional: {}
                        }
                    });
                    localMedia.listen('allow', allowSpy);
                    localMedia.listen('stream-received', function (evt) {
                        audioTracks = evt.stream.getAudioTracks();
                        videoTracks = evt.stream.getVideoTracks();
                        streamReceivedSpy();
                        done();
                    });
                    /*
                     * Can't test "requesting-media" eventbc we put a 500ms timeout on it as to not flash UI
                     * when auto-answered.
                     */
                    localMedia.listen('error', function () {
                        errorSpy();
                    });
                    localMedia.start();
                });

                afterEach(function () {
                    delete state.receiveOnly;
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

                it("fires the 'stream-received' event", function () {
                    expect(streamReceivedSpy.called).to.equal(true);
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
                    state.receiveOnly = false;
                    localMedia = respoke.LocalMedia({
                        state: state,
                        hasScreenShare: false,
                        constraints: {
                            audio: false,
                            video: true,
                            mandatory: [],
                            optional: {}
                        }
                    });
                    localMedia.listen('allow', allowSpy);
                    localMedia.listen('stream-received', function (evt) {
                        audioTracks = evt.stream.getAudioTracks();
                        videoTracks = evt.stream.getVideoTracks();
                        streamReceivedSpy();
                        done();
                    });
                    /*
                     * Can't test "requesting-media" eventbc we put a 500ms timeout on it as to not flash UI
                     * when auto-answered.
                     */
                    localMedia.listen('error', function () {
                        errorSpy();
                    });
                    localMedia.start();
                });

                afterEach(function () {
                    delete state.receiveOnly;
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

                it("fires the 'stream-received' event", function () {
                    expect(streamReceivedSpy.called).to.equal(true);
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
});
