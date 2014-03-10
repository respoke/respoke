/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a new direct connection via RTCDataChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.DirectConnection
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc WebRTC Call including getUserMedia, path and codec negotation, and connection state.
 * @param {string} client - client id
 * @param {boolean} initiator - whether or not we initiated the connection
 * @param {boolean} forceTurn - If true, delete all 'host' and 'srvflx' candidates and send only 'relay' candidates.
 * @param {brightstream.Endpoint} remoteEndpoint
 * @param {string} connectionId - The connection ID of the remoteEndpoint.
 * @param {function} signalOffer - Signaling action from SignalingChannel.
 * @param {function} signalConnected - Signaling action from SignalingChannel.
 * @param {function} signalAnswer - Signaling action from SignalingChannel.
 * @param {function} signalTerminate - Signaling action from SignalingChannel.
 * @param {function} signalReport - Signaling action from SignalingChannel.
 * @param {function} signalCandidate - Signaling action from SignalingChannel.
 * @param {function} [onClose] - Callback for the developer to be notified about closing the connection.
 * @param {function} [onOpen] - Callback for the developer to be notified about opening the connection.
 * @param {function} [onMessage] - Callback for the developer to be notified about incoming messages. Not usually
 * necessary to listen to this event if you are already listening to brightstream.Endpoint#message
 * @param {function} [onStats] - Callback for the developer to receive statistics about the connection.
 * This is only used if connection.getStats() is called and the stats module is loaded.
 * @param {object} connectionSettings
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
    var forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : false;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var clientObj = brightstream.getClient(client);
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
    var connectionSettings = params.connectionSettings;
    connectionSettings.constraints = {
        audio: true,
        video: false
    };

    var options = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    var report = {
        connectionStarted: 0,
        connectionStopped: 0,
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
     * before we can act on the peerconnection.
     */
    if (that.initiator !== true) {
        Q.all([defApproved.promise, defOffer.promise]).spread(function (approved, oOffer) {
            if (approved === true && oOffer && oOffer.sdp) {
                processOffer(oOffer);
            }
        }, function (err) {
            log.warn("Call rejected.");
        }).done();
    }

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.registerListeners
     * @param {function} [onOpen]
     * @param {function} [onClose]
     * @param {function} [onMessage]
     * @private
     */
    var registerListeners = function (params) {
        if (typeof params.onOpen === 'function') {
            that.listen('open', params.onOpen);
        }

        if (typeof params.onClose === 'function') {
            that.listen('close', params.onClose);
        }

        if (typeof params.onMessage === 'function') {
            that.listen('close', params.onMessage);
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
     * @param {function} [onOpen]
     * @param {function} [onClose]
     * @param {function} [onMessage]
     * @param {boolean} [forceTurn]
     */
    var answer = that.publicize('answer', function (params) {
        that.state = ST_STARTED;
        params = params || {};
        log.trace('answer');
        registerListeners(params);

        forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : forceTurn;

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.DirectConnection#answer
         * @type {brighstream.Event}
         */
        that.fire('answer');
        requestMedia(params);
        createDataChannel();
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
        defApproved.resolve(true);

        if (that.initiator === true) {
            log.info('creating offer');
            pc.createOffer(saveOfferAndSend, function errorHandler(p) {
                log.error('createOffer failed');
            }, {
                mandatory: {
                    OfferToReceiveAudio: true,
                    OfferToReceiveVideo: true
                }
            });
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
                        report.connectionStoppedReason = 'Error creating SDP answer.';
                    });
                }, function errorHandler(err) {
                    log.error('set remote desc of offer failed', err);
                    report.connectionStoppedReason = 'setLocalDescr failed at offer.';
                    close();
                }
            );
            that.state = ST_OFFERED;
        } catch (err) {
            log.error("error processing offer: ", err);
        }
    };

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getStats
     * @returns {Promise<object>}
     * @param {number} [interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [onStats] - An optional callback to receive the stats. If no callback is provided,
     * the connection's report will contain stats but the developer will not receive them on the client-side.
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
                that.listen('close', function (evt) {
                    stats.stopStats();
                });
                deferred.resolve(stats);
            }, function (err) {
                log.warn("DirectConnection rejected.");
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
     * Detect datachannel errors for internal state.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onDataChannelError
     */
    function onDataChannelError(error) {
        close();
    }

    /**
     * Receive and route messages to the Endpoint.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onDataChannelMessage
     * @param {MessageEvent}
     * @fires brightstream.DirectConnection#message
     */
    function onDataChannelMessage(evt) {
        var message;
        try {
            message = JSON.parse(evt.data);
        } catch (e) {
            message = evt.data;
        }
        /**
         * @event brightstream.Endpoint#message
         * @type {brightstream.Event}
         * @property {object} message
         * @property {brightstream.DirectConnection) directConnection
         */
        that.remoteEndpoint.fire('message', {
            message: message,
            directConnection: that
        });
        /**
         * @event brightstream.DirectConnection#message
         * @type {brightstream.Event}
         * @property {object} message
         * @property {brightstream.Endpoint} endpoint
         */
        that.fire('message', {
            message: message,
            endpoint: that.remoteEndpoint
        });
    }

    /**
     * Detect when the channel is open.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onDataChannelMessage
     * @param {MessageEvent}
     * @fires brightstream.DirectConnection#open
     */
    function onDataChannelOpen(evt) {
        if (!evt) {
            throw new Error("DataChannel.onopen got no event or channel");
        }
        dataChannel = evt.target || evt.channel;
        /**
         * @event brightstream.DirectConnection#open
         * @type {brightstream.Event}
         */
        that.fire('open');
    }

    /**
     * Detect when the channel is closed.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onDataChannelClose
     * @param {MessageEvent}
     * @fires brightstream.DirectConnection#close
     */
    function onDataChannelClose() {
        /**
         * @event brightstream.DirectConnection#close
         * @type {brightstream.Event}
         */
        that.fire('close');
    }

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * For the non-initiator, set up all the handlers we'll need to keep track of the
     * datachannel's state and to receive messages.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
     * @param {object} connectionSettings
     */
    var requestMedia = function (finalConnectionSettings) {
        var now = new Date();
        var toDelete = [];
        var url = '';

        finalConnectionSettings = finalConnectionSettings || {};
        if (finalConnectionSettings.servers) {
            connectionSettings.servers = finalConnectionSettings.servers;
        }

        report.connectionStarted = now.getTime();
        log.trace('requestMedia');

        try {
            pc = new RTCPeerConnection(connectionSettings.servers, options);
        } catch (e) {
            /* TURN is not supported, delete them from the array.
             * TODO: Find out when we can remove this workaround
             */
            log.debug("Removing TURN servers.");
            for (var i in connectionSettings.servers.iceServers) {
                if (connectionSettings.servers.iceServers.hasOwnProperty(i)) {
                    url = connectionSettings.servers.iceServers[i].url;
                    if (url.toLowerCase().indexOf('turn') > -1) {
                        toDelete.push(i);
                    }
                }
            }
            toDelete.sort(function sorter(a, b) { return b - a; });
            toDelete.forEach(function deleteByIndex(value, index) {
                connectionSettings.servers.iceServers.splice(index);
            });
            pc = new RTCPeerConnection(connectionSettings.servers, options);
        }

        pc.onicecandidate = onIceCandidate;
        pc.onnegotiationneeded = onNegotiationNeeded;
        pc.ondatachannel = function (evt) {
            if (evt && evt.channel) {
                dataChannel = evt.channel;
                dataChannel.onError = onDataChannelError;
                dataChannel.onmessage = onDataChannelMessage;
                dataChannel.onopen = onDataChannelOpen;
                dataChannel.onclose = onDataChannelClose;
            }
        };
    };

    /**
     * Create the datachannel. For the initiator, set up all the handlers we'll need to keep track of the
     * datachannel's state and to receive messages.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.createDataChannel
     * @private
     * @param [channel] RTCDataChannel
     */
    function createDataChannel(channel) {
        dataChannel = pc.createDataChannel("brightstreamDataChannel");
        dataChannel.binaryType = 'arraybuffer';

        dataChannel.onError = onDataChannelError;
        dataChannel.onmessage = onDataChannelMessage;
        dataChannel.onopen = onDataChannelOpen;
        dataChannel.onclose = onDataChannelClose;
        approve();
    }

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
         * we are the initiator. The person receiving the connection
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
            report.connectionStoppedReason = report.byeReasonReceived ||
                'Remote side did not confirm media.';
        } else {
            report.connectionStoppedReason = 'Remote side hung up.';
        }
        log.info('Non-initiate busy or connection rejected:' + report.connectionStoppedReason);
        close({signal: false});
    };

    /**
     * Tear down the connection.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.close
     * @fires brightstream.DirectConnection#close
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var close = that.publicize('close', function (params) {
        params = params || {};
        if (that.state === ST_ENDED) {
            log.trace("DirectConnection.close got called twice.");
            return;
        }
        that.state = ST_ENDED;

        log.trace("at close, connection state is " + that.state);
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

        report.connectionStopped = new Date().getTime();
        signalReport({
            report: report,
            connectionId: that.connectionId
        });

        /**
         * @event brightstream.DirectConnection#close
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
    });

    /*
     * Send a message over the datachannel in the form of a JSON-encoded plain old JavaScript object.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.send
     * @param {string|object} message - The message to send.
     */
    var send = that.publicize('send', function (params) {
        if (dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                message: params.message
            }));
        } else {
            log.error("dataChannel not in an open state.");
        }
    });

    /*
     * Expose close as reject for approve/reject workflow.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.reject
     * @param {boolean} signal - Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var reject = that.publicize('reject', close);

    /**
     * Indicate whether a datachannel is being setup or is in progress.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.isActive
     * @returns {boolean}
     */
    var isActive = that.publicize('isActive', function () {
        log.trace('isActive');

        if (!pc || that.state < ST_ENDED) {
            return false;
        }

        return dataChannel.readyState === 'open';
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
            log.warn('Got offer in pre-connection state.');
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
                report.connectionStoppedReason = 'setRemoteDescription failed at answer.';
                log.error(oSession);
                close();
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
            close(false);
        }
    });

    /**
     * Save the candidate. If we initiated the connection, place the candidate into the queue so
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
     * Save the close reason and hang up.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setBye
     * @todo TODO Make this listen to events and be private.
     */
    var setBye = that.publicize('setBye', function (params) {
        params = params || {};
        report.connectionStoppedReason = params.reason || "Remote side hung up";
        close({signal: false});
    });

    return that;
}; // End brightstream.DirectConnection
