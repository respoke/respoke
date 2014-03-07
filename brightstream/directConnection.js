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
 * @class brightstream.DirectConnection
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
 * @param {function} [onStats] - Callback for the developer to receive statistics about the call. This is only used
 * if call.getStats() is called and the stats module is loaded.
 * @param {object} callSettings
 * @param {object} [localVideoElements]
 * @param {object} [remoteVideoElements]
 * @returns {brightstream.DirectConnection}
 */
/*global brightstream: false */
brightstream.DirectConnection = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.DirectConnection';
    that.id = brightstream.makeUniqueID().toString();

    if (!that.initiator) {
        that.initiator = false;
    }

    var pc = null;
    var dataChannel = null;
    var defOffer = Q.defer();
    var defAnswer = Q.defer();
    var defApproved = Q.defer();
    var sendOnly = that.initiator === true;
    var receiveOnly = that.initiator !== true;
    var forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : false;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var mediaStreams = [];
    var clientObj = brightstream.getClient(client);
    var localVideoElements = params.localVideoElements || [];
    var remoteVideoElements = params.remoteVideoElements || [];
    var videoLocalElement = null;
    var videoRemoteElement = null;
    var signalOffer = params.signalOffer;
    var signalConnected = params.signalConnected;
    var signalAnswer = params.signalAnswer;
    var signalTerminate = params.signalTerminate;
    var signalReport = params.signalReport;
    var signalCandidate = function (oCan) {
        params.signalCandidate({
            candidate: oCan,
            connectionId: that.connectionId
        });
        report.candidatesSent.push(oCan);
    };
    var callSettings = params.callSettings;
    var options = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    var report = {
        callStarted: 0,
        callStopped: 0,
        lastSDPString: '',
        sdpsSent: [],
        sdpsReceived: [],
        candidatesSent: [],
        candidatesReceived: [],
        stats: [],
        userAgent: navigator.userAgent,
        os: navigator.platform
    };

    var ST_STARTED = 0;
    var ST_INREVIEW = 1;
    var ST_APPROVED = 2;
    var ST_OFFERED = 3;
    var ST_ANSWERED = 4;
    var ST_FLOWING = 5;
    var ST_ENDED = 6;
    var ST_MEDIA_ERROR = 7;

    /**
     * If we're not the initiator, we need to listen for approval AND the remote SDP to come in
     * before we can act on the call.
     */
    if (that.initiator !== true) {
        callSettings.constraints = {
            audio: false,
            video: false,
            offerToReceiveVideo: false,
            offerToReceiveAudio: true
        };
        Q.all([defApproved.promise, defOffer.promise]).spread(function (approved, oOffer) {
            if (approved === true && oOffer && oOffer.sdp) {
                processOffer(oOffer);
            }
        }, function (err) {
            log.warn("Call rejected.");
        }).done();
    } else {
        callSettings.constraints = {
            audio: true,
            video: false,
            offerToReceiveVideo: false,
            offerToReceiveAudio: false
        };
    }

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.registerListeners
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @param {function} [onHangup]
     * @private
     */
    var registerListeners = function (params) {
        if (typeof params.onLocalVideo === 'function') {
            that.listen('local-stream-received', params.onLocalVideo);
        }

        if (typeof params.onRemoteVideo === 'function') {
            that.listen('remote-stream-received', params.onRemoteVideo);
        }

        if (typeof params.onHangup === 'function') {
            that.listen('hangup', params.onHangup);
        }
    };

    /**
     * Must call registerListeners as part of object construction.
     */
    registerListeners(params);

    /**
     * Start the process of obtaining media. registerListeners will only be meaningful for the non-initiate,
     * since the library calls this method for the initiate. Developers will use this method to pass in
     * callbacks for the non-initiate.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.answer
     * @fires brightstream.DirectConnection#answer
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @param {function} [onHangup]
     * @param {boolean} [forceTurn]
     * @param {boolean} [receiveOnly]
     */
    var answer = that.publicize('answer', function (params) {
        that.state = ST_STARTED;
        params = params || {};
        log.trace('answer');
        registerListeners(params);

        forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : forceTurn;
        receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : receiveOnly;

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.DirectConnection#answer
         */
        that.fire('answer');

        /* Think we don't need this for data channels
        if (receiveOnly !== true) {
            requestMedia(params);
        } else if (typeof previewLocalMedia !== 'function') {
            approve();
        }*/
    });

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.approve.
     * @fires brightstream.DirectConnection#approve
     */
    var approve = that.publicize('approve', function () {
        that.state = ST_APPROVED;
        log.trace('Call.approve');
        /**
         * @event brightstream.DirectConnection#approve
         */
        that.fire('approve');

        if (that.initiator === true) {
            log.info('creating offer');
            pc.createOffer(saveOfferAndSend, function errorHandler(p) {
                log.error('createOffer failed');
            }, null);
            return;
        } else {
            defApproved.resolve(true);
        }
    });

    /**
     * Process a remote offer if we are not the initiator.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.processOffer
     * @private
     * @param {RTCSessionDescriptor}
     */
    var processOffer = function (oOffer) {
        log.trace('processOffer');
        log.debug('processOffer', oOffer);

        try {
            pc.setRemoteDescription(new RTCSessionDescription(oOffer),
                function successHandler() {
                    log.debug('set remote desc of offer succeeded');
                    pc.createAnswer(saveAnswerAndSend, function errorHandler(err) {
                        log.error("Error creating SDP answer.", err);
                        report.callStoppedReason = 'Error creating SDP answer.';
                    });
                }, function errorHandler(err) {
                    log.error('set remote desc of offer failed', err);
                    report.callStoppedReason = 'setLocalDescr failed at offer.';
                    hangup();
                }
            );
            that.state = ST_OFFERED;
        } catch (err) {
            log.error("error processing offer: ", err);
        }
    };

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onReceiveUserMedia
     * @private
     * @param {MediaStream}
     * @fires brightstream.DirectConnection#local-stream-received
     */
    var onReceiveUserMedia = function (stream) {
        log.debug('User gave permission to use media.');
        log.trace('onReceiveUserMedia');

        if (pc === null) {
            log.error("Peer connection is null!");
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
             * @event brightstream.DirectConnection#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             */
            that.fire('local-stream-received', {
                element: videoLocalElement
            });
        } else {
            stream.numPc = 1;
            brightstream.streams[callSettings.constraints] = stream;
            mediaStreams.push(brightstream.MediaStream({
                'stream': stream,
                'isLocal': true
            }));

            stream.id = clientObj.user.getID();
            attachMediaStream(videoLocalElement, stream);
            // We won't want our local video outputting audio.
            videoLocalElement.muted = true;
            videoLocalElement.autoplay = true;
            videoLocalElement.used = true;

            /**
             * @event brightstream.DirectConnection#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             */
            that.fire('local-stream-received', {
                element: videoLocalElement
            });
        }

        approve();
    };

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getStats
     * @returns {Promise<object>}
     * @param {number} [interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [onStats] - An optional callback to receive the stats. If no callback is provided,
     * the call's report will contain stats but the developer will not receive them on the client-side.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     */
    var getStats = function (params) {
        var deferred = brightstream.makeDeferred(null, function (err) {
            log.warn("Couldn't start stats:", err.message);
        });

        if (!pc) {
            deferred.reject(new Error("Can't get stats, pc is null."));
            return deferred.promise;
        }

        if (brightstream.MediaStats) {
            that.listen('stats', params.onStats);
            Q.all([defOffer.promise, defAnswer.promise]).done(function () {
                var stats = brightstream.MediaStats({
                    peerConnection: pc,
                    interval: params.interval,
                    onStats: function (stats) {
                        /**
                         * @event brightstream.DirectConnection#stats
                         * @type {brightstream.Event}
                         * @property {object} stats - an object with stats in it.
                         */
                        that.fire('stats', {
                            stats: stats
                        });
                        report.stats.push(stats);
                    }
                });
                that.listen('hangup', function (evt) {
                    stats.stopStats();
                });
                deferred.resolve(stats);
            }, function (err) {
                log.warn("Call rejected.");
            });
        } else {
            deferred.reject(new Error("Statistics module is not loaded."));
        }
        return deferred.promise;
    };

    if (brightstream.MediaStats) {
        that.publicize('getStats', getStats);
    }

    /**
     * Return local video element.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getLocalElement
     */
    var getLocalElement = that.publicize('getLocalElement', function () {
        return videoLocalElement;
    });

    /**
     * Return remote video element.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getRemoteElement
     */
    var getRemoteElement = that.publicize('getRemoteElement', function () {
        return videoRemoteElement;
    });

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
     * @param {object} callSettings
     */
    var requestMedia = function (finalCallSettings) {
        var now = new Date();
        var toDelete = [];
        var url = '';

        finalCallSettings = finalCallSettings || {};
        if (finalCallSettings.servers) {
            callSettings.servers = finalCallSettings.servers;
        }
        if (finalCallSettings.constraints) {
            callSettings.constraints = finalCallSettings.constraints;
        }

        report.callStarted = now.getTime();
        log.trace('requestMedia');

        try {
            pc = new RTCPeerConnection(callSettings.servers, options);
        } catch (e) {
            /* TURN is not supported, delete them from the array.
             * TODO: Find out when we can remove this workaround
             */
            log.debug("Removing TURN servers.");
            for (var i in callSettings.servers.iceServers) {
                if (callSettings.servers.iceServers.hasOwnProperty(i)) {
                    url = callSettings.servers.iceServers[i].url;
                    if (url.toLowerCase().indexOf('turn') > -1) {
                        toDelete.push(i);
                    }
                }
            }
            toDelete.sort(function sorter(a, b) { return b - a; });
            toDelete.forEach(function deleteByIndex(value, index) {
                callSettings.servers.iceServers.splice(index);
            });
            pc = new RTCPeerConnection(callSettings.servers, options);
        }

        pc.onaddstream = onRemoteStreamAdded;
        pc.onremovestream = onRemoteStreamRemoved;
        pc.onicecandidate = onIceCandidate;
        pc.onnegotiationneeded = onNegotiationNeeded;

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
    };

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onUserMediaError
     * @private
     * @param {object}
     */
    var onUserMediaError = function (p) {
        log.trace('onUserMediaError');
        that.state = ST_MEDIA_ERROR;
        if (p.code === 1) {
            log.warn("Permission denied.");
            report.callStoppedReason = 'Permission denied.';
        } else {
            log.warn(p);
            report.callStoppedReason = p.code;
        }
        hangup({signal: !that.initiator});
    };

    /**
     * Listen for the remote side to remove media in the middle of the call.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onRemoteStreamRemoved
     * @private
     * @param {object}
     */
    var onRemoteStreamRemoved = function (evt) {
        log.trace('pc event: remote stream removed');
    };

    /**
     * Listen for the remote side to add additional media in the middle of the call.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onRemoteStreamAdded
     * @private
     * @param {object}
     * @fires brightstream.DirectConnection#remote-stream-received
     */
    var onRemoteStreamAdded = function (evt) {
        that.state = ST_FLOWING;
        log.trace('received remote media');

        for (var i = 0; (i < remoteVideoElements.length && videoRemoteElement === null); i += 1) {
            if (remoteVideoElements[i].tagName === 'VIDEO' && !remoteVideoElements[i].used) {
                videoRemoteElement = remoteVideoElements[i];
            }
        }

        if (videoRemoteElement === null) {
            videoRemoteElement = document.createElement('video');
        }

        videoRemoteElement.autoplay = true;
        videoRemoteElement.used = true;
        videoRemoteElement.play();
        attachMediaStream(videoRemoteElement, evt.stream);
        /**
         * @event brightstream.DirectConnection#remote-stream-received
         * @type {brightstream.Event}
         * @property {Element} element - the HTML5 Video element with the new stream attached.
         */
        that.fire('remote-stream-received', {
            element: videoRemoteElement
        });

        mediaStreams.push(brightstream.MediaStream({
            'stream': evt.stream,
            'isLocal': false
        }));

        dataChannel = pc.createDataChannel();
        dataChannel.onerror = function (error) {
            console.log("DataChannel error:", error);
        };
        dataChannel.onmessage = function (event) {
            console.log("Got Data Channel Message:", event.data);
        };

        dataChannel.onopen = function () {
            dataChannel.send("Hello World!");
        };

        dataChannel.onclose = function () {
            console.log("The Data Channel is Closed");
        };
    };

    /**
     * Process a local ICE Candidate
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onIceCandidate
     * @private
     * @param {RTCICECandidate}
     */
    var onIceCandidate = function (oCan) {
        if (!oCan.candidate || !oCan.candidate.candidate) {
            return;
        }

        if (forceTurn === true && oCan.candidate.candidate.indexOf("typ relay") === -1) {
            return;
        }

        log.debug("local candidate", oCan.candidate);
        if (that.initiator && that.state < ST_ANSWERED) {
            candidateSendingQueue.push(oCan.candidate);
        } else {
            signalCandidate(oCan.candidate);
        }
    };

    /**
     * Handle renegotiation
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onNegotiationNeeded
     * @private
     */
    var onNegotiationNeeded = function () {
        log.warn("Negotiation needed.");
    };

    /**
     * Process any ICE candidates that we received either from the browser or the other side while
     * we were trying to set up our RTCPeerConnection to handle them.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.processQueues
     * @private
     */
    var processQueues = function () {
        /* We only need to queue (and thus process queues) if
         * we are the initiator. The person receiving the call
         * never has a valid PeerConnection at a time when we don't
         * have one. */
        var can = null;
        for (var i = 0; i < candidateSendingQueue.length; i += 1) {
            signalCandidate(candidateSendingQueue[i]);
        }
        candidateSendingQueue = [];
        for (var i = 0; i < candidateReceivingQueue.length; i += 1) {
            addRemoteCandidate(candidateReceivingQueue[i]);
        }
        candidateReceivingQueue = [];
    };

    /**
     * Save an SDP we've gotten from the browser which will be an offer and send it to the other
     * side.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.saveOfferAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    var saveOfferAndSend = function (oSession) {
        oSession.type = 'offer';
        that.state = ST_OFFERED;
        log.debug('setting and sending offer', oSession);
        report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'offer';
            signalOffer({sdp: oSession});
            defOffer.resolve(oSession);
        }, function errorHandler(p) {
            log.error('setLocalDescription failed');
            log.error(p);
        });
    };

    /**
     * Save our SDP we've gotten from the browser which will be an answer and send it to the
     * other side.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.saveAnswerAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    var saveAnswerAndSend = function (oSession) {
        oSession.type = 'answer';
        that.state = ST_ANSWERED;
        log.debug('setting and sending answer', oSession);
        report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'answer';
            signalAnswer({
                sdp: oSession,
                connectionId: that.connectionId
            });
            defAnswer.resolve(oSession);
        }, function errorHandler(p) {
            log.error('setLocalDescription failed');
            log.error(p);
        });
    };

    /**
     * Handle shutting the session down if the other side hangs up.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onRemoteHangup
     * @private
     */
    var onRemoteHangup = function () {
        if (pc && pc.readyState !== 'active') {
            report.callStoppedReason = report.byeReasonReceived ||
                'Remote side did not confirm media.';
        } else {
            report.callStoppedReason = 'Remote side hung up.';
        }
        log.info('Callee busy or or call rejected:' + report.callStoppedReason);
        hangup({signal: false});
    };

    /**
     * Tear down the call, release user media.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.hangup
     * @fires brightstream.DirectConnection#hangup
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var hangup = that.publicize('hangup', function (params) {
        params = params || {};
        if (that.state === ST_ENDED) {
            log.trace("Call.hangup got called twice.");
            return;
        }
        that.state = ST_ENDED;

        log.trace("at hangup, call state is " + that.state);
        if (that.initiator === true) {
            if (that.state < ST_OFFERED) {
                // Never send bye if we are the initiator but we haven't sent any other signal yet.
                params.signal = false;
            }
        } else {
            if (defApproved.promise.isPending()) {
                defApproved.reject(new Error("Call hung up before approval."));
            }
        }

        clientObj.updateTurnCredentials();
        log.debug('hanging up');

        params.signal = (typeof params.signal === 'boolean' ? params.signal : true);
        if (params.signal) {
            log.info('sending bye');
            signalTerminate({connectionId: that.connectionId});
        }

        report.callStopped = new Date().getTime();
        signalReport({
            report: report,
            connectionId: that.connectionId
        });

        /**
         * @event brightstream.DirectConnection#hangup
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('hangup', {
            sentSignal: params.signal
        });
        that.ignore();

        mediaStreams.forEach(function stopEach(mediaStream) {
            var stream = mediaStream.getStream();
            stream.numPc -= 1;
            if (stream.numPc === 0) {
                stream.stop();
                delete brightstream.streams[callSettings.constraints];
            }
        });

        if (pc) {
            pc.close();
        }

        mediaStreams = [];
        pc = null;
    });

    /*
     * Expose hangup as reject for approve/reject workflow.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.reject
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var reject = that.publicize('reject', hangup);

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.isActive
     * @returns {boolean}
     */
    var isActive = that.publicize('isActive', function () {
        var inProgress = false;

        log.trace('isActive');

        if (!pc || that.state < ST_ENDED) {
            return inProgress;
        }

        inProgress = pc.readyState in ['new', 'active'];
        log.info('readyState is ' + pc.readyState + '. Call is ' +
            (inProgress ? '' : 'not ') + 'in progress.');

        return inProgress;
    });

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setOffer
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    var setOffer = that.publicize('setOffer', function (oOffer) {
        log.debug('got offer', oOffer);

        if (!that.initiator) {
            report.sdpsReceived.push(oOffer);
            report.lastSDPString = oOffer.sdp;
            defOffer.resolve(oOffer);
        } else {
            defOffer.reject(new Error("Received offer in a bad state."));
            log.warn('Got offer in precall state.');
            signalTerminate({connectionId: that.connectionId});
        }
    });

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setAnswer
     * @param {RTCSessionDescription} oSession - The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    var setAnswer = that.publicize('setAnswer', function (oSession) {
        if (defAnswer.promise.isFulfilled()) {
            log.debug("Ignoring duplicate answer.");
            return;
        }

        that.state = ST_ANSWERED;
        log.debug('got answer', oSession);

        report.sdpsReceived.push(oSession);
        report.lastSDPString = oSession.sdp;
        that.connectionId = oSession.connectionId;
        delete oSession.connectionId;
        signalConnected({connectionId: that.connectionId});

        pc.setRemoteDescription(
            new RTCSessionDescription(oSession),
            function successHandler() {
                processQueues();
                defAnswer.resolve(oSession);
            }, function errorHandler(p) {
                log.error('set remote desc of answer failed');
                report.callStoppedReason = 'setRemoteDescription failed at answer.';
                log.error(oSession);
                hangup();
            }
        );
    });

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setConnected
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    var setConnected = that.publicize('setConnected', function (signal) {
        if (signal.connectionId !== clientObj.user.id) {
            that.hangup(false);
        }
    });

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.addRemoteCandidate
     * @param {RTCIceCandidate} oCan The ICE candidate.
     * @todo TODO Make this listen to events and be private.
     */
    var addRemoteCandidate = that.publicize('addRemoteCandidate', function (oCan) {
        if (!oCan || oCan.candidate === null) {
            return;
        }
        if (!oCan.hasOwnProperty('sdpMLineIndex') || !oCan.candidate) {
            log.warn("addRemoteCandidate got wrong format!", oCan);
            return;
        }
        if (that.initiator && that.state < ST_ANSWERED) {
            candidateReceivingQueue.push(oCan);
            log.debug('Queueing a candidate.');
            return;
        }
        try {
            pc.addIceCandidate(new RTCIceCandidate(oCan));
        } catch (e) {
            log.error("Couldn't add ICE candidate: " + e.message, oCan);
            return;
        }
        log.debug('Got a remote candidate.', oCan);
        report.candidatesReceived.push(oCan);
    });

    /**
     * Get the state of the Call
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getState
     * @returns {string}
     */
    var getState = that.publicize('getState', function () {
        return pc ? that.state : "before";
    });

    /**
     * Indicate whether the logged-in User initated the Call.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.isInitiator
     * @returns {boolean}
     */
    var isInitiator = that.publicize('isInitiator', function () {
        return that.initiator;
    });

    /**
     * Save the hangup reason and hang up.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setBye
     * @todo TODO Make this listen to events and be private.
     */
    var setBye = that.publicize('setBye', function (params) {
        params = params || {};
        report.callStoppedReason = params.reason || "Remote side hung up";
        hangup({signal: false});
    });

    return that;
}; // End brightstream.DirectConnection
