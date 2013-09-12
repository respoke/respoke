/**
 * Create a new Presentable, the base class for User, Endpoint, and Contact.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractPresentable
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
webrtc.AbstractPresentable = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventThrower(params);
    delete that.client;
    that.className = 'webrtc.AbstractPresentable';

    that.name = that.name || 'Unknown';
    that.id = that.id || '';
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
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.hasMedia
     * @returns {boolean}
     */
    var hasMedia = that.publicize('hasMedia', function () {
        return false;
    });

    /**
     * Indicate whether the entity is capable of sending audio.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.canSendAudio
     * @returns {boolean}
     */
    var canSendAudio = that.publicize('canSendAudio', function () {
        return skills.audio.send;
    });

    /**
     * Indicate whether the entity is capable of sending video.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.canSendVideo
     * @returns {boolean}
     */
    var canSendVideo = that.publicize('canSendVideo', function () {
        return skills.video.send;
    });

    /**
     * Get the unique id.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.getID
     * @returns {string} A unique ID for the object.
     */
    var getID = that.publicize('getID', function () {
        return that.id;
    });

    /**
     * Get the name.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.getName
     * @returns {string} The name of the object.
     */
    var getName = that.publicize('getName', function () {
        return that.name;
    });

    /**
     * Get the display name.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.getDisplayName
     * @returns {string} The display name of the object.
     */
    var getDisplayName = that.publicize('getDisplayName', function () {
        return that.name;
    });

    /**
     * Get the presence.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.getPresence
     * @returns {string}
     */
    var getPresence = that.publicize('getPresence', function () {
        return presence;
    });

    /**
     * Set the presence.
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.setPresence
     * @param {string} presence
     * @returns {string}
     * @fires webrtc.AbstractPresentable#presence
     */
    var setPresence = that.publicize('setPresence', function (newPresence) {
        presence = newPresence;
        that.fire('presence', presence);
    });

    return that;
}; // End webrtc.AbstractPresentable

/**
 * Create a new Endpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractEndpoint
 * @augments webrtc.AbstractPresentable
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
webrtc.AbstractEndpoint = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractPresentable(params);
    delete that.client;
    that.className = 'webrtc.AbstractEndpoint';

    that.mediaSessions = [];
    var signalingChannel = webrtc.getClient(client).getSignalingChannel();

    /**
     * Send a message to an Endpoint
     * @memberof! webrtc.AbstractEndpoint
     * @method webrtc.AbstractEndpoint.sendMessage
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
     * @memberof! webrtc.AbstractEndpoint
     * @method webrtc.AbstractEndpoint.startMedia
     * @param {object} mediaSettings Group of media settings from which WebRTC constraints
     * will be generated and with which the SDP will be modified.
     * @returns {webrtc.MediaSession}
     */
    var startMedia = that.publicize('startMedia', function (mediaSettings) {
    });

    /**
     * Stop media.
     * @memberof! webrtc.AbstractEndpoint
     * @method webrtc.AbstractEndpoint.stopMedia
     */
    var stopMedia = that.publicize('stopMedia', function () {
    });

    return that;
}; // End webrtc.AbstractEndpoint

/**
 * Create a new User, which represents the currently logged-in User.
 * @class webrtc.AbstractUser
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @classdesc Information describing a User this client app cannot send messages to or initate
 * media with along with a collection of sessions across one or more devices. Should this be
 * sessions only logged in with this appKey?
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.User}
 * @augments webrtc.AbstractPresentable
 * @property {string} name Display name for this group of user accounts.
 * @property {string} id Unique ID for this group of user accounts. This could be some
 * combination of the identity provider and the identity provider's unique ID.
 * @property {enum} presence Resolved presence information across one or more sessions.
 * @property {object} skills Information describing skills and features this Endpoint supports
 * @property {webrtc.AbstractContact[]} contactList Array of Contacts representing the User's contact list.
 * across all devices.
 */

