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
 * @param {string} [params.appId]
 * @param {string} [params.baseURL]
 * @param {string} [params.authToken]
 * @param {RTCConstraints} [params.constraints]
 * @param {RTCICEServers} [params.servers]
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
    var client = brightstream.makeUniqueID().toString();
    var that = brightstream.EventEmitter(params);
    brightstream.instances[client] = that;
    /**
     * @memberof! brightstream.Client
     * @name className
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
     * @memberof! brightstream.Client
     * @name app
     * @type {object}
     * @private
     * @desc A container for baseURL, authToken, and appId so they won't be accessble on the console.
     */
    var app = {
        baseURL: params.baseURL,
        authToken: params.authToken,
        appId: params.appId
    };
    delete that.appId;
    delete that.baseURL;
    /**
     * @memberof! brightstream.Client
     * @name user
     * @type {brightstream.User}
     */
    that.user = null;
    /**
     * @memberof! brightstream.Client
     * @name turnRefresher
     * @type {number}
     * @private
     * @desc A timer to facilitate refreshing the TURN credentials every 20 hours.
     */
    var turnRefresher = null;
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
    var signalingChannel = brightstream.SignalingChannel({'client': client});

    /**
     * Connect to the Digium infrastructure and authenticate using the appkey.  Store a token to be used in API
     * requests. Accept and attach quite a few event listeners for things like group joining and connection
     * statuses. Get the first set of TURN credentials and store them internally for later use.
     * @memberof! brightstream.Client
     * @method brightstream.Client.connect
     * @param {object} params
     * @param {string} params.authToken
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {function} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {function} [params.onLeave] - Callback for when this client's endpoint leaves a group.
     * @param {function} [params.onAutoJoin] - Callback for when this client's user automatically joins a group. Not
     * Implemented.
     * @param {function} [params.onAutoLeave] - Callback for when this client's user automatically leaves a group. Not
     * Implemented.
     * @param {function} [params.onMessage] - Callback for when any message is received from anywhere on the system.
     * @param {function} [params.onDisconnect] - Callback for Client disconnect.
     * @param {function} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
     * @param {function} [params.onCall] - Callback for when this client's user receives a call.
     * @param {function} [params.onDirectConnection] - Callback for when this client's user receives a request for a
     * direct connection.
     * @returns {Promise<brightstream.User>}
     * @fires brightstream.Client#connect
     */
    that.connect = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        app.authToken = params.authToken;
        app.appId = params.appId || app.appId;

        if (!app.authToken || !app.appId) {
            deferred.reject(new Error("Can't connect without appId and authToken"));
        }

        signalingChannel.open({
            appId: app.appId,
            token: app.authToken
        }).then(function () {
            return signalingChannel.authenticate({
                appId: app.appId
            });
        }, function (err) {
            log.error(err.message);
            deferred.reject(new Error("Couldn't connect to brightstream: " + err.message));
        }).done(function (user) {
            connected = true;

            user.setOnline(); // Initiates presence.
            user.listen('call', params.onCall);
            user.listen('direct-connection', params.onDirectConnection);
            user.listen('join', params.onJoin);
            user.listen('leave', params.onLeave);
            that.user = user;

            that.listen('join', params.onAutoJoin);
            that.listen('leave', params.onAutoLeave);
            that.listen('message', params.onMessage);
            that.listen('disconnect', params.onDisconnect);
            that.listen('reconnect', params.onReconnect);

            log.info('logged in as user ' + user.getName());
            log.debug(user);
            that.updateTurnCredentials();

            /**
             * @event brightstream.Client#connect
             * @type {brightstream.Event}
             * @property {brightstream.User}
             */
            that.fire('connect', {
                user: user
            });
            deferred.resolve(user);
        }, function (err) {
            deferred.reject("Couldn't create an endpoint.");
            log.error(err.message);
        });
        return deferred.promise;
    };

    /**
     * Disconnect from the Digium infrastructure. Invalidates the API token and disconnects the websocket.
     * @memberof! brightstream.Client
     * @method brightstream.Client.disconnect
     * @returns {Promise<undefined>}
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
            var leaveGroups = groups.map(function (group) {
                group.leave();
            });
            Q.all(leaveGroups).then(function () {
                return signalingChannel.close();
            }, function (err) {
                // Possibly the socket got closed already and we couldn't leave our groups. Backed will clean this up.
                disconnectPromise.resolve();
            }).fin(function () {
                if (!disconnectPromise.promise.isFulfilled()) {
                    // Successfully closed our socket after leaving all groups.
                    disconnectPromise.resolve();
                }
            });
        } else {
            disconnectPromise.resolve();
        }

        function afterDisconnect() {
            that.user = null;
            connected = false;
            endpoints = [];
            groups = [];
            /**
             * @event brightstream.Client#disconnect
             */
            that.fire('disconnect');
        }

        disconnectPromise.promise.done(afterDisconnect, afterDisconnect);
        return disconnectPromise.promise;
    };

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
     * @returns {Array<brightstream.Call>}
     */
    that.getCalls = function () {
        return that.user ? that.user.getCalls() : null;
    };

    /**
     * Send a message to an endpoint.
     * @memberof! brightstream.Client
     * @method brightstream.Client.sendMessage
     * @param {string} endpointId - The endpoint id of the recipient.
     * @param {object} params
     * @param {string} [params.connectionId] - The optional connection id of the receipient. If not set, message will be
     * broadcast to all connections for this endpoint.
     * @param {string} params.message - a string message.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise<undefined>}
     */
    that.sendMessage = function (params) {
        var endpoint = that.getEndpoint({id: params.endpointId});
        delete params.endpointId;
        return endpoint.sendMessage(params);
    };

    /**
     * Place an audio and/or video call to an endpoint.
     * @memberof! brightstream.Client
     * @method brightstream.Client.call
     * @param {object} params
     * @param {string} params.endpointId
     * @param {string} [params.connectionId]
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {brightstream.Call}
     */
    that.call = function (params) {
        var endpoint = that.getEndpoint({id: params.endpointId});
        delete params.endpointId;
        return endpoint.call(params);
    };

    /**
     * Update TURN credentials and set a timeout to do it again in 20 hours.
     * @memberof! brightstream.Client
     * @method brightstream.Client.updateTurnCredentials
     */
    that.updateTurnCredentials = function () {
        if (callSettings.disableTurn === true) {
            return;
        }

        clearInterval(turnRefresher);
        signalingChannel.getTurnCredentials().done(function successHandler(creds) {
            callSettings.servers.iceServers = creds;
        }, function errorHandler(error) {
            throw error;
        });
        turnRefresher = setInterval(that.updateTurnCredentials, 20 * (60 * 60 * 1000)); // 20 hours
    };

    /**
     * Determine whether the Client has authenticated with its token against the brightstream infrastructure.
     * @memberof! brightstream.Client
     * @method brightstream.Client.isConnected
     * @returns {boolean}
     */
    that.isConnected = function () {
        return !!connected;
    };

     /**
     * Get an object containing the client settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getClientSettings
     * @returns {object} An object containing the client settings.
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
        }).done(function () {
            var group = brightstream.Group({
                client: client,
                id: params.id,
                onMessage: params.onMessage,
                onJoin: params.onJoin,
                onLeave: params.onLeave
            });
            /**
             * @event {brightstream.User#join}
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             */
            that.user.fire('join', {
                group: group
            });
            addGroup(group);
            group.listen('leave', function (evt) {
                checkEndpointForRemoval(evt.endpoint);
            });
            deferred.resolve(group);
        }, function (err) {
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
        groups.every(function (grp) {
            if (grp.id === newGroup.id) {
                group = grp;
                return false;
            }
            return true;
        });

        if (!group) {
            newGroup.listen('leave', function (evt) {
                checkEndpointForRemoval(evt.endpoint);
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
        var endpoints;
        if (!newGroup || newGroup.className === 'brightstream.Group') {
            throw new Error("Can't remove group to internal tracking without a group.");
        }

        groups.every(function (grp, i) {
            if (grp.id === newGroup.id) {
                index = i;
                return false;
            }
            return true;
        });

        if (index > -1) {
            groups[index].getEndpoints().done(function (list) {
                endpoints = list;
                groups.splice(index, 1);
                endpoints.forEach(function (endpoint) {
                    checkEndpointForRemoval(endpoint);
                });
            });
        }
    }

    /**
     * Get a list of all the groups we're currently a member of.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getGroups
     * @returns {Array<brightstream.Group>}
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
     * @returns {brightstream.Group}
     */
    that.getGroup = function (params) {
        var group;
        if (!params || !params.id) {
            throw new Error("Can't get a group without group id.");
        }

        groups.every(function (grp) {
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
        absent = endpoints.every(function (ept) {
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
     * @param {brightstream.Endpoint}
     * @private
     */
    function checkEndpointForRemoval(theEndpoint) {
        var inAGroup;
        var index;
        if (!theEndpoint || theEndpoint.className !== 'brightstream.Endpoint') {
            throw new Error("Can't remove endpoint from internal tracking without group id.");
        }

        Q.all(groups.map(function (group) {
            return group.getEndpoints();
        })).done(function (groupEndpoints) {
            groupEndpoints.forEach(function (endpoints) {
                endpoints.forEach(function (endpoint) {
                    if (endpoint.id === theEndpoint.id) {
                        inAGroup = true;
                    }
                });
            });
            if (inAGroup) {
                endpoints.every(function (ept, i) {
                    if (ept.id === theEndpoint.id) {
                        index = i;
                        return false;
                    }
                    return true;
                });
                if (index > -1) {
                    endpoints.splice(index, 1);
                }
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
     * @returns {brightstream.Endpoint}
     */
    that.getEndpoint = function (params) {
        var endpoint;
        if (!params || !params.id) {
            throw new Error("Can't get an endpoint without endpoint id.");
        }

        endpoints.every(function (ept) {
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
     * Get the list of all endpoints we know about.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getEndpoints
     * @returns {Array<brightstream.Endpoint>}
     */
    that.getEndpoints = function () {
        return endpoints;
    };

    return that;
}; // End brightstream.Client
