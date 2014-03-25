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
 * @param {function} [params.onClose] - Callback for the developer to be notified about closing the connection.
 * @param {function} [params.onOpen] - Callback for the developer to be notified about opening the connection.
 * @param {function} [params.onMessage] - Callback for the developer to be notified about incoming messages. Not usually
 * necessary to listen to this event if you are already listening to brightstream.Endpoint#message
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

    var dataChannel = null;
    var onOpen = null;
    var onClose = null;
    var onMessage = null;
    var clientObj = brightstream.getClient(client);

    var pc = params.pc;
    delete params.pc;

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.saveParameters
     * @param {function} params
     * @param {function} [params.onOpen]
     * @param {function} [params.onClose]
     * @param {function} [params.onMessage]
     * @param {array} [params.servers]
     * @private
     */
    function saveParameters(params) {
        that.listen('open', params.onOpen);
        that.listen('close', params.onClose);
        that.listen('message', params.onMessage);
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
        /**
         * @event brightstream.Endpoint#error
         * @type {brightstream.Event}
         * @property {object} error
         * @property {brightstream.DirectConnection) directConnection
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
        dataChannel = evt.target || evt.channel;
        /**
         * @event brightstream.DirectConnection#open
         * @type {brightstream.Event}
         */
        that.fire('open');
    }

    /**
     * Create the datachannel. For the initiator, set up all the handlers we'll need to keep track of the
     * datachannel's state and to receive messages.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.createDataChannel
     * @private
     */
    function createDataChannel() {
        pc.listen('direct-connection', function (evt) {
            dataChannel = evt.channel;
            dataChannel.onerror = onDataChannelError;
            dataChannel.onmessage = onDataChannelMessage;
            dataChannel.onopen = onDataChannelOpen;
        }, true);
        dataChannel = pc.createDataChannel("brightstreamDataChannel");
        window.dc = dataChannel;
        dataChannel.binaryType = 'arraybuffer';

        dataChannel.onerror = onDataChannelError;
        dataChannel.onmessage = onDataChannelMessage;
        dataChannel.onopen = onDataChannelOpen;
        /**
         * The direct connection setup has begun.
         * @event brightstream.DirectConnection#started
         * @type {brightstream.Event}
         */
        that.fire('started');
    }

    /**
     * Start the process of obtaining media. saveParameters will only be meaningful for the non-initiator,
     * since the library calls this method for the initiator. Developers will use this method to pass in
     * callbacks for the non-initiator.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.accept
     * @fires brightstream.DirectConnection#accept
     * @param {object} params
     * @param {function} [params.onOpen]
     * @param {function} [params.onClose]
     * @param {function} [params.onMessage]
     */
    that.accept = function (params) {
        params = params || {};
        log.trace('DirectConnection.accept');
        saveParameters(params);

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.DirectConnection#answer
         * @type {brightstream.Event}
         */
        that.fire('accept');

        createDataChannel();
    };

    /**
     * Tear down the connection.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.close
     * @fires brightstream.DirectConnection#close
     */
    that.close = function () {
        log.trace("DirectConnection.close");
        if (dataChannel) {
            dataChannel.close();
        }

        /**
         * @event brightstream.DirectConnection#close
         * @type {brightstream.Event}
         */
        that.fire('close');

        that.ignore();
        dataChannel =  null;
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
     * @returns {Promise<undefined>}
     */
    that.sendMessage = function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(params.object || {
                message: params.message
            }));
            deferred.resolve();
        } else {
            deferred.reject(new Error("dataChannel not in an open state."));
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
    that.isActive = function () {
        return (pc && pc.isActive() && dataChannel && dataChannel.readyState === 'open');
    };

    /**
     * Get the state of the connection.
     * @memberof! brightstream.DirectConnection
     * @method brightstream.DirectConnection.getState
     * @returns {string}
     */
    that.getState = function () {
        return pc.getState();
    };

    return that;
}; // End brightstream.DirectConnection