webrtc.AbstractUser = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractPresentable(params);
    delete that.client;
    that.className = 'webrtc.AbstractUser';

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
     * @memberof! webrtc.AbstractUser
     * @method webrtc.AbstractUser.getUserSession
     * @returns {webrtc.UserSession}
     */
    var getUserSession = that.publicize('getUserSession', function () {
        return userSession;
    });

    /**
     * Get the User's contact list.
     * @memberof! webrtc.AbstractUser
     * @method webrtc.AbstractUser.getContactList
     * @returns {webrtc.ContactList}
     */
    var getContactList = that.publicize('getContactList', function () {
        return contactList;
    });

    /**
     * Mark the User as online or available.
     * @memberof! webrtc.AbstractUser
     * @method webrtc.AbstractUser.setOnline
     * @abstract
     */
    var setOnline = that.publicize('setOnline', function () {
        that.setPresence('available');
    });

    return that;
}; // End webrtc.AbstractUser

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
    var client = params.client;
    var that = webrtc.EventThrower(params);
    delete that.client;
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
 * @augments webrtc.AbstractEndpoint
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Contact}
 */
webrtc.AbstractContact = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractEndpoint(params);
    delete that.client;
    that.className = 'webrtc.AbstractContact';

    /**
     * Get the history of messages between this Contact and the logged-in User.
     * @memberof! webrtc.AbstractContact
     * @method webrtc.AbstractContact.getMessages
     * @returns {object[]} An array of message objects.
     */
    var getMessages = that.publicize('getMessages', function () {
    });

    return that;
}; // End webrtc.AbstractContact

/**
 * Create a new Presentable.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.AbstractPresentable
 * @classdesc Presentable class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @property {string} username
 * @returns {webrtc.Presentable}
 */
webrtc.Presentable = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractPresentable(params);
    delete that.client;
    that.className = 'webrtc.Presentable';
    that.username = that.username || "Unknown";

    var resources = [];
    var presence = 'unavailable';

    that.listen('signaling:received', function (message) {
        try {
            webrtc.getClient(client).getSignalingChannel().routeSignal(message);
        } catch (e) {
            log.error("Couldn't route message: " + e.message);
        }
    });

    /**
     * Return the user ID
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getID
     * @return {string} id
     */
    var getID = that.publicize('getID', function () {
        return that.id;
    });

    /**
     * Get the display name of the endpoint.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getDisplayName
     * @return {string} displayName
     */
    var getDisplayName = that.publicize('getDisplayName', function () {
        return that.name || that.username || that.id;
    });

    /**
     * Get the username.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getUsername
     * @return {string} displayName
     */
    var getUsername = that.publicize('getUsername', function () {
        return that.username;
    });

    /**
     * Get the presence of the endpoint.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getStatus
     * @deprecated Use or override getPresence instead.
     */
    var getStatus = that.publicize('getStatus', function () {
        return presence;
    });

    return that;
}; // End webrtc.Presentable

/**
 * Create a new Endpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.Presentable
 * @classdesc Endpoint class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Endpoint}
 */
webrtc.Endpoint = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Presentable(params);
    delete that.client;
    that.className = 'webrtc.Endpoint';

    var signalingChannel = webrtc.getClient(client).getSignalingChannel();

    /**
     * Send a message to the endpoint.
     * @memberof! webrtc.Endpoint
     * @method webrtc.Endpoint.sendMessage
     * @params {object} message The message to send
     */
    var sendMessage = that.publicize('sendMessage', function (message) {
        signalingChannel.sendMessage(webrtc.ChatMessage({
            'recipient': that,
            'sender': webrtc.getClient(client).user.getResourceFormat(),
            'payload': message
        }));
    });

    /**
     * Create a new MediaSession for a voice and/or video call. If initiator is set to true,
     * the MediaSession will start the call.
     * @memberof! webrtc.Endpoint
     * @method webrtc.Endpoint.startMedia
     * @param {object} Optional MediaSettings which will be used as constraints in getUserMedia.
     * @param {boolean} Optional Whether the logged-in user initiated the call.
     * @returns {webrtc.MediaSession}
     */
    var startMedia = that.publicize('startMedia', function (mediaSettings, initiator) {
        var id = that.getID();
        var mediaSession = null;
        var user = webrtc.getClient(client).user;

        log.trace('startMedia');
        if (initiator === undefined) {
            initiator = true;
        }

        mediaSession = webrtc.MediaSession({
            'client': client,
            'username': user.getUsername(),
            'remoteEndpoint': id,
            'initiator': initiator,
            'signalInitiate' : function (sdp) {
                sdp.type = 'offer';
                signalingChannel.sendSDP(id, sdp);
            },
            'signalAccept' : function (sdp) {
                sdp.type = 'answer';
                signalingChannel.sendSDP(id, sdp);
            },
            'signalCandidate' : function (oCan) {
                if (oCan !== null) {
                    signalingChannel.sendCandidate(id, oCan);
                }
            },
            'signalTerminate' : function () {
                signalingChannel.sendBye(id);
            },
            'signalReport' : function (oReport) {
                log.debug("Not sending report");
                log.debug(oReport);
            }
        });

        mediaSession.start();
        user.addMediaSession(mediaSession);
        mediaSession.listen('hangup', function (locallySignaled) {
            user.removeMediaSession(id);
        });
        return mediaSession;
    });

    return that;
}; // End webrtc.Endpoint

