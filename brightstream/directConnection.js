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
 * @param {brightstream.Call} params.call - The call that is handling state for this direct connection.
 * @param {boolean} [params.forceTurn] - If true, force the data to flow through relay servers instead of allowing
 * it to flow peer-to-peer. The relay acts like a blind proxy.
 * @param {string} params.connectionId - The connection ID of the remoteEndpoint.
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalHangup - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {brightstream.DirectConnection.onStart} [params.onStart] - Callback for when setup of the direct connection
 * begins. The direct connection will not be open yet.
 * @param {brightstream.DirectConnection.onError} [params.onError] - Callback for errors that happen during
 * direct connection setup or media renegotiation.
 * @param {brightstream.DirectConnection.onClose} [params.onClose] - Callback for closing the direct connection.
 * @param {brightstream.DirectConnection.onOpen} [params.onOpen] - Callback for opening the direct connection.
 * @param {brightstream.DirectConnection.onAccept} [params.onAccept] - Callback for when the user accepts the request
 * for a direct connection and setup is about to begin.
 * @param {brightstream.DirectConnection.onMessage} [params.onMessage] - Callback for incoming messages. Not usually
 * necessary to listen to this event if you are already listening to brightstream.Endpoint#message.
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
    that.id = brightstream.makeGUID();

    if (!that.call.caller) {
        that.call.caller = false;
    }

    var dataChannel = null;
    var onOpen = null;
    var onClose = null;
    var onMessage = null;
    var clientObj = brightstream.getClient(client);

    var pc = params.pc;
    delete params.pc;

    /**
     * When the datachannel is availble, we need to attach the callbacks. The event this function is attached to
     * only fires for the callee.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.listenDataChannel
     * @param {brightstream.Event} evt
     * @private
     */
    function listenDataChannel(evt) {
        dataChannel = evt.channel;
        dataChannel.onerror = onDataChannelError;
        dataChannel.onmessage = onDataChannelMessage;
        dataChannel.onopen = onDataChannelOpen;
    }

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.saveParameters
     * @param {object} params
     * @param {brightstream.DirectConnection.onClose} [params.onClose] - Callback for when the direct connection
     * is closed.
     * @param {brightstream.DirectConnection.onOpen} [params.onOpen] - Callback for when the direct connection
     * is open.
     * @param {brightstream.DirectConnection.onMessage} [params.onMessage] - Callback for incoming messages.
     * @param {brightstream.DirectConnection.onError} [params.onError] - Callback for errors setting up the direct
     * connection.
     * @param {brightstream.DirectConnection.onStart} [params.onStart] - Callback for when the direct connection
     * is being set up. The direct connection will not be open yet.
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
        that.listen('start', params.onStart);
        that.listen('error', params.onError);
        pc.listen('direct-connection', listenDataChannel, true);
        pc.listen('stats', function fireStats(evt) {
            /**
             * This event is fired every time statistical information about the direct connection
             * becomes available.
             * @event brightstream.DirectConnection#stats
             * @type {brightstream.Event}
             * @property {object} stats - an object with stats in it.
             * @property {brightstream.DirectConnection} target
             * @property {string} name - the event name.
             */
            that.fire('stats', {stats: evt.stats});
        }, true);

    }
    saveParameters(params);

    delete that.onOpen;
    delete that.onClose;
    delete that.onMessage;

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getStats
     * @returns {Promise<object>}
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - An optional callback to receive the
     * stats if the Brightstream stats module is loaded. If no callback is provided, the connection's report will
     * contain stats but the developer will not receive them on the client-side.
     * @param {brightstream.DirectConnection.statsSuccessHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {brightstream.DirectConnection.errorHandler} [params.onError] - Error handler for this invocation of
     * this method only.
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
        /**
         * @event brightstream.DirectConnection#error
         * @type {brightstream.Event}
         * @property {object} error
         * @property {brightstream.DirectConnection} directConnection
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
         */
        that.fire('error', {
            error: error
        });
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
         * @property {brightstream.DirectConnection} directConnection
         * @property {string} name - the event name.
         * @property {brightstream.Call} target
         */
        that.call.remoteEndpoint.fire('message', {
            message: message,
            directConnection: that
        });
        /**
         * @event brightstream.DirectConnection#message
         * @type {brightstream.Event}
         * @property {object} message
         * @property {brightstream.Endpoint} endpoint
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
         */
        that.fire('message', {
            message: message,
            endpoint: that.call.remoteEndpoint
        });
    }

    /**
     * Detect when the channel is open.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.onDataChannelOpen
     * @param {MessageEvent}
     * @fires brightstream.DirectConnection#open
     */
    function onDataChannelOpen(evt) {
        //dataChannel = evt.target || evt.channel;
        /**
         * @event brightstream.DirectConnection#open
         * @type {brightstream.Event}
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
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
    function onDataChannelClose(evt) {
        //dataChannel = evt.target || evt.channel;
        /**
         * @event brightstream.DirectConnection#close
         * @type {brightstream.Event}
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
         */
        that.fire('close');
    }

    /**
     * Create the datachannel. For the caller, set up all the handlers we'll need to keep track of the
     * datachannel's state and to receive messages.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.createDataChannel
     * @private
     */
    function createDataChannel() {
        dataChannel = pc.createDataChannel("brightstreamDataChannel");
        dataChannel.binaryType = 'arraybuffer';
        dataChannel.onerror = onDataChannelError;
        dataChannel.onmessage = onDataChannelMessage;
        dataChannel.onopen = onDataChannelOpen;

        /**
         * The direct connection setup has begun. This does NOT mean it's ready to send messages yet. Listen to
         * DirectConnection#open for that notification.
         * @event brightstream.DirectConnection#start
         * @type {brightstream.Event}
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
         */
        that.fire('start');
    }

    /**
     * Start the process of obtaining media. saveParameters will only be meaningful for the callee,
     * since the library calls this method for the caller. Developers will use this method to pass in
     * callbacks for the callee.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.accept
     * @fires brightstream.DirectConnection#accept
     * @param {object} params
     * @param {brightstream.DirectConnection.onOpen} [params.onOpen]
     * @param {brightstream.DirectConnection.onClose} [params.onClose]
     * @param {brightstream.DirectConnection.onMessage} [params.onMessage]
     * @param {brightstream.DirectConnection.onStart} [params.onStart]
     */
    that.accept = function (params) {
        params = params || {};
        log.trace('DirectConnection.accept');
        saveParameters(params);

        log.debug("I am " + (that.call.caller ? '' : 'not ') + "the caller.");

        if (that.call.caller === true) {
            createDataChannel();
        }

        /**
         * @event brightstream.DirectConnection#accept
         * @type {brightstream.Event}
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
         */
        that.fire('accept');
    };

    /**
     * Tear down the connection.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.close
     * @fires brightstream.DirectConnection#close
     */
    that.close = function (params) {
        params = params || {};
        log.trace("DirectConnection.close");
        if (dataChannel) {
            dataChannel.close();
        }

        /**
         * @event brightstream.DirectConnection#close
         * @type {brightstream.Event}
         * @property {string} name - the event name.
         * @property {brightstream.DirectConnection} target
         */
        that.fire('close');

        that.ignore();

        if (params.skipRemove !== true) {
            that.call.removeDirectConnection();
        }

        dataChannel = null;
        that.call.remoteEndpoint.directConnection = null;
        that.call = null;
        pc = null;
    };

    /**
     * Send a message over the datachannel in the form of a JSON-encoded plain old JavaScript object. Only one
     * attribute may be given: either a string 'message' or an object 'object'.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.sendMessage
     * @param {object} params
     * @param {string} [params.message] - The message to send.
     * @param {object} [params.object] - An object to send.
     * @param {brightstream.DirectConnection.sendHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {brightstream.DirectConnection.errorHandler} [params.onError] - Error handler for this invocation
     * of this method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        if (that.isActive()) {
            dataChannel.send(JSON.stringify(params.object || {
                message: params.message
            }));
            deferred.resolve();
        } else {
            deferred.reject(new Error("dataChannel not in an open state."));
        }
        return deferred.promise;
    };

    /**
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
    that.isActive = function () {
        // Why does pc.iceConnectionState not transition into 'connected' even though media is flowing?
        //return (pc && pc.isActive() && dataChannel && dataChannel.readyState === 'open');
        return (dataChannel && dataChannel.readyState === 'open');
    };

    return that;
}; // End brightstream.DirectConnection

/**
 * Called when the direct connection is closed.  This callback is called every time brightstream.DirectConnection#close
 * fires.
 * @callback brightstream.DirectConnection.onClose
 * @param {brightstream.Event} evt
 * @param {string} evt.name - the event name.
 * @param {brightstream.DirectConnection} evt.target
 */
