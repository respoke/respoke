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
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} [params.appId] - The ID of your BrightStream app. This must be passed either to
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
 * @param {function} [params.onJoin] - Callback for when this client's endpoint joins a group.
 * @param {function} [params.onLeave] - Callback for when this client's endpoint leaves a group.
 * @param {function} [params.onMessage] - Callback for when any message is received from anywhere on the system.
 * @param {function} [params.onConnect] - Callback for Client connect.
 * @param {function} [params.onDisconnect] - Callback for Client disconnect.
 * @param {function} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
 * @param {function} [params.onCall] - Callback for when this client's user receives a call.
 * @param {function} [params.onDirectConnection] - Callback for when this client's user receives a request for a
 * direct connection.
 * @returns {brightstream.Client}
 */
/*global brightstream: false */
brightstream.Client = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Client
     * @name client
     * @private
     * @type {string}
     */
    var client = brightstream.makeGUID();
    var that = brightstream.EventEmitter(params);
    brightstream.instances[client] = that;
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
     * @memberof! brightstream.Client
     * @name connected
     * @type {boolean}
     * @private
     */
    var connected = false;
    /**
     * A container for baseURL, token, and appId so they won't be accessble on the console.
     * @memberof! brightstream.Client
     * @name app
     * @type {object}
     * @private
     * @property {string} [baseURL] - the URL of the cloud infrastructure's REST API.
     * @property {string} [token] - The endpoint's authentication token.
     * @property {string} [appId] - The id of your BrightStream app.
     * @property {string} [endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @property {boolean} [developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @property {boolean} [reconnect=true] - Whether or not to automatically reconnect to the Brightstream service
     * when a disconnect occurs.
     * @property {function} [onJoin] - Callback for when this client's endpoint joins a group.
     * @property {function} [onLeave] - Callback for when this client's endpoint leaves a group.
     * @property {function} [onMessage] - Callback for when any message is received from anywhere on the system.
     * @property {function} [onConnect] - Callback for Client connect.
     * @property {function} [onDisconnect] - Callback for Client disconnect.
     * @property {function} [onReconnect] - Callback for Client reconnect. Not Implemented.
     * @property {function} [onCall] - Callback for when this client's user receives a call.
     * @property {function} [onDirectConnection] - Callback for when this client's user receives a request for a
     */
    var app = {
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

    if (!app.token && !app.appId) {
        throw new Error("Can't connect without either an appId, in which case developmentMode " +
            "must be set to true, or an token");
    }

    /**
     * @memberof! brightstream.Client
     * @name user - The currently logged-in endpoint.
     * @type {brightstream.User}
     */
    that.user = null;
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

    log.debug("Client ID is ", client);

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
    var signalingChannel = brightstream.SignalingChannel({'client': client, baseURL: app.baseURL});

    /**
     * Connect to the Digium infrastructure and authenticate using the `token`.  Store a new token to be used in API
     * requests. If no `token` is given and `developmentMode` is set to true, we will attempt to obtain a token
     * automatically from the Digium infrastructure.  If `reconnect` is set to true, we will attempt to keep
     * reconnecting each time this token expires. Accept and attach quite a few event listeners for things like group
     * joining and connection statuses. Get the first set of TURN credentials and store them internally for later use.
     * @memberof! brightstream.Client
     * @method brightstream.Client.connect
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {string} [params.appId] - The ID of your BrightStream app. This must be passed either to
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
     * @param {function} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {function} [params.onLeave] - Callback for when this client's endpoint leaves a group.
     * @param {function} [params.onMessage] - Callback for when any message is received from anywhere on the system.
     * @param {function} [params.onConnect] - Callback for Client connect.
     * @param {function} [params.onDisconnect] - Callback for Client disconnect.
     * @param {function} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
     * @param {function} [params.onCall] - Callback for when this client's user receives a call.
     * @param {function} [params.onDirectConnection] - Callback for when this client's user receives a request for a
     * direct connection.
     * @returns {Promise<brightstream.User>}
     * @fires brightstream.Client#connect
     */
    that.connect = function (params) {
        var promise;
        params = params || {};
        log.trace('Client.connect');

        Object.keys(params).forEach(function eachParam(key) {
            if (['onSuccess', 'onError'].indexOf(key) === -1 && params[key] !== undefined) {
                app[key] = params[key];
            }
        });
        that.endpointId = app.endpointId;

        promise = actuallyConnect(params);
        promise.done(function successHandler(user) {
            /**
             * This event is fired the first time the library connects to the cloud infrastructure.
             * @event brightstream.Client#connect
             * @type {brightstream.Event}
             * @property {brightstream.User}
             * @property {string} name - the event name.
             * @property {brightstream.Client} target
             */
            that.fire('connect', {
                user: user
            });
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
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise<brightstream.User>}
     */
    function actuallyConnect(params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        signalingChannel.open({
            actuallyConnect: actuallyConnect,
            appId: app.appId,
            developmentMode: app.developmentMode,
            endpointId: that.endpointId,
            token: app.token
        }).then(function successHandler() {
            return signalingChannel.authenticate();
        }, function errorHandler(err) {
            log.error(err.message);
            deferred.reject(new Error("Couldn't connect to brightstream: " + err.message));
        }).done(function successHandler(user) {
            connected = true;

            that.user = user;
            user.setOnline(); // Initiates presence.

            /*
             * These rely on the EventEmitter checking for duplicate event listeners in order for these
             * not to be duplicated on reconnect.
             */
            user.listen('call', app.onCall);
            user.listen('direct-connection', app.onDirectConnection);
            user.listen('join', app.onJoin);
            user.listen('leave', app.onLeave);

            that.listen('message', app.onMessage);
            that.listen('connect', app.onConnect);
            that.listen('disconnect', app.onDisconnect);
            that.listen('disconnect', setConnectedOnDisconnect);
            that.listen('reconnect', app.onReconnect);
            that.listen('reconnect', setConnectedOnReconnect);

            log.info('logged in as user ' + user.id);
            log.debug(user);

            deferred.resolve(user);
        }, function errorHandler(err) {
            connected = false;
            deferred.reject("Couldn't create an endpoint.");
            log.error(err.message);
        });
        return deferred.promise;
    }

    function setConnectedOnDisconnect() {
        that.user = null;
        connected = false;
    }

    function setConnectedOnReconnect() {
        connected = true;
    }

    /**
     * Disconnect from the Digium infrastructure, leave all groups, invalidate the token, and disconnect the websocket.
     * @memberof! brightstream.Client
     * @method brightstream.Client.disconnect
     * @returns {Promise}
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @fires brightstream.Client#disconnect
     */
    that.disconnect = function (params) {
        // TODO: also call this on socket disconnect
        params = params || {};
        var disconnectPromise = brightstream.makeDeferred(params.onSuccess, params.onError);

        if (signalingChannel.isOpen()) {
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
        that.user = null;
        connected = false;
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
     * Get the client ID. This can be used in the brightstream.getClient static method to obtain a reference
     * to the client object. Developers can instantiate multiple clients.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getID
     * @return {string} The ID of this client.
     */
    that.getID = function () {
        return client;
    };

    /**
     * Get an array containing all call in progress. Returns null if not connected.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getCalls
     * @returns {Array<brightstream.Call>} A list of all the calls in progress.
     */
    that.getCalls = function () {
        return that.user ? that.user.getCalls() : null;
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
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
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
     * @param {function} [params.onLocalVideo] - Callback for receiving an HTML5 Video element with the local
     * audio and/or video attached.
     * @param {function} [params.onRemoteVideo] - Callback for receiving an HTML5 Video element with the remote
     * audio and/or video attached.
     * @param {function} [params.onHangup] - Callback for being notified when the call has been hung up
     * @param {function} [params.onStats] - Callback for receiving statistical information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action
     * between local media becoming available and calling approve().
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
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @private
     */
    that.updateTurnCredentials = function () {
        var promise;
        if (callSettings.disableTurn === true) {
            return;
        }

        promise = signalingChannel.getTurnCredentials();
        promise.done(params.onSuccess, params.onError);
        promise.done(function successHandler(creds) {
            callSettings.servers.iceServers = creds;
        }, function errorHandler(error) {
            throw error;
        });
        return promise;
    };

    /**
     * Determine whether the Client has authenticated with its token against the brightstream infrastructure.
     * @memberof! brightstream.Client
     * @method brightstream.Client.isConnected
     * @returns {boolean} True or false to indicate whether the library is connected.
     */
    that.isConnected = function () {
        return !!connected;
    };

     /**
     * Get an object containing the client settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getClientSettings
     * @returns {object} An object containing the client settings.
     * @private
     */
    that.getClientSettings = function () {
        return app;
    };

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
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {function} [params.onMessage] - Message handler for messages from this group only.
     * @param {function} [params.onJoin] - Join event listener for endpoints who join this group only.
     * @param {function} [params.onLeave] - Leave event listener for endpoints who leave this group only.
     * @returns {Promise<brightstream.Group>} The instance of the brightstream.Group which the user joined.
     * @fires brightstream.User#join
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
                client: client,
                id: params.id,
                onMessage: params.onMessage,
                onJoin: params.onJoin,
                onLeave: params.onLeave
            });
            /**
             * This event is fired every time the currently logged-in endpoint joins a group. If the endpoint leaves
             * a group, this event will be fired again on the next time the endpoint joins the group.
             * @event {brightstream.User#join}
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             * @property {string} name - the event name.
             * @property {brightstream.User} target
             */
            that.user.fire('join', {
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
        return group;
    };

    /**
     * Add an Endpoint. This is called when we need to start keeping track of an endpoint.
     * @memberof! brightstream.Client
     * @method brightstream.Client.addEndpoint
     * @param {brightstream.Endpoint}
     */
    that.addEndpoint = function (newEndpoint) {
        var absent = false;
        if (!newEndpoint || newEndpoint.className !== 'brightstream.Endpoint') {
            throw new Error("Can't add endpoint to internal tracking. No endpoint given.");
        }
        absent = endpoints.every(function eachEndpoint(ept) {
            if (ept.id === newEndpoint.id) {
                return false;
            }
            return true;
        });

        if (absent) {
            endpoints.push(newEndpoint);
        }
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
     * @param {function} [onMessage] - TODO
     * @param {function} [onPresence] - TODO
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
            params.client = client;
            endpoint = brightstream.Endpoint(params);
            that.addEndpoint(endpoint);
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
     * @param {function} [onMessage] - TODO
     * @param {function} [onPresence] - TODO
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

            params.client = client;
            connection = brightstream.Connection(params);
            endpoint.connections.push(connection);
        }

        return connection;
    };

    /**
     * Get the list of all endpoints that the library has knowledge of. The library gains knowledge of an endpoint
     * either when an endpoint joins a group that the currently logged-in endpoint is a member of (if group presence is
     * enabled); when an endpoint that the currently logged-in endpoint is watching (if enabled). If an endpoint that
     * the library does not know about sends a message to the currently logged-in user, there is a special case in
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
