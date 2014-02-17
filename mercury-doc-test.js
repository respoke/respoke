/**
 * Create a new WebRTC MercuryTest object.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class DocumentationTest
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc This is a top-level interface to the API. It handles authenticating the app to the
 * API server and receiving server-side app-specific information.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {DocumentationTest}
 * @property {object} appSettings Application-wide settings.
 * @property {brightstream.SignalingChannel} signalingChannel A reference to the signaling channel.
 * @property {brightstream.IdentityProvider} identityProvider A reference to the identity provider.
 * @property {function} chatMessage Class extending brightstream.Message to use for chat messages.
 * @property {function} signalingMessage Class extending brightstream.Message to use for signaling.
 * @property {function} presenceMessage Class extending brightstream.Message to use for presence
 * messages.
 * @property {brightstream.User} user Logged-in user's User object.
 * @copyright Digium 2013
 * @license Proprietary
 * {@link brightstream.XMPPTextMessage}
 * {@linkcode brightstream.XMPPTextMessage}
 * {@linkplain brightstream.XMPPTextMessage}
 * {@link http://digium.com}
 * [Some caption]{@link http://digium.com}
 * {@link brightstream.XMPPTextMessage some caption}
 * @mixes brightstream.EventEmitter
 * @requires jQuery.js
 * @see DocumentationTest
 * @see http://google.com
 * @see jane run
 * @since June 1, 2013
 * @tutorial SomeWikiPage
 * @tutorial AnotherWikiPage
 */