/**
 * Called when the setup of the direct connection has begun. The direct connection will not be open yet. This
 * callback is called every time brightstream.DirectConnection#start fires.
 * @callback brightstream.DirectConnection.onStart
 * @param {brightstream.Event} evt
 * @param {string} evt.name - the event name.
 * @param {brightstream.DirectConnection} evt.target
 */
/**
 * Called when the direct connection is opened.  This callback is called every time brightstream.DirectConnection#open
 * fires.
 * @callback brightstream.DirectConnection.onOpen
 * @param {brightstream.Event} evt
 * @param {string} evt.name - the event name.
 * @param {brightstream.DirectConnection} evt.target
 */
/**
 * Called when a message is received over the direct connection.  This callback is called every time
 * brightstream.DirectConnection#message fires.
 * @callback brightstream.DirectConnection.onMessage
 * @param {brightstream.Event} evt
 * @param {object} evt.message
 * @param {brightstream.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 * @param {brightstream.DirectConnection} evt.target
 */
/**
 * Handle an error that resulted from a specific method call. This handler will not fire more than once.
 * @callback brightstream.DirectConnection.errorHandler
 * @param {Error} err
 */
/**
 * When a call is in setup or media renegotiation happens. This callback will be called every time
 * brightstream.DirectConnection#error.
 * @callback brightstream.DirectConnection.onError
 * @param {brightstream.Event} evt
 * @param {boolean} evt.reason - A human-readable description of the error.
 * @param {string} evt.name - the event name.
 * @param {brightstream.DirectConnection} evt.target
 */
/**
 * Called when the callee accepts the direct connection. This callback is called every time
 * brightstream.DirectConnection#accept is fired.
 * @callback brightstream.DirectConnection.onAccept
 * @param {brightstream.Event} evt
 * @param {brightstream.DirectConnection} evt.target
 */
/**
 * Handle the successful kick-off of stats on a call.
 * @callback brightstream.DirectConnection.statsSuccessHandler
 * @param {brightstream.Event} evt
 * @param {object} evt.stats - an object with stats in it.
 * @param {brightstream.DirectConnection} evt.target
 * @param {string} evt.name - the event name.
 */
/**
 * Handle sending successfully.
 * @callback brightstream.DirectConnection.sendHandler
 */
