/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * WebRTC Call including getUserMedia, path and codec negotation, and call state.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.LocalMedia
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client - client id
 * @param {object} params.callSettings
 * @returns {brightstream.LocalMedia}
 */
/*global brightstream: false */
brightstream.LocalMedia = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.LocalMedia
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.LocalMedia
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.LocalMedia';
    /**
     * @memberof! brightstream.LocalMedia
     * @name id
     * @type {string}
     */
    that.id = brightstream.makeGUID();

    /**
     * @memberof! brightstream.LocalMedia
     * @name clientObj
     * @private
     * @type {brightstream.getClient}
     */
    var clientObj = brightstream.getClient(client);
    /**
     * @memberof! brightstream.LocalMedia
     * @name videoLocalElement
     * @private
     * @type {Video}
     */
    var videoLocalElement = null;
    /**
     * @memberof! brightstream.LocalMedia
     * @name videoIsMuted
     * @private
     * @type {boolean}
     */
    var videoIsMuted = false;
    /**
     * @memberof! brightstream.LocalMedia
     * @name audioIsMuted
     * @private
     * @type {boolean}
     */
    var audioIsMuted = false;
    /**
     * A timer to make sure we only fire {brightstream.LocalMedia#waiting-for-allow} if the browser doesn't
     * automatically grant permission on behalf of the user. Timer is canceled in onReceiveUserMedia.
     * @memberof! brightstream.LocalMedia
     * @name allowTimer
     * @private
     * @type {number}
     */
    var allowTimer = 0;
    /**
     * @memberof! brightstream.LocalMedia
     * @name callSettings
     * @private
     * @type {object}
     */
    var callSettings = params.callSettings;
    /**
     * @memberof! brightstream.LocalMedia
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
     * @memberof! brightstream.LocalMedia
     * @name pc
     * @private
     * @type {brightstream.PeerConnection}
     */
    var pc = params.pc;
    delete that.pc;
    /**
     * @memberof! brightstream.LocalMedia
     * @name forceTurn
     * @private
     * @type {boolean}
     */
    var forceTurn;
    /**
     * @memberof! brightstream.LocalMedia
     * @name sendOnly
     * @private
     * @type {boolean}
     */
    var sendOnly;
    /**
     * @memberof! brightstream.LocalMedia
     * @name receiveOnly
     * @private
     * @type {boolean}
     */
    var receiveOnly;
    /**
     * @memberof! brightstream.LocalMedia
     * @name stream
     * @private
     * @type {RTCMediaStream}
     */
    var stream;

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.saveParameters
     * @param {object} params
     * @param {brightstream.Call.onHangup} [params.onHangup]
     * @param {object} [params.callSettings]
     * @param {object} [params.constraints]
     * @param {array} [params.servers]
     * @param {boolean} [params.forceTurn]
     * @param {boolean} [params.receiveOnly]
     * @param {boolean} [params.sendOnly]
     * @private
     */
    function saveParameters(params) {
        forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : forceTurn;
        receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : receiveOnly;
        sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : sendOnly;
        callSettings = params.callSettings || callSettings || {};
        callSettings.servers = params.servers || callSettings.servers;
        callSettings.constraints = params.constraints || callSettings.constraints;
        callSettings.disableTurn = params.disableTurn || callSettings.disableTurn;
    }

    /**
     * Must call saveParameters as part of object construction.
     */
    saveParameters(params);

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.onReceiveUserMedia
     * @private
     * @param {RTCMediaStream}
     * @fires brightstream.LocalMedia#stream-received
     */
    function onReceiveUserMedia(theStream) {
        stream = theStream;
        clearTimeout(allowTimer);
        /**
         * The user has approved the request for media. Any UI changes made to remind the user to click Allow
         * should be canceled now.
         * @event brightstream.LocalMedia#allowed
         * @type {brightstream.Event}
         * @property {string} name - the event name.
         * @property {brightstream.LocalMedia} target
         */
        that.fire('allowed');
        log.debug('User gave permission to use media.');
        log.trace('onReceiveUserMedia');

        /**
         * Expose getAudioTracks.
         * @memberof! brightstream.LocalMedia
         * @method brightstream.LocalMedia.getAudioTracks
         */
        that.getAudioTracks = stream.getAudioTracks.bind(stream);

        /**
         * Expose getVideoTracks.
         * @memberof! brightstream.LocalMedia
         * @method brightstream.LocalMedia.getVideoTracks
         */
        that.getVideoTracks = stream.getVideoTracks.bind(stream);

        // This happens when we get an automatic hangup or reject from the other side.
        if (pc === null) {
            that.hangup({signal: false});
            return;
        }

        videoLocalElement = document.createElement('video');

        // This still needs some work. Using cached streams causes an unused video element to be passed
        // back to the App. This is because we assume at the moment that only one local media video element
        // will be needed. The first one passed back will contain media and the others will fake it. Media
        // will still be sent with every peer connection. Also need to study the use of getLocalElement
        // and the implications of passing back a video element with no media attached.
        if (brightstream.streams[that.constraints]) {
            brightstream.streams[that.constraints].numPc += 1;
            /**
             * @event brightstream.LocalMedia#stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {brightstream.LocalMedia} target
             */
            that.fire('stream-received', {
                element: videoLocalElement,
                stream: stream
            });
        } else {
            stream.numPc = 1;
            brightstream.streams[that.constraints] = stream;

            stream.id = clientObj.user.id;
            attachMediaStream(videoLocalElement, stream);
            // We won't want our local video outputting audio.
            videoLocalElement.muted = true;
            videoLocalElement.autoplay = true;
            videoLocalElement.used = true;

            /**
             * @event brightstream.LocalMedia#stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {brightstream.LocalMedia} target
             */
            that.fire('stream-received', {
                element: videoLocalElement,
                stream: stream
            });
        }
    }

    /**
     * Return local video element.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.getElement
     * @returns {Video}
     */
    that.getElement = function () {
        return videoLocalElement;
    };

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.requestMedia
     * @private
     */
    function requestMedia() {
        log.trace('requestMedia');

        that.constraints = callSettings.constraints;

        if (!that.constraints) {
            throw new Error('No constraints.');
        }

        if (brightstream.streams[that.constraints]) {
            log.debug('using old stream');
            onReceiveUserMedia(brightstream.streams[that.constraints]);
            return;
        }

        try {
            log.debug("Running getUserMedia with constraints", that.constraints);
            // TODO set brightstream.streams[that.constraints] = true as a flag that we are already
            // attempting to obtain this media so the race condition where gUM is called twice with
            // the same constraints when calls are placed too quickly together doesn't occur.
            allowTimer = setTimeout(function allowTimer() {
                /**
                 * The browser is asking for permission to access the User's media. This would be an ideal time
                 * to modify the UI of the application so that the user notices the request for permissions
                 * and approves it.
                 * @event brightstream.LocalMedia#waiting-for-allow
                 * @type {brightstream.Event}
                 * @property {string} name - the event name.
                 * @property {brightstream.LocalMedia} target
                 */
                that.fire('waiting-for-allow');
            }, 500);
            getUserMedia(callSettings.constraints, onReceiveUserMedia, onUserMediaError);
        } catch (e) {
            log.error("Couldn't get user media: " + e.message);
        }
    }

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.onUserMediaError
     * @private
     * @param {object}
     */
    function onUserMediaError(p) {
        log.trace('onUserMediaError');
        if (p.code === 1) {
            log.warn("Permission denied.");
            /**
             * Indicate there has been an error obtaining media.
             * @event brightstream.LocalMedia#waiting-for-allow
             * @type {brightstream.Event}
             * @property {string} name - the event name.
             * @property {brightstream.LocalMedia} target
             */
            that.fire('error', {error: 'Permission denied.'});
        } else {
            log.warn(p);
            /**
             * Indicate there has been an error obtaining media.
             * @event brightstream.LocalMedia#waiting-for-allow
             * @type {brightstream.Event}
             * @property {string} name - the event name.
             * @property {brightstream.LocalMedia} target
             */
            that.fire('error', {error: p.code});
        }
    }

    /**
     * Mute local video stream.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.muteVideo
     * @fires brightstream.LocalMedia#video-muted
     */
    that.muteVideo = function () {
        if (videoIsMuted) {
            return;
        }
        stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
         * @event brightstream.LocalMedia#video-muted
         * @property {string} name - the event name.
         * @property {brightstream.LocalMedia} target
         */
        that.fire('video-muted');
        videoIsMuted = true;
    };

    /**
     * Unmute local video stream.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.unmuteVideo
     * @fires brightstream.LocalMedia#video-unmuted
     */
    that.unmuteVideo = function () {
        if (!videoIsMuted) {
            return;
        }
        stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
         * @event brightstream.LocalMedia#video-unmuted
         * @property {string} name - the event name.
         * @property {brightstream.LocalMedia} target
         */
        that.fire('video-unmuted');
        videoIsMuted = false;
    };

    /**
     * Mute local audio stream.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.muteAudio
     * @fires brightstream.LocalMedia#audio-muted
     */
    that.muteAudio = function () {
        if (audioIsMuted) {
            return;
        }
        stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
         * @event brightstream.LocalMedia#audio-muted
         * @property {string} name - the event name.
         * @property {brightstream.LocalMedia} target
         */
        that.fire('audio-muted');
        audioIsMuted = true;
    };

    /**
     * Unmute local audio stream.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.unmuteAudio
     * @fires brightstream.LocalMedia#audio-unmuted
     */
    that.unmuteAudio = function () {
        if (!audioIsMuted) {
            return;
        }
        stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
         * @event brightstream.LocalMedia#audio-unmuted
         * @property {string} name - the event name.
         * @property {brightstream.LocalMedia} target
         */
        that.fire('audio-unmuted');
        audioIsMuted = false;
    };

    /**
     * Stop the stream.
     * @memberof! brightstream.LocalMedia
     * @method brightstream.LocalMedia.stop
     * @fires brightstream.LocalMedia#stop
     */
    that.stop = function () {
        if (stream === null) {
            return;
        }

        stream.numPc -= 1;
        if (stream.numPc === 0) {
            stream.stop();
            delete brightstream.streams[that.constraints];
        }
        stream = null;
        /**
         * @event brightstream.LocalMedia#stop
         * @property {string} name - the event name.
         * @property {brightstream.LocalMedia} target
         */
        that.fire('stop');
    };

    requestMedia();
    return that;
}; // End brightstream.LocalMedia
