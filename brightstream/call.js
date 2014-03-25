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
 * @class brightstream.Call
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client - client id
 * @param {boolean} params.initiator - whether or not we initiated the call
 * @param {boolean} params.receiveOnly - whether or not we accept media
 * @param {boolean} params.sendOnly - whether or not we send media
 * @param {boolean} params.forceTurn - If true, delete all 'host' and 'srvflx' candidates and send only 'relay'
 * candidates.
 * @param {brightstream.Endpoint} params.remoteEndpoint
 * @param {string} params.connectionId - The connection ID of the remoteEndpoint.
 * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action between
 * local media becoming available and calling approve().
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalTerminate - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {function} [params.onLocalVideo] - Callback for the developer to receive the local video element.
 * @param {function} [params.onRemoteVideo] - Callback for the developer to receive the remote video element.
 * @param {function} [params.onHangup] - Callback for the developer to be notified about hangup.
 * @param {object} params.callSettings
 * @param {object} [params.localVideoElements]
 * @param {object} [params.remoteVideoElements]
 * @returns {brightstream.Call}
 */
/*global brightstream: false */
brightstream.Call = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Call
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.Call
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Call';
    /**
     * @memberof! brightstream.Call
     * @name id
     * @type {string}
     */
    that.id = brightstream.makeUniqueID().toString();

    if (!that.initiator) {
        /**
         * @memberof! brightstream.Call
         * @name initiator
         * @type {boolean}
         */
        that.initiator = false;
    }

    /**
     * @memberof! brightstream.Call
     * @name defOffer
     * @private
     * @type {Promise}
     */
    var defOffer = Q.defer();
    /**
     * @memberof! brightstream.Call
     * @name defAnswer
     * @private
     * @type {Promise}
     */
    var defAnswer = Q.defer();
    /**
     * @memberof! brightstream.Call
     * @name defApproved
     * @private
     * @type {Promise}
     */
    var defApproved = Q.defer();
    /**
     * @memberof! brightstream.Call
     * @name previewLocalMedia
     * @private
     * @type {function}
     */
    var previewLocalMedia = null;
    /**
     * @memberof! brightstream.Call
     * @name onLocalVideo
     * @private
     * @type {function}
     */
    var onLocalVideo = null;
    /**
     * @memberof! brightstream.Call
     * @name onRemoteVideo
     * @private
     * @type {function}
     */
    var onRemoteVideo = null;
    /**
     * @memberof! brightstream.Call
     * @name onHangup
     * @private
     * @type {function}
     */
    var onHangup = null;
    /**
     * @memberof! brightstream.Call
     * @name sendOnly
     * @private
     * @type {boolean}
     */
    var sendOnly = null;
    /**
     * @memberof! brightstream.Call
     * @name receiveOnly
     * @private
     * @type {boolean}
     */
    var receiveOnly = null;
    /**
     * @memberof! brightstream.Call
     * @name forceTurn
     * @private
     * @type {boolean}
     */
    var forceTurn = null;
    /**
     * @memberof! brightstream.Call
     * @name clientObj
     * @private
     * @type {brightstream.getClient}
     */
    var clientObj = brightstream.getClient(client);
    /**
     * @memberof! brightstream.Call
     * @name localVideoElements
     * @private
     * @type {Array<Video>}
     */
    var localVideoElements = params.localVideoElements || [];
    /**
     * @memberof! brightstream.Call
     * @name remoteVideoElements
     * @private
     * @type {Array<Video>}
     */
    var remoteVideoElements = params.remoteVideoElements || [];
    /**
     * @memberof! brightstream.Call
     * @name videoLocalElement
     * @private
     * @type {Video}
     */
    var videoLocalElement = null;
    /**
     * @memberof! brightstream.Call
     * @name videoRemoteElement
     * @private
     * @type {Video}
     */
    var videoRemoteElement = null;
    /**
     * @memberof! brightstream.Call
     * @name videoIsMuted
     * @private
     * @type {boolean}
     */
    var videoIsMuted = false;
    /**
     * @memberof! brightstream.Call
     * @name audioIsMuted
     * @private
     * @type {boolean}
     */
    var audioIsMuted = false;
    /**
     * @memberof! brightstream.Call
     * @name callSettings
     * @private
     * @type {object}
     */
    var callSettings = params.callSettings;
    /**
     * @memberof! brightstream.Call
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
     * @memberof! brightstream.Call
     * @name ST_STARTED
     * @private
     * @type {number}
     */
    var ST_STARTED = 0;
    /**
     * @memberof! brightstream.Call
     * @name ST_INREVIEW
     * @private
     * @type {number}
     */
    var ST_INREVIEW = 1;
    /**
     * @memberof! brightstream.Call
     * @name ST_APPROVED
     * @private
     * @type {number}
     */
    var ST_APPROVED = 2;
    /**
     * @memberof! brightstream.Call
     * @name ST_OFFERED
     * @private
     * @type {number}
     */
    var ST_OFFERED = 3;
    /**
     * @memberof! brightstream.Call
     * @name ST_ANSWERED
     * @private
     * @type {number}
     */
    var ST_ANSWERED = 4;
    /**
     * @memberof! brightstream.Call
     * @name ST_FLOWING
     * @private
     * @type {number}
     */
    var ST_FLOWING = 5;
    /**
     * @memberof! brightstream.Call
     * @name ST_ENDED
     * @private
     * @type {number}
     */
    var ST_ENDED = 6;
    /**
     * @memberof! brightstream.Call
     * @name ST_MEDIA_ERROR
     * @private
     * @type {number}
     */
    var ST_MEDIA_ERROR = 7;
    /**
     * @memberof! brightstream.Call
     * @name pc
     * @private
     * @type {brightstream.PeerConnection}
     */
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
     * @param {object} params
     * @param {function} [params.onLocalVideo]
     * @param {function} [params.onRemoteVideo]
     * @param {function} [params.onHangup]
     * @param {function} [params.previewLocalMedia]
     * @param {object} [params.callSettings]
     * @param {object} [params.constraints]
     * @param {array} [params.servers]
     * @param {boolean} [params.forceTurn]
     * @param {boolean} [params.receiveOnly]
     * @param {boolean} [params.sendOnly]
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
     * Answer the call and start the process of obtaining media. This method is called automatically on the caller's
     * side. This method must be called on the callee's side to indicate that the endpoint does wish to accept the
     * call. The app will have a later opportunity, by passing a callback named previewLocalMedia, to approve or
     * reject the call based on whether audio and/or video is working and is working at an acceptable level.
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
        /**
         * saveParameters will only be meaningful for the non-initiate,
         * since the library calls this method for the initiate. Developers will use this method to pass in
         * callbacks for the non-initiate.
         */
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
     * Start the process of network and media negotiation. If the app passes in a callback named previewLocalMedia
     * in order to allow the logged-in person a chance to base their decision to continue the call on whether
     * audio and/or video is working correctly,
     * this method must be called on both sides in order to begin the call. If call.approve() is called, the call
     * will progress as expected. If call.reject() is called, the call will be aborted.
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
     * Start the process of listening for a continuous stream of statistics about the flow of audio and/or video.
     * Since we have to wait for both the answer and offer to be available before starting
     * statistics, the library returns a promise for the stats object. The statistics object does not contain the
     * statistics; rather it contains methods of interacting with the actions of obtaining statistics. To obtain
     * the actual statistics one time, use stats.getStats(); use the onStats callback to obtain a continuous
     * stream of statistics every `interval` seconds.  Returns null if stats module is not loaded.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getStats
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [params.onStats] - An optional callback to receive the stats. If no callback is provided,
     * the call's report will contain stats but the developer will not receive them on the client-side.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise<object>|null}
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
     * Return local video element with the logged-in endpoint's audio and/or video streams attached to it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getLocalElement
     * @returns {Video} An HTML5 video element.
     */
    that.getLocalElement = function () {
        return videoLocalElement;
    };

    /**
     * Return remote video element with the remote endpoint's audio and/or video streams attached to it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getRemoteE
     * @returns {Video} An HTML5 video element.
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
     */
    function requestMedia() {
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
         * This event is fired when the remote endpoint's audio and/or video have become available for displaying.
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
     * @param {object} params
     * @param {boolean} params.signal Optional flag to indicate whether to send or suppress sending
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

        clientObj.updateTurnCredentials();
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
         * This event is fired when the call has hung up.
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
     * @private
     * @todo TODO Make this listen to events and be private.
     */
    that.setOffer = function (params) {
        defOffer.resolve(params);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setAnswer
     * @param {object} params
     * @param {RTCSessionDescription} params.sdp - The remote SDP.
     * @param {string} params.connectionId - The connectionId of the endpoint who answered the call.
     * @private
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
     * @private
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
     * @private
     * @todo TODO Make this listen to events and be private.
     */
    that.addRemoteCandidate = pc.addRemoteCandidate;

    /**
     * Get the state of the Call. 0 indicates the call has just been created. 1 indicates the call is waiting for the
     * audio and/or video to be approved. 2 indicates the audio and/or video have been approved. 3 indicates the caller
     * has requested the call. 4 indicates the callee has answered the call and the call is being set up. 5 indicates
     * that audio and/or video is flowing successfully.  6 indicates the call has ended. 7 indicates the call was never
     * successful due to an error setting up the audio and/or video.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getState
     * @returns {number} A number representing the current state of the call.
     */
    that.getState = function () {
        return pc.getState();
    };

    /**
     * If video is muted, unmute. If not muted, mute.
     * @deprecated
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
     * If audio is muted, unmute. If not muted, mute.
     * @deprecated
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
         * This event indicates that local video has been muted.
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
         * This event indicates that local video has been unmuted.
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
         * This event indicates that local audio has been muted.
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
         * This event indicates that local audio has been unmuted.
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
     * @params {object} params
     * @params {string} [params.reason] - An optional reason for a hangup.
     * @private
     */
    that.setBye = function (params) {
        params = params || {};
        pc.report.callStoppedReason = params.reason || "Remote side hung up";
        that.hangup({signal: false});
    };

    return that;
}; // End brightstream.Call
