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

    ['appId', 'token'].forEach(function (name) {
        if (!clientSettings[name]) {
            throw new Error(name + " is a required parameter to Client.");
        }
        app[name] = clientSettings[name];
        delete clientSettings[name];
    });

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
     */
    var connect = that.publicize('connect', function () {
        var connectPromise = signalingChannel.open({
            appId: app.appId,
            token: app.token
        });

        connectPromise.then(function () {
            connected = true;
        });
        return connectPromise;
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
     * Log in a User using the identity provider specified in the application settings. Adds
     * the UserSession to Client.userSessions.
     * Sends presence "available."
     * @memberof! webrtc.Client
     * @method webrtc.Client.login
     * @returns {Promise<webrtc.User>}
     * @param {object} username Optional user account to log in with.
     * @param {string} password Optional password or oAuth token.
     * @param {function} onSuccess
     * @param {function} onError
     * @returns {Promise<webrtc.User>}
     */
    var login = that.publicize('login', function (params) {
        var userPromise;
        var deferred;
        params = params || {};
        params.appId = app.appId;

        if (connected !== true) {
            deferred = webrtc.makePromise(function fakeHandler() {
                // This will never happen.
            }, function errorHandler(error) {
                throw error;
            });
            deferred.reject(new Error("Can't log in, signaling channel is not open."));
            return deferred.promise;
        }

        userPromise = that.identityProvider.login(params);
        userPromise.done(function successHandler(user) {
            user.setOnline(); // Initiates presence.
            that.user = user;
            log.info('logged in as user ' + user.getName());
            log.debug(user);

            updateTurnCredentials();
        }, function errorHandler(error) {
            throw error;
        });

        return userPromise;
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
     * Log out specified UserSession or all UserSessions if no usernames are passed. Sets
     * Client.user to null.
     * @memberof! webrtc.Client
     * @method webrtc.Client.logout
     * @param {function} onSuccess
     * @param {function} onError
     * @fires webrtc.User#loggedout
     * @fires webrtc.Client#loggedout
     */
    var logout = that.publicize('logout', function (params) {
        if (that.user === null) {
            return;
        }

        var logoutPromise = that.identityProvider.logout(params);

        logoutPromise.done(function successHandler() {
            that.user.fire('loggedout');
            that.user = null;
            that.fire('loggedout');
            clearInterval(turnRefresher);
        }, function errorHandler(err) {
            throw err;
        });

        return logoutPromise;
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
     * Determine whether any Users have logged in by checking the existence of logged-in Endpoints.
     * @memberof! webrtc.Client
     * @method webrtc.Client.isLoggedIn
     * @returns {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        if (that.user) {
            return !!that.user.getUserSession().isLoggedIn();
        }
        return false;
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
        if (!params.name) {
            deferred.reject(new Error("Can't join a group with no group name."));
            return deferred.promise;
        }

        signalingChannel.getGroup(params).done(function (group) {
            group.client = client;
            deferred.resolve(webrtc.Group(group));
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    return that;
}; // End webrtc.Client
