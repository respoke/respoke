/**
 * Create a new WebRTC Mercury object.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Mercury
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc This is a top-level interface to the API. It handles authenticating the app to the
 * API server and receiving server-side app-specific information.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Mercury}
 * @property {object} appSettings Application-wide settings.
 * @property {webrtc.SignalingChannel} signalingChannel A reference to the signaling channel.
 * @property {webrtc.IdentityProvider} identityProvider A reference to the identity provider.
 * @property {function} chatMessage Class extending webrtc.Message to use for chat messages.
 * @property {function} signalingMessage Class extending webrtc.Message to use for signaling.
 * @property {function} presenceMessage Class extending webrtc.Message to use for presence
 * messages.
 * @property {webrtc.User} user Logged-in user's User object.
 */
/*global webrtc: false */
webrtc.Mercury = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.EventThrower(params);
    that.className = 'webrtc.Mercury';

    var host = window.location.hostname;
    var port = window.location.port;
    var connected = false;
    var appKey = null;
    var apiToken = null;
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
    that.appSettings = {
        /* These are the names of classes which can be configured by the developer.
         * The constructor will search for them in the 'webrtc' and 'window' namespaces
         * and use them to do the job of some of the default classes.
         */
        signalingChannel: 'XMPPSignalingChannel',
        identityProvider: 'XMPPIdentityProvider',
        chatMessage: 'XMPPChatMessage',
        signalingMessage: 'XMPPSignalingMessage',
        presenceMessage: 'XMPPPresenceMessage'
    };

    /**
     * Find a configurable class in the webrtc or window scopes and instantiate with the
     * given params.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.findClass
     * @private
     * @params {string} className The name of the class for which to look.
     * @returns {function} The class.
     */
    var findClass = function (className) {
        if (webrtc[className]) {
            return webrtc[className];
        }
        if (window[className]) {
            return window[className];
        }
    };

    that.signalingChannel = findClass(that.appSettings.signalingChannel)();
    that.identityProvider = findClass(that.appSettings.identityProvider)();
    that.chatMessage = findClass(that.appSettings.chatMessage);
    that.signalingMessage = findClass(that.appSettings.signalingMessage);
    that.presenceMessage = findClass(that.appSettings.presenceMessage);
    that.mediaSession = findClass(that.appSettings.mediaSession);
    that.user = null;

    /**
     * Connect to the Digium infrastructure and authenticate using the appkey.  Store
     * a token to be used in API requests.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.connect
     */
    var connect = that.publicize('connect', function () {
        that.signalingChannel.open();
        connected = true;
    });

    /**
     * Disconnect from the Digium infrastructure. Invalidates the API token.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.disconnect
     */
    var disconnect = that.publicize('disconnect', function () {
        that.signalingChannel.close();
        connected = false;
    });

    /**
     * Log in a User using the identity provider specified in the application settings. Adds
     * the UserSession to Mercury.userSessions.
     * Sends presence "available."
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.login
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
     * from Mercury.userSessions and Mercury.user
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.logout
     * @param {string[]} username Optional array of usernames of UserSessions to log out.
     */
    var logout = that.publicize('logout', function (usernames) {
        var userSession = that.user.getUserSession();
        if (!usernames || userSession.userAccount in usernames) {
            that.identityProvider.logout(userSession.userAccount, userSession.token);
            userSession.loggedIn = false;
        }
    });

    /**
     * Determine whether the Mercury has authenticated with its appKey against Digium services
     * by checking the validity of the apiToken.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.isConnected
     * @returns {boolean}
     */
    var isConnected = that.publicize('isConnected', function () {
        return !!connected;
    });

    /**
     * Determine whether any Users have logged in by checking the existence of logged-in Endpoints.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.isLoggedIn
     * @returns {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        if (that.user) {
            return !!that.user.getUserSession().isLoggedIn();
        }
        return false;
    });

    /**
     * Get an object containing the default media constraints and other media settings.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.getMediaSettings
     * @returns {object} An object containing the media settings which will be used in
     * webrtc calls.
     */
    var getMediaSettings = that.publicize('getMediaSettings', function () {
        return mediaSettings;
    });

    /**
     * Set the default media constraints and other media settings.
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.setDefaultMediaSettings
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
     * @memberof! webrtc.Mercury
     * @method webrtc.Mercury.getSignalingChannel
     * @returns {webrtc.SignalingChannel} The instance of the webrtc.SignalingChannel.
     */
    var getSignalingChannel = that.publicize('getSignalingChannel', function () {
        return that.signalingChannel;
    });

    return that;
}; // End webrtc.Mercury