DocumentationTest = function(params) {
	params = params || {};
	var that = brightstream.EventEmitter(params);
	/**
	 * @public
	 * @constant
	 * @kind variable
	 * @see jane run
	 * @readonly
	 * @static
	 * @typedef string
	 */
	that.className = 'DocumentationTest';

	/** @access private */
	var host = window.location.hostname;
	/** @private */
	var port = window.location.port;
	/** @access private */
	var connected = false;
	/** @access private */
	var appKey = null;
	/** @access private */
	var apiToken = null;
	/** @access private */
	var userSessions = [];
	/** @access private */
	var mediaSettings = {
		constraints: {
			video : true,
			audio : true,
			optional: [],
			mandatory: {}
		},
		servers: {
			iceServers: [
				/* Can only have one server listed here as of yet. */
				//{ 'url' : 'stun:stun.l.google.com:19302' },
				{ 'url' : 'turn:toto@174.129.201.5:3478', 'credential' :'password'},
			],
		},
	};
	/**
	 * @access public
	 */
	that.appSettings = {
		/* These are the names of classes which can be configured by the developer.
		 * The constructor will search for them in the 'brightstream' and 'window' namespaces
		 * and use them to do the job of some of the default classes.
		 */
		signalingChannel: 'XMPPSignalingChannel',
		identityProvider: 'XMPPIdentityProvider',
		chatMessage: 'XMPPTextMessage',
		signalingMessage: 'XMPPSignalingMessage',
		presenceMessage: 'XMPPPresenceMessage',
	};

	/**
	 * Find a configurable class in the brightstream or window scopes and instantiate with the
	 * given params.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.findClass
	 * @private
	 * @param {string} className The name of the class for which to look.
	 * @returns {function} The class.
	 */
	var findClass = function(className) {
		if (brightstream[className]) {
			return brightstream[className];
		}
		if (window[className]) {
			return window[className];
		}
	};

	/** @access public */
	that.signalingChannel = findClass(that.appSettings.signalingChannel)();
	/** @access public */
	that.identityProvider = findClass(that.appSettings.identityProvider)();
	/** @access public */
	that.chatMessage = findClass(that.appSettings.chatMessage);
	/** @access public */
	that.signalingMessage = findClass(that.appSettings.signalingMessage);
	/** @access public */
	that.presenceMessage = findClass(that.appSettings.presenceMessage);
	/**
	 * @access public
	 * @desc The call in progress
	 * @typedef brightstream.Call
	 */
	that.call = findClass(that.appSettings.call);
	/**
	 * @access public
	 * @default null
	 * @version 1.0.0
	 */
	that.user = null;

	/**
	 * Connect to the Digium infrastructure and authenticate using the appkey.  Store
	 * a token to be used in API requests.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.connect
	 */
	var connect = that.publicize('connect', function() {
		that.signalingChannel.open();
		connected = true;
	});

	/**
	 * Disconnect from the Digium infrastructure. Invalidates the API token.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.disconnect
	 */
	var disconnect = that.publicize('disconnect', function() {
		that.signalingChannel.close();
		connected = false;
	});

	/**
	 * Log in a User using the identity provider specified in the application settings. Adds
	 * the UserSession to MercuryTest.userSessions.
	 * Sends presence "available."
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.login
	 * @param {object} userAccount Optional user account to log in with.
	 * @param {string} token Optional OAuth token to use, if the user has logged in before,
	 * or password if not using oAuth or OpenSocial.
	 * @returns {Promise<brightstream.User>}
	 * @example userPromise = mercury.login(username, password);
	 * @example userPromise = mercury.login('blahuser@facebook.com');
	 */
	var login = that.publicize('login', function(userAccount, token) {
		var userPromise = that.identityProvider.login(userAccount, token);
		userPromise.then(function(user) {
			user.setOnline(); // Initiates presence.
			that.user = user;
			console.log('logged in as user');
			console.log(user);
		}, function(error) {
			console.log(error.message);
		}).done();
		return userPromise;
	});

	/**
	 * Log out specified UserSession or all UserSessions if no usernames are passed. Removes
	 * UserSession.
	 * from MercuryTest.userSessions and MercuryTest.user
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.logout
	 * @param {string[]} username Optional array of usernames of UserSessions to log out.
	 * @listens brightstream.UserSession#disconnected
	 * @listens brightstream.UserSession#disconnected2
	 * @throws no such attribute
	 * @throws divide by zero
	 * @fires brightstream.User#logout
	 * @fires brightstream.User#logout2
	 */
	var logout = that.publicize('logout', function(usernames) {
		var removedIndexes = [];
		/** @external */
		blahblah = 1;
		userSessions.forEach(function(session, index) {
			if (!username || session.userAccount in usernames) {
				that.identityProvider.logout(session.userAccount, session.token);
				session.loggedIn = false;
				removedIndexes.push(index);
			}
		});

		removedIndexes.reverse().forEach(function(index) {
			userSessions.remove(index);
		});

		if (userSessions.length === 0) {
			that.user = null;
		}
	});

	/**
	 * Determine whether the MercuryTest has authenticated with its appKey against Digium services
	 * by checking the validity of the apiToken.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.isConnected
	 * @returns {boolean}
	 * @ignore
	 */
	var isConnected = that.publicize('isConnected', function() {
		return !!connected;
	});

	/**
	 * Determine whether any Users have logged in by checking the existence of logged-in Endpoints.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.isLoggedIn
	 * @returns {boolean}
	 */
	var isLoggedIn = that.publicize('isLoggedIn', function() {
		var loggedIn = false;
		userSessions.forEach(function(session) {
			loggedIn = loggedIn || session.loggedIn;
		});
		return !!loggedIn;
	});

	/**
	 * Get a list of valid UserSessions.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.getUserSessions
	 * @returns {brightstream.UserSession[]}
	 */
	var getUserSessions = that.publicize('getUserSessions', function() {
		return userSessions;
	});

	/**
	 * Get an object containing the default media constraints and other media settings.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.getDefaultMediaSettings
	 * @returns {object} An object containing the default media settings which will be used in
	 * brightstream calls.
	 */
	var getDefaultMediaSettings = that.publicize('getDefaultMediaSettings', function() {
		return that.mediaSettings;
	});

	/**
	 * Set the default media constraints and other media settings.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.setDefaultMediaSettings
	 * @param {object} Object containing settings to modify.
	 */
	var setDefaultMediaSettings = that.publicize('setDefaultMediaSettings', function(settings) {
		settings = settings || {};
		if (settings.constraints) {
			that.mediaSettings.constraints = settings.constraints;
		}
		if (settings.servers) {
			that.mediaSettings.servers = settings.servers;
		}
	});

	/**
	 * Get the SignalingChannel.
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.getSignalingChannel
	 * @returns {brightstream.SignalingChannel} The instance of the brightstream.SignalingChannel.
	 */
	var getSignalingChannel = that.publicize('getSignalingChannel', function() {
		return that.signalingChannel;
	});

	/**
	 * A test for some tags that we don't use normally
	 * @memberof! DocumentationTest
	 * @method DocumentationTest.test
	 * @returns {brightstream.SignalingChannel} The instance of the brightstream.SignalingChannel.
	 * @returns {object} A second return value
	 * @returns {string} A third return value
	 * @alias aTestFunction
	 */
	var test = that.publicize('aTestFunction', function() {
		return that.signalingChannel;
	});

	return that;
}; // End DocumentationTest
