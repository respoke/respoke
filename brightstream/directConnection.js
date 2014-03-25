/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * A direct connection via RTCDataChannel, including state and path negotation.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.DirectConnection
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {string} params
 * @param {string} params.client - client id
 * @param {boolean} params.initiator - whether or not we initiated the connection
 * @param {boolean} [params.forceTurn] - If true, force the data to flow through relay servers instead of allowing
 * it to flow peer-to-peer. The relay acts like a blind proxy.
 * @param {brightstream.Endpoint} params.remoteEndpoint
 * @param {string} params.connectionId - The connection ID of the remoteEndpoint.
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalTerminate - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {function} [params.onClose] - Callback for the developer to be notified about closing the connection.
 * @param {function} [params.onOpen] - Callback for the developer to be notified about opening the connection.
 * @param {function} [params.onMessage] - Callback for the developer to be notified about incoming messages. Not usually
 * necessary to listen to this event if you are already listening to brightstream.Endpoint#message
 * @param {function} [params.onStats] - Callback for the developer to receive statistics about the connection.
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

    var defOffer = Q.defer();
    var defAnswer = Q.defer();
    var defApproved = Q.defer();
    var dataChannel = null;
    var onOpen = null;
    var onClose = null;
    var onMessage = null;
    var forceTurn = null;
    var disableTurn = null;
    var callSettings = null;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var clientObj = brightstream.getClient(client);
    var connectionSettings = params.connectionSettings;

    var mediaOptions = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    var offerOptions = {
        mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
        }
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
        offerOptions: offerOptions,
        signalOffer: params.signalOffer,
        signalConnected: params.signalConnected,
        signalAnswer: params.signalAnswer,
        signalTerminate: params.signalTerminate,
        signalReport: params.signalReport,
        signalCandidate: params.signalCandidate
    });

    /**
     * Initiate some state. If we're not the initiator, we need to listen for approval AND the remote SDP to come in
     * before we can act on the peerconnection. Save callbacks off the params object passed into the DirectConnection
     * constructor and add them as listeners onto their respective DirectConnection events.
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
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.saveParameters
     * @param {function} params
     * @param {function} [params.onClose] - Callback for the developer to be notified about closing the connection.
     * @param {function} [params.onOpen] - Callback for the developer to be notified about opening the connection.
     * @param {function} [params.onMessage] - Callback for the developer to be notified about incoming messages.
     * @param {array} [params.servers] - Additional resources for determining network connectivity between two
     * endpoints.
     * @param {boolean} [params.forceTurn] - If true, force the data to flow through relay servers instead of allowing
     * it to flow peer-to-peer. The relay acts like a blind proxy.
     * @private
     */
    function saveParameters(params) {
        that.listen('open', params.onOpen);
        that.listen('close', params.onClose);
        that.listen('message', params.onMessage);
        forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : forceTurn;
        callSettings = params.callSettings || callSettings || {};
        callSettings.servers = params.servers || callSettings.servers;
        callSettings.disableTurn = params.disableTurn || callSettings.disableTurn;
        pc.callSettings = callSettings;
        pc.forceTurn = forceTurn;
        pc.listen('stats', function fireStats(evt) {
            /**
             * @event brightstream.Call#stats
             * @type {brightstream.Event}
             * @property {object} stats - an object with stats in it.
             */
            that.fire('stats', {stats: evt.stats});
        }, true);
    }
    saveParameters(params);

    delete params.signalOffer;
    delete params.signalConnected;
    delete params.signalAnswer;
    delete params.signalTerminate;
    delete params.signalReport;
    delete params.signalCandidate;
    delete params.onOpen;
    delete params.onClose;
    delete params.onMessage;
    delete params.callSettings;

    /**
     * Start the process of obtaining media. saveParameters will only be meaningful for the non-initiator,
     * since the library calls this method for the initiator. Developers will use this method to pass in
     * callbacks for the non-initiator.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.accept
     * @fires brightstream.DirectConnection#accept
     * @param {object} params
     * @param {function} [params.onClose] - Callback for the developer to be notified about closing the connection.
     * @param {function} [params.onOpen] - Callback for the developer to be notified about opening the connection.
     * @param {function} [params.onMessage] - Callback for the developer to be notified about incoming messages.
     * @param {boolean} [params.forceTurn] - If true, force the data to flow through relay servers instead of allowing
     * it to flow peer-to-peer. The relay acts like a blind proxy.
     */
    that.accept = function (params) {
        that.state = ST_STARTED;
        params = params || {};
        log.trace('answer');
        saveParameters(params);

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.DirectConnection#answer
         * @type {brighstream.Event}
         */
        that.fire('accept');
        startPeerConnection();
        createDataChannel();
    };

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.approve
     * @fires brightstream.DirectConnection#approve
     */
    that.approve = function () {
        that.state = ST_APPROVED;
        log.trace('Call.approve');
        /**
         * @event brightstream.DirectConnection#approve
         */
        that.fire('approve');
        defApproved.resolve(true);

        if (that.initiator === true) {
            pc.initOffer();
            return;
        } else {
            defApproved.resolve(true);
        }
    };

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getStats
     * @returns {Promise<object>}
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [params.onStats] - An optional callback to receive the stats. If no callback is provided,
     * the connection's report will contain stats but the developer will not receive them on the client-side.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
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
     * Detect datachannel errors for internal state.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onDataChannelError
     */
    function onDataChannelError(error) {
        that.close();
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
     * @method brightstream.DirectConnection.startPeerConnection
     * @todo Find out when we can stop deleting TURN servers
     * @private
     */
    function startPeerConnection() {
        params = params || {};
        log.trace('startPeerConnection');

        pc.init(callSettings);

        pc.listen('datachannel', function ondatachannel(evt) {
            if (evt && evt.channel) {
                dataChannel = evt.channel;
                dataChannel.onError = onDataChannelError;
                dataChannel.onmessage = onDataChannelMessage;
                dataChannel.onopen = onDataChannelOpen;
                dataChannel.onclose = onDataChannelClose;
            }
        });
    }

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
        that.approve();
    }

    /**
     * Tear down the connection.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.close
     * @fires brightstream.DirectConnection#close
     * @param {object} params
     * @param {boolean} params.signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.close = function (params) {
        params = params || {};
        var toHangup = false;

        if (that.state === ST_ENDED) {
            log.trace("DirectConnection.close got called twice.");
            return;
        }
        that.state = ST_ENDED;

        if (!that.initiator && defApproved.promise.isPending()) {
            defApproved.reject(new Error("Connection ended before approval."));
        }

        clientObj.updateTurnCredentials();
        log.debug('closing direct connection');

        if (pc) {
            toHangup = pc.close(params);
        }

        /**
         * @event brightstream.DirectConnection#close
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('close', {
            sentSignal: toHangup
        });
        that.ignore();

        if (dataChannel) {
            dataChannel.close();
        }
        dataChannel =  null;
        pc = null;
    };

    /*
     * Send a message over the datachannel in the form of a JSON-encoded plain old JavaScript object. Only one
     * attribute may be given: either a string 'message' or an object 'object'.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.sendMessage
     * @param {object} params
     * @param {string} [params.message] - The message to send.
     * @param {object} [params.object] - An object to send.
     * @param [function] [params.onSuccess] - Success handler.
     * @param [function] [params.onError] - Error handler.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(params.object || {
                message: params.message
            }));
            deferred.resolve();
        } else {
            log.error("dataChannel not in an open state.");
            deferred.reject();
        }
        return deferred.promise;
    };

    /*
     * Expose close as reject for approve/reject workflow.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.reject
     * @param {boolean} signal - Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.reject = that.close;

    /**
     * Indicate whether a datachannel is being setup or is in progress.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.isActive
     * @returns {boolean}
     */
    that.isActive = pc.isActive;

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setOffer
     * @param {RTCSessionDescription} sdp - The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setOffer = function (params) {
        defOffer.resolve(params);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setAnswer
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
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setConnected
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setConnected = function (signal) {
        pc.setConnected(signal, function endCall() {
            that.hangup(false);
        });
    };

    /**
     * Save the candidate. If we initiated the connection, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.addRemoteCandidate
     * @param {RTCIceCandidate} candidate The ICE candidate.
     * @todo TODO Make this listen to events and be private.
     */
    that.addRemoteCandidate = pc.addRemoteCandidate;

    /**
     * Get the state of the connection.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getState
     * @returns {string}
     */
    that.getState = function () {
        return pc.getState();
    };

    /**
     * Save the close reason and hang up.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.setBye
     * @todo TODO Make this listen to events and be private.
     * @param {object} params
     * @param {string} [params.reason] - An optional reason for the hangup.
     */
    that.setBye = function (params) {
        params = params || {};
        pc.report.connectionStoppedReason = params.reason || "Remote side hung up";
        that.close({signal: false});
    };

    return that;
}; // End brightstream.DirectConnection
