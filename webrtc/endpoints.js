/**
 * Create a new Presentable, the base class for User, Endpoint, and Contact.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractPresentable
 * @constructor
 * @augments webrtc.EventEmitter
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
    var that = webrtc.EventEmitter(params);
    delete that.client;
    that.className = 'webrtc.AbstractPresentable';

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
     * Indicate whether the entity has an active Call. Should we only return true if
     * media is flowing, or anytime a WebRTC session is active? Should it return true if the
     * engaged in a media session on another device?
     * @memberof! webrtc.AbstractPresentable
     * @method webrtc.AbstractPresentable.callInProgress
     * @returns {boolean}
     */
    var callInProgress = that.publicize('callInProgress', function () {
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
 * can be no multiple sessions per Endpoint.
 * properties on the class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * @returns {webrtc.Endpoint}
 * @property {webrtc.Call[]} calls Array of Calls in progress.
 * this?
 */
webrtc.AbstractEndpoint = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractPresentable(params);
    delete that.client;
    that.className = 'webrtc.AbstractEndpoint';

    that.calls = [];
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
     * Start a call.
     * @memberof! webrtc.AbstractEndpoint
     * @method webrtc.AbstractEndpoint.startCall
     * @param {object} callSettings Group of media settings from which WebRTC constraints
     * will be generated and with which the SDP will be modified.
     * @returns {webrtc.Call}
     */
    var startCall = that.publicize('startCall', function (callSettings) {
    });

    /**
     * Stop a call.
     * @memberof! webrtc.AbstractEndpoint
     * @method webrtc.AbstractEndpoint.stopCall
     */
    var stopCall = that.publicize('stopCall', function () {
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
    var calls = [];

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
     * @method webrtc.AbstractUser.getContacts
     * @returns {webrtc.Contacts}
     */
    var getContacts = that.publicize('getContacts', function () {
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
    var that = webrtc.EventEmitter(params);
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

    var sessions = [];
    var presence = 'unavailable';

    that.listen('signal', function (message) {
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
     * @return {string}
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
        signalingChannel.sendMessage(webrtc.TextMessage({
            'recipient': that,
            'sender': webrtc.getClient(client).user.getID(),
            'payload': message
        }));
    });

    /**
     * Create a new Call for a voice and/or video call. If initiator is set to true,
     * the Call will start the call.
     * @memberof! webrtc.Endpoint
     * @method webrtc.Endpoint.startCall
     * @param {object} Optional CallSettings which will be used as constraints in getUserMedia.
     * @param {boolean} Optional Whether the logged-in user initiated the call.
     * @returns {webrtc.Call}
     */
    var startCall = that.publicize('startCall', function (callSettings, initiator) {
        var id = that.getID();
        var call = null;
        var user = webrtc.getClient(client).user;

        log.trace('Endpoint.startCall');
        if (initiator === undefined) {
            initiator = true;
        }

        call = webrtc.Call({
            'client': client,
            'username': user.getUsername(),
            'remoteEndpoint': id,
            'initiator': initiator,
            'signalInitiate' : function (sdp) {
                sdp.type = 'offer';
                signalingChannel.sendSDP(that, sdp);
            },
            'signalAccept' : function (sdp) {
                sdp.type = 'answer';
                signalingChannel.sendSDP(that, sdp);
            },
            'signalCandidate' : function (oCan) {
                if (oCan !== null) {
                    signalingChannel.sendCandidate(that, oCan);
                }
            },
            'signalTerminate' : function () {
                signalingChannel.sendBye(that);
            },
            'signalReport' : function (oReport) {
                log.debug("Not sending report");
                log.debug(oReport);
            }
        });

        if (initiator === true) {
            call.start();
        }
        user.addCall(call);
        call.listen('hangup', function (locallySignaled) {
            user.removeCall(id);
        });
        return call;
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
    var sessions = {};

    /**
     * Get the Contact's presence.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.getPresence
     */
    var getPresence = that.publicize('getPresence', function () {
        return presence;
    });

    /**
     * Set the presence on the Contact and the session
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.setPresence
     */
    var setPresence = that.publicize('setPresence', function (presenceString, sessionId) {
        // undefined is a valid presenceString equivalent to available.
        presenceString = presenceString || 'available';
        console.log('presenceString');
        console.log(presenceString);

        if (!sessions.hasOwnProperty(sessionId)) {
            sessions[sessionId] = {
                'sessionId': sessionId,
                'presence': presenceString
            };
        }
        sessions[sessionId].presence = presenceString;
        log.debug('after setPresence');
        log.debug(sessions);
        resolvePresence();
    });

    /**
     * Find the presence out of all known sessions with the highest priority (most availability)
     * and set it as the contact's resolved presence.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.setPresence
     * @private
     * @fires webrtc.Presentable#presence
     */
    var resolvePresence = function () {
        var options = ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'];
        var sessionIds = Object.keys(sessions);

        /**
         * Sort the sessionIds array by the priority of the value of the presence of that
         * sessionId. This will cause the first element in the sessionsId to be the id of the
         * session with the highest priority presence. Then we can access it by the 0 index.
         */
        sessionIds = sessionIds.sort(function (a, b) {
            var indexA = options.indexOf(sessions[a].presence);
            var indexB = options.indexOf(sessions[b].presence);
            // Move it to the end of the list if it isn't one of our accepted presence values
            indexA = indexA === -1 ? 1000 : indexA;
            indexB = indexB === -1 ? 1000 : indexB;
            return indexA < indexB ? -1 : (indexB < indexA ? 1 : 0);
        });

        presence = sessionIds[0] ? sessions[sessionIds[0]].presence : 'unavailable';

        log.debug("presences resolved to " + presence);
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
    var calls = [];
    var contactList = webrtc.Contacts({'client': client});
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

    // listen to webrtc.Contacts#presence -- the contacts's presences
    contactList.listen('new', function (contact) {
        that.fire('contact', contact);
    });

    // listen to webrtc.Contacts#presence -- the contacts's presences
    contactList.listen('presence', function (presenceMessage) {
        var presPayload = presenceMessage.getPayload();
        var from = presenceMessage.getSender();
        var sessionId = presenceMessage.getSessionID();
        var contact = contactList.get(from);
        /*
         * Parse the message, add the session to contact sessions or usersessions if it's us,
         * modify the contact's presence using contact.setPresence, which will fire the event
         */
        if (contact) {
            contact.setPresence(presPayload.type, sessionId);
        } else if (from === webrtc.getClient(client).user.getID()) {
            // logged in user TODO: save userSession
            log.debug("got own presence");
        } else {
            log.debug("Got unrecognized presence");
            log.debug(presPayload);
        }
    });

    /**
     * Get user's Contacts from server.
     * @memberof! webrtc.User
     * @method webrtc.User.getContacts
     * @returns {Promise<webrtc.Contacts>}
     */
    var getContacts = that.publicize('getContacts', function () {
        var deferred = Q.defer();
        var itemElements = [];

        if (!userSession.isLoggedIn()) {
            deferred.reject(new Error("Can't request contacts unless logged in."));
            return deferred.promise;
        }

        if (contactList.length > 0) {
            deferred.resolve(contactList);
            return deferred.promise;
        }

        deferred.promise.then(function (contactList) {
            log.debug("got contact list", contactList);
            setTimeout(function () {
                contactList.processPresenceQueue();
            }, 1000);
        }, function (err) {
            throw err;
        }).done();

        var presenceHandler = function (message) {
            var contact;
            var message = webrtc.PresenceMessage({'rawMessage': message});
            if (contactList.length === 0) {
                contactList.queuePresence(message);
                return;
            }

            try {
                contact = contactList.get(message.getSender());
            } catch (e) {
                throw new Error("Couldn't get presence sender.");
            }

            if (!contact) {
                log.warn("Can't set presence");
                log.debug(message.getSender());
                log.debug(message.getText());
            } else {
                log.debug('presence ' + message.getText() + " set on contact " +
                    contact.getDisplayName());
                contact.setPresence(message.getText(), message.getSessionID());
            }
        };

        signalingChannel.getContacts(function (list) {
            if (!(list in [null, undefined]) && list.length >= 0) {
                list.forEach(function (contactInfo) {
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
            } else {
                deferred.reject(new Error("Can't get contact list: " + list.error));
            }
        }, function (presenceList) {
            if (presenceList && presenceList.length > 0) {
                presenceList.forEach(function (presence) {
                    contactList.fire('presence', webrtc.PresenceMessage({'rawMessage': presence}));
                });
            }
        });

        signalingChannel.addHandler('presence', presenceHandler);

        signalingChannel.addHandler('chat', function (message) {
            var contact;
            try {
                contact = contactList.get(message.header.from.split(':')[1]);
            } catch (e) {
                throw new Error("Couldn't parse chat message.");
            }
            if (!contact) {
                log.warn("No such contact " + message.header.from);
                return;
            }
            // TODO remove all this when we have a real signaling API
            try {
                var parsed = JSON.parse(message.text);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.candidate) {
                        parsed.type = 'candidate';
                    }
                    contact.fire('signal', webrtc.SignalingMessage({
                        'client': client,
                        // yes, the unparsed version. TODO reevaluate?
                        'rawMessage': JSON.stringify(parsed),
                        'recipient': that,
                        'sender': contact.getID()
                    }));
                    return;
                }
            } catch (e) {
                // not JSON, assume chat message
                log.debug('message error');
                log.debug(message);
            }
            contact.fire('message', webrtc.TextMessage({
                'client': client,
                'rawMessage': message.text,
                'recipient': that,
                'sender': contact.getID()
            }));
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
     * Get the active Call.  Can there be multiple active Calls? Should we timestamp
     * them and return the most recently used? Should we create a Call if none exist?
     * @memberof! webrtc.User
     * @method webrtc.User.getActiveCall
     * @returns {webrtc.Call}
     */
    var getActiveCall = that.publicize('getActiveCall', function () {
        // TODO search by user, create if doesn't exist?
        var session = null;
        calls.forEach(function (call) {
            if (call.isActive()) {
                session = call;
            }
        });
        return session;
    });

    /**
     * Get the Call with the contact specified.
     * @memberof! webrtc.User
     * @method webrtc.User.getCallByContact
     * @param {string} Contact ID
     * @returns {webrtc.Call}
     */
    var getCallByContact = that.publicize('getCallByContact',
        function (contactId) {
            var session = null;
            var contact = null;
            var callSettings = null;

            calls.forEach(function (call) {
                if (call.remoteEndpoint === contactId) {
                    if (call.getState() === 'ended') {
                        return;
                    }
                    session = call;
                }
            });

            if (session === null) {
                try {
                    contact = contactList.get(contactId);
                    callSettings = webrtc.getClient(client).getCallSettings();
                    session = contact.startCall(callSettings, false);
                } catch (e) {
                    log.error("Couldn't create Call: " + e.message);
                }
            }

            return session;
        }
    );

    /**
     * Associate the media session with this user.
     * @memberof! webrtc.User
     * @method webrtc.User.addCall
     * @param {webrtc.Call} call
     * @fires webrtc.User#call
     */
    var addCall = that.publicize('addCall', function (call) {
        calls.push(call);
        that.fire('call', call, call.getContactID());
    });

    /**
     * Remove the media session.
     * @memberof! webrtc.User
     * @method webrtc.User.removeCall
     * @param {string} Optional Contact ID
     */
    var removeCall = that.publicize('removeCall', function (contactId) {
        var toDelete = null;

        if (!contactId) {
            throw new Error("Must specify contactId of Call to remove.");
        }

        // Loop backward since we're modifying the array in place.
        for (var i = calls.length - 1; i >= 0; i -= 1) {
            var call = calls[i];
            if (call.remoteEndpoint === contactId) {
                calls.splice(i);
            }
        }
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

