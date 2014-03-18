/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a new PeerConnection. This class handles all the state and connectivity for Call and DirectConnection.
 * This class cannot be used alone, but is instantiated by and must be given media by either Call, DirectConnection,
 * or the not-yet-implemented ScreenShare.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.PeerConnection
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc WebRTC PeerConnection path and codec negotation and call state.
 * @param {string} client - client id
 * @param {boolean} initiator - whether or not we initiated the call
 * @param {boolean} receiveOnly - whether or not we accept media
 * @param {boolean} sendOnly - whether or not we send media
 * @param {boolean} forceTurn - If true, delete all 'host' and 'srvflx' candidates and send only 'relay' candidates.
 * @param {brightstream.Endpoint} remoteEndpoint
 * @param {string} connectionId - The connection ID of the remoteEndpoint.
 * @param {function} signalOffer - Signaling action from SignalingChannel.
 * @param {function} signalConnected - Signaling action from SignalingChannel.
 * @param {function} signalAnswer - Signaling action from SignalingChannel.
 * @param {function} signalTerminate - Signaling action from SignalingChannel.
 * @param {function} signalReport - Signaling action from SignalingChannel.
 * @param {function} signalCandidate - Signaling action from SignalingChannel.
 * @param {function} [onHangup] - Callback for the developer to be notified about hangup.
 * @param {function} [onStats] - Callback for the developer to receive statistics about the call. This is only used
 * if call.getStats() is called and the stats module is loaded.
 * @param {object} callSettings
 * @param {object} pcOptions
 * @param {object} offerOptions
 * @returns {brightstream.PeerConnection}
 */
