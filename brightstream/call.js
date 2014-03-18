/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a new Call.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Call
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc WebRTC Call including getUserMedia, path and codec negotation, and call state.
 * @param {string} client - client id
 * @param {boolean} initiator - whether or not we initiated the call
 * @param {boolean} receiveOnly - whether or not we accept media
 * @param {boolean} sendOnly - whether or not we send media
 * @param {boolean} forceTurn - If true, delete all 'host' and 'srvflx' candidates and send only 'relay' candidates.
 * @param {brightstream.Endpoint} remoteEndpoint
 * @param {string} connectionId - The connection ID of the remoteEndpoint.
 * @param {function} [previewLocalMedia] - A function to call if the developer wants to perform an action between
 * local media becoming available and calling approve().
 * @param {function} signalOffer - Signaling action from SignalingChannel.
 * @param {function} signalConnected - Signaling action from SignalingChannel.
 * @param {function} signalAnswer - Signaling action from SignalingChannel.
 * @param {function} signalTerminate - Signaling action from SignalingChannel.
 * @param {function} signalReport - Signaling action from SignalingChannel.
 * @param {function} signalCandidate - Signaling action from SignalingChannel.
 * @param {function} [onLocalVideo] - Callback for the developer to receive the local video element.
 * @param {function} [onRemoteVideo] - Callback for the developer to receive the remote video element.
 * @param {function} [onHangup] - Callback for the developer to be notified about hangup.
 * @param {object} callSettings
 * @param {object} [localVideoElements]
 * @param {object} [remoteVideoElements]
 * @returns {brightstream.Call}
 */