/**
 * Create a new Contact.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.Endpoint
 * @classdesc Contact class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Contact}
 */
webrtc.Contact = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Endpoint(params);
    delete that.client;
    that.className = 'webrtc.Contact';

    var presence = 'unavailable';
    var subscription = 'both';
    var resources = {};

    /**
     * Set the presence on the Contact and the resource
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.setPresence
     */
    var setPresence = that.publicize('setPresence', function (presenceString, resourceID) {
        // undefined is a valid presenceString equivalent to available.
        presenceString = presenceString || 'available';

        if (!resources.hasOwnProperty(resourceID)) {
            resources[resourceID] = {
                'resourceID': resourceID,
                'presence': presenceString
            };
        }
        resources[resourceID].presence = presenceString;
        resolvePresence();
    });

    /**
     * Loop through resources; resolve presence into identity-wide presence. Set presence attribute.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.setPresence
     * @private
     * @fires webrtc.Presentable#presence
     */
    var resolvePresence = function () {
        var options = [];
        resources.forOwn(function (resource) {
            options.push(resource.presence);
            switch (resource.presence) {
            case 'chat':
                presence = resource.presence;
                break;
            case 'available':
                if (!(presence in ['chat'])) {
                    presence = resource.presence;
                }
                break;
            case 'away':
                if (!(presence in ['chat', 'available'])) {
                    presence = resource.presence;
                }
                break;
            case 'dnd':
                if (!(presence in ['chat', 'available', 'away'])) {
                    presence = resource.presence;
                }
                break;
            case 'xa':
                if (!(presence in ['chat', 'available', 'away', 'dnd'])) {
                    presence = resource.presence;
                }
                break;
            }
        });
        if (!presence) {
            presence = 'unavailable';
        }
        log.debug("presences " + options.join(', ') + " resolved to " + presence);
        that.fire('presence', presence);
    };


    return that;
}; // End webrtc.Contact

/**
 * Create a new User. This class does NOT extend {webrtc.AbstractUser} but it really should!
 * Should we attempt to support multiple inheritance?
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.Presentable
 * @classdesc User class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.User}
 */
