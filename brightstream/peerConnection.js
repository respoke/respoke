/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * WebRTC PeerConnection. This class handles all the state and connectivity for Call and DirectConnection.
 * This class cannot be used alone, but is instantiated by and must be given media by either Call, DirectConnection,
 * or the not-yet-implemented ScreenShare.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.PeerConnection
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client - client id
 * @param {boolean} [params.receiveOnly] - whether or not we accept media
 * @param {boolean} [params.sendOnly] - whether or not we send media
 * @param {boolean} [params.forceTurn] - If true, delete all 'host' and 'srvflx' candidates and send only 'relay'
 * candidates.
 * @param {brightstream.Call} params.call
 * @param {string} params.connectionId - The connection ID of the remoteEndpoint.
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalModify - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalHangup - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for the developer to be notified about hangup.
 * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for the developer to receive
 * statistics about the call. This is only used if call.getStats() is called and the stats module is loaded.
 * @param {object} [params.callSettings]
 * @param {object} [params.pcOptions]
 * @param {object} [params.offerOptions]
 * @returns {brightstream.PeerConnection}
 */
/*global brightstream: false */
brightstream.PeerConnection = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.PeerConnection
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.PeerConnection
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.PeerConnection';

    /**
     * Whether or not we will send a 'hangup' signal to the other side during hangup.
     * @memberof! brightstream.PeerConnection
     * @name toSendHangup
     * @type {brightstream.Endpoint}
     */
    var toSendHangup;
    /**
     * @memberof! brightstream.PeerConnection
     * @name state
     * @type {number}
     */
    that.state = -1;

    /**
     * @memberof! brightstream.PeerConnection
     * @private
     * @name pc
     * @type RTCPeerConnection
     * @desc The RTCPeerConnection as provided by the browser API. All internal state, networking functionality, and
     * raw data transfer occurs within the PeerConnection.
     */
    var pc = null;
    /**
     * @memberof! brightstream.PeerConnection
     * @name defSDPOffer
     * @private
     * @type {Promise}
     * @desc Used in the state machine to trigger methods or functions whose execution depends on the reception,
     * handling, or sending of some information.
     */
    var defSDPOffer = Q.defer();
    /**
     * @memberof! brightstream.PeerConnection
     * @name defSDPAnswer
     * @private
     * @type {Promise}
     * @desc Used in the state machine to trigger methods or functions whose execution depends on the reception,
     * handling, or sending of some information.
     */
    var defSDPAnswer = Q.defer();
    /**
     * @memberof! brightstream.PeerConnection
     * @name defApproved
     * @private
     * @type {Promise}
     * @desc Used in the state machine to trigger methods or functions whose execution depends on the reception,
     * handling, or sending of some information.
     */
    var defApproved = Q.defer();
    /**
     * @memberof! brightstream.PeerConnection
     * @name defModify
     * @private
     * @type {Promise}
     * @desc Used in the state machine to trigger methods or functions whose execution depends on the reception,
     * handling, or sending of some information.
     */
    var defModify;
    /**
     * @memberof! brightstream.PeerConnection
     * @name previewLocalMedia
     * @private
     * @type {brightstream.Call.previewLocalMedia}
     * @desc A callback provided by the developer that we'll call after receiving local media and before
     * approve() is called.
     */
    var previewLocalMedia = typeof params.previewLocalMedia === 'function' ?
        params.previewLocalMedia : undefined;
    /**
     * @memberof! brightstream.PeerConnection
     * @name sendOnly
     * @private
     * @type {boolean}
     * @desc A flag indicating we will send media but not receive it.
     */
    var sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : false;
    /**
     * @memberof! brightstream.PeerConnection
     * @name receiveOnly
     * @private
     * @type {boolean}
     * @desc A flag indicating we will receive media but will not send it.
     */
    var receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : false;
    /**
     * @memberof! brightstream.PeerConnection
     * @name forceTurn
     * @private
     * @type {boolean}
     * @desc A flag indicating we will not permit data to flow peer-to-peer.
     */
    var forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : false;
    /**
     * @memberof! brightstream.PeerConnection
     * @name candidateSendingQueue
     * @private
     * @type {array}
     * @desc An array to save candidates between offer and answer so that both parties can process them simultaneously.
     */
    var candidateSendingQueue = [];
    /**
     * @memberof! brightstream.PeerConnection
     * @name candidateReceivingQueue
     * @private
     * @type {array}
     * @desc An array to save candidates between offer and answer so that both parties can process them simultaneously.
     */
    var candidateReceivingQueue = [];
    /**
     * @memberof! brightstream.PeerConnection
     * @name clientObj
     * @private
     * @type {brightstream.Client}
     */
    var clientObj = brightstream.getClient(client);
    /**
     * @memberof! brightstream.PeerConnection
     * @name callSettings
     * @private
     * @type {object}
     * @desc A container for constraints and servers.
     */
    var callSettings = params.callSettings || {};
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalOffer
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalOffer = params.signalOffer;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalConnected
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalConnected = params.signalConnected;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalModify
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalModify = params.signalModify;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalAnswer
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalAnswer = params.signalAnswer;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalHangup
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalHangup = params.signalHangup;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalReport
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalReport = params.signalReport;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalCandidateOrig
     * @private
     * @type {function}
     * @desc A temporary function saved from params in order to construct the candidate signaling function.
     */
    var signalCandidateOrig = params.signalCandidate;
    /**
     * @memberof! brightstream.PeerConnection
     * @name signalCandidate
     * @private
     * @type {function}
     * @desc A signaling function constructed from the one passed to us by the signaling channel with additions
     * to facilitate candidate logging.
     */
    function signalCandidate(params) {
        params.iceCandidates = [params.candidate];
        signalCandidateOrig(params);
        that.report.candidatesSent.push({candidate: params.candidate});
    }

    /**
     * @memberof! brightstream.PeerConnection
     * @name offerOptions
     * @private
     * @type {object}
     */
    var offerOptions = params.offerOptions || null;
    /**
     * @memberof! brightstream.PeerConnection
     * @name pcOptions
     * @private
     * @type {object}
     */
    var pcOptions = params.pcOptions || {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    /**
     * @memberof! brightstream.PeerConnection
     * @name report
     * @type {object}
     */
    that.report = {
        callStarted: 0,
        callStopped: 0,
        sessionId: that.call.id,
        lastSDPString: '',
        sdpsSent: [],
        sdpsReceived: [],
        candidatesSent: [],
        candidatesReceived: [],
        stats: [],
        userAgent: navigator.userAgent,
        os: navigator.platform
    };

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.initOffer
     * @fires brightstream.PeerConnection#initOffer
     */
    that.initOffer = function () {
        log.info('creating offer', offerOptions);
        pc.createOffer(saveOfferAndSend, function errorHandler(p) {
            log.error('createOffer failed');
        }, offerOptions);
    };

    /**
     * Process a remote offer if we are not the caller.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.processOffer
     * @param {RTCSessionDescriptor}
     * @returns {Promise}
     */
    that.processOffer = function (oOffer) {
        log.trace('processOffer', oOffer);
        if (that.call.caller) {
            log.warn('Got offer in precall state.');
            that.report.callStoppedReason = 'Got offer in precall state';
            signalHangup({
                call: that.call
            });
            defSDPOffer.reject();
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
                        defSDPOffer.resolve();
                        processQueues(oSession);
                    }, function errorHandler(err) {
                        err = new Error("Error creating SDP answer." + err.message);
                        that.report.callStoppedReason = err.message;
                        /**
                         * This event is fired on errors that occur during call setup or media negotiation.
                         * @event brightstream.Call#error
                         * @type {brightstream.Event}
                         * @property {string} reason - A human readable description about the error.
                         * @property {brightstream.Call} target
                         * @property {string} name - the event name.
                         */
                        that.call.fire('error', {
                            message: err.message
                        });
                        defSDPOffer.reject(err);
                    });
                }, function errorHandler(err) {
                    err = new Error('Error calling setRemoteDescription on offer I received.' + err.message);
                    that.report.callStoppedReason = err.message;
                    /**
                     * This event is fired on errors that occur during call setup or media negotiation.
                     * @event brightstream.Call#error
                     * @type {brightstream.Event}
                     * @property {string} reason - A human readable description about the error.
                     * @property {brightstream.Call} target
                     * @property {string} name - the event name.
                     */
                    that.call.fire('error', {
                        message: err.message
                    });
                    defSDPOffer.reject(err);
                }
            );
        } catch (err) {
            var newErr = new Error("Exception calling setRemoteDescription on offer I received." + err.message);
            that.report.callStoppedReason = newErr.message;
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event brightstream.Call#error
             * @type {brightstream.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {brightstream.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: newErr.message
            });
            defSDPOffer.reject(newErr);
        }
        return defSDPOffer.promise;
    };

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.getStats
     * @returns {Promise<{brightstream.MediaStatsParser}>}
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires brightstream.PeerConnection#stats
     */
    function getStats(params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        if (!pc) {
            deferred.reject(new Error("Can't get stats, pc is null."));
            return deferred.promise;
        }

        if (brightstream.MediaStats) {
            Q.all([defSDPOffer.promise, defSDPAnswer.promise]).done(function onSuccess() {
                var stats = brightstream.MediaStatsParser({
                    peerConnection: pc,
                    interval: params.interval,
                    onStats: function statsHandler(stats) {
                        /**
                         * @event brightstream.PeerConnection#stats
                         * @type {brightstream.Event}
                         * @property {object} stats - an object with stats in it.
                         * @property {string} name - the event name.
                         * @property {brightstream.PeerConnection}
                         */
                        that.fire('stats', {
                            stats: stats
                        });
                        that.report.stats.push(stats);
                    }
                });
                that.listen('close', function closeHandler(evt) {
                    stats.stopStats();
                }, true);
                deferred.resolve();
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

        log.trace('PC.init');

        if (pc) {
            return;
        }

        that.report.callStarted = new Date().getTime();
        pc = new RTCPeerConnection(callSettings.servers, pcOptions);
        pc.onicecandidate = onIceCandidate;
        pc.onnegotiationneeded = onNegotiationNeeded;
        pc.onaddstream = function onaddstream(evt) {
            /**
             * @event brightstream.PeerConnection#remote-stream-received
             * @type {brightstream.Event}
             * @property {string} name - the event name.
             * @property {brightstream.PeerConnection}
             */
            that.fire('remote-stream-received', {
                stream: evt.stream
            });
        };
        pc.onremovestream = function onremovestream(evt) {
            /**
             * @event brightstream.PeerConnection#remote-stream-removed
             * @type {brightstream.Event}
             * @property {string} name - the event name.
             * @property {brightstream.PeerConnection}
             */
            that.fire('remote-stream-removed', {
                stream: evt.stream
            });
        };
        pc.ondatachannel = function ondatachannel(evt) {
            /**
             * CAUTION: This event is only called for the callee because RTCPeerConnection#ondatachannel
             * is only called for the callee.
             * @event brightstream.PeerConnection#direct-connection
             * @type {brightstream.Event}
             * @property {string} name - the event name.
             * @property {brightstream.PeerConnection}
             */
            that.fire('direct-connection', {
                channel: evt.channel
            });
        };

        /*
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
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event brightstream.Call#error
             * @type {brightstream.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {brightstream.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: "Got local stream in a precall state."
            });
        }
        pc.addStream(stream);
    };

    /**
     * Process a local ICE Candidate
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.onIceCandidate
     * @private
     * @param {RTCIceCandidate}
     */
    function onIceCandidate(oCan) {
        var candidate = oCan.candidate; // {candidate: ..., sdpMLineIndex: ... }
        if (!candidate || !candidate.candidate) {
            return;
        }

        if (forceTurn === true && candidate.candidate.indexOf("typ relay") === -1) {
            return;
        }

        if (that.call.caller && defSDPAnswer.promise.isPending()) {
            candidateSendingQueue.push(candidate);
        } else {
            signalCandidate({
                candidate: candidate,
                call: that.call
            });
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
         * we are the caller. The person receiving the call
         * never has a valid PeerConnection at a time when we don't
         * have one. */
        var can = null;
        for (var i = 0; i < candidateSendingQueue.length; i += 1) {
            signalCandidate({
                candidate: candidateSendingQueue[i],
                call: that.call
            });
        }
        candidateSendingQueue = [];
        for (var i = 0; i < candidateReceivingQueue.length; i += 1) {
            that.addRemoteCandidate({candidate: candidateReceivingQueue[i]});
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
        if (!defSDPOffer.promise.isPending()) {
            return;
        }
        log.debug('setting and sending offer', oSession);
        that.report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'offer';
            signalOffer({
                call: that.call,
                sdp: oSession
            });
            defSDPOffer.resolve(oSession);
        }, function errorHandler(p) {
            var err = new Error('Error calling setLocalDescription on offer I created.');
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event brightstream.Call#error
             * @type {brightstream.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {brightstream.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: err.message
            });
            defSDPOffer.reject(err);
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
        log.debug('setting and sending answer', oSession);
        that.report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'answer';
            signalAnswer({
                sdp: oSession,
                call: that.call
            });
            defSDPAnswer.resolve(oSession);
        }, function errorHandler(p) {
            var err = new Error('Error calling setLocalDescription on answer I created.');
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event brightstream.Call#error
             * @type {brightstream.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {brightstream.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: err.message
            });
            defSDPAnswer.reject();
        });
    }

    /**
     * Tear down the call, release user media.  Send a hangup signal to the remote party if
     * signal is not false and we have not received a hangup signal from the remote party.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.close
     * @fires brightstream.PeerConnection#destoy
     * @param {object} param
     * @param {boolean} [param.signal] - Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side. This is set to false by the library if we're responding to a
     * hangup signal.
     * @fires brightstream.PeerConnection#close
     */
    that.close = function (params) {
        params = params || {};
        if (toSendHangup !== undefined) {
            log.trace("PeerConnection.close got called twice.");
            return;
        }
        toSendHangup = true;

        if (that.call.caller === true) {
            if (defSDPOffer.promise.isPending()) {
                // Never send hangup if we are the caller but we haven't sent any other signal yet.
                toSendHangup = false;
            }
        } else {
            if (defApproved.promise.isPending()) {
                defApproved.reject(new Error("Call hung up before approval."));
            }
        }

        toSendHangup = (typeof params.signal === 'boolean' ? params.signal : toSendHangup);
        if (toSendHangup) {
            log.info('sending hangup');
            signalHangup({
                call: that.call
            });
        }

        that.report.callStopped = new Date().getTime();
        signalReport({
            report: that.report,
            call: that.call
        });

        /**
         * @event brightstream.PeerConnection#close
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'hangup' signal to the other party.
         * @property {string} name - the event name.
         * @property {brightstream.PeerConnection}
         */
        that.fire('close', {
            sentSignal: toSendHangup
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
        return (pc && ['completed', 'connected'].indexOf(pc.iceConnectionState) > -1);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.listenAnswer
     * @param {object} evt
     * @param {object} evt.signal - The signal, including the remote SDP and the connectionId of the endpoint who
     * answered the call.
     * @private
     */
    function listenAnswer(evt) {
        if (!defSDPAnswer.promise.isPending()) {
            log.debug("Ignoring duplicate answer.");
            return;
        }
        defSDPAnswer.promise.done(processQueues, function successHandler() {
            log.error('set remote desc of answer failed', evt.signal.sdp);
            that.report.callStoppedReason = 'setRemoteDescription failed at answer.';
            that.close();
        });
        log.debug('got answer', evt.signal);

        that.report.sdpsReceived.push(evt.signal.sdp);
        that.report.lastSDPString = evt.signal.sdp.sdp;
        signalConnected({
            call: that.call
        });

        pc.setRemoteDescription(
            new RTCSessionDescription(evt.signal.sdp),
            function successHandler() {
                defSDPAnswer.resolve(evt.signal.sdp);
            }, function errorHandler(p) {
                var newErr = new Error("Exception calling setRemoteDescription on answer I received.");
                that.report.callStoppedReason = newErr.message;
                /**
                 * This event is fired on errors that occur during call setup or media negotiation.
                 * @event brightstream.Call#error
                 * @type {brightstream.Event}
                 * @property {string} reason - A human readable description about the error.
                 * @property {brightstream.Call} target
                 * @property {string} name - the event name.
                 */
                that.call.fire('error', {
                    message: newErr.message
                });
                defSDPAnswer.reject();
            }
        );
    }

    /**
     * Figure out who won the call. This necessary to prevent two connections of the same endpoint from thinking
     * they are both on the same call.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.listenConnected
     * @private
     */
    function listenConnected(evt) {
        if (evt.signal.toConnection !== clientObj.user.connectionId) {
            log.verbose("Hanging up because I didn't win the call.");
            that.call.hangup({signal: false});
        }
    }

    /**
     * Send the initiate signal to start the modify process. This method is only called by the caller of the
     * renegotiation.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.startModify
     * @param {object} params
     * @param {object} [params.constraints] - Indicate this is a request for media and what type of media.
     * @param {boolean} [params.directConnection] - Indicate this is a request for a direct connection.
     */
    that.startModify = function (params) {
        defModify = Q.defer();
        defModify.promise.done(function successHandler() {
            // No offer/answer when tearing down direct connection.
            if (params.directConnection !== false) {
                defSDPOffer = Q.defer();
                defApproved = Q.defer();
                defSDPAnswer = Q.defer();
            }
        });
        signalModify({
            action: 'initiate',
            call: that.call,
            constraints: params.constraints,
            directConnection: params.directConnection
        });
    };

    /**
     * Indicate a desire from the other side to renegotiate media.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.listenModify
     * @param {object} evt
     * @param {object} evt.signal
     * @private
     */
    function listenModify(evt) {
        var err;
        log.trace('PC.listenModify', evt.signal);

        if (evt.signal.action === 'accept') {
            that.call.caller = true;
            if (defModify.promise.isPending()) {
                defModify.resolve();
                /**
                 * @event brightstream.PeerConnection#modify-accept
                 * @type {brightstream.Event}
                 * @property {string} name - the event name.
                 * @property {brightstream.PeerConnection}
                 */
                that.fire('modify-accept', {signal: evt.signal});
            }
            return;
        } else if (evt.signal.action === 'reject') {
            if (defModify.promise.isPending()) {
                err = new Error("Remote party cannot negotiate.");
                log.debug(err.message);
                defModify.reject(err);
                /**
                 * @event brightstream.PeerConnection#modify-reject
                 * @type {brightstream.Event}
                 * @property {Error} err
                 * @property {string} name - the event name.
                 * @property {brightstream.PeerConnection}
                 */
                that.fire('modify-reject', {err: err});
            }
            return;
        }

        // This code only gets executed if signal.action === 'initiate'
        if (defModify && defModify.promise.isPending()) {
            // TODO compare signal request ID and accept if we have the higher request ID,
            // reject if we have the lower request ID.
            err = new Error("Got modify in a negotiating state.");
            log.debug(err.message);
            defModify.reject(err);
            /**
             * @event brightstream.PeerConnection#modify-reject
             * @type {brightstream.Event}
             * @property {Error} err
             * @property {string} name - the event name.
             * @property {brightstream.PeerConnection}
             */
            that.fire('modify-reject', {err: err});
            signalModify({
                action: 'reject',
                call: that.call
            });
            return;
        }

        defModify = Q.defer();

        if (defSDPOffer.promise.isPending() || defSDPAnswer.promise.isPending()) {
            err = new Error("Got modify in a precall state.");
            /**
             * @event brightstream.PeerConnection#modify-reject
             * @type {brightstream.Event}
             * @property {Error} err
             * @property {string} name - the event name.
             * @property {brightstream.PeerConnection}
             */
            that.fire('modify-reject', {err: err});
            signalModify({
                action: 'reject',
                call: that.call
            });
            defModify.reject(err);
            return;
        }

        // No offer/answer when tearing down a direct connection.
        if (evt.signal.directConnection !== false) {
            defSDPOffer = Q.defer();
            defApproved = Q.defer();
            defSDPAnswer = Q.defer();
        }

       /**
         * @event brightstream.PeerConnection#modify-accept
         * @type {brightstream.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {brightstream.PeerConnection}
         */
        that.fire('modify-accept', {signal: evt.signal});
        signalModify({
            action: 'accept',
            call: that.call
        });
        that.call.caller = false;
        defModify.resolve();
    }

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.PeerConnection
     * @method brightstream.PeerConnection.addRemoteCandidate
     * @param {object} params
     * @param {RTCIceCandidate} params.candidate
     */
    that.addRemoteCandidate = function (params) {
        params = params || {};
        if (!params.candidate) {
            return;
        }

        if (!params.candidate.hasOwnProperty('sdpMLineIndex')) {
            log.warn("addRemoteCandidate got wrong format!", params, new Error().stack);
            return;
        }
        if (!pc || that.call.caller && defSDPAnswer.promise.isPending()) {
            candidateReceivingQueue.push(params.candidate);
            log.debug('Queueing a candidate.');
            return;
        }
        try {
            pc.addIceCandidate(new RTCIceCandidate(params.candidate));
        } catch (e) {
            log.error("Couldn't add ICE candidate: " + e.message, params.candidate);
            return;
        }
        log.verbose('Got a remote candidate.', params.candidate);
        that.report.candidatesReceived.push(params.candidate);
    };

    that.call.listen('signal-answer', listenAnswer, true);
    that.call.listen('signal-connected', listenConnected, true);
    that.call.listen('signal-modify', listenModify, true);

    return that;
}; // End brightstream.PeerConnection
