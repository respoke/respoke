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
 * @param {HTMLVideoElement} params.videoLocalElement - Pass in an optional html video element to have local video attached to it.
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
     * @name videoLocalElement
     * @private
     * @type {Video}
     */
    var videoLocalElement = params.videoLocalElement || document.createElement('video');
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
    var callSettings = params.callSettings;
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
     * @name forceTurn
     * @private
     * @type {boolean}
     */
    var forceTurn;
    /**
     * @memberof! respoke.LocalMedia
     * @name sendOnly
     * @private
     * @type {boolean}
     */
    var sendOnly;
    /**
     * @memberof! respoke.LocalMedia
     * @name receiveOnly
     * @private
     * @type {boolean}
     */
    var receiveOnly;
    /**
     * @memberof! respoke.LocalMedia
     * @name stream
     * @private
     * @type {RTCMediaStream}
     */
    var stream;
    
    function getStream(theConstraints) {
        for(var i = 0; i < respoke.streams.length; i++) {
            var s = respoke.streams[i];
            if (respoke.isEqual(s.constraints, theConstraints)) {
                return s.stream;
            }
        }
        return null;
    }
    
    function removeStream(theConstraints) {
        var toRemoveIndex;
        for(var i = 0; i < respoke.streams.length; i++) {
            var s = respoke.streams[i];
            if(respoke.isEqual(s.constraints, theConstraints)) {
                toRemoveIndex = i;
                break;
            }
        }
        if (toRemoveIndex) {
            respoke.streams.slice(toRemoveIndex, 1);
        }
    }

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.saveParameters
     * @param {object} params
     * @param {respoke.Call.onHangup} [params.onHangup]
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
        params.videoLocalElement = videoLocalElement;
    }

    /**
     * Must call saveParameters as part of object construction.
     */
    saveParameters(params);

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

        videoLocalElement = params.videoLocalElement || videoLocalElement || document.createElement('video');

        // This still needs some work. Using cached streams causes an unused video element to be passed
        // back to the App. This is because we assume at the moment that only one local media video element
        // will be needed. The first one passed back will contain media and the others will fake it. Media
        // will still be sent with every peer connection. Also need to study the use of getLocalElement
        // and the implications of passing back a video element with no media attached.
        var aStream = getStream(that.constraints);
        if (aStream) {
            aStream.numPc += 1;
            /**
             * @event respoke.LocalMedia#stream-received
             * @type {respoke.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('stream-received', {
                element: videoLocalElement,
                stream: stream
            });
        } else {
            stream.numPc = 1;
            respoke.streams.push({stream: stream, constraints: that.constraints});
            
            stream.id = client.endpointId;
            attachMediaStream(videoLocalElement, stream);
            // We won't want our local video outputting audio.
            videoLocalElement.muted = true;
            videoLocalElement.autoplay = true;
            videoLocalElement.used = true;

            /**
             * @event respoke.LocalMedia#stream-received
             * @type {respoke.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             * @property {RTCMediaStream} stream - the HTML5 Video stream
             * @property {string} name - the event name.
             * @property {respoke.LocalMedia} target
             */
            that.fire('stream-received', {
                element: videoLocalElement,
                stream: stream
            });
        }
    }

    /**
     * Return local video element.
     * @memberof! respoke.LocalMedia
     * @method respoke.LocalMedia.getElement
     * @returns {Video}
     */
    that.getElement = function () {
        return videoLocalElement;
    };

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
        var theStream = getStream(that.constraints);
        if (theStream) {
            log.debug('using old stream');
            onReceiveUserMedia(theStream);
            return;
        }

        try {
            log.debug("Running getUserMedia with constraints", that.constraints);
            // TODO set getStream(that.constraints) = true as a flag that we are already
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
        if (stream === null) {
            return;
        }

        stream.numPc -= 1;
        if (stream.numPc === 0) {
            stream.stop();
            removeStream(that.constraints);
        }
        stream = null;
        /**
         * @event respoke.LocalMedia#stop
         * @property {string} name - the event name.
         * @property {respoke.LocalMedia} target
         */
        that.fire('stop');
    };

    // give devs a chance to attach listeners before kicking of media retrieval.
    setTimeout(requestMedia);
    return that;
}; // End respoke.LocalMedia
