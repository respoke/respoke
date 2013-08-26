/**
 * Create a new Presentable, the base class for User, Endpoint, and Contact.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Presentable
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc Information describing a nameable entity which has presence and skills.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Presentable}
 * @property {string} name Display name for this entity.
 * @property {string} id Unique ID for this entity.
 * @property {enum} presence Resolved presence information across one or more sessions.
 * @property {object} skills Information describing skills and features this entity supports
 * across all devices.
 */

/*global webrtc: false */
webrtc.Presentable = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.EventThrower(params);
    that.className = 'webrtc.Presentable';

    that.name = 'Unknown';
    that.id = '';
    var presence = 'unavailable';
    var skills = {
        'video': {
            'send': true,
            'receive': true
        },
        'audio': {
            'send': true,
            'receive': true
        }
    };

    /**
     * Indicate whether the entity has an active MediaSession. Should we only return true if
     * media is flowing, or anytime a WebRTC session is active? Should it return true if the
     * engaged in a media session on another device?
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.hasMedia
     * @returns {boolean}
     */
    var hasMedia = that.publicize('hasMedia', function () {
        return false;
    });

    /**
     * Indicate whether the entity is capable of sending audio.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.canSendAudio
     * @returns {boolean}
     */
    var canSendAudio = that.publicize('canSendAudio', function () {
        return skills.audio.send;
    });

    /**
     * Indicate whether the entity is capable of sending video.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.canSendVideo
     * @returns {boolean}
     */
    var canSendVideo = that.publicize('canSendVideo', function () {
        return skills.video.send;
    });

    /**
     * Get the unique id.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getID
     * @returns {string} A unique ID for the object.
     */
    var getID = that.publicize('getID', function () {
        return that.id;
    });

    /**
     * Get the name.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getName
     * @returns {string} The name of the object.
     */
    var getName = that.publicize('getName', function () {
        return that.name;
    });

    /**
     * Get the display name.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getDisplayName
     * @returns {string} The display name of the object.
     */
    var getDisplayName = that.publicize('getDisplayName', function () {
        return that.name;
    });

    /**
     * Get the presence.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getPresence
     * @returns {string}
     */
    var getPresence = that.publicize('getPresence', function () {
        return presence;
    });

    /**
     * Set the presence.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.setPresence
     * @param {string} presence
     * @returns {string}
     * @fires webrtc.Presentable#presence
     */
    var setPresence = that.publicize('setPresence', function (newPresence) {
        presence = newPresence;
        that.fire('presence', presence);
    });

    return that;
}; // End webrtc.Presentable

/**
 * Create a new Endpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Endpoint
 * @augments webrtc.Presentable
 * @constructor
 * @classdesc Information which represents an entity which can send and receive messages and media
 * to and from the logged-in User. As proper Endpoints are anonymous (no identity provider) there
 * can be no multiple resources per Endpoint.
 * properties on the class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * @returns {webrtc.Endpoint}
 * @property {webrtc.MediaSession[]} mediaSessions Array of MediaSessions in progress.
 * this?
 */
webrtc.Endpoint = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Presentable(params);
    that.className = 'webrtc.Endpoint';

    that.mediaSessions = [];
    var signalingChannel = mercury.getSignalingChannel();

    /**
     * Send a message to an Endpoint
     * @memberof! webrtc.Endpoint
     * @method webrtc.Endpoint.sendMessage
     * @param {string} message A message to be sent.
     * @param {successCallback} onSuccess
     * @param {failureCallback} onFailure
     */
    var sendMessage = that.publicize('sendMessage', function (message, onSuccess, onFailure) {
        if (signalingChannel.isOpen()) {
            signalingChannel.send(message);
        }
    });

    /**
     * Start the process of obtaining media
     * @memberof! webrtc.Endpoint
     * @method webrtc.Endpoint.startMedia
     * @param {object} mediaSettings Group of media settings from which WebRTC constraints
     * will be generated and with which the SDP will be modified.
     * @returns {webrtc.MediaSession}
     */
    var startMedia = that.publicize('startMedia', function (mediaSettings) {
    });

    /**
     * Stop media.
     * @memberof! webrtc.Endpoint
     * @method webrtc.Endpoint.stopMedia
     */
    var stopMedia = that.publicize('stopMedia', function () {
    });

    return that;
}; // End webrtc.Endpoint

