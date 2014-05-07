/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * This is a top-level interface to the API. It handles authenticating the app to the
 * API server, receiving server-side app-specific information including callbacks and listeners, and interacting with
 * information the library keeps
 * track of, like groups and endpoints. The client also keeps track of default settings for calls and direct
 * connections as well as automatically reconnecting to the service when network activity is lost.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Client
 * @constructor
 * @augments brightstream.Presentable
 * @param {object} params
 * @param {string} [params.appId] - The ID of your Brightstream app. This must be passed either to
 * brightstream.connect, brightstream.createClient, or to client.connect.
 * @param {string} [params.token] - The endpoint's authentication token.
 * @param {RTCConstraints} [params.constraints] - A set of default WebRTC call constraints if you wish to use
 * different parameters than the built-in defaults.
 * @param {RTCICEServers} [params.servers] - A set of default WebRTC ICE/STUN/TURN servers if you wish to use
 * different parameters than the built-in defaults.
 * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
 * endpoint. This is only used when `developmentMode` is set to `true`.
 * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
 * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
 * operation and will limit the services you will be able to use.
 * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Brightstream service
 * when a disconnect occurs.
 * @param {brightstream.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
 * @param {brightstream.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves a group.
 * @param {brightstream.Client.onClientMessage} [params.onMessage] - Callback for when any message is received
 * from anywhere on the system.
 * @param {brightstream.Client.onConnect} [params.onConnect] - Callback for Client connect.
 * @param {brightstream.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
 * @param {brightstream.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect.
 * @param {brightstream.Client.onCall} [params.onCall] - Callback for when this client's user receives a call.
 * @param {brightstream.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this client's user
 * receives a request for a direct connection.
 * @returns {brightstream.Client}
 */
/*global brightstream: false */
brightstream.Client = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Client
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = brightstream.makeGUID();
    params.instanceId = instanceId;
    var that = brightstream.Presentable(params);
    brightstream.instances[instanceId] = that;
    delete that.instanceId;
    /**
     * @memberof! brightstream.Client
     * @name className - A name to identify this class
     * @type {string}
     */
    that.className = 'brightstream.Client';
    /**
     * @memberof! brightstream.Client
     * @name host
     * @type {string}
     * @private
     */
    var host = window.location.hostname;
    /**
     * @memberof! brightstream.Client
     * @name port
     * @type {number}
     * @private
     */
    var port = window.location.port;
    /**
     * Whether the client is connected to the cloud infrastructure.
     * @memberof! brightstream.Client
     * @name connected
     * @type {boolean}
     */
    that.connected = false;
    /**
     * A simple POJO to store some methods we will want to override but reference later.
     * @memberof! brightstream.Client
     * @name superClass
     * @private
     * @type {object}
     */
    var superClass = {
        setPresence: that.setPresence
    };
    /**
     * A container for baseURL, token, and appId so they won't be accidentally viewable in any JavaScript debugger.
     * @memberof! brightstream.Client
     * @name app
     * @type {object}
     * @private
     * @property {string} [baseURL] - the URL of the cloud infrastructure's REST API.
     * @property {string} [token] - The endpoint's authentication token.
     * @property {string} [appId] - The id of your Brightstream app.
     * @property {string} [endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @property {boolean} [developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @property {boolean} [reconnect=true] - Whether or not to automatically reconnect to the Brightstream service
     * when a disconnect occurs.
     * @property {onJoin} [onJoin] - Callback for when this client's endpoint joins a group.
     * @property {onLeave} [onLeave] - Callback for when this client's endpoint leaves a group.
     * @property {brightstream.Client.onClientMessage} [onMessage] - Callback for when any message is received
     * from anywhere on the system.
     * @property {brightstream.Client.onConnect} [onConnect] - Callback for Client connect.
     * @property {brightstream.Client.onDisconnect} [onDisconnect] - Callback for Client disconnect.
     * @property {brightstream.Client.onReconnect} [onReconnect] - Callback for Client reconnect. Not Implemented.
     * @property {brightstream.Client.onCall} [onCall] - Callback for when this client receives a call.
     * @property {brightstream.Client.onDirectConnection} [onDirectConnection] - Callback for when this client
     * receives a request
     * for a direct connection.
     */
    var clientSettings = {
        baseURL: params.baseURL,
        token: params.token,
        appId: params.appId,
        developmentMode: typeof params.developmentMode === 'boolean' ? params.developmentMode : false,
        reconnect: typeof params.developmentMode === 'boolean' ? params.developmentMode : true,
        endpointId: params.endpointId,
        onJoin: params.onJoin,
        onLeave: params.onLeave,
        onMessage: params.onMessage,
        onConnect: params.onConnect,
        onDisconnect: params.onDisconnect,
        onReconnect: params.onReconnect,
        onCall: params.onCall,
        onDirectConnection: params.onDirectConnection
    };
    delete that.appId;
    delete that.baseURL;
    delete that.developmentMode;
    delete that.token;

    /**
     * @memberof! brightstream.Client
     * @name groups
     * @type {Array<brightstream.Group>}
     * @private
     */
    var groups = [];
    /**
     * @memberof! brightstream.Client
     * @name endpoints
     * @type {Array<brightstream.Endpoint>}
     * @private
     */
    var endpoints = [];
    /**
     * Array of calls in progress. This array should never be modified.
     * @memberof! brightstream.Client
     * @name calls
     * @type {array}
     */
    that.calls = [];
    log.debug("Client ID is ", instanceId);

    /**
     * @memberof! brightstream.Client
     * @name callSettings
     * @type {object}
     * @private
     */
    var callSettings = {
        constraints: params.constraints || {
            video : true,
            audio : true,
            optional: [],
            mandatory: {}
        },
        servers: params.servers || {
            iceServers: []
        }
    };

    /**
     * @memberof! brightstream.Client
     * @name signalingChannel
     * @type {brightstream.SignalingChannel}
     * @private
     */
    var result = brightstream.SignalingChannel({
        instanceId: instanceId,
        clientSettings: clientSettings
    });
    var signalingChannel = result.signalingChannel;
    var getTurnCredentials = result.getTurnCredentials;

    /**
     * Connect to the Digium infrastructure and authenticate using the `token`.  Store a new token to be used in API
     * requests. If no `token` is given and `developmentMode` is set to true, we will attempt to obtain a token
     * automatically from the Digium infrastructure.  If `reconnect` is set to true, we will attempt to keep
     * reconnecting each time this token expires. Accept and attach quite a few event listeners for things like group
     * joining and connection statuses. Get the first set of TURN credentials and store them internally for later use.
     * @memberof! brightstream.Client
     * @method brightstream.Client.connect
     * @param {object} params
     * @param {brightstream.Client.connectSuccessHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {string} [params.appId] - The ID of your Brightstream app. This must be passed either to
     * brightstream.connect, brightstream.createClient, or to client.connect.
     * @param {string} [params.token] - The endpoint's authentication token.
     * @param {RTCConstraints} [params.constraints] - A set of default WebRTC call constraints if you wish to use
     * different parameters than the built-in defaults.
     * @param {RTCICEServers} [params.servers] - A set of default WebRTC ICE/STUN/TURN servers if you wish to use
     * different parameters than the built-in defaults.
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Brightstream service
     * when a disconnect occurs.
     * @param {brightstream.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {brightstream.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves
     * a group.
     * @param {brightstream.Client.onClientMessage} [params.onMessage] - Callback for when any message is
     * received from anywhere on the system.
     * @param {brightstream.Client.onConnect} [params.onConnect] - Callback for Client connect.
     * @param {brightstream.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
     * @param {brightstream.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
     * @param {brightstream.Client.onCall} [params.onCall] - Callback for when this client receives a call.
     * @param {brightstream.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this
     * client receives a request for a direct connection.
     * @returns {Promise}
     * @fires brightstream.Client#connect
     */
    that.connect = function (params) {
        var promise;
        params = params || {};
        log.trace('Client.connect');

        Object.keys(params).forEach(function eachParam(key) {
            if (['onSuccess', 'onError'].indexOf(key) === -1 && params[key] !== undefined) {
                clientSettings[key] = params[key];
            }
        });
        that.endpointId = clientSettings.endpointId;

        if (!clientSettings.token && !clientSettings.appId) {
            throw new Error("Can't connect without either an appId, in which case developmentMode " +
                "must be set to true, or an token");
        }

        promise = actuallyConnect(params);
        promise.done(function successHandler() {
            /**
             * This event is fired the first time the library connects to the cloud infrastructure.
             * @event brightstream.Client#connect
             * @type {brightstream.Event}
             * @property {string} name - the event name.
             * @property {brightstream.Client} target
             */
            that.fire('connect');
        });
        return promise;
    };

    /**
     * This function contains the meat of the connection, the portions which can be repeated again on reconnect.
     * When `reconnect` is true, this function will be added in an event listener to the Client#disconnect event.
     * @memberof! brightstream.Client
     * @method brightstream.Client.actuallyConnect
     * @private
     * @param {object} params
     * @param {connectSuccessHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise}
     */
    function actuallyConnect(params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        signalingChannel.open({
            actuallyConnect: actuallyConnect,
            endpointId: that.endpointId,
            token: clientSettings.token
        }).then(function successHandler() {
            return signalingChannel.authenticate();
        }, function errorHandler(err) {
            log.error(err.message);
            deferred.reject(new Error("Couldn't connect to brightstream: " + err.message));
        }).done(function successHandler() {
            that.connected = true;
            that.setOnline(); // Initiates presence.

            /*
             * These rely on the EventEmitter checking for duplicate event listeners in order for these
             * not to be duplicated on reconnect.
             */
            that.listen('call', clientSettings.onCall);
            that.listen('call', addCall);
            that.listen('direct-connection', clientSettings.onDirectConnection);
            that.listen('direct-connection', function (evt) {
                evt.call = evt.directConnection.call;
                addCall(evt);
            });
            that.listen('join', clientSettings.onJoin);
            that.listen('leave', clientSettings.onLeave);
            that.listen('message', clientSettings.onMessage);
            that.listen('connect', clientSettings.onConnect);
            that.listen('disconnect', clientSettings.onDisconnect);
            that.listen('disconnect', setConnectedOnDisconnect);
            that.listen('reconnect', clientSettings.onReconnect);
            that.listen('reconnect', setConnectedOnReconnect);

            log.info('logged in as ' + that.id, that);
            deferred.resolve();
        }, function errorHandler(err) {
            that.connected = false;
            deferred.reject("Couldn't create an endpoint.");
            log.error(err.message);
        });
        return deferred.promise;
    }

    function setConnectedOnDisconnect() {
        that.connected = false;
    }

    function setConnectedOnReconnect() {
        that.connected = true;
    }

    /**
     * Disconnect from the Digium infrastructure, leave all groups, invalidate the token, and disconnect the websocket.
     * @memberof! brightstream.Client
     * @method brightstream.Client.disconnect
     * @returns {Promise}
     * @param {object} params
     * @param {disconnectSuccessHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires brightstream.Client#disconnect
     */
    that.disconnect = function (params) {
        // TODO: also call this on socket disconnect
        params = params || {};
        var disconnectPromise = brightstream.makeDeferred(params.onSuccess, params.onError);

        if (signalingChannel.connected) {
            // do websocket stuff. If the websocket is already closed, we have to skip this stuff.
            var leaveGroups = groups.map(function eachGroup(group) {
                group.leave();
            });
            Q.all(leaveGroups).then(function successHandler() {
                return signalingChannel.close();
            }, function errorHandler(err) {
                // Possibly the socket got closed already and we couldn't leave our groups. Backend will clean this up.
                disconnectPromise.resolve();
            }).fin(function finallyHandler() {
                if (!disconnectPromise.promise.isFulfilled()) {
                    // Successfully closed our socket after leaving all groups.
                    disconnectPromise.resolve();
                }
            });
        } else {
            disconnectPromise.resolve();
        }
        disconnectPromise.promise.done(afterDisconnect, afterDisconnect);
        return disconnectPromise.promise;
    };

    /**
     * Clean up after an intentional disconnect.
     * @memberof! brightstream.Client
     * @method brightstream.Client.afterDisconnect
     * @private
     */
    function afterDisconnect() {
        that.connected = false;
        endpoints = [];
        groups = [];
        /**
         * This event is fired when the library has disconnected from the cloud infrastructure.
         * @event brightstream.Client#disconnect
         * @property {string} name - the event name.
         * @property {brightstream.Client} target
         */
        that.fire('disconnect');
    }

    /**
     * Overrides Presentable.setPresence to send presence to the server before updating the object.
     * @memberof! brightstream.Client
     * @method brightstream.Client.setPresence
     * @param {object} params
     * @param {string} params.presence
     * @param {brightstream.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @return {Promise}
     */
    that.setPresence = function (params) {
        params = params || {};
        params.presence = params.presence || "available";
        log.info('sending my presence update ' + params.presence);

        return signalingChannel.sendPresence({
            presence: params.presence,
            onSuccess: function successHandler(p) {
                superClass.setPresence(params);
                if (typeof params.onSuccess === 'function') {
                    params.onSuccess(p);
                }
            },
            onError: params.onError
        });
    };

    /**
     * Get the Call with the endpoint specified.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getCall
     * @param {object} params
     * @param {string} [params.id] - Call ID.
     * @param {string} [params.endpointId] - Endpoint ID. Warning: If you pass only the endpointId, this method
     * will just return the first call that matches. If you are placing multiple calls to the same endpoint,
     * pass in the call ID, too.
     * @param {boolean} params.create - whether or not to create a new call if the specified endpointId isn't found
     * @returns {brightstream.Call}
     */
    that.getCall = function (params) {
        var call = null;
        var endpoint = null;

        that.calls.every(function findCall(one) {
            if (params.id && one.id === params.id) {
                call = one;
                return false;
            }

            if (!params.id && params.endpointId && one.remoteEndpoint.id === params.endpointId) {
                call = one;
                return false;
            }
            return true;
        });

        if (call === null && params.create === true) {
            endpoint = that.getEndpoint({id: params.endpointId});
            try {
                call = endpoint.startCall({
                    callSettings: callSettings,
                    id: params.id,
                    caller: false
                });
            } catch (e) {
                log.error("Couldn't create Call.", e.message, e.stack);
            }
        }
        return call;
    };

    /**
     * Associate the call with this client.
     * @memberof! brightstream.Client
     * @method brightstream.Client.addCall
     * @param {object} evt
     * @param {brightstream.Call} evt.call
     * @param {brightstream.Endpoint} evt.endpoint
     * @private
     */
    function addCall(evt) {
        if (that.calls.indexOf(evt.call) === -1) {
            that.calls.push(evt.call);
            evt.call.listen('hangup', removeCall, true);

            updateTurnCredentials().done(null, function (err) {
                var message = "Couldn't get TURN credentials. Sure hope this call goes peer-to-peer!";
                /**
                 * This event is fired on errors that occur during call setup or media negotiation.
                 * @event brightstream.Call#error
                 * @type {brightstream.Event}
                 * @property {string} reason - A human readable description about the error.
                 * @property {brightstream.Call} target
                 * @property {string} name - the event name.
                 */
                that.fire('error', {
                    reason: message
                });
            });

            if (evt.call.className === 'brightstream.Call') {
                if (!evt.call.caller && !that.hasListeners('call')) {
                    log.warn("Got a incoming call with no handlers to accept it!");
                    evt.call.reject();
                    return;
                }
            }
        }
    }

    /**
     * Remove the call or direct connection.
     * @memberof! brightstream.Client
     * @method brightstream.Client.removeCall
     * @param {object} evt
     * @param {brightstream.Call} evt.target
     * @private
     */
    function removeCall(evt) {
        var match = false;

        // Loop backward since we're modifying the array in place.
        for (var i = that.calls.length - 1; i >= 0; i -= 1) {
            if (that.calls[i].id === evt.target.id) {
                that.calls.splice(i);
                match = true;
            }
        }

        if (!match) {
            log.warn("No call removed.");
        }
    }

    /**
     * Set presence to available.
     * @memberof! brightstream.Client
     * @method brightstream.Client.setOnline
     * @param {object} params
     * @param {string} [params.presence] - The presence to set.
     * @param {brightstream.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise}
     */
    that.setOnline = function (params) {
        params = params || {};
        params.presence = params.presence || 'available';
        return that.setPresence(params);
    };

    /**
     * Send a message to an endpoint.
     * @memberof! brightstream.Client
     * @method brightstream.Client.sendMessage
     * @param {object} params
     * @param {string} params.endpointId - The endpoint id of the recipient.
     * @param {string} [params.connectionId] - The optional connection id of the receipient. If not set, message will be
     * broadcast to all connections for this endpoint.
     * @param {string} params.message - a string message.
     * @param {sendHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        var endpoint = that.getEndpoint({id: params.endpointId});
        delete params.endpointId;
        return endpoint.sendMessage(params);
    };

    /**
     * Place an audio and/or video call to an endpoint.
     * @memberof! brightstream.Client
     * @method brightstream.Client.startCall
     * @param {object} params
     * @param {string} params.endpointId - The id of the endpoint that should be called.
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {string} [params.connectionId]
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video element
     * with the local audio and/or video attached.
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video element
     * with the remote audio and/or video attached.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {brightstream.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @return {brightstream.Call}
     */
    that.startCall = function (params) {
        var endpoint = that.getEndpoint({id: params.endpointId});
        delete params.endpointId;
        return endpoint.startCall(params);
    };

    /**
     * Update TURN credentials.
     * @memberof! brightstream.Client
     * @method brightstream.Client.updateTurnCredentials
     * @returns {Promise}
     * @param {object} params
     * @param {brightstream.SignalingChannel.turnSuccessHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @private
     */
    function updateTurnCredentials() {
        var promise;
        if (callSettings.disableTurn === true) {
            return;
        }

        promise = getTurnCredentials();
        promise.done(params.onSuccess, params.onError);
        promise.done(function successHandler(creds) {
            callSettings.servers.iceServers = creds;
        }, null);
        return promise;
    }

    /**
     * Get an object containing the default media constraints and other media settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getCallSettings
     * @returns {object} An object containing the media settings which will be used in
     * brightstream calls.
     * @private
     */
    that.getCallSettings = function () {
        return callSettings;
    };

    /**
     * Set the default media constraints and other media settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.setDefaultCallSettings
     * @param {object} params
     * @param {object} [params.constraints]
     * @param {object} [params.servers]
     */
    that.setDefaultCallSettings = function (params) {
        params = params || {};
        callSettings.constraints = params.constraints || callSettings.constraints;
        callSettings.servers = params.servers || callSettings.servers;
    };

    /**
     * Get the SignalingChannel. This is not really a private method but we don't want our developers interacting
     * directly with the signaling channel.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getSignalingChannel
     * @returns {brightstream.SignalingChannel} The instance of the brightstream.SignalingChannel.
     * @private
     */
    that.getSignalingChannel = function () {
        return signalingChannel;
    };

    /**
     * Join a Group and begin keeping track of it. Attach some event listeners.
     * @memberof! brightstream.Client
     * @method brightstream.Client.join
     * @param {object} params
     * @param {string} params.id - The name of the group.
     * @param {brightstream.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {brightstream.Group.onMessage} [params.onMessage] - Message handler for messages from this group only.
     * @param {brightstream.Group.onJoin} [params.onJoin] - Join event listener for endpoints who join this group only.
     * @param {brightstream.Group.onLeave} [params.onLeave] - Leave event listener for endpoints who leave
     * this group only.
     * @returns {Promise<brightstream.Group>} The instance of the brightstream.Group which the client joined.
     * @fires brightstream.Client#join
     */
    that.join = function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        if (!params.id) {
            deferred.reject(new Error("Can't join a group with no group id."));
            return deferred.promise;
        }

        signalingChannel.joinGroup({
            id: params.id
        }).done(function successHandler() {
            var group = brightstream.Group({
                instanceId: instanceId,
                id: params.id,
                onMessage: params.onMessage,
                onJoin: params.onJoin,
                onLeave: params.onLeave
            });
            /**
             * This event is fired every time the client joins a group. If the client leaves
             * a group, this event will be fired again on the next time the client joins the group.
             * @event brightstream.Client#join
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             * @property {string} name - the event name.
             */
            that.fire('join', {
                group: group
            });
            addGroup(group);
            group.listen('leave', function leaveHandler(evt) {
                checkEndpointForRemoval(evt.connection.getEndpoint());
            });
            deferred.resolve(group);
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return deferred.promise;
    };

    /**
     * Add a Group. This is called when we join a group and need to begin keeping track of it.
     * @memberof! brightstream.Client
     * @method brightstream.Client.addGroup
     * @param {brightstream.Group}
     * @private
     */
    function addGroup(newGroup) {
        var group;
        if (!newGroup || newGroup.className !== 'brightstream.Group') {
            throw new Error("Can't add group to internal tracking without a group.");
        }
        groups.every(function eachGroup(grp) {
            if (grp.id === newGroup.id) {
                group = grp;
                return false;
            }
            return true;
        });

        if (!group) {
            newGroup.listen('leave', function leaveHandler(evt) {
                checkEndpointForRemoval(evt.connection.getEndpoint());
            }, true);
            groups.push(newGroup);
        }
    }

    /**
     * Remove a Group. This is called when we have left a group and no longer need to keep track of it.
     * @memberof! brightstream.Client
     * @method brightstream.Client.removeGroup
     * @param {brightstream.Group}
     * @private
     */
    function removeGroup(newGroup) {
        var index;
        if (!newGroup || newGroup.className === 'brightstream.Group') {
            throw new Error("Can't remove group to internal tracking without a group.");
        }

        groups.every(function eachGroup(grp, i) {
            if (grp.id === newGroup.id) {
                index = i;
                return false;
            }
            return true;
        });

        if (index !== undefined && index > -1) {
            groups[index].getMembers().done(function successHandler(list) {
                groups[index].ignore();
                groups.splice(index, 1);
                list.forEach(function eachConnection(connection) {
                    checkEndpointForRemoval(connection.getEndpoint());
                });
            });
        }
    }

    /**
     * Get a list of all the groups we're currently a member of.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getGroups
     * @returns {Array<brightstream.Group>} All of the groups the library is aware of.
     */
    that.getGroups = function () {
        return groups;
    };

    /**
     * Find a group by id and return it.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getGroup
     * @param {object} params
     * @param {string} params.id
     * @param {brightstream.Group.onJoin} [params.onJoin] - Receive notification that an endpoint has joined this group.
     * @param {brightstream.Group.onLeave} [params.onLeave] - Receive notification that an endpoint has left this group.
     * @param {brightstream.Group.onMessage} [params.onMessage] - Receive notification that a message has been
     * received to a group.
     * @returns {brightstream.Group} The group whose ID was specified.
     */
    that.getGroup = function (params) {
        var group;
        if (!params || !params.id) {
            throw new Error("Can't get a group without group id.");
        }

        groups.every(function eachGroup(grp) {
            if (grp.id === params.id) {
                group = grp;
                return false;
            }
            return true;
        });

        if (group) {
            group.listen('join', params.onJoin);
            group.listen('leave', params.onLeave);
            group.listen('message', params.onMessage);
        }

        return group;
    };

    /**
     * Remove an Endpoint. Since an endpoint can be a member of multiple groups, we can't just remove it from
     * our list on brightstream.Endpoint#leave. We must see if it's a member of any more groups. If it's not
     * a member of any other groups, we can stop keeping track of it.
     * @todo TODO Need to account for Endpoints not created as part of a group. These do not need to be
     * deleted based on group membership.
     * @memberof! brightstream.Client
     * @method brightstream.Client.checkEndpointForRemoval
     * @param {object} params
     * @param {string} params.id - The ID of the Endpoint to check for removal.
     * @private
     */
    function checkEndpointForRemoval(params) {
        params = params || {};
        if (!params.id) {
            throw new Error("Can't remove endpoint from internal tracking without group id.");
        }

        Q.all(groups.map(function eachGroup(group) {
            return group.getMembers();
        })).done(function successHandler(connectionsByGroup) {
            // connectionsByGroup is a two-dimensional array where the first dimension is a group
            // and the second dimension is a connection.
            var absent = connectionsByGroup.every(function eachConnectionList(connectionList) {
                return connectionList.every(function eachConnection(conn) {
                    return (conn.endpointId !== params.id);
                });
            });
            if (absent) {
                endpoints.every(function eachEndpoint(ept, index) {
                    if (ept.id === params.id) {
                        endpoints.splice(index, 1);
                        return false;
                    }
                    return true;
                });
            }
        });
    }

    /**
     * Find an endpoint by id and return it. In most cases, if we don't find it we will create it. This is useful
     * in the case of dynamic endpoints where groups are not in use. Set skipCreate=true to return undefined
     * if the Endpoint is not already known.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getEndpoint
     * @param {object} params
     * @param {string} params.id
     * @param {boolean} params.skipCreate - Skip the creation step and return undefined if we don't yet
     * know about this Endpoint.
     * @param {function} [params.onMessage] - Handle messages sent to the logged-in user from this one Endpoint.
     * @param {function} [params.onPresence] - Handle presence notifications from this one Endpoint.
     * @returns {brightstream.Endpoint} The endpoint whose ID was specified.
     */
    that.getEndpoint = function (params) {
        var endpoint;
        if (!params || !params.id) {
            throw new Error("Can't get an endpoint without endpoint id.");
        }

        endpoints.every(function eachEndpoint(ept) {
            if (ept.id === params.id) {
                endpoint = ept;
                return false;
            }
            return true;
        });

        if (!endpoint && params && !params.skipCreate) {
            params.instanceId = instanceId;
            endpoint = brightstream.Endpoint(params);
            endpoints.push(endpoint);
        }

        if (endpoint) {
            endpoint.listen('presence', params.onPresence);
            endpoint.listen('message', params.onMessage);
        }

        return endpoint;
    };

    /**
     * Find a Connection by id and return it. In most cases, if we don't find it we will create it. This is useful
     * in the case of dynamic endpoints where groups are not in use. Set skipCreate=true to return undefined
     * if the Connection is not already known.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getConnection
     * @param {object} params
     * @param {string} params.connectionId
     * @param {string} params.[endpointId] - An endpointId to use in the creation of this connection.
     * @param {function} [params.onMessage] - TODO
     * @param {function} [params.onPresence] - TODO
     * @returns {brightstream.Connection} The connection whose ID was specified.
     */
    that.getConnection = function (params) {
        params = params || {};
        var connection;
        var endpoint;

        if (!params || !params.connectionId) {
            throw new Error("Can't get a connection without connection id.");
        }

        if (params.endpointId) {
            endpoint = that.getEndpoint({
                id: params.endpointId,
                skipCreate: params.skipCreate
            });
        }

        if (!endpoint) {
            endpoints.every(function eachEndpoint(ept) {
                if (params.endpointId) {
                    if (params.endpointId !== ept.id) {
                        return true;
                    } else {
                        endpoint = ept;
                    }
                }

                ept.connections.every(function eachConnection(conn) {
                    if (conn.id === params.connectionId) {
                        connection = conn;
                        return false;
                    }
                    return true;
                });
                return connection === undefined;
            });
        }

        if (!connection && !params.skipCreate) {
            if (!params.endpointId || !endpoint) {
                throw new Error("Couldn't find an endpoint for this connection. Did you pass in the endpointId?");
            }

            params.instanceId = instanceId;
            connection = brightstream.Connection(params);
            endpoint.connections.push(connection);
        }

        return connection;
    };

    /**
     * Get the list of all endpoints that the library has knowledge of. The library gains knowledge of an endpoint
     * either when an endpoint joins a group that the currently logged-in endpoint is a member of (if group presence is
     * enabled); when an endpoint that the currently logged-in endpoint is watching (if enabled). If an endpoint that
     * the library does not know about sends a message to the client, there is a special case in
     * which the developer can immediately call the getEndpoint() method on the sender of the message. This tells
     * the library to keep track of the endpoint, even though it had previously not had reason to do so.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getEndpoints
     * @returns {Array<brightstream.Endpoint>}
     */
    that.getEndpoints = function () {
        return endpoints;
    };

    return that;
}; // End brightstream.Client

/**
 * Handle sending successfully.
 * @callback brightstream.Client.successHandler
 */
/**
 * Handle joining a group successfully. This callback is called only once when Client.join() is called.
 * @callback brightstream.Client.joinHandler
 * @param {brightstream.Group} group
 */
/**
 * Receive notification that the client has joined a group. This callback is called everytime
 * brightstream.Client#join is fired.
 * @callback brightstream.Client.onJoin
 * @param {brightstream.Event} evt
 * @param {brightstream.Group} evt.group
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that the client has left a group. This callback is called everytime
 * brightstream.Client#leave is fired.
 * @callback brightstream.Client.onLeave
 * @param {brightstream.Event} evt
 * @param {brightstream.Group} evt.group
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that a message has been received. This callback is called every time
 * brightstream.Client#message is fired.
 * @callback brightstream.Client.onClientMessage
 * @param {brightstream.Event} evt
 * @param {brightstream.TextMessage} evt.message
 * @param {brightstream.Group} [evt.group] - If the message is to a group we already know about,
 * this will be set. If null, the developer can use client.join({id: evt.message.header.channel}) to join
 * the group. From that point forward, Group#message will fire when a message is received as well. If
 * group is undefined instead of null, the message is not a group message at all.
 * @param {string} evt.name - the event name.
 * @param {brightstream.Client} evt.target
 */
/**
 * Receive notification that the client is receiving a call from a remote party. This callback is called every
 * time brightstream.Client#call is fired.
 * @callback brightstream.Client.onCall
 * @param {brightstream.Event} evt
 * @param {brightstream.Call} evt.call
 * @param {brightstream.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that the client is receiving a request for a direct connection from a remote party.
 * This callback is called every time brightstream.Client#direct-connection is fired.
 * @callback brightstream.Client.onDirectConnection
 * @param {brightstream.Event} evt
 * @param {brightstream.DirectConnection} evt.directConnection
 * @param {brightstream.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 * @param {brightstream.Call} evt.target
 */
/**
 * Receive notification Brightstream has successfully connected to the cloud. This callback is called every time
 * brightstream.Client#connect is fired.
 * @callback brightstream.Client.onConnect
 * @param {brightstream.Event} evt
 * @param {string} evt.name - the event name.
 * @param {brightstream.Client} evt.target
 */
/**
 * Receive notification Brightstream has successfully disconnected from the cloud. This callback is called every time
 * brightstream.Client#disconnect is fired.
 * @callback brightstream.Client.onDisconnect
 * @param {brightstream.Event} evt
 * @param {string} evt.name - the event name.
 * @param {brightstream.Client} evt.target
 */
/**
 * Receive notification Brightstream has successfully reconnected to the cloud. This callback is called every time
 * brightstream.Client#reconnect is fired.
 * @callback brightstream.Client.onReconnect
 * @param {brightstream.Event} evt
 * @param {string} evt.name - the event name.
 * @param {brightstream.Client} evt.target
 */
/**
 * Handle disconnection to the cloud successfully.
 * @callback brightstream.Client.disconnectSuccessHandler
 */
/**
 * Handle an error that resulted from a method call.
 * @callback brightstream.Client.errorHandler
 * @params {Error} err
 */
/**
 * Handle connection to the cloud successfully.
 * @callback brightstream.Client.connectSuccessHandler
 */