/*global brightstream: false */
brightstream.Call = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.Call';
    that.id = brightstream.makeUniqueID().toString();

    if (!that.initiator) {
        that.initiator = false;
    }

    var defOffer = Q.defer();
    var defAnswer = Q.defer();
    var defApproved = Q.defer();
    var previewLocalMedia = null;
    var onLocalVideo = null;
    var onRemoteVideo = null;
    var onHangup = null;
    var sendOnly = null;
    var receiveOnly = null;
    var forceTurn = null;
    var clientObj = brightstream.getClient(client);
    var localVideoElements = params.localVideoElements || [];
    var remoteVideoElements = params.remoteVideoElements || [];
    var videoLocalElement = null;
    var videoRemoteElement = null;
    var videoIsMuted = false;
    var audioIsMuted = false;
    var callSettings = params.callSettings;

    var mediaOptions = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    var ST_STARTED = 0;
    var ST_INREVIEW = 1;
    var ST_APPROVED = 2;
    var ST_OFFERED = 3;
    var ST_ANSWERED = 4;
    var ST_FLOWING = 5;
    var ST_ENDED = 6;
    var ST_MEDIA_ERROR = 7;

    var pc = brightstream.PeerConnection({
        client: client,
        connectionId: that.connectionId,
        initiator: that.initiator,
        forceTurn: forceTurn,
        callSettings: callSettings,
        pcOptions: {
            optional: [
                { DtlsSrtpKeyAgreement: true },
                { RtpDataChannels: false }
            ]
        },
        offerOptions: null,
        signalOffer: params.signalOffer,
        signalConnected: params.signalConnected,
        signalAnswer: params.signalAnswer,
        signalTerminate: params.signalTerminate,
        signalReport: params.signalReport,
        signalCandidate: params.signalCandidate
    });

    /**
     * If we're not the initiator, we need to listen for approval AND the remote SDP to come in
     * before we can act on the call.
     */
    if (that.initiator !== true) {
        Q.all([defApproved.promise, defOffer.promise]).spread(function (approved, oOffer) {
            if (approved === true && oOffer && oOffer.sdp) {
                pc.processOffer(oOffer.sdp).done(function () {
                    that.state = ST_OFFERED;
                }, function () {
                    that.hangup({signal: !that.initiator});
                });
            }
        }, function (err) {
            log.warn("Call rejected.");
        }).done();
    }

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.Call
     * @method brightstream.Call.saveParameters
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @param {function} [onHangup]
     * @param {function} [previewLocalMedia]
     * @param {object} [callSettings]
     * @param {object} [constraints]
     * @param {array} [servers]
     * @param {boolean} [forceTurn]
     * @param {boolean} [receiveOnly]
     * @param {boolean} [sendOnly]
     * @private
     */
    function saveParameters(params) {
        that.listen('local-stream-received', params.onLocalVideo);
        that.listen('remote-stream-received', params.onRemoteVideo);
        that.listen('hangup', params.onHangup);
        forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : forceTurn;
        receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : receiveOnly;
        sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : sendOnly;
        previewLocalMedia = typeof params.previewLocalMedia === 'function' ?
            params.previewLocalMedia : previewLocalMedia;
        callSettings = params.callSettings || callSettings || {};
        callSettings.servers = params.servers || callSettings.servers;
        callSettings.constraints = params.constraints || callSettings.constraints;
        callSettings.disableTurn = params.disableTurn || callSettings.disableTurn;
        pc.callSettings = callSettings;
        pc.forceTurn = forceTurn;
        pc.receiveOnly = receiveOnly;
        pc.sendOnly = sendOnly;
        pc.listen('stats', function fireStats(evt) {
            /**
             * @event brightstream.Call#stats
             * @type {brightstream.Event}
             * @property {object} stats - an object with stats in it.
             */
            that.fire('stats', {stats: evt.stats});
        }, true);
    }

    /**
     * Must call saveParameters as part of object construction.
     */
    saveParameters(params);

    delete params.signalOffer;
    delete params.signalConnected;
    delete params.signalAnswer;
    delete params.signalTerminate;
    delete params.signalReport;
    delete params.signalCandidate;
    delete params.onRemoteVideo;
    delete params.onLocalVideo;
    delete params.callSettings;

    /**
     * Start the process of obtaining media. saveParameters will only be meaningful for the non-initiate,
     * since the library calls this method for the initiate. Developers will use this method to pass in
     * callbacks for the non-initiate.
     * @memberof! brightstream.Call
     * @method brightstream.Call.answer
     * @fires brightstream.Call#answer
     * @param {object} [params]
     * @param {function} [params.previewLocalMedia]
     * @param {function} [params.onLocalVideo]
     * @param {function} [params.onRemoteVideo]
     * @param {function} [params.onHangup]
     * @param {boolean} [params.disableTurn]
     * @param {boolean} [params.receiveOnly]
     * @param {boolean} [params.sendOnly]
     * @param {object} [params.constraints]
     * @param {array} [params.servers]
     */
    that.answer = function (params) {
        that.state = ST_STARTED;
        params = params || {};
        log.trace('answer');
        saveParameters(params);

        pc.listen('remote-stream-received', onRemoteStreamAdded, true);
        pc.listen('local-stream-received', onRemoteStreamRemoved, true);

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.Call#answer
         */
        that.fire('answer');

        if (receiveOnly !== true) {
            requestMedia();
        } else if (typeof previewLocalMedia !== 'function') {
            that.approve();
        }
    };

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.Call
     * @method brightstream.Call.approve.
     * @fires brightstream.Call#approve
     */
    that.approve = function () {
        if (that.state < ST_APPROVED) {
            that.state = ST_APPROVED;
        }
        log.trace('Call.approve');
        /**
         * @event brightstream.Call#approve
         */
        that.fire('approve');

        if (that.initiator === true) {
            pc.initOffer();
            return;
        } else {
            defApproved.resolve(true);
        }
    };

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onReceiveUserMedia
     * @private
     * @param {RTCMediaStream}
     * @fires brightstream.Call#local-stream-received
     */
    function onReceiveUserMedia(stream) {
        log.debug('User gave permission to use media.');
        log.trace('onReceiveUserMedia');

        // This happens when we get an automatic hangup or reject from the other side.
        if (pc === null) {
            that.hangup({signal: false});
            return;
        }

        pc.addStream(stream);

        for (var i = 0; (i < localVideoElements.length && videoLocalElement === null); i += 1) {
            if (localVideoElements[i].tagName === 'VIDEO' && !localVideoElements[i].used) {
                videoLocalElement = localVideoElements[i];
            }
        }

        if (videoLocalElement === null) {
            videoLocalElement = document.createElement('video');
        }

        // This still needs some work. Using cached streams causes an unused video element to be passed
        // back to the App. This is because we assume at the moment that only one local media video element
        // will be needed. The first one passed back will contain media and the others will fake it. Media
        // will still be sent with every peer connection. Also need to study the use of getLocalElement
        // and the implications of passing back a video element with no media attached.
        if (brightstream.streams[callSettings.constraints]) {
            brightstream.streams[callSettings.constraints].numPc += 1;
            /**
             * @event brightstream.Call#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             */
            that.fire('local-stream-received', {
                element: videoLocalElement
            });
        } else {
            stream.numPc = 1;
            brightstream.streams[callSettings.constraints] = stream;

            stream.id = clientObj.user.getID();
            attachMediaStream(videoLocalElement, stream);
            // We won't want our local video outputting audio.
            videoLocalElement.muted = true;
            videoLocalElement.autoplay = true;
            videoLocalElement.used = true;

            /**
             * @event brightstream.Call#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             */
            that.fire('local-stream-received', {
                element: videoLocalElement
            });
        }

        if (typeof previewLocalMedia === 'function') {
            that.state = ST_INREVIEW;
            previewLocalMedia(videoLocalElement, that);
        } else {
            that.approve();
        }
    }

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object. Returns null if stats module is not loaded.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getStats
     * @returns {Promise<object>|null}
     * @param {number} [interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [onStats] - An optional callback to receive the stats. If no callback is provided,
     * the call's report will contain stats but the developer will not receive them on the client-side.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     */
    function getStats(params) {
        if (pc && pc.getStats) {
            that.listen('stats', params.onStats);
            delete params.onStats;
            return pc.getStats(params);
        }
        return null;
    }
    if (brightstream.MediaStats) {
        that.getStats = getStats;
    }

    /**
     * Return local video element.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getLocalElement
     */
    that.getLocalElement = function () {
        return videoLocalElement;
    };

    /**
     * Return remote video element.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getRemoteElement
     */
    that.getRemoteElement = function () {
        return videoRemoteElement;
    };

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! brightstream.Call
     * @method brightstream.Call.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
     * @param {object} params
     */
    function requestMedia(params) {
        params = params || {};

        log.trace('requestMedia');

        pc.init(callSettings);

        if (brightstream.streams[callSettings.constraints]) {
            log.debug('using old stream');
            onReceiveUserMedia(brightstream.streams[callSettings.constraints]);
            return;
        }

        try {
            log.debug("Running getUserMedia with constraints", callSettings.constraints);
            // TODO set brightstream.streams[callSettings.constraints] = true as a flag that we are already
            // attempting to obtain this media so the race condition where gUM is called twice with
            // the same constraints when calls are placed too quickly together doesn't occur.
            getUserMedia(callSettings.constraints, onReceiveUserMedia, onUserMediaError);
        } catch (e) {
            log.error("Couldn't get user media: " + e.message);
        }
    }

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onUserMediaError
     * @private
     * @param {object}
     */
    function onUserMediaError(p) {
        log.trace('onUserMediaError');
        that.state = ST_MEDIA_ERROR;
        if (p.code === 1) {
            log.warn("Permission denied.");
            pc.report.callStoppedReason = 'Permission denied.';
        } else {
            log.warn(p);
            pc.report.callStoppedReason = p.code;
        }
        that.hangup({signal: !that.initiator});
    }

    /**
     * Listen for the remote side to remove media in the middle of the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteStreamRemoved
     * @private
     * @param {object}
     */
    function onRemoteStreamRemoved(evt) {
        log.trace('pc event: remote stream removed');
    }

    /**
     * Listen for the remote side to add additional media in the middle of the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteStreamAdded
     * @private
     * @param {object}
     * @fires brightstream.Call#remote-stream-received
     */
    function onRemoteStreamAdded(evt) {
        if (that.state < ST_FLOWING) {
            that.state = ST_FLOWING;
        }
        log.debug('received remote media', evt);

        for (var i = 0; (i < remoteVideoElements.length && videoRemoteElement === null); i += 1) {
            if (remoteVideoElements[i].tagName === 'VIDEO' && !remoteVideoElements[i].used) {
                videoRemoteElement = remoteVideoElements[i];
            }
        }

        if (videoRemoteElement === null) {
            videoRemoteElement = document.createElement('video');
        }

        attachMediaStream(videoRemoteElement, evt.stream);
        videoRemoteElement.autoplay = true;
        videoRemoteElement.used = true;
        videoRemoteElement.play();
        /**
         * @event brightstream.Call#remote-stream-received
         * @type {brightstream.Event}
         * @property {Element} element - the HTML5 Video element with the new stream attached.
         */
        that.fire('remote-stream-received', {
            element: videoRemoteElement
        });
    }

    /**
     * Tear down the call, release user media.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.Call
     * @method brightstream.Call.hangup
     * @fires brightstream.Call#hangup
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.hangup = function (params) {
        params = params || {};
        var toHangup = false;

        if (that.state === ST_ENDED) {
            log.trace("Call.hangup got called twice.");
            return;
        }
        that.state = ST_ENDED;

        if (!that.initiator && defApproved.promise.isPending()) {
            defApproved.reject(new Error("Call hung up before approval."));
        }

        clientObj.updateTurnCredentials(); // TODO Move
        log.debug('hanging up');

        if (pc) {
            if (pc.getLocalStreams) {
                pc.getLocalStreams().forEach(function (stream) {
                    stream.numPc -= 1;
                    if (stream.numPc === 0) {
                        stream.stop();
                        delete brightstream.streams[callSettings.constraints];
                    }
                });
            }
            toHangup = pc.close(params);
        }

        /**
         * @event brightstream.Call#hangup
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('hangup', {
            sentSignal: toHangup
        });
        that.ignore();
        pc = null;
    };

    /*
     * Expose hangup as reject for approve/reject workflow.
     * @memberof! brightstream.Call
     * @method brightstream.Call.reject
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.reject = that.hangup;

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! brightstream.Call
     * @method brightstream.Call.isActive
     * @returns {boolean}
     */
    that.isActive = pc.isActive;

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setOffer
     * @param {RTCSessionDescription} sdp - The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setOffer = function (params) {
        defOffer.resolve(params);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setAnswer
     * @param {RTCSessionDescription} sdp - The remote SDP.
     * @param {string} connectionId - The connectionId of the endpoint who answered the call.
     * @todo TODO Make this listen to events and be private.
     */
    that.setAnswer = function (params) {
        if (defAnswer.promise.isFulfilled()) {
            log.debug("Ignoring duplicate answer.");
            return;
        }
        if (that.state < ST_ANSWERED) {
            that.state = ST_ANSWERED;
        }
        pc.setAnswer(params);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setConnected
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setConnected = function (signal) {
        pc.setConnected(signal, function endCall() {
            that.hangup(false);
        });
    };

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addRemoteCandidate
     * @param {RTCIceCandidate} candidate The ICE candidate.
     * @todo TODO Make this listen to events and be private.
     */
    that.addRemoteCandidate = pc.addRemoteCandidate;

    /**
     * Get the state of the Call
     * @memberof! brightstream.Call
     * @method brightstream.Call.getState
     * @returns {string}
     */
    that.getState = function () {
        return pc.getState();
    };

    /**
     * Indicate whether the logged-in User initated the Call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.isInitiator
     * @returns {boolean}
     */
    that.isInitiator = function () {
        return that.initiator;
    };

    /**
     * If video is muted, unmute. If not muted, mute. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.toggleVideo
     */
    that.toggleVideo = function () {
        if (that.isActive()) {
            if (!videoIsMuted) {
                that.muteVideo();
            } else {
                that.unmuteVideo();
            }
        }
    };

    /**
     * If audio is muted, unmute. If not muted, mute. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.toggleAudio
     */
    that.toggleAudio = function () {
        if (that.isActive()) {
            if (!audioIsMuted) {
                that.muteAudio();
            } else {
                that.unmuteAudio();
            }
        }
    };

    /**
     * Mute all local video streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.muteVideo
     * @fires brightstream.Call#video-muted
     */
    that.muteVideo = function () {
        if (videoIsMuted) {
            return;
        }
        pc.getLocalStreams().forEach(function (stream) {
            stream.getVideoTracks().forEach(function (track) {
                track.enabled = false;
            });
        });
        /**
         * @event brightstream.Call#video-muted
         */
        that.fire('video-muted');
        videoIsMuted = true;
    };

    /**
     * Unmute all local video streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.unmuteVideo
     * @fires brightstream.Call#video-unmuted
     */
    that.unmuteVideo = function () {
        if (!videoIsMuted) {
            return;
        }
        pc.getLocalStreams().forEach(function (stream) {
            stream.getVideoTracks().forEach(function (track) {
                track.enabled = true;
            });
        });
        /**
         * @event brightstream.Call#video-unmuted
         */
        that.fire('video-unmuted');
        videoIsMuted = false;
    };

    /**
     * Mute all local audio streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.muteAudio
     * @fires brightstream.Call#audio-muted
     */
    that.muteAudio = function () {
        if (audioIsMuted) {
            return;
        }
        pc.getLocalStreams().forEach(function (stream) {
            stream.getAudioTracks().forEach(function (track) {
                track.enabled = false;
            });
        });
        /**
         * @event brightstream.Call#audio-muted
         */
        that.fire('audio-muted');
        audioIsMuted = true;
    };

    /**
     * Unmute all local audio streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.unmuteAudio
     * @fires brightstream.Call#audio-unmuted
     */
    that.unmuteAudio = function () {
        if (!audioIsMuted) {
            return;
        }
        pc.getLocalStreams().forEach(function (stream) {
            stream.getAudioTracks().forEach(function (track) {
                track.enabled = true;
            });
        });
        /**
         * @event brightstream.Call#audio-unmuted
         */
        that.fire('audio-unmuted');
        audioIsMuted = false;
    };

    /**
     * Save the hangup reason and hang up.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setBye
     * @todo TODO Make this listen to events and be private.
     */
    that.setBye = function (params) {
        params = params || {};
        pc.report.callStoppedReason = params.reason || "Remote side hung up";
        that.hangup({signal: false});
    };

    return that;
}; // End brightstream.Call