/**
 * Create a new User, which represents the currently logged-in User.
 * @class webrtc.User
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @classdesc Information describing a User this client app cannot send messages to or initate
 * media with along with a collection of sessions across one or more devices. Should this be
 * sessions only logged in with this appKey?
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.User}
 * @augments webrtc.Presentable
 * @property {string} name Display name for this group of user accounts.
 * @property {string} id Unique ID for this group of user accounts. This could be some
 * combination of the identity provider and the identity provider's unique ID.
 * @property {enum} presence Resolved presence information across one or more sessions.
 * @property {object} skills Information describing skills and features this Endpoint supports
 * @property {webrtc.Contact[]} contactList Array of Contacts representing the User's contact list.
 * across all devices.
 */

webrtc.User = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Presentable(params);
    that.className = 'webrtc.User';

    var remoteUserSessions = [];
    var contactList = [];
    var mediaSessions = [];

    var userSession = webrtc.UserSession({
        'token': params.token,
        'timeLoggedIn': params.timeLoggedIn || new Date(),
        'loggedIn': params.loggedIn
    });
    delete params.token;
    delete params.timeLoggedIn;
    delete params.loggedIn;

    /**
     * Get the User's locally logged-in UserSession
     * @memberof! webrtc.User
     * @method webrtc.User.getUserSession
     * @returns {webrtc.UserSession}
     */
    var getUserSession = that.publicize('getUserSession', function () {
        return userSession;
    });

    /**
     * Get the User's contact list.
     * @memberof! webrtc.User
     * @method webrtc.User.getContactList
     * @returns {webrtc.ContactList}
     */
    var getContactList = that.publicize('getContactList', function () {
        return contactList;
    });

    /**
     * Mark the User as online or available.
     * @memberof! webrtc.User
     * @method webrtc.User.setOnline
     * @abstract
     */
    var setOnline = that.publicize('setOnline', function () {
        that.setPresence('available');
    });

    return that;
}; // End webrtc.User

/**
 * Create a new UserSession.
 * @class webrtc.UserSession
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @classdesc UserSession including logged-in status about a user account. There may be more than
 * one of these per User.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.UserSession}
 * @property {string} username
 * @property {string} token
 * @property {datetime} timeLoggedIn
 * @property {boolean} loggedIn
 */
webrtc.UserSession = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.EventThrower(params);
    that.className = 'webrtc.UserSession';

    var token = params.token || '';
    var timeLoggedIn = params.timeLoggedIn || null;
    var loggedIn = params.loggedIn || false;
    delete params.token;
    delete params.timeLoggedIn;
    delete params.loggedIn;

    /**
     * Get User's OAuth token
     * @memberof! webrtc.UserSession
     * @method webrtc.UserSession.getAuthToken
     * @returns {string} The auth token for this session.
     */
    var getAuthToken = that.publicize('getAuthToken', function () {
        return token;
    });

    /**
     * Determine whether this is a valid logged-in UserSession
     * @memberof! webrtc.UserSession
     * @method webrtc.UserSession.isLoggedIn
     * @returns {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        return !!loggedIn;
    });

    return that;
}; // End webrtc.UserSession

/**
 * Create a new Contact, which represents an identity.
 * @constructor
 * @classdesc Information describing an identity. Should this be UserSessions? Should it be only
 * sessions logged in with this appKey?
 * @augments webrtc.Endpoint
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Contact}
 */
webrtc.Contact = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Endpoint(params);
    that.className = 'webrtc.Contact';

    /**
     * Get the history of messages between this Contact and the logged-in User.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.getMessages
     * @returns {object[]} An array of message objects.
     */
    var getMessages = that.publicize('getMessages', function () {
    });

    return that;
}; // End webrtc.Contact
