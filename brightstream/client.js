/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a new WebRTC Client object.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Client
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc This is a top-level interface to the API. It handles authenticating the app to the
 * API server and receiving server-side app-specific information.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {brightstream.Client}
 * @property {object} clientSettings Client settings.
 * @property {brightstream.SignalingChannel} signalingChannel A reference to the signaling channel.
 * @property {function} chatMessage Class to use for chat messages.
 * @property {function} signalingMessage Class to use for signaling.
 * @property {function} presenceMessage Class to use for presence messages.
 * @property {brightstream.User} user Logged-in user's User object.
 */
/*global brightstream: false */
brightstream.Client = function (params) {
    "use strict";
    params = params || {};
    var client = brightstream.makeUniqueID().toString();
    var that = brightstream.EventEmitter(params);
    brightstream.instances[client] = that;
    that.className = 'brightstream.Client';

    var host = window.location.hostname;
    var port = window.location.port;
    var connected = false;
    var app = {};
    var signalingChannel = null;
    var turnRefresher = null;
    var clientSettings = params.clientSettings || {};
    var groups = [];
    var endpoints = [];

    if (!clientSettings.appId) {
        throw new Error("appId is a required parameter to Client.");
    }
    app.appId = clientSettings.appId;
    delete clientSettings.appId;

    log.debug("Client ID is ", client);

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

    signalingChannel = brightstream.SignalingChannel({'client': client});
    that.user = null;
    log.debug(signalingChannel);

    /**
     * Connect to the Digium infrastructure and authenticate using the appkey.  Store
     * a token to be used in API requests.
     * @memberof! brightstream.Client
     * @method brightstream.Client.connect
     * @param {string} authToken
     */
    var connect = that.publicize('connect', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        app.authToken = params.authToken;
        signalingChannel.open({
            appId: app.appId,
            token: app.authToken
        }).then(function () {
            return signalingChannel.authenticate({
                appId: app.appId
            });
        }, function (err) {
            deferred.reject("Couldn't connect to brightstream.");
            log.error(err.message);
        }).done(function (user) {
            connected = true;

            user.setOnline(); // Initiates presence.
            user.listen('call', params.onCall);
            user.listen('join', params.onGroupJoin);
            user.listen('leave', params.onGroupLeave);
            that.user = user;

            that.listen('message', params.onMessage);
            that.listen('connect', params.onConnect);
            that.listen('disconnect', params.onDisconnect);
            that.listen('reconnect', params.onReconnect);

            log.info('logged in as user ' + user.getName());
            log.debug(user);
            //updateTurnCredentials(); // TODO fix TURN credentials with Endpoints instead of Users.

            that.fire('connect', user);
            deferred.resolve(user);
        }, function (err) {
            deferred.reject("Couldn't create an endpoint.");
            log.error(err.message);
        });
        return deferred.promise;
    });

    /**
     * Disconnect from the Digium infrastructure. Invalidates the API token.
     * @memberof! brightstream.Client
     * @method brightstream.Client.disconnect
     */
    var disconnect = that.publicize('disconnect', function () {
        // TODO: also call this on socket disconnect
        var disconnectPromise = signalingChannel.close();
        disconnectPromise.then(function () {
            connected = false;
        });
        return disconnectPromise;
    });

    /**
     * Get the client ID
     * @memberof! brightstream.Client
     * @method brightstream.Client.getID
     * @return {string}
     */
    var getID = that.publicize('getID', function () {
        return client;
    });

    /**
     * Update TURN credentials and set a timeout to do it again in 20 hours.
     * @memberof! brightstream.Client
     * @method brightstream.Client.updateTurnCredentials
     */
    var updateTurnCredentials = that.publicize('updateTurnCredentials', function () {
        if (callSettings.disableTurn === true) {
            return;
        }

        clearInterval(turnRefresher);
        signalingChannel.getTurnCredentials().done(function successHandler(creds) {
            callSettings.servers.iceServers = creds;
        }, function errorHandler(error) {
            throw error;
        });
        turnRefresher = setInterval(updateTurnCredentials, 20 * (60 * 60 * 1000)); // 20 hours
    });

    /**
     * Determine whether the Client has authenticated with its appKey against Digium services
     * by checking the validity of the apiToken.
     * @memberof! brightstream.Client
     * @method brightstream.Client.isConnected
     * @returns {boolean}
     */
    var isConnected = that.publicize('isConnected', function () {
        return !!connected;
    });

    /**
     * Get an object containing the client settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getClientSettings
     * @returns {object} An object containing the client settings.
     */
    var getClientSettings = that.publicize('getClientSettings', function () {
        return clientSettings;
    });

    /**
     * Get an object containing the default media constraints and other media settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getCallSettings
     * @returns {object} An object containing the media settings which will be used in
     * brightstream calls.
     */
    var getCallSettings = that.publicize('getCallSettings', function () {
        return callSettings;
    });

    /**
     * Set the default media constraints and other media settings.
     * @memberof! brightstream.Client
     * @method brightstream.Client.setDefaultCallSettings
     * @param {object} Object containing settings to modify.
     */
    var setDefaultCallSettings = that.publicize('setDefaultCallSettings', function (params) {
        params = params || {};
        if (params.constraints) {
            callSettings.constraints = params.constraints;
        }
        if (params.servers) {
            callSettings.servers = params.servers;
        }
    });

    /**
     * Get the SignalingChannel.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getSignalingChannel
     * @returns {brightstream.SignalingChannel} The instance of the brightstream.SignalingChannel.
     */
    var getSignalingChannel = that.publicize('getSignalingChannel', function () {
        return signalingChannel;
    });

    /**
     * Get a Group
     * @memberof! brightstream.Client
     * @method brightstream.Client.join
     * @params {string} The name of the group.
     * @returns {brightstream.Group} The instance of the brightstream.Group which the user joined.
     */
    var join = that.publicize('join', function (params) {
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
                onLeave: params.onLeave,
                onPresence: params.onPresence
            });
            addGroup(group);
            that.user.fire('join', group);
            deferred.resolve(group);
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    /**
     * Add a Group
     * @memberof! brightstream.Client
     * @method brightstream.Client.addGroup
     * @params {id} the Group id
     * @private
     */
    var addGroup = function (newGroup) {
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
            groups.push(newGroup);
        }
    };

    /**
     * Remove a Group
     * @memberof! brightstream.Client
     * @method brightstream.Client.removeGroup
     * @params {id} the Group id
     * @private
     */
    var removeGroup = function (newGroup) {
        var index;
        var endpoints;
        if (!newGroup || !(newGroup instanceof brightstream.Group)) {
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
    };

    /**
     * Find a group by id and return it.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getGroup
     * @params {id} the Group id
     * @returns {brightstream.Group}
     */
    var getGroup = that.publicize('getGroup', function (params) {
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
    });

    /**
     * Add an Endpoint
     * @memberof! brightstream.Client
     * @method brightstream.Client.addEndpoint
     * @params {id} the Endpoint id
     * @private
     */
    var addEndpoint = that.publicize('addEndpoint', function (newEndpoint) {
        var absent = false;
        if (!newEndpoint || !newEndpoint.id) {
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
    });

    /**
     * Remove an Endpoint
     * @memberof! brightstream.Client
     * @method brightstream.Client.removeEndpoint
     * @params {id} the Endpoint id
     * @private
     */
    var checkEndpointForRemoval = that.publicize('checkEndpointForRemoval', function (params) {
        var inAGroup;
        var index;
        if (!params || !params.id) {
            throw new Error("Can't remove endpoint from internal tracking without group id.");
        }

        Q.all(groups.map(function (group) {
            return group.getEndpoints();
        })).done(function (groupEndpoints) {
            groupEndpoints.forEach(function (endpoints) {
                endpoints.forEach(function (endpoint) {
                    if (endpoint.id === params.id) {
                        inAGroup = true;
                    }
                });
            });
            if (inAGroup) {
                endpoints.every(function (ept, i) {
                    if (ept.id === params.id) {
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
    });

    /**
     * Find an endpoint by id and return it.
     * @memberof! brightstream.Client
     * @method brightstream.Client.getEndpoint
     * @params {id} the Endpoint id
     * @returns {brightstream.Contact}
     */
    var getEndpoint = that.publicize('getEndpoint', function (params) {
        var endpoint;
        if (!params || !params.id) {
            throw new Error("Can't get an endpoint without group id.");
        }

        endpoints.every(function (ept) {
            if (ept.id === params.id) {
                endpoint = ept;
                return false;
            }
            return true;
        });
        return endpoint;
    });

    return that;
}; // End brightstream.Client
