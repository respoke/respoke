/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var log = require('loglevel');
var respoke = require('./respoke');

/**
 * Class for managing the remote media stream, 
 * which is attached to a call at `call.outgoingMedia`.
 * 
 * @class respoke.RemoteMedia
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId - client id
 * @param {string} params.callId - call id
 * @param {object} params.constraints
 * @param {HTMLVideoElement} params.videoRemoteElement - Pass in an optional html video element to have remote video attached to it.
 * @returns {respoke.RemoteMedia}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.RemoteMedia
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    /**
     * @memberof! respoke.RemoteMedia
     * @name className
     * @type {string}
     */
    that.className = 'respoke.RemoteMedia';
    /**
     * Respoke media ID (different from a `MediaStream.id`).
     * @memberof! respoke.RemoteMedia
     * @name id
     * @type {string}
     */
    that.id = respoke.makeGUID();

    /**
     * @memberof! respoke.RemoteMedia
     * @name client
     * @private
     * @type {respoke.getClient}
     */
    var client = respoke.getClient(instanceId);
    /**
     * The HTML element with attached video.
     * @memberof! respoke.RemoteMedia
     * @name element
     * @type {HTMLVideoElement}
     */
    that.element = params.videoRemoteElement;
    /**
     * @memberof! respoke.RemoteMedia
     * @name sdpHasAudio
     * @private
     * @type {boolean}
     */
    var sdpHasAudio = false;
    /**
     * @memberof! respoke.RemoteMedia
     * @name sdpHasVideo
     * @private
     * @type {boolean}
     */
    var sdpHasVideo = false;
    /**
     * @memberof! respoke.RemoteMedia
     * @name sdpHasDataChannel
     * @private
     * @type {boolean}
     */
    var sdpHasDataChannel = false;
    /**
     * A timer to make sure we only fire {respoke.RemoteMedia#requesting-media} if the browser doesn't
     * automatically grant permission on behalf of the user. Timer is canceled in onReceiveUserMedia.
     * @memberof! respoke.RemoteMedia
     * @name allowTimer
     * @private
     * @type {number}
     */
    var allowTimer = 0;
    /**
     * @memberof! respoke.RemoteMedia
     * @name mediaOptions
     * @private
     * @type {object}
     */
    var mediaOptions = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };
    /**
     * @memberof! respoke.RemoteMedia
     * @name pc
     * @private
     * @type {respoke.PeerConnection}
     */
    var pc = params.pc;
    delete that.pc;
    /**
     * The remote `MediaStream`.
     * @memberof! respoke.RemoteMedia
     * @name stream
     * @type {RTCMediaStream}
     */
    that.stream = null;

    /**
     * Indicate whether we are receiving video.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.hasVideo
     * @return {boolean}
     */
    that.hasVideo = function () {
        if (that.stream) {
            return (that.stream.getVideoTracks().length > 0);
        }
        return sdpHasVideo;
    };

    /**
     * Indicate whether we are receiving audio.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.hasAudio
     * @return {boolean}
     */
    that.hasAudio = function () {
        if (that.stream) {
            return (that.stream.getAudioTracks().length > 0);
        }
        return sdpHasAudio;
    };

    /**
     * Indicate whether we have media yet.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.hasMedia
     * @return {boolean}
     */
    that.hasMedia = function () {
        return !!that.stream;
    };

    /**
     * Save and parse the SDP
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.setSDP
     * @param {RTCSessionDescription} oSession
     * @private
     */
    that.setSDP = function (oSession) {
        sdpHasVideo = respoke.sdpHasVideo(oSession.sdp);
        sdpHasAudio = respoke.sdpHasAudio(oSession.sdp);
        sdpHasDataChannel = respoke.sdpHasDataChannel(oSession.sdp);
    };

    /**
     * Parse the constraints.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.setConstraints
     * @param {MediaConstraints} constraints
     * @private
     */
    that.setConstraints = function (constraints) {
        that.constraints = constraints;
        sdpHasVideo = respoke.constraintsHasVideo(that.constraints);
        sdpHasAudio = respoke.constraintsHasAudio(that.constraints);
    };

    /**
     * Save the media stream
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.setStream
     * @param {MediaStream} str
     * @private
     */
    that.setStream = function (str) {
        if (str) {
            that.stream = str;
            /**
             * Expose getAudioTracks.
             */
            that.getAudioTracks = that.stream.getAudioTracks.bind(that.stream);
            /**
             * Expose getVideoTracks.
             */
            that.getVideoTracks = that.stream.getVideoTracks.bind(that.stream);
            that.element = that.element || document.createElement('video');
            attachMediaStream(that.element, that.stream);
            that.element.autoplay = true;
            setTimeout(that.element.play.bind(that.element));
        }
    };

    /**
     * Stop the stream.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.stop
     * @fires respoke.RemoteMedia#stop
     */
    that.stop = function () {
        if (!that.stream) {
            return;
        }

        that.stream.numPc -= 1;
        if (that.stream.numPc === 0) {
            that.stream.stop();
            delete respoke.streams[that.constraints];
        }
        that.stream = null;
        /**
         * @event respoke.RemoteMedia#stop
         * @property {string} name - the event name.
         * @property {respoke.RemoteMedia} target
         */
        that.fire('stop');
    };

    /**
     * Whether the video stream is muted.
     * 
     * All video tracks must be muted for this to return `false`.
     * @returns boolean
     */
    that.isVideoMuted = function () {
        if (!that.stream) {
            return false;
        }
        return that.stream.getVideoTracks().every(function (track) {
            return !track.enabled;
        });
    };

    /**
     * Mute remote video stream.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.muteVideo
     * @fires respoke.RemoteMedia#mute
     */
    that.muteVideo = function () {
        if (that.isVideoMuted()) {
            return;
        }
        that.stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
         * @event respoke.RemoteMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.RemoteMedia} target
         * @property {string} type - Either "audio" or "video" to specify the type of stream whose muted state
         * has been changed.
         * @property {boolean} muted - Whether the stream is now muted. Will be set to false if mute was turned off.
         */
        that.fire('mute', {
            type: 'video',
            muted: true
        });
    };

    /**
     * Unmute remote video stream.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.unmuteVideo
     * @fires respoke.RemoteMedia#mute
     */
    that.unmuteVideo = function () {
        if (!that.isVideoMuted()) {
            return;
        }
        that.stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
         * @event respoke.RemoteMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.RemoteMedia} target
         * @property {string} type - Either "audio" or "video" to specify the type of stream whose muted state
         * has been changed.
         * @property {boolean} muted - Whether the stream is now muted. Will be set to false if mute was turned off.
         */
        that.fire('mute', {
            type: 'video',
            muted: false
        });
    };

    /**
     * Whether the audio stream is muted.
     * 
     * All audio tracks must be muted for this to return `false`.
     * @returns boolean
     */
    that.isAudioMuted = function () {
        if (!that.stream) {
            return false;
        }
        return that.stream.getAudioTracks().every(function (track) {
            return !track.enabled;
        });
    };

    /**
     * Mute remote audio stream.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.muteAudio
     * @fires respoke.RemoteMedia#mute
     */
    that.muteAudio = function () {
        if (that.isAudioMuted()) {
            return;
        }
        that.stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
         * @event respoke.RemoteMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.RemoteMedia} target
         * @property {string} type - Either "audio" or "video" to specify the type of stream whose muted state
         * has been changed.
         * @property {boolean} muted - Whether the stream is now muted. Will be set to false if mute was turned off.
         */
        that.fire('mute', {
            type: 'audio',
            muted: true
        });
    };

    /**
     * Unmute remote audio stream.
     * @memberof! respoke.RemoteMedia
     * @method respoke.RemoteMedia.unmuteAudio
     * @fires respoke.RemoteMedia#mute
     */
    that.unmuteAudio = function () {
        if (!that.isAudioMuted()) {
            return;
        }
        that.stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
         * @event respoke.RemoteMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.RemoteMedia} target
         * @property {string} type - Either "audio" or "video" to specify the type of stream whose muted state
         * has been changed.
         * @property {boolean} muted - Whether the stream is now muted. Will be set to false if mute was turned off.
         */
        that.fire('mute', {
            type: 'audio',
            muted: false
        });
    };

    return that;
}; // End respoke.RemoteMedia
