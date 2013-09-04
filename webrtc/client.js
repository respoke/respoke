/**
 * Create a new WebRTC Client object.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Client
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc This is a top-level interface to the API. It handles authenticating the app to the
 * API server and receiving server-side app-specific information.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Client}
 * @property {object} clientSettings Client settings.
 * @property {webrtc.SignalingChannel} signalingChannel A reference to the signaling channel.
 * @property {webrtc.IdentityProvider} identityProvider A reference to the identity provider.
 * @property {function} chatMessage Class extending webrtc.AbstractMessage to use for chat messages.
 * @property {function} signalingMessage Class extending webrtc.AbstractMessage to use for
 * signaling.
 * @property {function} presenceMessage Class extending webrtc.AbstractMessage to use for presence
 * messages.
 * @property {webrtc.User} user Logged-in user's User object.
 */
/*global webrtc: false */
webrtc.Client = function (params) {
    "use strict";
    params = params || {};
    var client = webrtc.makeUniqueID().toString();
    var that = webrtc.EventThrower(params);
    webrtc.instances[client] = that;
    that.className = 'webrtc.Client';

    var host = window.location.hostname;
    var port = window.location.port;
    var connected = false;
    var appKey = null;
    var apiToken = null;
    var clientSettings = params.clientSettings || {};
    log.debug("Client ID is " + client);

    var mediaSettings = {
        constraints: params.constraints || [{
            video : { mandatory: { minWidth: 640, minHeight: 480 } },
            audio : true,
            optional: [],
            mandatory: {}
        }],
        servers: params.servers || {
            iceServers: [
                /* Can only have one server listed here as of yet. */
                //{ 'url': 'stun:stun.l.google.com:19302' },
                { 'url': 'turn:toto@174.129.201.5:3478', 'credential': 'password'}
            ]
        }
    };

    that.signalingChannel = webrtc.SignalingChannel({'client': client});
    that.identityProvider = webrtc.IdentityProvider({'client': client});
    that.user = null;
    log.debug(that.signalingChannel);

    /**
     * Connect to the Digium infrastructure and authenticate using the appkey.  Store
     * a token to be used in API requests.
     * @memberof! webrtc.Client
     * @method webrtc.Client.connect
     */
    var connect = that.publicize('connect', function () {
        that.signalingChannel.open();
        connected = true;
    });

    /**
     * Disconnect from the Digium infrastructure. Invalidates the API token.
     * @memberof! webrtc.Client
     * @method webrtc.Client.disconnect
     */
    var disconnect = that.publicize('disconnect', function () {
        that.signalingChannel.close();
        connected = false;
    });

    /**
     * Get the client ID
     * @memberof! webrtc.Client
     * @method webrtc.Client.getID
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
     * @param {object} userAccount Optional user account to log in with.
     * @param {string} token Optional OAuth token to use, if the user has logged in before,
     * or password if not using oAuth or OpenSocial.
     * @returns {Promise<webrtc.User>}
     */
    var login = that.publicize('login', function (userAccount, token) {
        var userPromise = that.identityProvider.login(userAccount, token);
        userPromise.then(function (user) {
            user.setOnline(); // Initiates presence.
            that.user = user;
            log.info('logged in as user ' + user.getID());
            log.debug(user);
        }, function (error) {
            log.error(error.message);
        }).done();
        return userPromise;
    });

    /**
     * Log out specified UserSession or all UserSessions if no usernames are passed. Removes
     * UserSession.
     * from Client.userSessions and Client.user
     * @memberof! webrtc.Client
     * @method webrtc.Client.logout
     * @param {string[]} username Optional array of usernames of UserSessions to log out.
     */
    var logout = that.publicize('logout', function (usernames) {
        if (that.user === null) {
            return;
        }
        var userSession = that.user.getUserSession();
        if (!usernames || userSession.userAccount in usernames) {
            that.identityProvider.logout(userSession.userAccount, userSession.token);
            userSession.loggedIn = false;
        }
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
     * @method webrtc.Client.getMediaSettings
     * @returns {object} An object containing the media settings which will be used in
     * webrtc calls.
     */
    var getMediaSettings = that.publicize('getMediaSettings', function () {
        return mediaSettings;
    });

    /**
     * Set the default media constraints and other media settings.
     * @memberof! webrtc.Client
     * @method webrtc.Client.setDefaultMediaSettings
     * @param {object} Object containing settings to modify.
     */
    var setDefaultMediaSettings = that.publicize('setDefaultMediaSettings', function (settings) {
        settings = settings || {};
        if (settings.constraints) {
            mediaSettings.constraints = settings.constraints;
        }
        if (settings.servers) {
            mediaSettings.servers = settings.servers;
        }
    });

    /**
     * Get the SignalingChannel.
     * @memberof! webrtc.Client
     * @method webrtc.Client.getSignalingChannel
     * @returns {webrtc.SignalingChannel} The instance of the webrtc.SignalingChannel.
     */
    var getSignalingChannel = that.publicize('getSignalingChannel', function () {
        return that.signalingChannel;
    });

    return that;
}; // End webrtc.Client