webrtc.User = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Presentable(params);
    delete that.client;
    that.className = 'webrtc.User';

    var remoteUserSessions = {};
    var mediaSessions = [];
    var contactList = webrtc.ContactList({'client': client});
    var presenceQueue = [];
    var presence = 'unavailable';
    var signalingChannel = webrtc.getClient(client).getSignalingChannel();
    var userSession = webrtc.UserSession({
        'client': client,
        'token': params.token,
        'timeLoggedIn': params.timeLoggedIn,
        'loggedIn': params.loggedIn
    });

    // listen to webrtc.User#presence:update -- the logged-in user's presence
    that.listen("presence", function (presenceString) {
        presence = presenceString;
        if (signalingChannel && signalingChannel.isOpen()) {
            log.info('sending my presence update ' + presenceString);
            signalingChannel.sendPresence(presenceString);
        } else {
            log.error("Can't send my presence: no signaling channel.");
        }
    });

    // listen to webrtc.ContactList#presence -- the contacts's presences
    contactList.listen('new', function (contact) {
        that.fire('contact:new', contact);
    });

    // listen to webrtc.ContactList#presence -- the contacts's presences
    contactList.listen('presence', function (presenceMessage) {
        var presPayload = null;
        var from = null;
        var contact = null;
        /*
         * Parse the message, add the session to contact sessions or usersessions if it's us,
         * modify the contact's presence using contact.setPresence, which will fire the event
         */
    });

    /**
     * Send iq stanza requesting roster.
     * @memberof! webrtc.User
     * @method webrtc.User.requestContacts
     * @returns {Promise<webrtc.ContactList>}
     */
    var requestContacts = that.publicize('requestContacts', function () {
        var deferred = Q.defer();
        var itemElements = [];
        if (!userSession.isLoggedIn()) {
            deferred.reject(new Error("Can't request contacts unless logged in."));
            return deferred.promise;
        }
        deferred.promise.then(function (contactList) {
            setTimeout(function () {
                contactList.processPresenceQueue();
            }, 1000);
        }, function (err) {
            throw err;
        }).done();

        signalingChannel.getContactList(function (response, request) {
            if (response.code === 200) {
                response.result.forEach(function (contactInfo) {
                    var contact = webrtc.Contact({
                        'client': client,
                        'id': contactInfo.id,
                        'username': contactInfo.username,
                        'email': contactInfo.email,
                        'name': contactInfo.name
                    });
                    contactList.add(contact);
                });
                deferred.resolve(contactList);
            } else if (response.code === 404) {
                deferred.resolve(contactList);
            } else {
                deferred.reject(new Error("Can't get contact list: " + response.error));
            }
        });
        return deferred.promise;
    });

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
     * Get the active MediaSession.  Can there be multiple active MediaSessions? Should we timestamp
     * them and return the most recently used? Should we create a MediaSession if none exist?
     * @memberof! webrtc.User
     * @method webrtc.User.getActiveMediaSession
     * @returns {webrtc.MediaSession}
     */
    var getActiveMediaSession = that.publicize('getActiveMediaSession', function () {
        // TODO search by user, create if doesn't exist?
        var session = null;
        mediaSessions.forEach(function (mediaSession) {
            if (mediaSession.isActive()) {
                session = mediaSession;
            }
        });
        return session;
    });

    /**
     * Get the MediaSession with the contact specified.
     * @memberof! webrtc.User
     * @method webrtc.User.getMediaSessionByContact
     * @param {string} Contact ID
     * @returns {webrtc.MediaSession}
     */
    var getMediaSessionByContact = that.publicize('getMediaSessionByContact',
        function (contactId) {
            var session = null;
            var contact = null;
            var mediaSettings = null;

            mediaSessions.forEach(function (mediaSession) {
                if (mediaSession.remoteEndpoint === contactId) {
                    session = mediaSession;
                }
            });

            if (session === null) {
                try {
                    contact = contactList.get(contactId);
                    mediaSettings = webrtc.getClient(client).getMediaSettings();
                    session = contact.startMedia(mediaSettings, false);
                    addMediaSession(session);
                } catch (e) {
                    log.error("Couldn't create MediaSession: " + e.message);
                }
            }

            return session;
        }
    );

    /**
     * Associate the media session with this user.
     * @memberof! webrtc.User
     * @method webrtc.User.addMediaSession
     * @param {webrtc.MediaSession} mediaSession
     * @fires webrtc.User#media:started
     */
    var addMediaSession = that.publicize('addMediaSession', function (mediaSession) {
        mediaSessions.push(mediaSession);
        that.fire('media:started', mediaSession, mediaSession.getContactID());
    });

    /**
     * Remove the media session.
     * @memberof! webrtc.User
     * @method webrtc.User.removeMediaSession
     * @param {string} Optional Contact ID
     */
    var removeMediaSession = that.publicize('removeMediaSession', function (contactId) {
        var toDelete = null;

        if (!contactId) {
            mediaSessions = [];
        }

        mediaSessions.forEach(function (mediaSession, index) {
            if (mediaSession.remoteEndpoint === contactId) {
                toDelete = index;
            }
        });

        if (toDelete === null) {
            log.warn("Couldn't find mediaSession in removeMediaSession");
            return;
        }

        mediaSessions.splice(toDelete);
    });


    /**
     * Set presence to available.
     * @memberof! webrtc.User
     * @method webrtc.User.setOnline
     */
    var setOnline = that.publicize('setOnline', function () {
        that.setPresence('available');
    });

    return that;
}; // End webrtc.User

