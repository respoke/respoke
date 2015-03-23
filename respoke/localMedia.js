/*!
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 * @ignore
 */

/* global respoke: true */
var log = require('loglevel');
var respoke = require('./respoke');

/**
 * A wrapper around the stream from `getUserMedia`,
 * which is attached to a call at `call.outgoingMedia`.
 *
 * @class respoke.LocalMedia
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {object} [params.constraints]
 * @param {HTMLVideoElement} params.element - Pass in an optional html video element to have local
 * video attached to it.
 * @returns {respoke.LocalMedia}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    var that = respoke.EventEmitter(params);

    /**
     * @memberof! respoke.LocalMedia
     * @name className
     * @type {string}
     */
    that.className = 'respoke.LocalMedia';
    /**
     * Respoke media ID (different from a `MediaStream.id`).
     * @memberof! respoke.LocalMedia
     * @name id
     * @type {string}
     */
    that.id = respoke.makeGUID();
    /**
     * The HTML element with video attached.
     * @memberof! respoke.LocalMedia
     * @name element
     * @type {HTMLVideoElement}
     */
    that.element = params.element;
    /**
     * @memberof! respoke.LocalMedia
     * @name hasScreenShare
     * @private
     * @type {boolean}
     */
    var hasScreenShare = params.hasScreenShare;
    delete params.hasScreenShare;
    /**
     * @memberof! respoke.LocalMedia
     * @name sdpHasAudio
     * @private
     * @type {boolean}
     */
    var sdpHasAudio = false;
    /**
     * @memberof! respoke.LocalMedia
     * @name sdpHasVideo
     * @private
     * @type {boolean}
     */
    var sdpHasVideo = false;
    /**
     * @memberof! respoke.LocalMedia
     * @name sdpHasDataChannel
     * @private
     * @type {boolean}
     */
    var sdpHasDataChannel = false;
    /**
     * A timer to make sure we only fire {respoke.LocalMedia#requesting-media} if the browser doesn't
     * automatically grant permission on behalf of the user. Timer is canceled in onReceiveUserMedia.
     * @memberof! respoke.LocalMedia
     * @name allowTimer
     * @private
     * @type {number}
     */
    var allowTimer = 0;
    /**
     * @memberof! respoke.LocalMedia
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
     * The local `MediaStream` from `getUserMedia()`.
     * @memberof! respoke.LocalMedia
     * @name stream
     * @type {RTCMediaStream}
     */
    that.stream = null;

    function getStream(theConstraints) {
        for (var i = 0; i < respoke.streams.length; i++) {
            var s = respoke.streams[i];
            if (respoke.isEqual(s.constraints, theConstraints)) {
                return s.stream;
            }
        }
        return null;
    }

    function removeStream(theConstraints) {
        var toRemoveIndex;
        for (var i = 0; i < respoke.streams.length; i++) {
            var s = respoke.streams[i];
            if (respoke.isEqual(s.constraints, theConstraints)) {
                toRemoveIndex = i;
                break;
            }
        }
        if (toRemoveIndex !== undefined) {
            respoke.streams.splice(toRemoveIndex, 1);
        }
    }

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.onReceiveUserMedia
     * @private
     * @param {RTCMediaStream} theStream
     * @fires respoke.LocalMedia#stream-received
     */
    function onReceiveUserMedia(theStream) {
        that.stream = theStream;
        clearTimeout(allowTimer);
        /**
         * The user has approved the request for media. Any UI changes made to remind the user to click Allow
         * should be canceled now. This event is the same as the `onAllow` callback.  This event gets fired
         * even if the allow process is automatic, i. e., permission and media is granted by the browser
         * without asking the user to approve it.
         * @event respoke.LocalMedia#allow
         * @type {respoke.Event}
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
         */
        that.fire('allow');
        log.debug('User gave permission to use media.');
        log.debug('onReceiveUserMedia');

        that.element = that.element || document.createElement('video');

        // This still needs some work. Using cached streams causes an unused video element to be passed
        // back to the App. This is because we assume at the moment that only one local media video element
        // will be needed. The first one passed back will contain media and the others will fake it. Media
        // will still be sent with every peer connection. Also need to study the use of getLocalElement
        // and the implications of passing back a video element with no media attached.
        var aStream = getStream(that.constraints);
        if (aStream) {
            aStream.numPc += 1;

            attachMediaStream(that.element, that.stream);
            // We won't want our local video outputting audio.
            that.element.muted = true;
            that.element.autoplay = true;

            /**
             * Indicate that we've received media from the browser.
             * @event respoke.LocalMedia#stream-received
             * @type {respoke.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('stream-received', {
                element: that.element,
                stream: that.stream
            });
        } else {
            that.stream.numPc = 1;
            respoke.streams.push({stream: that.stream, constraints: that.constraints});

            that.stream.id = that.streamId;
            attachMediaStream(that.element, that.stream);
            // We won't want our local video outputting audio.
            that.element.muted = true;
            that.element.autoplay = true;

            /**
             * Indicate that we've received media from the browser.
             * @event respoke.LocalMedia#stream-received
             * @type {respoke.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('stream-received', {
                element: that.element,
                stream: that.stream
            });
        }
    }

    /**
     * Expose getAudioTracks.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.getAudioTracks
     */
    that.getAudioTracks = function () {
        if (that.stream) {
            return that.stream.getAudioTracks();
        }
        return [];
    };

    /**
     * Expose getVideoTracks.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.getVideoTracks
     */
    that.getVideoTracks = function () {
        if (that.stream) {
            return that.stream.getVideoTracks();
        }
        return [];
    };

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.requestMedia
     * @private
     */
    function requestMedia() {
        if (that.state.receiveOnly === true) {
            /**
             * Indicate there is no need to obtain media at this time.
             * @event respoke.LocalMedia#no-local-media
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('no-local-media');
            return;
        }

        log.debug('requestMedia', that.state.caller);

        if (!that.constraints) {
            throw new Error('No constraints.');
        }

        var theStream = getStream(that.constraints);
        if (theStream) {
            log.debug('using old stream');
            onReceiveUserMedia(theStream);
            return;
        }

        // TODO set getStream(that.constraints) = true as a flag that we are already
        // attempting to obtain this media so the race condition where gUM is called twice with
        // the same constraints when calls are placed too quickly together doesn't occur.
        allowTimer = setTimeout(function delayPermissionsRequest() {
            /**
             * The browser is asking for permission to access the User's media. This would be an ideal time
             * to modify the UI of the application so that the user notices the request for permissions
             * and approves it.
             * @event respoke.LocalMedia#requesting-media
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('requesting-media');
        }, 500);
        if (respoke.useFakeMedia === true) {
            that.constraints.fake = true;
        }
        if (!respoke.isNwjs && that.constraints.video.mandatory &&
                that.constraints.video.mandatory.chromeMediaSource) {
            if (respoke.needsChromeExtension && respoke.hasChromeExtension) {
                respoke.chooseDesktopMedia(function (params) {
                    if (!params.sourceId) {
                        respoke.log.error("Error trying to get screensharing source.", params.error);
                        /**
                         * Indicate there has been an error obtaining media.
                         * @event respoke.LocalMedia#error
                         * @type {respoke.Event}
                         * @property {string} name - the event name.
                         * @property {respoke.LocalMedia} target
                         * @property {string} message - a textual description of the error.
                         */
                        that.fire('error', {error: 'Permission denied.'});
                        return;
                    }
                    that.constraints.video.mandatory.chromeMediaSourceId = params.sourceId;
                    log.debug("Running getUserMedia with constraints", that.constraints);
                    getUserMedia(that.constraints, onReceiveUserMedia, onUserMediaError);
                });
                return;
            } else {
                throw new Error("Screen sharing not implemented on this platform yet.");
            }
        }
        log.debug("Running getUserMedia with constraints", that.constraints);
        getUserMedia(that.constraints, onReceiveUserMedia, onUserMediaError);
    }

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.onUserMediaError
     * @private
     * @param {object}
     */
    function onUserMediaError(p) {
        log.debug('onUserMediaError');
        if (p.code === 1) {
            log.warn("Permission denied.");
            /**
             * Indicate there has been an error obtaining media.
             * @event respoke.LocalMedia#error
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             * @property {string} message - a textual description of the error.
             */
            that.fire('error', {error: 'Permission denied.'});
        } else {
            log.warn(p);
            /**
             * Indicate there has been an error obtaining media.
             * @event respoke.LocalMedia#error
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             * @property {string} message - a textual description of the error.
             */
            that.fire('error', {error: p.code});
        }
    }

    /**
     * Whether the video stream is muted, or undefined if no stream of this type exists.
     *
     * All video tracks must be muted for this to return `false`.
     * @returns boolean
     */
    that.isVideoMuted = function () {
        if (!that.stream || !that.stream.getVideoTracks().length) {
            return undefined;
        }

        return that.stream.getVideoTracks().every(function (track) {
            return !track.enabled;
        });
    };

    /**
     * Mute local video stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.muteVideo
     * @fires respoke.LocalMedia#mute
     */
    that.muteVideo = function () {
        if (that.isVideoMuted()) {
            return;
        }
        that.stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
         * Indicate that the mute status of local audio or video has changed.
         * @event respoke.LocalMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
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
     * Unmute local video stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.unmuteVideo
     * @fires respoke.LocalMedia#mute
     */
    that.unmuteVideo = function () {
        if (!that.isVideoMuted()) {
            return;
        }
        that.stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
         * Indicate that the mute status of local audio or video has changed.
         * @event respoke.LocalMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
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
     * Whether the audio stream is muted, or undefined if no track of this type exists.
     *
     * All audio tracks must be muted for this to return `false`.
     * @returns boolean
     */
    that.isAudioMuted = function () {
        if (!that.stream || !that.stream.getAudioTracks().length) {
            return undefined;
        }
        return that.stream.getAudioTracks().every(function (track) {
            return !track.enabled;
        });
    };

    /**
     * Mute local audio stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.muteAudio
     * @fires respoke.LocalMedia#mute
     */
    that.muteAudio = function () {
        if (that.isAudioMuted()) {
            return;
        }
        that.stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
         * Indicate that the mute status of local audio or video has changed.
         * @event respoke.LocalMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
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
     * Unmute local audio stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.unmuteAudio
     * @fires respoke.LocalMedia#mute
     */
    that.unmuteAudio = function () {
        if (!that.isAudioMuted()) {
            return;
        }
        that.stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
         * Indicate that the mute status of local audio or video has changed.
         * @event respoke.LocalMedia#mute
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
         * @property {string} type - Either "audio" or "video" to specify the type of stream whose muted state
         * has been changed.
         * @property {boolean} muted - Whether the stream is now muted. Will be set to false if mute was turned off.
         */
        that.fire('mute', {
            type: 'audio',
            muted: false
        });
    };

    /**
     * Stop the stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.stop
     * @fires respoke.LocalMedia#stop
     */
    that.stop = function () {
        if (!that.stream) {
            return;
        }

        that.stream.numPc -= 1;
        if (that.stream.numPc === 0) {
            that.stream.stop();
            removeStream(that.constraints);
        }
        that.stream = null;
        /**
         * Indicate that local media has stopped.
         * @event respoke.LocalMedia#stop
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
         */
        that.fire('stop');
    };

    /**
     * Indicate whether we are sending a screenshare.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.hasScreenShare
     * @return {boolean}
     */
    that.hasScreenShare = function () {
        if (that.stream) {
            return (that.stream.getVideoTracks().length > 0 && hasScreenShare);
        }
        return hasScreenShare;
    };

    /**
     * Indicate whether we are sending video.
     *
     * Note: This method will return true when the video is a screenshare.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.hasVideo
     * @return {boolean}
     */
    that.hasVideo = function () {
        if (that.stream) {
            return (that.stream.getVideoTracks().length > 0);
        }
        return sdpHasVideo;
    };

    /**
     * Indicate whether we are sending audio.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.hasAudio
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
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.hasMedia
     * @return {boolean}
     */
    that.hasMedia = function () {
        return !!that.stream;
    };

    /**
     * Save and parse the SDP.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.setSDP
     * @param {RTCSessionDescription} oSession
     * @private
     */
    that.setSDP = function (oSession) {
        sdpHasVideo = respoke.sdpHasVideo(oSession.sdp);
        sdpHasAudio = respoke.sdpHasAudio(oSession.sdp);
        sdpHasDataChannel = respoke.sdpHasDataChannel(oSession.sdp);

        // We don't have media yet & this can still be changed so create the defaults based on what the sdp says.
        if (that.temporary) {
            that.constraints = {
                video: sdpHasVideo,
                audio: sdpHasAudio,
                mandatory: {},
                optional: []
            };
        }
    };

    /**
     * Parse the constraints.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.setConstraints
     * @param {MediaConstraints} constraints
     * @private
     */
    that.setConstraints = function (constraints) {
        that.constraints = constraints;
        sdpHasVideo = respoke.constraintsHasVideo(that.constraints);
        sdpHasAudio = respoke.constraintsHasAudio(that.constraints);
    };

    /**
     * Start the stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.start
     * @fires respoke.LocalMedia#start
     * @private
     */
    that.start = function () {
        if (that.state.receiveOnly) {
            throw new Error("Local media started when receiveOnly is set!");
        }

        if (that.temporary) {
            throw new Error("Temporary local media started!");
        }

        try {
            requestMedia();
        } catch (err) {
            clearTimeout(allowTimer);
            /**
             * Indicate there has been an error obtaining media.
             * @event respoke.LocalMedia#error
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             * @property {string} message - a textual description of the error.
             */
            that.fire('error', {reason: err.message});
        }
    };

    return that;
}; // End respoke.LocalMedia
