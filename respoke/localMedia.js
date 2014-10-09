/**
 * Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software.
 * @private
 */

var log = require('loglevel');
var respoke = require('./respoke');

/**
 * WebRTC Call including getUserMedia, path and codec negotation, and call state.
 * @class respoke.LocalMedia
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId - client id
 * @param {object} params.callSettings
 * @param {HTMLVideoElement} params.element - Pass in an optional html video element to have local video attached to it.
 * @returns {respoke.LocalMedia}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.LocalMedia
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    /**
     * @memberof! respoke.LocalMedia
     * @name className
     * @type {string}
     */
    that.className = 'respoke.LocalMedia';
    /**
     * @memberof! respoke.LocalMedia
     * @name id
     * @type {string}
     */
    that.id = respoke.makeGUID();

    /**
     * @memberof! respoke.LocalMedia
     * @name client
     * @private
     * @type {respoke.getClient}
     */
    var client = respoke.getClient(instanceId);
    /**
     * @memberof! respoke.LocalMedia
     * @name element
     * @type {Video}
     */
    that.element = params.element;
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
     * @memberof! respoke.LocalMedia
     * @name videoIsMuted
     * @private
     * @type {boolean}
     */
    var videoIsMuted = false;
    /**
     * @memberof! respoke.LocalMedia
     * @name audioIsMuted
     * @private
     * @type {boolean}
     */
    var audioIsMuted = false;
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
     * @name callSettings
     * @private
     * @type {object}
     */
    var callSettings = params.callSettings || {};
    callSettings.constraints = params.constraints || callSettings.constraints;
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
     * @memberof! respoke.LocalMedia
     * @name pc
     * @private
     * @type {respoke.PeerConnection}
     */
    var pc = params.pc;
    delete that.pc;
    /**
     * @memberof! respoke.LocalMedia
     * @name stream
     * @private
     * @type {RTCMediaStream}
     */
    var stream;

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.onReceiveUserMedia
     * @private
     * @param {RTCMediaStream} theStream
     * @fires respoke.LocalMedia#stream-received
     */
    function onReceiveUserMedia(theStream) {
        stream = theStream;
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

        /**
         * Expose getAudioTracks.
         * @memberof! respoke.LocalMedia
         * @method respoke.LocalMedia.getAudioTracks
         */
        that.getAudioTracks = stream.getAudioTracks.bind(stream);

        /**
         * Expose getVideoTracks.
         * @memberof! respoke.LocalMedia
         * @method respoke.LocalMedia.getVideoTracks
         */
        that.getVideoTracks = stream.getVideoTracks.bind(stream);

        // This happens when we get an automatic hangup or reject from the other side.
        if (pc === null) {
            that.hangup({signal: false});
            return;
        }

        that.element = params.element || that.element || document.createElement('video');

        // This still needs some work. Using cached streams causes an unused video element to be passed
        // back to the App. This is because we assume at the moment that only one local media video element
        // will be needed. The first one passed back will contain media and the others will fake it. Media
        // will still be sent with every peer connection. Also need to study the use of getLocalElement
        // and the implications of passing back a video element with no media attached.
        if (respoke.streams[that.constraints]) {
            respoke.streams[that.constraints].numPc += 1;
            /**
             * @event respoke.LocalMedia#stream-received
             * @type {respoke.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('stream-received', {
                element: that.element,
                stream: stream
            });
        } else {
            stream.numPc = 1;
            respoke.streams[that.constraints] = stream;

            stream.id = client.endpointId;
            attachMediaStream(that.element, stream);
            // We won't want our local video outputting audio.
            that.element.muted = true;
            that.element.autoplay = true;

            /**
             * @event respoke.LocalMedia#stream-received
             * @type {respoke.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('stream-received', {
                element: that.element,
                stream: stream
            });
        }
    }

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.requestMedia
     * @private
     */
    function requestMedia() {
        log.debug('requestMedia');

        that.constraints = callSettings.constraints;

        if (!that.constraints) {
            throw new Error('No constraints.');
        }

        if (respoke.streams[that.constraints]) {
            log.debug('using old stream');
            onReceiveUserMedia(respoke.streams[that.constraints]);
            return;
        }

        try {
            log.debug("Running getUserMedia with constraints", that.constraints);
            // TODO set respoke.streams[that.constraints] = true as a flag that we are already
            // attempting to obtain this media so the race condition where gUM is called twice with
            // the same constraints when calls are placed too quickly together doesn't occur.
            allowTimer = setTimeout(function allowTimer() {
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
            getUserMedia(callSettings.constraints, onReceiveUserMedia, onUserMediaError);
        } catch (e) {
            log.error("Couldn't get user media: " + e.message);
        }
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
             * @event respoke.LocalMedia#requesting-media
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('error', {error: 'Permission denied.'});
        } else {
            log.warn(p);
            /**
             * Indicate there has been an error obtaining media.
             * @event respoke.LocalMedia#requesting-media
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('error', {error: p.code});
        }
    }

    /**
     * Mute local video stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.muteVideo
     * @fires respoke.LocalMedia#mute
     */
    that.muteVideo = function () {
        if (videoIsMuted) {
            return;
        }
        stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
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
        videoIsMuted = true;
    };

    /**
     * Unmute local video stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.unmuteVideo
     * @fires respoke.LocalMedia#mute
     */
    that.unmuteVideo = function () {
        if (!videoIsMuted) {
            return;
        }
        stream.getVideoTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
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
        videoIsMuted = false;
    };

    /**
     * Mute local audio stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.muteAudio
     * @fires respoke.LocalMedia#mute
     */
    that.muteAudio = function () {
        if (audioIsMuted) {
            return;
        }
        stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = false;
        });
        /**
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
        audioIsMuted = true;
    };

    /**
     * Unmute local audio stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.unmuteAudio
     * @fires respoke.LocalMedia#mute
     */
    that.unmuteAudio = function () {
        if (!audioIsMuted) {
            return;
        }
        stream.getAudioTracks().forEach(function eachTrack(track) {
            track.enabled = true;
        });
        /**
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
        audioIsMuted = false;
    };

    /**
     * Stop the stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.stop
     * @fires respoke.LocalMedia#stop
     */
    that.stop = function () {
        if (!stream) {
            return;
        }

        stream.numPc -= 1;
        if (stream.numPc === 0) {
            stream.stop();
            delete respoke.streams[that.constraints];
        }
        stream = null;
        /**
         * @event respoke.LocalMedia#stop
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
         */
        that.fire('stop');
    };

    /**
     * Indicate whether we are sending video.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.hasVideo
     * @return {boolean}
     */
    that.hasVideo = function () {
        if (stream) {
            return (stream.getVideoTracks().length > 0);
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
        if (stream) {
            return (stream.getAudioTracks().length > 0);
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
        return !!stream;
    };

    /**
     * Save and parse the SDP
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.setSDP
     * @param {RTCSessionDescription} oSession
     * @private
     */
    that.setSDP = function (oSession) {
        sdpHasVideo = respoke.sdpHasVideo(oSession.sdp);
        sdpHasAudio = respoke.sdpHasAudio(oSession.sdp);
        sdpHasDataChannel = respoke.sdpHasDataChannel(oSession.sdp);
    };

    /**
     * Parse the constraints
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.setConstraints
     * @param {MediaConstraints} constraints
     * @private
     */
    that.setConstraints = function (constraints) {
        that.constraints = constraints;
        sdpHasVideo = respoke.constraintsHasVideo(constraints);
        sdpHasAudio = respoke.constraintsHasAudio(constraints);
    };

    /**
     * Start the stream.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.start
     * @fires respoke.LocalMedia#start
     * @private
     */
    that.start = function () {
        requestMedia();
    };

    return that;
}; // End respoke.LocalMedia
