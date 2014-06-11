/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * This is a top-level interface to the API. It handles authenticating the app to the
 * API server, receiving server-side app-specific information, keeping track of connection status and presence,
 * accepting callbacks and listeners, and interacting with information the library keeps
 * track of, like groups and endpoints. The client also keeps track of default settings for calls and direct
 * connections as well as automatically reconnecting to the service when network activity is lost.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.Client
 * @constructor
 * @augments respoke.Presentable
 * @param {object} params
 * @param {string} [params.appId] - The ID of your Respoke app. This must be passed either to
 * respoke.connect, respoke.createClient, or to client.connect.
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
 * @param {string|number|object|Array} [params.presence=unavailable] The initial presence to set once connected.
 * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Respoke service
 * when a disconnect occurs.
 * @param {respoke.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
 * @param {respoke.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves a group.
 * @param {respoke.Client.onClientMessage} [params.onMessage] - Callback for when any message is received
 * from anywhere on the system.
 * @param {respoke.Client.onConnect} [params.onConnect] - Callback for Client connect.
 * @param {respoke.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
 * @param {respoke.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect.
 * @param {respoke.Client.onCall} [params.onCall] - Callback for when this client's user receives a call.
 * @param {respoke.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this client's user
 * receives a request for a direct connection.
 * @returns {respoke.Client}
 */
/*global respoke: false */
respoke.Client = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Client
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId || respoke.makeGUID();
    params.instanceId = instanceId;
    var that = respoke.Presentable(params);
    respoke.instances[instanceId] = that;
    delete that.instanceId;
    that.connectTries = 0;
    /**
     * A name to identify this class
     * @memberof! respoke.Client
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Client';
    /**
     * @memberof! respoke.Client
     * @name host
     * @type {string}
     * @private
     */
    var host = window.location.hostname;
    /**
     * @memberof! respoke.Client
     * @name port
     * @type {number}
     * @private
     */
    var port = window.location.port;
    /**
     * Whether the client is connected to the cloud infrastructure.
     * @memberof! respoke.Client
     * @name connected
     * @type {boolean}
     */
    that.connected = false;
    /**
     * A simple POJO to store some methods we will want to override but reference later.
     * @memberof! respoke.Client
     * @name superClass
     * @private
     * @type {object}
     */
    var superClass = {
        setPresence: that.setPresence
    };
    /**
     * A container for baseURL, token, and appId so they won't be accidentally viewable in any JavaScript debugger.
     * @memberof! respoke.Client
     * @name clientSettings
     * @type {object}
     * @private
     * @property {string} [baseURL] - the URL of the cloud infrastructure's REST API.
     * @property {string} [token] - The endpoint's authentication token.
     * @property {string} [appId] - The id of your Respoke app.
     * @property {string} [endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @property {boolean} [developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @property {boolean} [reconnect=true] - Whether or not to automatically reconnect to the Respoke service
     * when a disconnect occurs.
     * @property {onJoin} [onJoin] - Callback for when this client's endpoint joins a group.
     * @property {onLeave} [onLeave] - Callback for when this client's endpoint leaves a group.
     * @property {respoke.Client.onClientMessage} [onMessage] - Callback for when any message is received
     * from anywhere on the system.
     * @property {respoke.Client.onConnect} [onConnect] - Callback for Client connect.
     * @property {respoke.Client.onDisconnect} [onDisconnect] - Callback for Client disconnect.
     * @property {respoke.Client.onReconnect} [onReconnect] - Callback for Client reconnect. Not Implemented.
     * @property {respoke.Client.onCall} [onCall] - Callback for when this client receives a call.
     * @property {respoke.Client.onDirectConnection} [onDirectConnection] - Callback for when this client
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
        onDirectConnection: params.onDirectConnection,
        resolveEndpointPresence: params.resolveEndpointPresence
    };
    delete that.appId;
    delete that.baseURL;
    delete that.developmentMode;
    delete that.token;

    /**
     * @memberof! respoke.Client
     * @name groups
     * @type {Array<respoke.Group>}
     * @private
     */
    var groups = [];
    /**
     * @memberof! respoke.Client
     * @name endpoints
     * @type {Array<respoke.Endpoint>}
     * @private
     */
    var endpoints = [];
    /**
     * Array of calls in progress. This array should never be modified.
     * @memberof! respoke.Client
     * @name calls
     * @type {array}
     */
    that.calls = [];
    log.debug("Client ID is ", instanceId);

    /**
     * @memberof! respoke.Client
     * @name callSettings
     * @type {object}
     */
    that.callSettings = {
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
     * @memberof! respoke.Client
     * @name signalingChannel
     * @type {respoke.SignalingChannel}
     * @private
     */
    var result = respoke.SignalingChannel({
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
     * @memberof! respoke.Client
     * @method respoke.Client.connect
     * @param {object} params
     * @param {respoke.Client.connectSuccessHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {string} [params.appId] - The ID of your Respoke app. This must be passed either to
     * respoke.connect, respoke.createClient, or to client.connect.
     * @param {string} [params.token] - The endpoint's authentication token.
     * @param {RTCConstraints} [params.constraints] - A set of default WebRTC call constraints if you wish to use
     * different parameters than the built-in defaults.
     * @param {RTCICEServers} [params.servers] - A set of default WebRTC ICE/STUN/TURN servers if you wish to use
     * different parameters than the built-in defaults.
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @param {string|number|object|Array} [params.presence] The initial presence to set once connected.
     * @param {respoke.client.resolveEndpointPresence} [params.resolveEndpointPresence] An optional function for resolving presence for an endpoint.
     * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Respoke service
     * when a disconnect occurs.
     * @param {respoke.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {respoke.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves
     * a group.
     * @param {respoke.Client.onClientMessage} [params.onMessage] - Callback for when any message is
     * received from anywhere on the system.
     * @param {respoke.Client.onConnect} [params.onConnect] - Callback for Client connect.
     * @param {respoke.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
     * @param {respoke.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
     * @param {respoke.Client.onCall} [params.onCall] - Callback for when this client receives a call.
     * @param {respoke.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this
     * client receives a request for a direct connection.
     * @returns {Promise}
     * @fires respoke.Client#connect
     */
    that.connect = function (params) {
        var promise;
        var retVal;
        params = params || {};
        log.trace('Client.connect');
        that.connectTries += 1;

        Object.keys(params).forEach(function eachParam(key) {
            if (['onSuccess', 'onError'].indexOf(key) === -1 && params[key] !== undefined) {
                clientSettings[key] = params[key];
            }
        });
        that.endpointId = clientSettings.endpointId;
        promise = actuallyConnect(params);
        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        promise.then(function successHandler() {
            /**
             * This event is fired the first time the library connects to the cloud infrastructure.
             * @event respoke.Client#connect
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            that.fire('connect');
        });
        return retVal;
    };

    /**
     * This function contains the meat of the connection, the portions which can be repeated again on reconnect.
     * When `reconnect` is true, this function will be added in an event listener to the Client#disconnect event.
     * @memberof! respoke.Client
     * @method respoke.Client.actuallyConnect
     * @private
     * @param {object} params
     * @param {connectSuccessHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise|undefined}
     */
    function actuallyConnect(params) {
        params = params || {};
        var deferred = Q.defer();

        if (!clientSettings.token &&
                (!clientSettings.appId || !clientSettings.endpointId || clientSettings.developmentMode !== true)) {
            deferred.reject(new Error("Must pass either endpointID & appId & developmentMode=true, or a token, " +
                "to client.connect()."));
            return deferred.promise;
        }

        signalingChannel.open({
            actuallyConnect: actuallyConnect,
            endpointId: that.endpointId,
            token: clientSettings.token
        }).then(function successHandler() {
            return signalingChannel.authenticate();
        }, function errorHandler(err) {
            log.error(err.message);
            deferred.reject(new Error(err.message));
        }).done(function successHandler() {
            that.connected = true;
            // set initial presence for the connection
            if (clientSettings.presence) {
                that.setPresence({presence: clientSettings.presence});
            }

            /*
             * These rely on the EventEmitter checking for duplicate event listeners in order for these
             * not to be duplicated on reconnect.
             */
            that.listen('call', clientSettings.onCall);
            that.listen('call', removeCallOnHangup, true);
            that.listen('direct-connection', clientSettings.onDirectConnection);
            that.listen('direct-connection', removeDCCallOnHangup, true);
            that.listen('join', clientSettings.onJoin);
            that.listen('leave', clientSettings.onLeave);
            that.listen('message', clientSettings.onMessage);
            that.listen('connect', clientSettings.onConnect);
            that.listen('disconnect', clientSettings.onDisconnect);
            that.listen('disconnect', setConnectedOnDisconnect, true);
            that.listen('reconnect', clientSettings.onReconnect);
            that.listen('reconnect', setConnectedOnReconnect, true);

            log.info('logged in as ' + that.endpointId, that);
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

    function removeCallOnHangup(evt) {
        evt.call.listen('hangup', function (evt) {
            removeCall({call: evt.target});
        }, true);
        addCall(evt);
    }

    function removeDCCallOnHangup(evt) {
        addCall({call: evt.directConnection.call});
        evt.directConnection.listen('close', function (evt) {
            removeCall({call: evt.target.call});
        }, true);
    }

    /**
     * Disconnect from the Digium infrastructure, leave all groups, invalidate the token, and disconnect the websocket.
     * @memberof! respoke.Client
     * @method respoke.Client.disconnect
     * @returns {Promise|undefined}
     * @param {object} params
     * @param {disconnectSuccessHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires respoke.Client#disconnect
     */
    that.disconnect = function (params) {
        // TODO: also call this on socket disconnect
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        if (signalingChannel.connected) {
            // do websocket stuff. If the websocket is already closed, we have to skip this stuff.
            var leaveGroups = groups.map(function eachGroup(group) {
                group.leave();
            });
            Q.all(leaveGroups).then(function successHandler() {
                return signalingChannel.close();
            }, function errorHandler(err) {
                // Possibly the socket got closed already and we couldn't leave our groups. Backend will clean this up.
                deferred.resolve();
            }).fin(function finallyHandler() {
                if (!deferred.promise.isFulfilled()) {
                    // Successfully closed our socket after leaving all groups.
                    deferred.resolve();
                }
            });
            deferred.promise.then(afterDisconnect, afterDisconnect);
        } else {
            deferred.resolve();
        }
        return retVal;
    };

    /**
     * Clean up after an intentional disconnect.
     * @memberof! respoke.Client
     * @method respoke.Client.afterDisconnect
     * @private
     */
    function afterDisconnect() {
        that.connected = false;
        that.presence = 'unavailable';
        endpoints = [];
        groups = [];
        /**
         * This event is fired when the library has disconnected from the cloud infrastructure.
         * @event respoke.Client#disconnect
         * @property {string} name - the event name.
         * @property {respoke.Client} target
         */
        that.fire('disconnect');
    }

    /**
     * Overrides Presentable.setPresence to send presence to the server before updating the object.
     * @memberof! respoke.Client
     * @method respoke.Client.setPresence
     * @param {object} params
     * @param {string|number|object|Array} params.presence
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @return {Promise|undefined}
     */
    that.setPresence = function (params) {
        var promise;
        var retVal;
        params = params || {};

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            return respoke.handlePromise(promise, params.onSuccess, params.onError);
        }

        log.info('sending my presence update ' + params.presence);

        promise = signalingChannel.sendPresence({
            presence: params.presence
        });

        promise.then(function successHandler(p) {
            superClass.setPresence(params);
            clientSettings.presence = params.presence;
        });
        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        return retVal;
    };

    /**
     * Get the Call with the endpoint specified.
     * @memberof! respoke.Client
     * @method respoke.Client.getCall
     * @param {object} params
     * @param {string} [params.id] - Call ID.
     * @param {string} [params.endpointId] - Endpoint ID. Warning: If you pass only the endpointId, this method
     * will just return the first call that matches. If you are placing multiple calls to the same endpoint,
     * pass in the call ID, too.
     * @param {boolean} params.create - whether or not to create a new call if the specified endpointId isn't found
     * @returns {respoke.Call}
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
     * Add the call to internal record-keeping.
     * @memberof! respoke.Client
     * @method respoke.Client.addCall
     * @param {object} evt
     * @param {respoke.Call} evt.call
     * @param {respoke.Endpoint} evt.endpoint
     * @private
     */
    function addCall(evt) {
        if (!evt.call) {
            throw new Error("Can't add call without a call parameter.");
        }
        if (that.calls.indexOf(evt.call) === -1) {
            that.calls.push(evt.call);

            updateTurnCredentials().done(null, function (err) {
                var message = "Couldn't get TURN credentials. Sure hope this call goes peer-to-peer!";
                /**
                 * This event is fired on errors that occur during call setup or media negotiation.
                 * @event respoke.Call#error
                 * @type {respoke.Event}
                 * @property {string} reason - A human readable description about the error.
                 * @property {respoke.Call} target
                 * @property {string} name - the event name.
                 */
                that.fire('error', {
                    reason: message
                });
            });

            if (evt.call.className === 'respoke.Call') {
                if (!evt.call.caller && !that.hasListeners('call')) {
                    log.warn("Got a incoming call with no handlers to accept it!");
                    evt.call.reject();
                    return;
                }
            }
        }
    }

    /**
     * Remove the call or direct connection from internal record-keeping.
     * @memberof! respoke.Client
     * @method respoke.Client.removeCall
     * @param {object} evt
     * @param {respoke.Call} evt.target
     * @private
     */
    function removeCall(evt) {
        var match = 0;
        if (!evt.call) {
            throw new Error("Can't remove call without a call parameter.");
        }

        // Loop backward since we're modifying the array in place.
        for (var i = that.calls.length - 1; i >= 0; i -= 1) {
            if (that.calls[i].id === evt.call.id) {
                that.calls.splice(i, 1);
                match += 1;
            }
        }

        if (match !== 1) {
            log.warn("Something went wrong.", match, "calls were removed!");
        }
    }

    /**
     * Set presence to available.
     * @memberof! respoke.Client
     * @method respoke.Client.setOnline
     * @param {object} params
     * @param {string|number|object|Array} [params.presence=available] - The presence to set.
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise}
     */
    that.setOnline = function (params) {
        var promise;

        params = params || {};
        params.presence = params.presence || 'available';

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            return respoke.handlePromise(promise, params.onSuccess, params.onError);
        }

        return that.setPresence(params);
    };

    /**
     * Send a message to an endpoint.
     * @memberof! respoke.Client
     * @method respoke.Client.sendMessage
     * @param {object} params
     * @param {string} params.endpointId - The endpoint id of the recipient.
     * @param {string} [params.connectionId] - The optional connection id of the receipient. If not set, message will be
     * broadcast to all connections for this endpoint.
     * @param {string} params.message - a string message.
     * @param {sendHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        var promise;
        var retVal;
        var endpoint;
        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }
        endpoint = that.getEndpoint({id: params.endpointId});
        delete params.endpointId;
        return endpoint.sendMessage(params);
    };

    /**
     * Place an audio and/or video call to an endpoint.
     * @memberof! respoke.Client
     * @method respoke.Client.startCall
     * @param {object} params
     * @param {string} params.endpointId - The id of the endpoint that should be called.
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {string} [params.connectionId]
     * @param {respoke.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video element
     * with the local audio and/or video attached.
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video element
     * with the remote audio and/or video attached.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @return {respoke.Call}
     */
    that.startCall = function (params) {
        var promise;
        var retVal;
        var endpoint;

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        endpoint = that.getEndpoint({id: params.endpointId});
        delete params.endpointId;
        return endpoint.startCall(params);
    };

    /**
     * Assert that we are connected to the backend infrastructure.
     * @memberof! respoke.Client
     * @method respoke.Client.verifyConnected
     * @throws {Error}
     */
    that.verifyConnected = function () {
        if (that.connected !== true || signalingChannel.connected !== true) {
            throw new Error("Can't complete request when not connected. Please reconnect!");
        }
    };

    /**
     * Update TURN credentials.
     * @memberof! respoke.Client
     * @method respoke.Client.updateTurnCredentials
     * @returns {Promise}
     * @param {object} params
     * @param {respoke.SignalingChannel.turnSuccessHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @private
     */
    function updateTurnCredentials() {
        var promise;
        var retVal;

        if (that.callSettings.disableTurn === true) {
            return;
        }

        try {
            if (typeof that.verifyConnected === 'undefined') {
                throw new Error("that.verifyConnected is undefined");
            }
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        promise = getTurnCredentials();
        promise.then(params.onSuccess, params.onError);
        promise.then(function successHandler(creds) {
            that.callSettings = that.callSettings || {};
            that.callSettings.servers = that.callSettings.servers || {};
            that.callSettings.servers.iceServers = creds;
        }, null);
        return promise;
    }

    /**
     * Join a Group and begin keeping track of it. Attach some event listeners.
     * @memberof! respoke.Client
     * @method respoke.Client.join
     * @param {object} params
     * @param {string} params.id - The name of the group.
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {respoke.Group.onMessage} [params.onMessage] - Message handler for messages from this group only.
     * @param {respoke.Group.onJoin} [params.onJoin] - Join event listener for endpoints who join this group only.
     * @param {respoke.Group.onLeave} [params.onLeave] - Leave event listener for endpoints who leave
     * this group only.
     * @returns {Promise<respoke.Group>} The instance of the respoke.Group which the client joined.
     * @fires respoke.Client#join
     */
    that.join = function (params) {
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
        try {
            that.verifyConnected();
        } catch (e) {
            deferred.reject(e);
            return retVal;
        }

        if (!params.id) {
            deferred.reject(new Error("Can't join a group with no group id."));
            return retVal;
        }

        signalingChannel.joinGroup({
            id: params.id
        }).done(function successHandler() {
            params.signalingChannel = signalingChannel;
            params.instanceId = instanceId;
            var group = respoke.Group(params);
            /**
             * This event is fired every time the client joins a group. If the client leaves
             * a group, this event will be fired again on the next time the client joins the group.
             * @event respoke.Client#join
             * @type {respoke.Event}
             * @property {respoke.Group} group
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
        return retVal;
    };

    /**
     * Add a Group. This is called when we join a group and need to begin keeping track of it.
     * @memberof! respoke.Client
     * @method respoke.Client.addGroup
     * @param {respoke.Group}
     * @private
     */
    function addGroup(newGroup) {
        var group;
        if (!newGroup || newGroup.className !== 'respoke.Group') {
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
     * @memberof! respoke.Client
     * @method respoke.Client.removeGroup
     * @param {respoke.Group}
     * @private
     */
    function removeGroup(newGroup) {
        var index;
        if (!newGroup || newGroup.className === 'respoke.Group') {
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
     * @memberof! respoke.Client
     * @method respoke.Client.getGroups
     * @returns {Array<respoke.Group>} All of the groups the library is aware of.
     */
    that.getGroups = function () {
        return groups;
    };

    /**
     * Find a group by id and return it.
     * @memberof! respoke.Client
     * @method respoke.Client.getGroup
     * @param {object} params
     * @param {string} params.id
     * @param {respoke.Group.onJoin} [params.onJoin] - Receive notification that an endpoint has joined this group.
     * @param {respoke.Group.onLeave} [params.onLeave] - Receive notification that an endpoint has left this group.
     * @param {respoke.Group.onMessage} [params.onMessage] - Receive notification that a message has been
     * received to a group.
     * @returns {respoke.Group} The group whose ID was specified.
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
     * our list on respoke.Endpoint#leave. We must see if it's a member of any more groups. If it's not
     * a member of any other groups, we can stop keeping track of it.
     * @todo TODO Need to account for Endpoints not created as part of a group. These do not need to be
     * deleted based on group membership.
     * @memberof! respoke.Client
     * @method respoke.Client.checkEndpointForRemoval
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
     * @memberof! respoke.Client
     * @method respoke.Client.getEndpoint
     * @param {object} params
     * @param {string} params.id
     * @param {boolean} params.skipCreate - Skip the creation step and return undefined if we don't yet
     * know about this Endpoint.
     * @param {respoke.Endpoint.onMessage} [params.onMessage] - Handle messages sent to the logged-in user
     * from this one Endpoint.
     * @param {respoke.Endpoint.onPresence} [params.onPresence] - Handle presence notifications from this one
     * Endpoint.
     * @returns {respoke.Endpoint} The endpoint whose ID was specified.
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
            params.signalingChannel = signalingChannel;
            params.resolveEndpointPresence = clientSettings.resolveEndpointPresence;

            endpoint = respoke.Endpoint(params);
            signalingChannel.registerPresence({
                endpointList: [endpoint.id]
            }).done(null, function (err) {
                log.error("Couldn't register for presence on", endpoint.id, err.message);
            });
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
     * @memberof! respoke.Client
     * @method respoke.Client.getConnection
     * @param {object} params
     * @param {string} params.connectionId
     * @param {string} [params.endpointId] - An endpointId to use in the creation of this connection.
     * @param {respoke.Endpoint.onMessage} [params.onMessage] - Handle messages sent to the logged-in user
     * from this one Connection.
     * @param {respoke.Endpoint.onPresence} [params.onPresence] - Handle presence notifications from this one
     * Connection.
     * @returns {respoke.Connection} The connection whose ID was specified.
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
            connection = respoke.Connection(params);
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
     * @memberof! respoke.Client
     * @method respoke.Client.getEndpoints
     * @returns {Array<respoke.Endpoint>}
     */
    that.getEndpoints = function () {
        return endpoints;
    };

    return that;
}; // End respoke.Client

/**
 * Handle sending successfully.
 * @callback respoke.Client.successHandler
 */
/**
 * Handle joining a group successfully. This callback is called only once when Client.join() is called.
 * @callback respoke.Client.joinHandler
 * @param {respoke.Group} group
 */
/**
 * Receive notification that the client has joined a group. This callback is called everytime
 * respoke.Client#join is fired.
 * @callback respoke.Client.onJoin
 * @param {respoke.Event} evt
 * @param {respoke.Group} evt.group
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that the client has left a group. This callback is called everytime
 * respoke.Client#leave is fired.
 * @callback respoke.Client.onLeave
 * @param {respoke.Event} evt
 * @param {respoke.Group} evt.group
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that a message has been received. This callback is called every time
 * respoke.Client#message is fired.
 * @callback respoke.Client.onClientMessage
 * @param {respoke.Event} evt
 * @param {respoke.TextMessage} evt.message
 * @param {respoke.Group} [evt.group] - If the message is to a group we already know about,
 * this will be set. If null, the developer can use client.join({id: evt.message.header.channel}) to join
 * the group. From that point forward, Group#message will fire when a message is received as well. If
 * group is undefined instead of null, the message is not a group message at all.
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Receive notification that the client is receiving a call from a remote party. This callback is called every
 * time respoke.Client#call is fired.
 * @callback respoke.Client.onCall
 * @param {respoke.Event} evt
 * @param {respoke.Call} evt.call
 * @param {respoke.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that the client is receiving a request for a direct connection from a remote party.
 * This callback is called every time respoke.Client#direct-connection is fired.
 * @callback respoke.Client.onDirectConnection
 * @param {respoke.Event} evt
 * @param {respoke.DirectConnection} evt.directConnection
 * @param {respoke.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * Receive notification Respoke has successfully connected to the cloud. This callback is called every time
 * respoke.Client#connect is fired.
 * @callback respoke.Client.onConnect
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Receive notification Respoke has successfully disconnected from the cloud. This callback is called every time
 * respoke.Client#disconnect is fired.
 * @callback respoke.Client.onDisconnect
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Receive notification Respoke has successfully reconnected to the cloud. This callback is called every time
 * respoke.Client#reconnect is fired.
 * @callback respoke.Client.onReconnect
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Handle disconnection to the cloud successfully.
 * @callback respoke.Client.disconnectSuccessHandler
 */
/**
 * Handle an error that resulted from a method call.
 * @callback respoke.Client.errorHandler
 * @params {Error} err
 */
/**
 * Handle connection to the cloud successfully.
 * @callback respoke.Client.connectSuccessHandler
 */
