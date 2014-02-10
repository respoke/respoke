/**
 * Create a new WebRTC Client object.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Client
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc This is a top-level interface to the API. It handles authenticating the app to the
 * API server and receiving server-side app-specific information.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Client}
 * @property {object} clientSettings Client settings.
 * @property {webrtc.SignalingChannel} signalingChannel A reference to the signaling channel.
 * @property {webrtc.IdentityProvider} identityProvider A reference to the identity provider.
 * @property {function} chatMessage Class to use for chat messages.
 * @property {function} signalingMessage Class to use for signaling.
 * @property {function} presenceMessage Class to use for presence messages.
 * @property {webrtc.User} user Logged-in user's User object.
 */
/*global webrtc: false */
webrtc.Client = function (params) {
    "use strict";
    params = params || {};
    var client = webrtc.makeUniqueID().toString();
    var that = webrtc.EventEmitter(params);
    webrtc.instances[client] = that;
    that.className = 'webrtc.Client';

    var host = window.location.hostname;
    var port = window.location.port;
    var connected = false;
    var app = {};
    var signalingChannel = null;
    var turnRefresher = null;
    var clientSettings = params.clientSettings || {};
    var groups = [];
    var endpoints = [];
    var onMessage = function () {};
    var onCall = function () {};
    var onGroupJoin = function () {};
    var onGroupLeave = function () {};
    var onConnect = function () {};
    var onDisconnect = function () {};
    var onReconnect = function () {};

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

    signalingChannel = webrtc.SignalingChannel({'client': client});
    that.identityProvider = webrtc.IdentityProvider({'client': client});
    that.user = null;
    log.debug(signalingChannel);

    /**
     * Connect to the Digium infrastructure and authenticate using the appkey.  Store
     * a token to be used in API requests.
     * @memberof! webrtc.Client
     * @method webrtc.Client.connect
     * @param {string} authToken
     */
    var connect = that.publicize('connect', function (params) {
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);

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

            onMessage = params.onMessage || onMessage;
            onCall = params.onCall || onCall;
            onGroupJoin = params.onGroupJoin || onGroupJoin;
            onGroupLeave = params.onGroupLeave || onGroupLeave;
            onConnect = params.onConnect || onConnect;
            onDisconnect = params.onDisconnect || onDisconnect;
            onReconnect = params.onReconnect || onReconnect;

            user.setOnline(); // Initiates presence.
            user.listen('call', onCall);
            user.listen('join', onGroupJoin);
            user.listen('leave', onGroupLeave);
            that.listen('connect', onConnect);
            that.listen('disconnect', onDisconnect);
            that.listen('reconnect', onReconnect);
            that.user = user;
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.disconnect
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.getID
     * @return {string}
     */
    var getID = that.publicize('getID', function () {
        return client;
    });

    /**
     * Update TURN credentials and set a timeout to do it again in 20 hours.
     * @memberof! webrtc.Client
     * @method webrtc.Client.updateTurnCredentials
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.isConnected
     * @returns {boolean}
     */
    var isConnected = that.publicize('isConnected', function () {
        return !!connected;
    });

    /**
     * Get an object containing the client settings.
     * @memberof! webrtc.Client
     * @method webrtc.Client.getClientSettings
     * @returns {object} An object containing the client settings.
     */
    var getClientSettings = that.publicize('getClientSettings', function () {
        return clientSettings;
    });

    /**
     * Get an object containing the default media constraints and other media settings.
     * @memberof! webrtc.Client
     * @method webrtc.Client.getCallSettings
     * @returns {object} An object containing the media settings which will be used in
     * webrtc calls.
     */
    var getCallSettings = that.publicize('getCallSettings', function () {
        return callSettings;
    });

    /**
     * Set the default media constraints and other media settings.
     * @memberof! webrtc.Client
     * @method webrtc.Client.setDefaultCallSettings
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.getSignalingChannel
     * @returns {webrtc.SignalingChannel} The instance of the webrtc.SignalingChannel.
     */
    var getSignalingChannel = that.publicize('getSignalingChannel', function () {
        return signalingChannel;
    });

    /**
     * Get a Group
     * @memberof! webrtc.Client
     * @method webrtc.Client.join
     * @params {string} The name of the group.
     * @returns {webrtc.Group} The instance of the webrtc.Group which the user joined.
     */
    var join = that.publicize('join', function (params) {
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
        if (!params.id) {
            deferred.reject(new Error("Can't join a group with no group id."));
            return deferred.promise;
        }

        signalingChannel.joinGroup({
            id: params.id
        }).done(function () {
            var group = webrtc.Group({
                client: client,
                id: params.id,
                onMessage: params.onMessage,
                onEnter: params.onEnter,
                onLeave: params.onLeave,
                onPresence: params.onPresence
            });
            addGroup(group);
            deferred.resolve(group);
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    /**
     * Add a Group
     * @memberof! webrtc.Client
     * @method webrtc.Client.addGroup
     * @params {id} the Group id
     * @private
     */
    var addGroup = function (newGroup) {
        var group;
        if (!newGroup || newGroup.className !== 'webrtc.Group') {
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.removeGroup
     * @params {id} the Group id
     * @private
     */
    var removeGroup = function (newGroup) {
        var index;
        var endpoints;
        if (!newGroup || !(newGroup instanceof webrtc.Group)) {
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.getGroup
     * @params {id} the Group id
     * @returns {webrtc.Group}
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
     * @memberof! webrtc.Client
     * @method webrtc.Client.addEndpoint
     * @params {id} the Endpoint id
     * @private
     */
    var addEndpoint = that.publicize('addEndpoint', function (newEndpoint) {
        var absent = false;
        if (!newEndpoint || !newEndpoint.id) {
            throw new Error("Can't add endpoint to internal tracking. No endpoint given.");
        }
        console.log('addEndpoints before', endpoints);
        absent = endpoints.every(function (ept) {
            if (ept.id === newEndpoint.id) {
                console.log('addEndpoints false');
                return false;
            }
            console.log('addEndpoints true');
            return true;
        });

        console.log('addEndpoints checking absent', absent);
        if (absent) {
            endpoints.push(newEndpoint);
        }
        console.log('addEndpoints after', endpoints);
    });

    /**
     * Remove an Endpoint
     * @memberof! webrtc.Client
     * @method webrtc.Client.removeEndpoint
     * @params {id} the Endpoint id
     * @private
     */
    var checkEndpointForRemoval = that.publicize('checkEndpointForRemoval', function (params) {
        var inAGroup;
        var index;
        if (!params || !params.id) {
            throw new Error("Can't remove endpoint from internal tracking without group id.");
        }

        console.log('checkEndpointForRemoval before', endpoints);
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
            console.log('checkEndpointForRemoval after', endpoints);
        });
    });

    /**
     * Find an endpoint by id and return it.
     * @memberof! webrtc.Client
     * @method webrtc.Client.getEndpoint
     * @params {id} the Endpoint id
     * @returns {webrtc.Contact}
     */
    var getEndpoint = that.publicize('getEndpoint', function (params) {
        var endpoint;
        if (!params || !params.id) {
            throw new Error("Can't get an endpoint without group id.");
        }

        console.log("looking for", params.id, 'in', endpoints);
        endpoints.every(function (ept) {
            console.log('comparing', ept.id, params.id);
            if (ept.id === params.id) {
                endpoint = ept;
                return false;
            }
            return true;
        });
        return endpoint;
    });

    return that;
}; // End webrtc.Client
