/*global webrtc: false */
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
 * Create a new Presentable.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.EventEmitter
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
    var that = webrtc.EventEmitter(params);
    delete that.client;
    that.className = 'webrtc.Presentable';

    var sessions = [];
    var presence = 'unavailable';

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
     * Get the name.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getName
     * @return {string} name
     */
    var getName = that.publicize('getName', function () {
        return that.name;
    });

    /**
     * Indicate whether the entity has an active Call. Should we only return true if
     * media is flowing, or anytime a WebRTC call is active? Should it return true if the
     * engaged in a Call on another device?
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.callInProgress
     * @returns {boolean}
     */
    var callInProgress = that.publicize('callInProgress', function () {
        return false;
    });

    /**
     * Set the presence on the object and the session
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.setPresence
     * @param {string} presence
     * @param {string} sessionId
     * @fires webrtc.Presentable#presence
     */
    var setPresence = that.publicize('setPresence', function (params) {
        params = params || {};
        params.presence = params.presence || 'available';
        params.sessionId = params.sessionId || 'local';

        sessions[params.sessionId] = {
            'sessionId': params.sessionId,
            'presence': params.presence
        };

        if (typeof that.resolvePresence === 'function') {
            presence = that.resolvePresence({sessions: sessions});
        } else {
            presence = params.presence;
        }

        that.fire('presence', presence);
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

    return that;
}; // End webrtc.Presentable

/**
 * Create a new Contact.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.Presentable
 * @classdesc Contact class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Contact}
 */
webrtc.Contact = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Presentable(params);
    delete that.client;
    that.className = 'webrtc.Contact';
    var sessions = {};

    var signalingChannel = webrtc.getClient(client).getSignalingChannel();

    /**
     * Send a message to the endpoint.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.sendMessage
     * @params {object} message The message to send
     */
    var sendMessage = that.publicize('sendMessage', function (params) {
        params = params || {};
        return signalingChannel.sendMessage({
            message: webrtc.TextMessage({
                'recipient': that,
                'sender': webrtc.getClient(client).user.getID(),
                'payload': params.message
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Send a signal to the endpoint.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.sendSignal
     * @params {object} message The signal to send
     */
    var sendSignal = that.publicize('sendSignal', function (params) {
        log.debug('Contact.sendSignal, no support for custom signaling profiles.');
        params = params || {};
        return signalingChannel.sendSignal({
            signal: webrtc.SignalingMessage({
                'recipient': that,
                'sender': webrtc.getClient(client).user.getID(),
                'payload': params.signal // JSON in string form
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Create a new Call for a voice and/or video call. If initiator is set to true,
     * the Call will start the call.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.call
     * @param {object} Optional CallSettings which will be used as constraints in getUserMedia.
     * @param {boolean} Optional Whether the logged-in user initiated the call.
     * @returns {webrtc.Call}
     */
    var call = that.publicize('call', function (params) {
        var id = that.getID();
        var call = null;
        var clientObj = webrtc.getClient(client);
        var combinedCallSettings = clientObj.getCallSettings();
        var user = clientObj.user;

        log.trace('Contact.call');
        log.debug('Default callSettings is', combinedCallSettings);
        if (params.initiator === undefined) {
            params.initiator = true;
        }

        if (!id) {
            log.error("Can't start a call without contact ID!");
            return;
        }

        // Apply call-specific callSettings to the app's defaults
        combinedCallSettings.constraints = params.constraints || combinedCallSettings.constraints;
        combinedCallSettings.servers = params.servers || combinedCallSettings.servers;
        log.debug('Final callSettings is', combinedCallSettings);

        params.callSettings = combinedCallSettings;
        params.client = client;
        params.username = user.getName();
        params.remoteEndpoint = id;

        params.signalOffer = function (sdp) {
            log.trace('signalOffer');
            signalingChannel.sendSDP({
                recipient: that,
                sdpObj: sdp
            });
        };
        params.signalAnswer = function (sdp) {
            log.trace('signalAnswer');
            signalingChannel.sendSDP({
                recipient: that,
                sdpObj: sdp
            });
        };
        params.signalCandidate = function (oCan) {
            oCan.type = 'candidate';
            signalingChannel.sendCandidate({
                recipient: that,
                candObj: oCan
            });
        };
        params.signalTerminate = function () {
            log.trace('signalTerminate');
            signalingChannel.sendBye({
                recipient: that
            });
        };
        params.signalReport = function (oReport) {
            log.debug("Not sending report");
            log.debug(oReport);
        };
        call = webrtc.Call(params);

        if (params.initiator === true) {
            call.answer();
        }
        user.addCall({call: call});

        // Don't use params.onHangup here. Will overwrite the developer's callback.
        call.listen('hangup', function hangupListener(locallySignaled) {
            user.removeCall({contactId: id});
        });
        return call;
    });

    /**
     * Find the presence out of all known sessions with the highest priority (most availability)
     * and set it as the contact's resolved presence.
     * @memberof! webrtc.Contact
     * @method webrtc.Contact.setPresence
     * @private
     */
    var resolvePresence = that.publicize('resolvePresence', function (params) {
        var presence;
        var options = ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'];
        params = params || {};
        var sessionIds = Object.keys(params.sessions);

        /**
         * Sort the sessionIds array by the priority of the value of the presence of that
         * sessionId. This will cause the first element in the sessionsId to be the id of the
         * session with the highest priority presence. Then we can access it by the 0 index.
         */
        sessionIds = sessionIds.sort(function sorter(a, b) {
            var indexA = options.indexOf(params.sessions[a].presence);
            var indexB = options.indexOf(params.sessions[b].presence);
            // Move it to the end of the list if it isn't one of our accepted presence values
            indexA = indexA === -1 ? 1000 : indexA;
            indexB = indexB === -1 ? 1000 : indexB;
            return indexA < indexB ? -1 : (indexB < indexA ? 1 : 0);
        });

        presence = sessionIds[0] ? params.sessions[sessionIds[0]].presence : 'unavailable';

        log.debug("presences resolved to " + presence);
        return presence;
    });

    return that;
}; // End webrtc.Contact

/**
 * Create a new User.
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
    var superClass = {
        setPresence: that.setPresence
    };
    delete that.client;
    that.className = 'webrtc.User';

    var remoteUserSessions = {};
    var calls = [];
    var presenceQueue = [];
    var signalingChannel = webrtc.getClient(client).getSignalingChannel();
    var userSession = webrtc.UserSession({
        'client': client,
        'token': params.token,
        'timeLoggedIn': params.timeLoggedIn,
        'loggedIn': params.loggedIn
    });

    /**
     * Override Presentable.setPresence to send presence to the server before updating the object.
     * @memberof! webrtc.User
     * @method webrtc.User.setPresence
     * @returns {webrtc.Contacts}
     */
    var setPresence = that.publicize('setPresence', function (params) {
        var promise;
        params = params || {};
        params.presence = params.presence || "available";
        log.info('sending my presence update ' + params.presence);

        promise = signalingChannel.sendPresence({
            presence: params.presence,
            onSuccess: function (p) {
                superClass.setPresence(params);
                if (typeof params.onSuccess === 'function') {
                    params.onSuccess(p);
                }
            },
            onError: params.onError
        });
        return promise;
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
        var call = null;
        calls.forEach(function findCall(one) {
            if (one.isActive()) {
                call = one;
            }
        });
        return call;
    });

    /**
     * Get the Call with the contact specified.
     * @memberof! webrtc.User
     * @method webrtc.User.getCallByContact
     * @param {string} Contact ID
     * @returns {webrtc.Call}
     */
    var getCallByContact = that.publicize('getCallByContact', function (params) {
        var call = null;
        var contact = null;
        var callSettings = null;
        var clientObj = webrtc.getClient(client);

        calls.forEach(function findCall(one) {
            if (one.remoteEndpoint === params.contactId) {
                if (one.getState() >= 6) { // ended or media error
                    return;
                }
                call = one;
            }
        });

        if (call === null && params.create === true) {
            contact = clientObj.getEndpoint({id: params.contactId});
            try {
                callSettings = clientObj.getCallSettings();
                call = contact.call({
                    callSettings: callSettings,
                    initiator: false
                });
            } catch (e) {
                log.error("Couldn't create Call: " + e.message);
            }
        }
        return call;
    });

    /**
     * Associate the call with this user.
     * @memberof! webrtc.User
     * @method webrtc.User.addCall
     * @param {webrtc.Call} call
     * @fires webrtc.User#call
     */
    var addCall = that.publicize('addCall', function (params) {
        if (calls.indexOf(params.call) === -1) {
            calls.push(params.call);
            that.fire('call', params.call, params.call.getContactID());
        }
    });

    /**
     * Remove the call.
     * @memberof! webrtc.User
     * @method webrtc.User.removeCall
     * @param {string} Optional Contact ID
     */
    var removeCall = that.publicize('removeCall', function (params) {
        var match = false;
        if (!params.contactId && !params.call) {
            throw new Error("Must specify contactId of Call to remove or the call itself.");
        }

        // Loop backward since we're modifying the array in place.
        for (var i = calls.length - 1; i >= 0; i -= 1) {
            if ((params.contactId && calls[i].getContactID() === params.contactId) ||
                    (params.call && calls[i] === params.call)) {
                calls.splice(i);
                match = true;
            }
        }

        if (!match) {
            log.warn("No call removed.");
        }
    });


    /**
     * Set presence to available.
     * @memberof! webrtc.User
     * @method webrtc.User.setOnline
     */
    var setOnline = that.publicize('setOnline', function (params) {
        params = params || {};
        params.presence = params.presence || 'available';
        return that.setPresence(params);
    });

    return that;
}; // End webrtc.User

