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
var Q = require('q');
var respoke = require('./respoke');

/**
 * WebRTC PeerConnection. This class handles all the state and connectivity for Call and DirectConnection.
 * This class cannot be used alone, but is instantiated by and must be given media by either Call, DirectConnection,
 * or the not-yet-implemented ScreenShare.
 * @class respoke.PeerConnection
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId - client id
 * @param {boolean} [params.forceTurn] - If true, delete all 'host' and 'srvflx' candidates and send only 'relay'
 * candidates.
 * @param {boolean} [params.disableTurn] - If true, delete all 'relay' candidates and send only 'host' and 'srvflx'
 * candidates.
 * @param {respoke.Call} params.call
 * @param {string} params.connectionId - The connection ID of the remoteEndpoint.
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalModify - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalHangup - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {respoke.Call.onHangup} [params.onHangup] - Callback for the developer to be notified about hangup.
 * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for the developer to receive
 * statistics about the call. This is only used if call.getStats() is called and the stats module is loaded.
 * @param {object} [params.pcOptions]
 * @param {object} [params.offerOptions]
 * @returns {respoke.PeerConnection}
 */

module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.PeerConnection
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    /**
     * @memberof! respoke.PeerConnection
     * @name className
     * @type {string}
     */
    that.className = 'respoke.PeerConnection';

    /**
     * Whether or not we will send a 'hangup' signal to the other side during hangup.
     * @memberof! respoke.PeerConnection
     * @name toSendHangup
     * @type {respoke.Endpoint}
     */
    var toSendHangup;

    /**
     * @memberof! respoke.PeerConnection
     * @private
     * @name pc
     * @type RTCPeerConnection
     * @desc The RTCPeerConnection as provided by the browser API. All internal state, networking functionality, and
     * raw data transfer occurs within the PeerConnection.
     */
    var pc = null;
    /**
     * @memberof! respoke.PeerConnection
     * @name defModify
     * @private
     * @type {Promise}
     * @desc Used in the state machine to trigger methods or functions whose execution depends on the reception,
     * handling, or sending of some information.
     */
    var defModify;
    /**
     * @memberof! respoke.PeerConnection
     * @name previewLocalMedia
     * @private
     * @type {respoke.Call.previewLocalMedia}
     * @desc A callback provided by the developer that we'll call after receiving local media and before
     * approve() is called.
     */
    var previewLocalMedia = typeof params.previewLocalMedia === 'function' ? params.previewLocalMedia : undefined;
    /**
     * @memberof! respoke.PeerConnection
     * @name candidateSendingQueue
     * @private
     * @type {array}
     * @desc An array to save candidates between offer and answer so that both parties can process them simultaneously.
     */
    var candidateSendingQueue = [];
    /**
     * @memberof! respoke.PeerConnection
     * @name candidateReceivingQueue
     * @private
     * @type {array}
     * @desc An array to save candidates between offer and answer so that both parties can process them simultaneously.
     */
    var candidateReceivingQueue = [];
    /**
     * @memberof! respoke.PeerConnection
     * @name client
     * @private
     * @type {respoke.Client}
     */
    var client = respoke.getClient(instanceId);
    /**
     * @memberof! respoke.PeerConnection
     * @name signalOffer
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalOffer = params.signalOffer;
    /**
     * @memberof! respoke.PeerConnection
     * @name signalConnected
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalConnected = params.signalConnected;
    /**
     * @memberof! respoke.PeerConnection
     * @name signalModify
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalModify = params.signalModify;
    /**
     * @memberof! respoke.PeerConnection
     * @name signalAnswer
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalAnswer = params.signalAnswer;
    /**
     * @memberof! respoke.PeerConnection
     * @name signalHangup
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalHangup = respoke.once(params.signalHangup);
    /**
     * @memberof! respoke.PeerConnection
     * @name signalReport
     * @private
     * @type {function}
     * @desc A signaling function constructed by the signaling channel.
     */
    var signalReport = params.signalReport;
    /**
     * @memberof! respoke.PeerConnection
     * @name signalCandidateOrig
     * @private
     * @type {function}
     * @desc A temporary function saved from params in order to construct the candidate signaling function.
     */
    var signalCandidateOrig = params.signalCandidate;
    /**
     * @memberof! respoke.PeerConnection
     * @name signalCandidate
     * @private
     * @type {function}
     * @desc A signaling function constructed from the one passed to us by the signaling channel with additions
     * to facilitate candidate logging.
     */
    function signalCandidate(params) {
        if (!pc) {
            return;
        }

        params.iceCandidates = [params.candidate];
        signalCandidateOrig(params);
        that.report.candidatesSent.push({candidate: params.candidate});
    }

    /**
     * @memberof! respoke.PeerConnection
     * @name offerOptions
     * @private
     * @type {object}
     */
    var offerOptions = params.offerOptions || null;
    /**
     * @memberof! respoke.PeerConnection
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
     * @memberof! respoke.PeerConnection
     * @name report
     * @type {object}
     */
    that.report = {
        callStarted: 0,
        callStopped: 0,
        callerendpoint: that.call.caller ? client.name : that.call.remoteEndpoint.id,
        callerconnection: that.call.caller ? client.id : that.call.connectionId,
        calleeendpoint: that.call.caller ? that.call.remoteEndpoint.id : client.id,
        calleeconnection: that.call.caller ? that.call.connectionId : client.connectionId,
        sessionId: that.call.id,
        lastSDPString: '',
        sdpsSent: [],
        sdpsReceived: [],
        candidatesSent: [],
        candidatesReceived: [],
        userAgent: navigator.userAgent,
        os: navigator.platform
    };

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.initOffer
     * @fires respoke.PeerConnection#initOffer
     * @private
     */
    function initOffer() {
        if (!pc) {
            return;
        }

        log.info('creating offer', offerOptions);
        pc.createOffer(saveOfferAndSend, function errorHandler(p) {
            log.error('createOffer failed');
        }, offerOptions);
    }

    /**
     * Process a remote offer if we are not the caller. This is necessary because we don't process the offer until
     * the callee has answered the call.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.processOffer
     * @param {RTCSessionDescriptor}
     * @returns {Promise}
     */
    that.processOffer = function (oOffer) {
        if (!pc) {
            return;
        }
        log.debug('processOffer', oOffer);

        that.report.sdpsReceived.push(oOffer);
        that.report.lastSDPString = oOffer.sdp;

        //set flags for audio / video being offered
        that.call.hasAudio = respoke.sdpHasAudio(oOffer.sdp);
        that.call.hasVideo = respoke.sdpHasVideo(oOffer.sdp);
        that.call.hasDataChannel = respoke.sdpHasDataChannel(oOffer.sdp);

        try {
            pc.setRemoteDescription(new RTCSessionDescription(oOffer),
                function successHandler() {
                    if (!pc) {
                        return;
                    }

                    log.debug('set remote desc of offer succeeded');
                    that.call.incomingMedia.setSDP(oOffer); // callee's incoming media
                    pc.createAnswer(function successHandler(oSession) {
                        that.state.processedRemoteSDP = true;
                        that.call.outgoingMedia.setSDP(oSession); // callee's outgoing media
                        saveAnswerAndSend(oSession);
                    }, function errorHandler(err) {
                        err = new Error("Error creating SDP answer." + err.message);
                        that.report.callStoppedReason = err.message;
                        /**
                         * This event is fired on errors that occur during call setup or media negotiation.
                         * @event respoke.Call#error
                         * @type {respoke.Event}
                         * @property {string} reason - A human readable description about the error.
                         * @property {respoke.Call} target
                         * @property {string} name - the event name.
                         */
                        that.call.fire('error', {
                            message: err.message
                        });
                        log.error('create answer failed');
                        that.report.callStoppedReason = 'setRemoteDescription failed at answer.';
                        that.close();
                    });
                }, function errorHandler(err) {
                    err = new Error('Error calling setRemoteDescription on offer I received.' + err.message);
                    that.report.callStoppedReason = err.message;
                    /**
                     * This event is fired on errors that occur during call setup or media negotiation.
                     * @event respoke.Call#error
                     * @type {respoke.Event}
                     * @property {string} reason - A human readable description about the error.
                     * @property {respoke.Call} target
                     * @property {string} name - the event name.
                     */
                    that.call.fire('error', {
                        message: err.message
                    });
                }
            );
        } catch (err) {
            var newErr = new Error("Exception calling setRemoteDescription on offer I received." + err.message);
            that.report.callStoppedReason = newErr.message;
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event respoke.Call#error
             * @type {respoke.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {respoke.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: newErr.message
            });
        }
    };

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.getStats
     * @returns {Promise<{respoke.MediaStatsParser}>|undefined}
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires respoke.PeerConnection#stats
     */
    function getStats(params) {
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        if (!respoke.MediaStats) {
            deferred.reject(new Error("Statistics module is not loaded."));
            return retVal;
        }

        function onConnect() {
            var stats = respoke.MediaStatsParser({
                peerConnection: pc,
                interval: params.interval,
                onStats: function statsHandler(stats) {
                    if (!pc) {
                        return;
                    }

                    /**
                     * @event respoke.PeerConnection#stats
                     * @type {respoke.Event}
                     * @property {object} stats - an object with stats in it.
                     * @property {string} name - the event name.
                     * @property {respoke.PeerConnection}
                     */
                    that.fire('stats', {
                        stats: stats
                    });
                }
            });
            that.listen('close', function closeHandler(evt) {
                stats.stopStats();
            }, true);
            deferred.resolve();
        }

        if (!pc) {
            that.once('stream-received', onConnect);
        } else {
            onConnect();
        }

        return retVal;
    }

    if (respoke.MediaStats) {
        that.getStats = getStats;
    }

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.init
     */
    that.init = function init() {
        log.debug('PC.init');

        if (pc) {
            return;
        }

        that.report.callStarted = new Date().getTime();

        pc = new RTCPeerConnection(that.servers, pcOptions);
        pc.onicecandidate = onIceCandidate;
        pc.onnegotiationneeded = onNegotiationNeeded;
        pc.onaddstream = function onaddstream(evt) {
            /**
             * @event respoke.PeerConnection#connect
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('connect', {
                stream: evt.stream
            });
        };
        pc.onremovestream = function onremovestream(evt) {
            /**
             * @event respoke.PeerConnection#remote-stream-removed
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('remote-stream-removed', {
                stream: evt.stream
            });
        };
        pc.ondatachannel = function ondatachannel(evt) {
            /**
             * CAUTION: This event is only called for the callee because RTCPeerConnection#ondatachannel
             * is only called for the callee.
             * @event respoke.PeerConnection#direct-connection
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('direct-connection', {
                channel: evt.channel
            });
        };

        that.state.listen('offering:entry', function (evt) {
            if (that.state.caller) {
                initOffer();
            }
        });
    };

    /**
     * Return an array of remote media streams.
     * @muremberof! respoke.PeerConnection
     * @method respoke.PeerConnection.getRemoteStreams
     */
    that.getRemoteStreams = function () {
        if (!pc) {
            return [];
        }
        return pc.getRemoteStreams.apply(pc, Array.prototype.slice.call(arguments));
    };

    /**
     * Return an array of local media streams.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.getLocalStreams
     */
    that.getLocalStreams = function () {
        if (!pc) {
            return [];
        }
        return pc.getLocalStreams.apply(pc, Array.prototype.slice.call(arguments));
    };

    /**
     * Create a data channel.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.createDataChannel
     */
    that.createDataChannel = function () {
        if (!pc) {
            return;
        }
        return pc.createDataChannel.apply(pc, Array.prototype.slice.call(arguments));
    };

    /**
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.addStream
     * Expose addStream.
     * @param {RTCMediaStream}
     */
    that.addStream = function (stream) {
        if (!pc) {
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event respoke.Call#error
             * @type {respoke.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {respoke.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: "Got local stream in a precall state."
            });
            return;
        }
        pc.addStream(stream);
    };

    /**
     * Process a local ICE Candidate
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.onIceCandidate
     * @private
     * @param {RTCIceCandidate}
     */
    function onIceCandidate(oCan) {
        var candidate = oCan.candidate; // {candidate: ..., sdpMLineIndex: ... }
        if (!candidate || !candidate.candidate) {
            return;
        }

        if (that.forceTurn === true && candidate.candidate.indexOf("typ relay") === -1) {
            log.debug("Dropping candidate because forceTurn is on.");
            return;
        } else if (that.disableTurn === true && candidate.candidate.indexOf("typ relay") !== -1) {
            log.debug("Dropping candidate because disableTurn is on.");
            return;
        }

        if (!that.state.sentSDP && !that.state.processedRemoteSDP) {
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
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.onNegotiationNeeded
     * @private
     */
    function onNegotiationNeeded() {
        log.warn("Negotiation needed.");
    }

    /**
     * Process any ICE candidates that we received either from the browser or the other side while
     * we were trying to set up our RTCPeerConnection to handle them.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.processQueues
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
            that.addRemoteCandidate({
                candidate: candidateReceivingQueue[i],
                processingQueue: true
            });
        }
        candidateReceivingQueue = [];
    }

    /**
     * Save an SDP we've gotten from the browser which will be an offer and send it to the other
     * side.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.saveOfferAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    function saveOfferAndSend(oSession) {
        oSession.type = 'offer';
        if (!pc) {
            return;
        }
        log.debug('setting and sending offer', oSession);
        that.report.sdpsSent.push(oSession);
        that.call.outgoingMedia.setSDP(oSession); // caller's outgoing media
        that.call.incomingMedia.setSDP(oSession); // caller's incoming media estimate
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'offer';
            signalOffer({
                call: that.call,
                sessionDescription: oSession,
                onSuccess: function () {
                    that.state.sentSDP = true;
                    setTimeout(processQueues);
                },
                onError: function (err) {
                    respoke.log.error('offer could not be sent');
                    that.call.hangup({signal: false});
                }
            });
        }, function errorHandler(p) {
            var err = new Error('Error calling setLocalDescription on offer I created.');
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event respoke.Call#error
             * @type {respoke.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {respoke.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: err.message
            });
        });
    }

    /**
     * Save our SDP we've gotten from the browser which will be an answer and send it to the
     * other side.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.saveAnswerAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    function saveAnswerAndSend(oSession) {
        if (!pc) {
            return;
        }

        if (!that.state.caller) {
            that.report.callerconnection = that.call.connectionId;
        }

        oSession.type = 'answer';
        log.debug('setting and sending answer', oSession);
        that.report.sdpsSent.push(oSession);

        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'answer';
            signalAnswer({
                sessionDescription: oSession,
                call: that.call
            });
            that.state.sentSDP = true;
            processQueues();
        }, function errorHandler(p) {
            var err = new Error('Error calling setLocalDescription on answer I created.');
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event respoke.Call#error
             * @type {respoke.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {respoke.Call} target
             * @property {string} name - the event name.
             */
            that.call.fire('error', {
                message: err.message
            });
        });
    }

    /**
     * Tear down the call, release user media.  Send a hangup signal to the remote party if
     * signal is not false and we have not received a hangup signal from the remote party.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.close
     * @fires respoke.PeerConnection#destoy
     * @param {object} param
     * @param {boolean} [param.signal] - Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side. This is set to false by the library if we're responding to a
     * hangup signal.
     * @fires respoke.PeerConnection#close
     */
    that.close = function (params) {
        params = params || {};
        toSendHangup = true;

        if (that.state.caller === true) {
            if (!that.state.sentSDP) {
                // Never send hangup if we are the caller but we haven't sent any other signal yet.
                toSendHangup = false;
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

        /**
         * @event respoke.PeerConnection#close
         * @type {respoke.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'hangup' signal to the other party.
         * @property {string} name - the event name.
         * @property {respoke.PeerConnection}
         */
        that.fire('close', {
            sentSignal: toSendHangup
        });
        that.ignore();

        if (pc && that.report) {
            pc.close();
        }
        pc = null;

        if (that.call.enableCallDebugReport) {
            signalReport({
                report: that.report
            });
        }
        that.report = null;
    };
    that.close = respoke.once(that.close);

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.isActive
     * @returns {boolean}
     */
    that.isActive = function () {
        return !!(pc && ['completed', 'connected', 'new', 'checking'].indexOf(pc.iceConnectionState) > -1);
    };

    /**
     * Set the estimated media status on incoming and outgoing media.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.listenOffer
     * @param {object} evt
     * @param {object} evt.signal - The signal, including the remote SDP and the connectionId of the endpoint who
     * answered the call.
     * @private
     */
    function listenOffer(evt) {
        that.call.incomingMedia.setSDP(evt.signal.sessionDescription); // callee's incoming media
        that.call.outgoingMedia.setSDP(evt.signal.sessionDescription); // callee's outgoing media estimate
    }

    /**
     * Save the answer and tell the browser about it.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.listenAnswer
     * @param {object} evt
     * @param {object} evt.signal - The signal, including the remote SDP and the connectionId of the endpoint who
     * answered the call.
     * @private
     */
    function listenAnswer(evt) {
        if (!pc) {
            return;
        }
        log.debug('got answer', evt.signal);

        that.report.sdpsReceived.push(evt.signal.sessionDescription);
        that.report.lastSDPString = evt.signal.sessionDescription.sdp;
        //set flags for audio / video for answer
        that.call.hasAudio = respoke.sdpHasAudio(evt.signal.sessionDescription.sdp);
        that.call.hasVideo = respoke.sdpHasVideo(evt.signal.sessionDescription.sdp);
        that.call.hasDataChannel = respoke.sdpHasDataChannel(evt.signal.sessionDescription.sdp);
        if (that.state.caller) {
            that.report.calleeconnection = evt.signal.fromConnection;
        }
        that.call.connectionId = evt.signal.fromConnection;
        // TODO don't signal connected more than once.
        signalConnected({
            call: that.call
        });

        pc.setRemoteDescription(
            new RTCSessionDescription(evt.signal.sessionDescription),
            function successHandler() {
                that.call.incomingMedia.setSDP(evt.signal.sessionDescription); // caller's incoming media
                that.state.dispatch('receiveAnswer');
            }, function errorHandler(p) {
                var newErr = new Error("Exception calling setRemoteDescription on answer I received.");
                that.report.callStoppedReason = newErr.message;
                /**
                 * This event is fired on errors that occur during call setup or media negotiation.
                 * @event respoke.Call#error
                 * @type {respoke.Event}
                 * @property {string} reason - A human readable description about the error.
                 * @property {respoke.Call} target
                 * @property {string} name - the event name.
                 */
                that.call.fire('error', {
                    message: newErr.message
                });
                log.error('set remote desc of answer failed', evt.signal.sessionDescription);
                that.report.callStoppedReason = 'setRemoteDescription failed at answer.';
                that.close();
            }
        );
    }

    /**
     * Figure out who won the call. This necessary to prevent two connections of the same endpoint from thinking
     * they are both on the same call.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.listenConnected
     * @private
     */
    function listenConnected(evt) {
        if (evt.signal.connectionId !== client.connectionId) {
            log.debug("Hanging up because I didn't win the call.", evt.signal, client);
            that.call.hangup({signal: false});
        }
    }

    /**
     * Send the initiate signal to start the modify process. This method is only called by the caller of the
     * renegotiation.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.startModify
     * @param {object} params
     * @param {object} [params.constraints] - Indicate this is a request for media and what type of media.
     * @param {boolean} [params.directConnection] - Indicate this is a request for a direct connection.
     */
    that.startModify = function (params) {
        defModify = Q.defer();
        signalModify({
            action: 'initiate',
            call: that.call,
            constraints: params.constraints,
            directConnection: params.directConnection
        });
    };

    /**
     * Indicate a desire from the other side to renegotiate media.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.listenModify
     * @param {object} evt
     * @param {object} evt.signal
     * @private
     */
    function listenModify(evt) {
        var err;
        log.debug('PC.listenModify', evt.signal);

        if (evt.signal.action === 'accept') {
            if (defModify.promise.isPending()) {
                defModify.resolve();
                /**
                 * @event respoke.PeerConnection#modify-accept
                 * @type {respoke.Event}
                 * @property {string} name - the event name.
                 * @property {respoke.PeerConnection}
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
                 * @event respoke.PeerConnection#modify-reject
                 * @type {respoke.Event}
                 * @property {Error} err
                 * @property {string} name - the event name.
                 * @property {respoke.PeerConnection}
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
             * @event respoke.PeerConnection#modify-reject
             * @type {respoke.Event}
             * @property {Error} err
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('modify-reject', {err: err});
            signalModify({
                action: 'reject',
                call: that.call
            });
            return;
        }

        defModify = Q.defer();

        if (!that.state.sentSDP || that.state.isState('idle')) {
            err = new Error("Got modify in a precall state.");
            /**
             * @event respoke.PeerConnection#modify-reject
             * @type {respoke.Event}
             * @property {Error} err
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('modify-reject', {err: err});
            signalModify({
                action: 'reject',
                call: that.call
            });
            defModify.reject(err);
            return;
        }

       /**
         * @event respoke.PeerConnection#modify-accept
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.PeerConnection}
         */
        that.fire('modify-accept', {signal: evt.signal});
        signalModify({
            action: 'accept',
            call: that.call
        });
        defModify.resolve();
    }

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.addRemoteCandidate
     * @param {object} params
     * @param {RTCIceCandidate} params.candidate
     */
    that.addRemoteCandidate = function (params) {
        params = params || {};

        if (!pc && params.processingQueue) { // we hung up.
            return;
        }

        if (!params.candidate || !params.candidate.hasOwnProperty('sdpMLineIndex')) {
            log.warn("addRemoteCandidate got wrong format!", params);
            return;
        }

        if (!pc) {
            candidateReceivingQueue.push(params.candidate);
            log.debug('Queueing a candidate because pc is null.');
            return;
        }

        if (that.state.sentSDP || that.state.processedRemoteSDP) {
            try {
                pc.addIceCandidate(new RTCIceCandidate(params.candidate));
                log.debug('Got a remote candidate.', params.candidate);
                that.report.candidatesReceived.push(params.candidate);
            } catch (e) {
                log.error("Couldn't add ICE candidate: " + e.message, params.candidate);
                return;
            }
        } else if (!params.processingQueue) {
            candidateReceivingQueue.push(params.candidate);
            log.debug('Queueing a candidate because no offer yet.');
        }
    };

    that.call.listen('signal-offer', listenOffer, true);
    that.call.listen('signal-answer', listenAnswer, true);
    that.call.listen('signal-connected', listenConnected, true);
    that.call.listen('signal-modify', listenModify, true);

    return that;
}; // End respoke.PeerConnection
