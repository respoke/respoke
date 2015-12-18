/*
 * Copyright 2015, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var Q = require('q');
var respoke = require('./respoke');
var log = respoke.log;
var Statechart = require('statechart');

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
     * @name candidateReceivingQueue
     * @private
     * @type {array}
     * @desc An array to save candidates between offer and answer so that both parties can process them simultaneously.
     */
    var candidateReceivingQueue = respoke.queueFactory();
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
    var signalHangup = respoke.callOnce(params.signalHangup);
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
     * The RTCDTMFSender as provided by the browser API.
     * @memberof! respoke.PeerConnection
     * @private
     * @name digitSender
     * @type RTCDigitSender
     */

    var digitSender = null;

    /**
     * A temporary variable to define if we're in the middle of cancelling any tones on a peer connection
     * @memberof! respoke.PeerConnection
     * @private
     * @name cancellingTones
     * @type boolean
     */

    var cancellingTones = false;

    /**
     * @memberof! respoke.PeerConnection
     * @name signalCandidates
     * @private
     * @type {function}
     * @desc A signaling function constructed from the one passed to us by the signaling channel with additions
     * to facilitate candidate logging.
     */

    function signalCandidates(params) {
        if (!pc) {
            return Q.resolve();
        }

        params.call = that.call;
        that.report.candidatesSent = that.report.candidatesSent.concat(params.iceCandidates);

        return signalCandidateOrig(params);
    }
    /**
     * @memberof! respoke.PeerConnection
     * @name sdpExpectedStreamCount
     * @private
     * @type {number}
     */
    that.sdpExpectedStreamCount = 0;

    /**
     * @memberof! respoke.PeerConnection
     * @name offerOptions
     * @private
     * @type {object}
     */
    var offerOptions = params.offerOptions || {};
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

        if (that.state.receiveOnly) {
            makeOptionsReceiveOnly(offerOptions);
        }

        if (that.state.sendOnly) {
            makeOptionsSendOnly(offerOptions);
        }

        log.info('creating offer', offerOptions);

        pc.createOffer(saveOfferAndSend, function errorHandler(p) {
            log.error('createOffer failed');
        }, offerOptions);
    }

    function makeOptionsReceiveOnly(options) {
        if (navigator.webkitGetUserMedia) {
            options.mandatory = {
                OfferToReceiveVideo: true,
                OfferToReceiveAudio: true,
                OfferToSendVideo: false,
                OfferToSendAudio: false
            };
        } else {
            options.offerToReceiveVideo = true;
            options.offerToReceiveAudio = true;
            options.offerToSendVideo = false;
            options.offerToSendAudio = false;
        }
    }

    function makeOptionsSendOnly(options) {
        if (navigator.webkitGetUserMedia) {
            options.mandatory = {
                OfferToSendVideo: true,
                OfferToSendAudio: true,
                OfferToReceiveVideo: false,
                OfferToReceiveAudio: false
            };
        } else {
            options.offerToSendVideo = true;
            options.offerToSendAudio = true;
            options.offerToReceiveVideo = false;
            options.offerToReceiveAudio = false;
        }
    }

    /**
     * @memberof! respoke.PeerConnection
     * @name localCandidates
     * @private
     * @type {array}
     * @desc An array to save local candidates, to retransmit for peers that
     *       don't support trickle ice.
     */
    var localCandidates = [];

    /**
     * @memberof! respoke.PeerConnection
     * @name localCandidatesComplete
     * @private
     * @type {boolean}
     * @desc Whether all the local candidates have been received.
     */
    var localCandidatesComplete = false;

    /**
     * @memberof! respoke.PeerConnection
     * @name localCandidatesSent
     * @private
     * @type {number}
     * @desc The number of local candidates that have been sent to the remote.
     */
    var localCandidatesSent = 0;

    /**
     * @memberof! respoke.PeerConnection
     * @name localCandidatesSent
     * @private
     * @type {Statechart}
     * @desc FSM for managing local ICE candidates.
     */
    var localCandidatesFSM;

    /**
     * @memberof! respoke.PeerConnection
     * @name localCandidatesTimeout
     * @private
     * @type {number}
     * @desc timeoutId for the ice gathering timeout. Fires when no ice candidate
     *  received in a specified period of time, to speed up finalCandidates signal.
     */
    var localCandidatesTimeout;

    /**
     * The number of local candidates that have not yet been sent.
     * @returns {number}
     * @private
     */
    function localCandidatesRemaining() {
        return localCandidates.length - localCandidatesSent;
    }

    /**
     * Throw another local ICE candidate on the pile
     * @param params
     * @param params.candidate ICE candidate
     * @private
     */
    function collectLocalIceCandidate(params) {
        if (params && params.candidate) {
            localCandidates.push(params.candidate);
        }
    }

    /**
     * Send the remaining local candidates that have not yet been sent.
     * @private
     */
    function sendRemainingCandidates(params) {
        var remainingCandidates = localCandidates.slice(localCandidatesSent);
        var signalParams = {iceCandidates: remainingCandidates};

        localCandidatesSent += remainingCandidates.length;

        if (localCandidatesComplete && !(params && params.suppressFinalCandidates)) {
            signalParams.finalCandidates = localCandidates;
        }

        if (!signalParams.iceCandidates.length && !signalParams.finalCandidates) {
            // Nothing to send. Happens if we receive the null "end of ice" ice candidate
            // after we've already sent the finalCandidates signal.
            return;
        }

        signalCandidates(signalParams)
            .finally(function () {
                localCandidatesFSM.dispatch('iceSent');
            }).done();
    }

    localCandidatesFSM = respoke.Class({
        that: Object.create(Statechart),
        initialState: 'buffering',
        states: {
            buffering: {
                localIceCandidate: {action: collectLocalIceCandidate},
                ready: [{
                    guard: function () {
                        return localCandidatesRemaining() === 0 && localCandidatesComplete;
                    },
                    target: 'finished',
                    action: function () {
                        log.error('ice completed without any candidates');
                    }
                }, {
                    guard: function () {
                        return localCandidatesRemaining() === 0 && !localCandidatesComplete;
                    },
                    target: 'waiting'
                }, {
                    guard: function () {
                        return localCandidatesRemaining() !== 0;
                    },
                    target: 'sending',
                    action: sendRemainingCandidates
                }]
            },
            sending: {
                localIceCandidate: {action: collectLocalIceCandidate},
                iceSent: [{
                    guard: function () {
                        return localCandidatesRemaining() === 0 && localCandidatesComplete;
                    },
                    target: 'finished'
                }, {
                    guard: function () {
                        return localCandidatesRemaining() === 0 && !localCandidatesComplete;
                    },
                    target: 'waiting'
                }, {
                    guard: function () {
                        return localCandidatesRemaining() !== 0;
                    },
                    action: sendRemainingCandidates
                }]
            },
            waiting: {
                entry: {
                    action: function () {
                        localCandidatesTimeout = setTimeout(function () {
                            log.debug('ice gathering has timed out. sending final candidate signal.');
                            localCandidatesComplete = true;
                            localCandidatesFSM.dispatch('localIceCandidate');
                        }, 2000);
                    }
                },
                exit: {
                    action: function () {
                        clearTimeout(localCandidatesTimeout);
                    }
                },
                localIceCandidate: {
                    action: function (params) {
                        collectLocalIceCandidate(params);
                        sendRemainingCandidates();
                    },
                    target: 'sending'
                }
            },
            finished: {
                localIceCandidate: {
                    // helps trickleIce-compatible clients
                    action: function (params) {
                        collectLocalIceCandidate(params);
                        sendRemainingCandidates({ suppressFinalCandidates: true });
                    }
                }
            }
        }
    });

    localCandidatesFSM.run();

    /**
     * Process a remote offer if we are not the caller. This is necessary because we don't process the offer until
     * the callee has answered the call.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.processOffer
     * @param {RTCSessionDescriptor}
     * @returns {Promise}
     */
    that.processOffer = function (oOffer) {

        function onSetRemoteDescriptionSuccess() {
            if (!pc) {
                return;
            }

            log.debug('set remote desc of offer succeeded');

            processReceivingQueue();

            pc.createAnswer(function successHandler(oSession) {
                that.state.processedRemoteSDP = true;
                saveAnswerAndSend(oSession);
            }, function errorHandler(err) {
                log.error('create answer failed', err);

                err = new Error("Error creating SDP answer. " + err);
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
                that.report.callStoppedReason = 'setRemoteDescription failed at answer.';
                that.close();
            });
        }

        function onSetRemoteDescriptionInitialError(err) {
            log.debug('Error calling setRemoteDescription on offer I received.', err);

            if (!pc) {
                return;
            }

            /*
             * Attempt to remove the dtls transport protocol from the offer sdp. This has been observed
             * to cause setRemoteDescription failures when Chrome 46+ is placing calls to Chrome <= 41.
             * This is a particularly acute issue when using nw.js 0.12.x or lower.
             */
            var alteredSdp = oOffer.sdp.replace(/UDP\/TLS\/RTP\/SAVPF/g, 'RTP/SAVPF');
            if (oOffer.sdp !== alteredSdp) {
                oOffer.sdp = alteredSdp;
                log.debug('Retrying setRemoteDescription with legacy transport in offer sdp', oOffer);
                pc.setRemoteDescription(new RTCSessionDescription(oOffer),
                    onSetRemoteDescriptionSuccess, onSetRemoteDescriptionFinalError);
                return;
            }

            onSetRemoteDescriptionFinalError(err);
        }

        function onSetRemoteDescriptionFinalError(p) {
            var errorMessage = 'Error calling setRemoteDescription on offer I received.';
            var err = new Error(errorMessage);
            log.error(errorMessage, p);
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

        if (!pc) {
            return;
        }

        log.debug('processOffer', oOffer);

        that.report.sdpsReceived.push(oOffer);
        that.report.lastSDPString = oOffer.sdp;

        //set flags for audio / video being offered
        that.sdpExpectedStreamCount = respoke.sdpStreamCount(oOffer.sdp);
        that.call.hasDataChannel = respoke.sdpHasDataChannel(oOffer.sdp);

        try {
            pc.setRemoteDescription(new RTCSessionDescription(oOffer),
                onSetRemoteDescriptionSuccess, onSetRemoteDescriptionInitialError);
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
                     * This event is fired every 5 seconds by default, configurable by the 'interval' property to
                     * `call.startStats` and reports the current state of media statistics.
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
        pc.oniceconnectionstatechange = onIceConnectionStateChange;
        pc.onaddstream = function onaddstream(evt) {
            /**
             * Indicate the RTCPeerConnection has received remote media.
             * @event respoke.PeerConnection#remote-stream-received
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('remote-stream-received', {
                stream: evt.stream
            });
        };

        pc.onremovestream = function onremovestream(evt) {
            /**
             * Indicate the remote side has stopped sending media.
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
        if (!pc) {
            return;
        }

        // From http://www.w3.org/TR/webrtc/#operation
        // If the intent of the ICE Agent is to notify the script that:
        //  [snip]
        //  * The gathering process is done.
        //    Set connection's ice gathering state to completed and let newCandidate be null.
        if (!candidate || !candidate.candidate) {
            if (pc.iceGatheringState === 'complete') {
                localCandidatesComplete = true;
                localCandidatesFSM.dispatch('localIceCandidate');
            }
            return;
        }

        if (that.forceTurn === true && candidate.candidate.indexOf("typ relay") === -1) {
            log.debug("Dropping candidate because forceTurn is on.");
            return;
        } else if (that.disableTurn === true && candidate.candidate.indexOf("typ relay") !== -1) {
            log.debug("Dropping candidate because disableTurn is on.");
            return;
        }

        localCandidatesFSM.dispatch('localIceCandidate', {candidate: candidate});
    }

    /**
     * Handle ICE state change
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.onIceConnectionStateChange
     * @private
     */
    function onIceConnectionStateChange(evt) {
        if (!pc) {
            return;
        }

        if (pc.iceConnectionState === 'connected') {
            /**
             * Indicate that we've successfully connected to the remote side. This is only helpful for the
             * outgoing connection.
             * @event respoke.PeerConnection#connect
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.PeerConnection}
             */
            that.fire('connect');
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
     * Process any ICE candidates that we received from the other side while we were waiting on the other
     * party's SDP to arrive and be processed.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.processReceivingQueue
     * @private
     */
    function processReceivingQueue() {
        candidateReceivingQueue.trigger(function processIce(can) {
            if (!pc) {
                return;
            }

            pc.addIceCandidate(new RTCIceCandidate(can.candidate), function onSuccess() {
                log.debug((that.state.caller ? 'caller' : 'callee'), 'got a remote candidate.', can.candidate);
                that.report.candidatesReceived.push(can.candidate);
            }, function onError(e) {
                log.error("Couldn't add ICE candidate: " + e.message, can.candidate);
            });
        });
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

        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'offer';
            signalOffer({
                call: that.call,
                sessionDescription: oSession,
                onSuccess: function () {
                    that.state.sentSDP = true;
                    localCandidatesFSM.dispatch('ready');
                },
                onError: function (err) {
                    log.error('offer could not be sent', err);
                    that.call.hangup({signal: false});
                }
            });
        }, function errorHandler(p) {
            var errorMessage = 'Error calling setLocalDescription on offer I created.';
            var err = new Error(errorMessage);
            log.error(errorMessage, p);
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
                call: that.call,
                onSuccess: function () {
                    localCandidatesFSM.dispatch('ready');
                }
            });
            that.state.sentSDP = true;
        }, function errorHandler(p) {
            var errorMessage = 'Error calling setLocalDescription on answer I created.';
            var err = new Error(errorMessage);
            log.error(errorMessage, p);
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
     * Send DTMF tones to the first audio track on the call. This allows interaction with a phone system expecting keys
     * to be pressed on a normal phone, such as when calling a company for customer support and having to "Press 1 for English".
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.sendTones
     * @param {object} params
     * @param {string} params.tones - The tones to send. Can be any combination of the characters '0123456789ABCD#*', or
     *  a ',' (comma) to insert a 2 second pause before sending the next tone.
     * @param {number} [params.duration] - Optional number in milliseconds to indicate how long to play each tone. This
     *  value needs to be between 40 and 6000. Defaults to 100.
     * @param {number} [params.gap] - Optional number in mlliseconds to indicate the gap between playing the tones.
     *  This value needs to be larger than 30. Defaults to 70.
     * @param {respoke.Call.onSuccess} [params.onSuccess] - Callback called when all requested DTMF tones have been played.
     * @param {respoke.Call.onError} [params.onError] - Callback called when an error occurs while playing back the DTMF
     *  tones, or when the request has been cancelled.
     * @fires respoke.PeerConnection#tone-sent
     * @fires respoke.PeerConnection#tone-sending-complete
     * @returns {Promise|null} Returns a promise if no onSuccess nor onError callbacks are specified. Otherwise, returns null.
     */
    that.sendTones = function (params) {
        var deferred = Q.defer();

        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        params = typeof params === 'object' ? params : {};

        params.duration = params.duration || 100;
        params.gap = params.gap || 50;//chrome says minimum is 50 not 30 like the spec

        var err;

        if (!pc) {
            err = new Error('No Peer Connection available');
        }
        if (!params.tones) {
            err = new Error('Unable to send tones as none passed in');
        }

        if (params.duration > 6000 || params.duration < 40) {
            err = new Error('Unable to send tones as duration needs to be between 40 and 6000 milliseconds');
        }

        if (params.gap < 50 ) {
            err = new Error('Unable to send tones as gap needs to be greater than 50 milliseconds');
        }

        if (params.tones && !params.tones.match(/^([A-D0-9,#*])+$/ig)) {
            err = new Error('Unable to send tones as tones passed in were not in correct format');
        }

        if (pc && !pc.createDTMFSender) {
            err = new Error('Unable to send tones in this browser');
        }

        if (err) {
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        if (digitSender) {
            err = new Error('Unable to queue tones on audio track as a digitSender already exists');
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        var audioTracks = that.call.outgoingMedia.getAudioTracks();
        if (!audioTracks || audioTracks.length < 1) {
            err = new Error('Could not send tones "' + params.tones + '". No audio track available.');
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        digitSender = pc.createDTMFSender(audioTracks[0]);

        digitSender.ontonechange = function onToneChange(evt) {
            if (evt.tone !== '') {
                /**
                 * Indicate the RTCPeerConnection has sent a tone.
                 * @event respoke.PeerConnection#tone-sent
                 * @type {respoke.Event}
                 * @property {string} evt.tone
                 * @property {number} evt.duration
                 * @property {number} evt.gap
                 */
                that.call.fire('tone-sent', {
                    tone: evt.tone,
                    duration: digitSender.duration,
                    gap: digitSender.interToneGap
                });
                return;
            }

            /*
             * The tone string is empty, which is how the DTMFSender represents the end
             * of the tone queue. Cleanup our handlers, wrap up the promises, and fire
             * the appropriate events.
             */
            digitSender = null;

            if (cancellingTones) {
                cancellingTones = false;
                deferred.reject(new Error('Tone playback cancelled'));
                return;
            }

            /**
             * Indicate the RTCPeerConnection has finished sending tones, unless they were cancelled.
             * @event respoke.PeerConnection#tone-sending-complete
             * @type {respoke.Event}
             * @property {string} name - the event name.
             */
            deferred.resolve();
            that.call.fire('tone-sending-complete');
        };

        if (!digitSender.canInsertDTMF) {
            err = new Error('Unable to insert tones into audio track');
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        try {
            digitSender.insertDTMF(params.tones, params.duration, params.gap);
        } catch (e) {
            err = new Error('Unable to queue tones on audio track due to an error');
            log.warn(err, params, e);
            deferred.reject(err);
            return retVal;
        }
        log.debug('successfully queued playback of tones', {
            tones: digitSender.toneBuffer,
            duration: digitSender.duration,
            gap: digitSender.interToneGap
        });

        return retVal;
    };

    /**
     * Cancel any tones currently being sent via sendTones.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.cancelTones
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this method only.
     * @fires respoke.PeerConnection#tone-sending-cancelled
     * @returns {Promise|null} Returns a promise if no onSuccess nor onError callbacks are specified. Otherwise, returns null.
     */
    that.cancelTones = function (params) {
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
        var err;

        if (!pc) {
            err = new Error('No Peer Connection available');
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        if (!digitSender) {
            err = new Error('Unable to queue tones on audio track as a digitSender does not exist');
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        if (!digitSender.canInsertDTMF) {
            err = new Error('Unable to cancel playback of tones as cannot change tones on audio track');
            log.warn(err);
            deferred.reject(err);
            return retVal;
        }

        cancellingTones = true;
        var tonesToCancel = digitSender.toneBuffer;

        try {
            digitSender.insertDTMF('');
        } catch (e) {
            err = new Error('Unable to cancel playback of tones');
            log.warn(err, e);
            deferred.reject(err);
            return retVal;
        }

        /**
         * Indicate the RTCPeerConnection has finished cancelling tones.
         * @event respoke.PeerConnection#tone-sending-cancelled
         * @type {respoke.Event}
         * @property {string} name - the event name.
         */
        deferred.resolve();
        that.call.fire('tone-sending-cancelled', {
            cancelledTones: tonesToCancel
        });

        return retVal;
    };

    /**
     * Tear down the call, release user media.  Send a hangup signal to the remote party if
     * signal is not false and we have not received a hangup signal from the remote party.
     * @memberof! respoke.PeerConnection
     * @method respoke.PeerConnection.close
     * @param {object} params
     * @param {boolean} [params.signal] - Optional flag to indicate whether to send or suppress sending
     *  a hangup signal to the remote side. This is set to false by the library if we're responding to a
     *  hangup signal.
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
         * Indicate that the RTCPeerConnection is closed.
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
    that.close = respoke.callOnce(that.close);

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
        that.state.sendOnly = respoke.sdpHasReceiveOnly(evt.signal.sessionDescription.sdp);
        that.sdpExpectedStreamCount = respoke.sdpStreamCount(evt.signal.sessionDescription.sdp);
        that.report.lastSDPString = evt.signal.sessionDescription.sdp;

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
                processReceivingQueue();
                that.state.dispatch('receiveAnswer');
            }, function errorHandler(p) {
                var errorMessage = 'Exception calling setRemoteDescription on answer I received.';
                var newErr = new Error(errorMessage);
                log.error(errorMessage, p);
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
                log.error('set remote desc of answer failed', evt.signal.sessionDescription, p);
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
                 * Indicate that the remote party has accepted our invitation to begin renegotiating media.
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
                 * Indicate that the remote party has rejected our invitation to begin renegotiating media.
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
             * Indicate that the remote party has rejected our invitation to begin renegotiating media.
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
             * Indicate that the remote party has rejected our invitation to begin renegotiating media.
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
         * Indicate that the remote party has accepted our invitation to begin renegotiating media.
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
        if (!pc && (that.state.sentSDP || that.state.receivedSDP)) { // we hung up.
            return;
        }

        if (!params || !params.candidate || !params.candidate.hasOwnProperty('sdpMLineIndex')) {
            log.warn("addRemoteCandidate got wrong format!", params);
            return;
        }

        candidateReceivingQueue.push(params);
    };

    that.call.listen('signal-answer', listenAnswer, true);
    that.call.listen('signal-connected', listenConnected, true);
    that.call.listen('signal-modify', listenModify, true);

    return that;
}; // End respoke.PeerConnection