/*global brightstream: false */
brightstream.PeerConnection = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.PeerConnection';

    if (!that.initiator) {
        that.initiator = false;
    }

    var pc = null;
    var defOffer = Q.defer();
    var defAnswer = Q.defer();
    var defApproved = Q.defer();
    var previewLocalMedia = typeof params.previewLocalMedia === 'function' ? params.previewLocalMedia : undefined;
    var sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : false;
    var receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : false;
    var forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : false;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var clientObj = brightstream.getClient(client);
    var callSettings = params.callSettings || {};

    var signalOffer = params.signalOffer;
    var signalConnected = params.signalConnected;
    var signalAnswer = params.signalAnswer;
    var signalTerminate = params.signalTerminate;
    var signalReport = params.signalReport;
    var signalCandidateOrig = params.signalCandidate;
    function signalCandidate(oCan) {
        signalCandidateOrig({
            candidate: oCan,
            connectionId: that.connectionId
        });
        that.report.candidatesSent.push(oCan);
    }

    var offerOptions = params.offerOptions || null;
    var pcOptions = params.pcOptions || {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    that.report = {
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
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.initOffer.
     * @fires brightstream.PeerConnection#initOffer
     */
    that.initOffer = function () {
        log.info('creating offer');
        pc.createOffer(saveOfferAndSend, function errorHandler(p) {
            log.error('createOffer failed');
        }, offerOptions);
    };

    /**
     * Process a remote offer if we are not the initiator.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.processOffer
     * @param {RTCSessionDescriptor}
     * @returns {Promise<undefined>}
     */
    that.processOffer = function (oOffer) {
        log.debug('got offer', oOffer);
        var deferred = brightstream.makeDeferred();

        if (that.initiator) {
            log.warn('Got offer in precall state.');
            that.report.callStoppedReason = 'Got offer in precall state';
            signalTerminate({connectionId: that.connectionId});
            deferred.reject();
            return;
        }
        that.report.sdpsReceived.push(oOffer);
        that.report.lastSDPString = oOffer.sdp;

        try {
            pc.setRemoteDescription(new RTCSessionDescription(oOffer),
                function successHandler() {
                    log.debug('set remote desc of offer succeeded');
                    pc.createAnswer(function successHandler(oSession) {
                        saveAnswerAndSend(oSession);
                        deferred.resolve();
                        processQueues();
                    }, function errorHandler(err) {
                        log.error("Error creating SDP answer.", err);
                        that.report.callStoppedReason = 'Error creating SDP answer.';
                    });
                }, function errorHandler(err) {
                    log.error('set remote desc of offer failed', err);
                    that.report.callStoppedReason = 'setLocalDescr failed at offer.';
                    deferred.reject();
                }
            );
            that.state = ST_OFFERED;
        } catch (err) {
            log.error("error processing offer: ", err);
            that.report.callStoppedReason = 'error processing offer. ' + err.message;
            deferred.reject();
        }
        return deferred.promise;
    };

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.getStats
     * @returns {Promise<object>}
     * @param {number} [interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     */
    function getStats(params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        if (!pc) {
            deferred.reject(new Error("Can't get stats, pc is null."));
            return deferred.promise;
        }

        if (brightstream.MediaStats) {
            Q.all([defOffer.promise, defAnswer.promise]).done(function onSuccess() {
                var stats = brightstream.MediaStats({
                    peerConnection: pc,
                    interval: params.interval,
                    onStats: function (stats) {
                        /**
                         * @event brightstream.PeerConnection#stats
                         * @type {brightstream.Event}
                         * @property {object} stats - an object with stats in it.
                         */
                        that.fire('stats', {
                            stats: stats
                        });
                        that.report.stats.push(stats);
                    }
                });
                that.listen('close', function (evt) {
                    stats.stopStats();
                }, true);
                deferred.resolve(stats);
            }, function onError(err) {
                log.warn("Call rejected.");
            });
        } else {
            deferred.reject(new Error("Statistics module is not loaded."));
        }
        return deferred.promise;
    }

    if (brightstream.MediaStats) {
        that.getStats = getStats;
    }

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.init
     * @param {object} params
     * @param {object} params.constraints
     * @param {array} params.servers
     * @param {boolean} params.disableTurn
     */
    that.init = function init(params) {
        params = params || {};
        callSettings.servers = params.servers || callSettings.servers;
        callSettings.disableTurn = params.disableTurn || callSettings.disableTurn;

        that.report.callStarted = new Date().getTime();
        log.trace('init');

        pc = new RTCPeerConnection(callSettings.servers, pcOptions);
        pc.onicecandidate = onIceCandidate;
        pc.ondatachannel = onNegotiationNeeded;
        pc.onaddstream = function onaddstream(evt) {
            /**
             * @event brightstream.PeerConnection#remote-stream-received
             * @type {MediaStreamEvent}
             */
            that.fire('remote-stream-received', evt);
        };
        pc.onremovestream = function onremovestream(evt) {
            /**
             * @event brightstream.PeerConnection#remote-stream-removed
             * @type {MediaStreamEvent}
             */
            that.fire('remote-stream-removed', evt);
        };
        pc.ondatachannel = function ondatachannel(evt) {
            /**
             * @event brightstream.PeerConnection#datachannel
             * @type {RTCDataChannelEvent}
             */
            that.fire('datachannel', evt);
        };

        /**
         * Expose some methods on the PeerConnection.
         */
        that.getRemoteStreams = pc.getRemoteStreams.bind(pc);
        that.getLocalStreams = pc.getLocalStreams.bind(pc);
        that.createDataChannel = pc.createDataChannel.bind(pc);
    };

    /**
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.addStream
     * Expose addStream.
     * @param {RTCMediaStream}
     */
    that.addStream = function (stream) {
        if (!pc) {
            throw new Error("Got local stream in a precall state.");
        }
        pc.addStream(stream);
    };

    /**
     * Process a local ICE Candidate
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.onIceCandidate
     * @private
     * @param {RTCICECandidate}
     */
    function onIceCandidate(oCan) {
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
    }

    /**
     * Handle renegotiation
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.onNegotiationNeeded
     * @private
     */
    function onNegotiationNeeded() {
        log.warn("Negotiation needed.");
    }

    /**
     * Process any ICE candidates that we received either from the browser or the other side while
     * we were trying to set up our RTCPeerConnection to handle them.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.processQueues
     * @private
     */
    function processQueues() {
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
            that.addRemoteCandidate(candidateReceivingQueue[i]);
        }
        candidateReceivingQueue = [];
    }

    /**
     * Save an SDP we've gotten from the browser which will be an offer and send it to the other
     * side.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.saveOfferAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    function saveOfferAndSend(oSession) {
        oSession.type = 'offer';
        if (that.state < ST_OFFERED) {
            that.state = ST_OFFERED;
        }
        log.debug('setting and sending offer', oSession);
        that.report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'offer';
            signalOffer({sdp: oSession});
            defOffer.resolve(oSession);
        }, function errorHandler(p) {
            defOffer.reject();
            log.error('setLocalDescription failed');
            log.error(p);
        });
    }

    /**
     * Save our SDP we've gotten from the browser which will be an answer and send it to the
     * other side.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.saveAnswerAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    function saveAnswerAndSend(oSession) {
        oSession.type = 'answer';
        if (that.state < ST_ANSWERED) {
            that.state = ST_ANSWERED;
        }
        log.debug('setting and sending answer', oSession);
        that.report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'answer';
            signalAnswer({
                sdp: oSession,
                connectionId: that.connectionId
            });
            defAnswer.resolve(oSession);
        }, function errorHandler(p) {
            defAnswer.reject();
            log.error('setLocalDescription failed');
            log.error(p);
        });
    }

    /**
     * Tear down the call, release user media.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.close
     * @fires brightstream.PeerConnection#destoy
     * @param {boolean} [signal] - Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side. This is set to false by the library if we're responding to a
     * bye signal.
     */
    that.close = function (params) {
        params = params || {};
        if (that.state === ST_ENDED) {
            log.trace("PeerConnection.close got called twice.");
            return;
        }
        that.state = ST_ENDED;

        log.trace("at close, call state is " + that.state);
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

        that.report.callStopped = new Date().getTime();
        signalReport({
            report: that.report,
            connectionId: that.connectionId
        });

        /**
         * @event brightstream.PeerConnection#close
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('close', {
            sentSignal: params.signal
        });
        that.ignore();

        if (pc) {
            pc.close();
        }

        pc = null;
    };

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.isActive
     * @returns {boolean}
     */
    that.isActive = function () {
        return (pc && pc.iceConnectionState === 'connected' && that.state === ST_FLOWING);
    };


    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.setAnswer
     * @param {object} params
     * @param {RTCSessionDescription} params.sdp - The remote SDP.
     * @param {string} params.connectionId - The connectionId of the endpoint who answered the call.
     * @param {function} params.onSuccess
     * @param {function} params.onError
     * @todo TODO Make this listen to events and be private.
     * @returns {Promise<undefined>}
     */
    that.setAnswer = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        if (defAnswer.promise.isFulfilled()) {
            log.debug("Ignoring duplicate answer.");
            return;
        }

        if (that.state < ST_ANSWERED) {
            that.state = ST_ANSWERED;
        }
        log.debug('got answer', params);

        that.report.sdpsReceived.push(params.sdp);
        that.report.lastSDPString = params.sdp.sdp;
        that.connectionId = params.connectionId;
        signalConnected({connectionId: that.connectionId});

        pc.setRemoteDescription(
            new RTCSessionDescription(params.sdp),
            function successHandler() {
                processQueues();
                defAnswer.resolve(params.sdp);
                deferred.resolve();
            }, function errorHandler(p) {
                log.error('set remote desc of answer failed', params.sdp);
                that.report.callStoppedReason = 'setRemoteDescription failed at answer.';
                that.close();
                deferred.reject();
            }
        );
        return deferred.promise;
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.setConnected
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setConnected = function (signal, endCall) {
        if (signal.connectionId !== clientObj.user.id) {
            endCall();
        }
    };

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.addRemoteCandidate
     * @param {RTCIceCandidate} candidate The ICE candidate.
     * @todo TODO Make this listen to events and be private.
     */
    that.addRemoteCandidate = function (params) {
        if (!params || params.candidate === null) {
            return;
        }
        if (!params.candidate.hasOwnProperty('sdpMLineIndex') || !params.candidate) {
            log.warn("addRemoteCandidate got wrong format!", params);
            return;
        }
        if (!pc || that.initiator && that.state < ST_ANSWERED) {
            candidateReceivingQueue.push(params);
            log.debug('Queueing a candidate.');
            return;
        }
        try {
            pc.addIceCandidate(new RTCIceCandidate(params.candidate));
        } catch (e) {
            log.error("Couldn't add ICE candidate: " + e.message, params.candidate);
            return;
        }
        log.debug('Got a remote candidate.', params.candidate);
        that.report.candidatesReceived.push(params.candidate);
    };

    /**
     * Get the state of the Call
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.getState
     * @returns {string}
     */
    that.getState = function () {
        return pc ? that.state : "before";
    };

    /**
     * Indicate whether the logged-in User initated the Call.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.isInitiator
     * @returns {boolean}
     */
    that.isInitiator = function () {
        return that.initiator;
    };

    /**
     * Save the hangup reason and hang up.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.setBye
     * @todo TODO Make this listen to events and be private.
     */
    that.setBye = function (params) {
        params = params || {};
        that.report.callStoppedReason = params.reason || "Remote side hung up";
        that.close({signal: false});
    };

    return that;
}; // End brightstream.PeerConnection
