/**
 * Create a new XMPPSignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.XMPPSignalingChannel
 * @augments webrtc.SignalingChannel
 * @constructor
 * @classdesc XMPP Signaling class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPSignalingChannel}
 */
/*global webrtc: false */
webrtc.XMPPSignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.SignalingChannel(params);
    that.className = 'webrtc.XMPPSignalingChannel';

    var state = 'new';
    var BOSH_SERVICE = 'http://mercury.digiumlabs.com:5280/http-bind/';
    var NS = 'mercury:signaling';
    var stropheConnection = null;

    /**
     * Open a BOSH connection to ejabberd.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.open
     */
    var open = that.publicize('open', function () {
        stropheConnection = new Strophe.Connection(BOSH_SERVICE);
        state = 'open';
    });

    /**
     * Close BOSH connection to ejabberd.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.close
     */
    var close = that.publicize('close', function () {
        stropheConnection.disconnect();
        state = 'closed';
    });

    /**
     * Generate a unique ID to identify the call.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.generateCallID
     * @private
     * @returns {string}
     */
    var generateCallID = function () {
        return Math.floor(Math.random() * 100000000);
    };

    /**
     * In XMPP, there is no state to a messaging session, so this method always returns "open."
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.getState
     * @return {string} The state of the signaling channel.
    */
    var getState = that.publicize('getState', function () {
        return state;
    });

    /**
     * Whether signaling channel is open.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.isOpen
     * @return {boolean}
     */
    var isOpen = that.publicize('isOpen', function () {
        return state === 'open';
    });

    /**
     * Generate and send a presence stanza representing the user's current status. This triggers the
     * server to send the user's contact's presence.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.sendPresence
     * @param {string} presence description, "unavailable", "available", "away", "xa", "dnd"
     */
    var sendPresence = that.publicize('sendPresence', function (presenceString) {
        var pres = null;
        switch (presenceString) {
        case "":
        case null:
        case undefined:
        case false:
        case "available":
            pres = $pres();
            break;
        case "unavailable":
            pres = $pres({'type' : 'unavailable'});
            break;
        case "dnd":
        case "away":
        case "xa":
            pres = $pres().c('show', {}).t(presenceString);
            break;
        default:
            throw new Error("Can't send invalid presence " + presenceString + "!");
        }
        stropheConnection.send(pres.tree());
    });

    /**
     * Generate an iq stanza requesting the server send the user's roster.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.requestRoster
     * @param {string} myJID User's JID.
     */
    var requestRoster = that.publicize('requestRoster', function (myJID) {
        if (!myJID) {
            throw new Error("Can't request roster without JID.");
        }
        var rosterStanza = $iq({
            'from': myJID,
            'type': 'get',
            'id': 'roster_1'
        }).c('query', { 'xmlns' : Strophe.NS.ROSTER}).tree();
        stropheConnection.send(rosterStanza);
    });

    /**
     * Send a chat message.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.sendMessage
     * @param {string} message The string text message to send.
     * @fires webrtc.Endpoint#message:sent
     */
    var sendMessage = that.publicize('sendMessage', function (message) {
        var stanza = message.getXMPP();
        stropheConnection.send(stanza.tree());
        message.getRecipient().fire('message:sent', message);
    });

    /**
     * Stringify object message. Build an XMPP stanza with Strophe. Send it to the XMPP server.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.send
     * @param {string} recipient The recipient of the message.
     * @param {object} msgObj A JavaScript object to JSONify before sending as an XMPP message.
     * @deprecated
     */
    var send = that.publicize('send', function (recipient, msgObj) {
        var text = '';
        if (!msgObj) {
            console.log("Can't send, no message.");
            return;
        }
        if (!recipient) {
            console.log("Can't send, recipient is " + recipient);
            return;
        }
        if (recipient === stropheConnection.jid) {
            console.log("Can't send, recipient is me!");
            return;
        }

        console.log('sending a ' + msgObj.type);
        text = $msg({
            'to': recipient,
            'from': stropheConnection.jid,
            'type' : 'signaling'
        }).c('signaling', {
            'xmlns': NS
        }).t(escape(JSON.stringify(msgObj))).tree();
        console.log(text);
        stropheConnection.send(text);
    });

    /**
     * Send an ICE candidate to the XMPP server.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.sendCandidate
     * @param {string} recipient The JID of the recipient.
     * @param {RTCIceCandidate} candObj An ICE candidate to JSONify and send as an XMPP message.
     */
    var sendCandidate = that.publicize('sendCandidate', function (recipient, candObj) {
        var text = '';
        if (!stropheConnection.jid || !recipient) {
            throw new Error("Can't send without sender and recipient.`");
        }

        text = $msg({
            'to': recipient,
            'from': stropheConnection.jid,
            'type' : 'signaling'
        }).c('signaling', {
            'xmlns': NS,
            'type': 'candidate'
        }).t(escape(JSON.stringify(candObj))).tree();
        console.log(text);
        stropheConnection.send(text);
    });

    /**
     * Send an SDP to the XMPP server.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.sendSDP
     * @param {string} recipient The JID of the recipient.
     * @param {RTCSessionDescription} sdpObj An SDP to JSONify and send as an XMPP message.
     */
    var sendSDP = that.publicize('sendSDP', function (recipient, sdpObj) {
        var text = '';
        if (!stropheConnection.jid || !recipient) {
            throw new Error("Can't send without sender and recipient.`");
        }

        text = $msg({
            'to': recipient,
            'from': stropheConnection.jid,
            'type' : 'signaling'
        }).c('signaling', {
            'xmlns': NS,
            'type': sdpObj.type
        }).t(escape(JSON.stringify(sdpObj))).tree();
        console.log(text);
        stropheConnection.send(text);
    });

    /**
     * Send an message terminating the WebRTC session to the XMPP server.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.sendBye
     * @param {string} recipient The JID of the recipient.
     * @param {string} reason The reason the session is being terminated.
     */
    var sendBye = that.publicize('sendBye', function (recipient, reason) {
        var text = '';
        if (!stropheConnection.jid || !recipient) {
            throw new Error("Can't send without sender and recipient.`");
        }

        text = $msg({
            'to': recipient,
            'from': stropheConnection.jid,
            'type' : 'signaling'
        }).c('signaling', {
            'xmlns': NS,
            'type': 'bye'
        }).t(escape(JSON.stringify({
            'type': 'bye',
            'reason': reason
        }))).tree();
        console.log(text);
        stropheConnection.send(text);
    });

    /**
     * Parse an XMPP message and find the JSON signaling blob in it.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.parseText
     * @param {object} msgXML An XMPP signaling stanza.
     * @return {object} signalingObj A JavaScript object containing the signaling information.
     */
    var parseText = that.publicize('parseText', function (msgXML) {
        var json = {};
        var sig = null;
        var signalingElements = msgXML.getElementsByTagName('signaling');
        if (signalingElements.length === 0) {
            return null;
        }

        sig = signalingElements[0];
        json.value = unescape(Strophe.getText(sig));
        json.from = msgXML.getAttribute('from');
        json.to = msgXML.getAttribute('to');
        json.type = sig.getAttribute('type');

        try {
            json.value = JSON.parse(json.value);
        } catch (e) {
            json.value = null;
            console.log("Couldn't parse JSON from msg received: " + e.message);
        }

        return json;
    });

    /**
     * Route different types of signaling messages via events.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.routeSignal
     * @param {webrtc.XMPPSignalingMessage} message A message to route
     */
    var routeSignal = that.publicize('routeSignal', function (message) {
        var mediaSession = mercury.user.getMediaSessionByContact(message.sender);
        var signal = message.getPayload();
        switch (signal.type) {
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'bye':
            that.fire('received:' + signal.type, signal.value);
            break;
        case 'error':
            console.log("Received an error");
            console.log(signal);
            break;
        default:
            console.log("Don't know what to do with msg of unknown type " + signal.type);
            break;
        }
    });

    /**
     * Add a handler to the Strophe connection for XMPP messages of different types.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.addHandler
     * @param {string} type The type of stanza, e. g., 'iq', 'pres'
     * @param {function} handler A function to which to pass the message
     */
    var addHandler = that.publicize('addHandler', function (type, handler) {
        stropheConnection.addHandler(handler, null, type, null, null, null);
    });

    /**
     * Authenticate to via Strophe and call the handler on state change.
     * @memberof! webrtc.XMPPSignalingChannel
     * @method webrtc.XMPPSignalingChannel.authenticate
     * @param {string} username The XMPP JID and resource
     * @param {string} password The XMPP password.
     * @param {function} onStatusChange A function to which to call on every state change.
     */
    var authenticate = that.publicize('authenticate', function (username, password, onStatusChange) {
        stropheConnection.connect(username, password, onStatusChange);
    });

    return that;
}; // End webrtc.XMPPSignalingChannel

/**
 * Create a new XMPPIdentityProvider.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.IdentityProvider
 * @classdesc XMPP Identity provider class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPIdentityProvider}
 */
webrtc.XMPPIdentityProvider = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.IdentityProvider(params);
    that.className = 'webrtc.XMPPIdentityProvider';

    var signalingChannel = null;
    var loggedIn = false;

    /**
     * Log an XMPP user in.
     * @memberof! webrtc.XMPPIdentityProvider
     * @method webrtc.XMPPIdentityProvider.login
     * @param {string} username The XMPP user's Jabber ID (jid).
     * @param {string} password The XMPP user's password.
     * @returns {Promise<webrtc.User>}
     */
    var login = that.publicize('login', function (username, password) {
        var deferred = null;
        if (signalingChannel === null) {
            signalingChannel = mercury.getSignalingChannel();
        }
        if (!signalingChannel.isOpen()) {
            signalingChannel.open();
        }
        deferred = Q.defer();
        signalingChannel.authenticate(username, password, function (statusCode) {
            var user = null;
            if (statusCode === Strophe.Status.CONNECTED) {
                console.log('Strophe is connected.');
                user = webrtc.XMPPUser({
                    'jid': username,
                    'loggedIn': true
                });
                deferred.resolve(user);
            } else if (statusCode === Strophe.Status.ERROR) {
                deferred.reject(new Error("Unknown error."));
            } else if (statusCode === Strophe.Status.AUTHFAIL) {
                deferred.reject(new Error("Authentication failure."));
            } else if (statusCode === Strophe.Status.CONNFAIL) {
                deferred.reject(new Error("Couldn't connect."));
            } else if (statusCode === Strophe.Status.DISCONNECTED) {
                deferred.reject(new Error("Got disconnected."));
            } else if (statusCode === Strophe.Status.AUTHENTICATING) {
            } else if (statusCode === Strophe.Status.ATTACHED) {
            } else if (statusCode === Strophe.Status.CONNECTING) {
            } else if (statusCode === Strophe.Status.DISCONNECTING) {
            } else {
                console.log("unknown strophe connection status. " + statusCode);
            }
        });
        return deferred.promise;
    });

    /**
     * Log an XMPP user out.
     * @memberof! webrtc.XMPPIdentityProvider
     * @method webrtc.XMPPIdentityProvider.logout
     */
    var logout = that.publicize('logout', function () {
        signalingChannel.listen('closed', function () {
            loggedIn = false;
        });
        signalingChannel.close();
    });

    /**
     * Whether logged in
     * @memberof! webrtc.XMPPIdentityProvider
     * @method webrtc.XMPPIdentityProvider.isLoggedIn
     * @return {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        return !!loggedIn;
    });

    return that;
}; // End webrtc.XMPPIdentityProvider

/**
 * Create a new XMPPPresentable.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.Presentable
 * @classdesc XMPP Presentable class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @property {string} username Username portion of JID, e. g., espiceland
 * @property {string} domain Domain portion of JID, e. g., digium.com
 * @property {string} jid JID without resource, e. g., espiceland@digium.com
 * @property {string} emailFormat JID without resource, equal to jid
 * @property {string} resourceFormat JID with resource, e. g., espiceland@digium.com/fjkahsfhadf
 * @property {string} idstring JID without resource with @ replaced by . for use in DOM, e. g.,
 * espiceland.digium.com.
 * @returns {webrtc.XMPPPresentable}
 */
webrtc.XMPPPresentable = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Presentable(params);

    that.className = 'webrtc.XMPPPresentable';
    that.domain = null;
    that.username = null;
    that.emailFormat = null;
    that.resourceFormat = null;
    that.idstring = null;
    var resources = [];
    var presence = 'unavailable';

    that.listen('signaling:received', function(message) {
        console.log(message);
        mercury.getSignalingChannel().routeSignal(message);
    });

    /**
     * Set identity information such as username, domain, email format from JID. This method exists
     * in this form so that we can create instances of this class without a JID for creating
     * subclasses. Called from the constructor or from setJID().
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.init
     * @private
     */
    var init = function () {
        var resourcePieces = [];
        var jidPieces = [];
        if (!that.jid) {
            throw new Error("Can't use an XMPPPresentable without a JID.");
        }

        resourcePieces = that.jid.split('/');

        if (resourcePieces[1]) {
            resources.push({
                'resource': resourcePieces[1],
                'presence': 'unavailable',
                'show': ''
            });
        }

        jidPieces = resourcePieces[0].split('@');
        that.emailFormat = resourcePieces[0];
        that.id = resourcePieces[0];
        that.username = jidPieces[0];
        that.name = jidPieces[0];
        that.domain = jidPieces[1];

        if (!that.username || !that.domain || !that.emailFormat) {
            throw new Error("Can't create an XMPPPresentable. " + that.jid + " is wrong format!");
        }

        that.idstring = that.emailFormat.replace('@', '.');
    };

    /**
     * Use getEmailFormat as getID.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getEmailFormat
     * @return {string} email
     */
    var getID = that.publicize('getID', function () {
        return that.emailFormat;
    });

    /**
     * Get the JID without the resource.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getEmailFormat
     * @return {string} email
     */
    var getEmailFormat = that.publicize('getEmailFormat', function () {
        return that.emailFormat;
    });

    /**
     * Get the JID with the resource.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getResourceFormat
     * @return {string} resourcejid
     */
    var getResourceFormat = that.publicize('getResourceFormat', function () {
        return that.jid;
    });

    /**
     * Get the a unique id formatted from the JID with resource that has the @ and / replaced with
     * periods to serve as a dom ID.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getIDString
     * @return {string} idstring
     */
    var getIDString = that.publicize('getIDString', function () {
        return that.idstring;
    });

    /**
     * Get the display name of the endpoint.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getDisplayName
     * @return {string} displayName
     */
    var getDisplayName = that.publicize('getDisplayName', function () {
        return that.name || that.username || that.jid || that.emailFormat;
    });

    /**
     * Get the username.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getUsername
     * @return {string} displayName
     */
    var getUsername = that.publicize('getUsername', function () {
        return that.username;
    });

    /**
     * Determine whether a JID matches the JID of this endpoint.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.matchesJID
     * @param {string} jid A JID with or without resource to compare this user's JID to for
     * equality.
     * @return {boolean}
     */
    var matchesJID = that.publicize('matchesJID', function (jid) {
        var pieces = [];
        var regex = null;
        if (!jid || !that.jid) {
            return false;
        }
        pieces = jid.split('/');
        regex = new RegExp('^' + that.username + '\\@' + that.domain + '\\/?\\w*$', 'i');
        return regex.test(pieces[0]);
    });

    /**
     * Get the presence of the endpoint.
     * @memberof! webrtc.XMPPPresentable
     * @method webrtc.XMPPPresentable.getStatus
     * @deprecated Use or override getPresence instead.
     */
    var getStatus = that.publicize('getStatus', function () {
        return presence;
    });

    if (that.jid) {
        init();
    }

    return that;
}; // End webrtc.XMPPPresentable

/**
 * Create a new XMPPEndpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.XMPPPresentable
 * @classdesc XMPP Endpoint class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPEndpoint}
 */
webrtc.XMPPEndpoint = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.XMPPPresentable(params);
    that.className = 'webrtc.XMPPEndpoint';

    var signalingChannel = mercury.getSignalingChannel();

    /**
     * Send a message to the endpoint.
     * @memberof! webrtc.XMPPEndpoint
     * @method webrtc.XMPPEndpoint.sendMessage
     * @params {object} message The message to send
     */
    var sendMessage = that.publicize('sendMessage', function (message) {
        signalingChannel.sendMessage(webrtc.XMPPChatMessage({
            'recipient': that,
            'sender': mercury.user.getResourceFormat(),
            'payload': message
        }));
    });

    return that;
}; // End webrtc.XMPPEndpoint

/**
 * Create a new XMPPContact.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.XMPPEndpoint
 * @classdesc XMPP Contact class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPContact}
 */
webrtc.XMPPContact = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.XMPPEndpoint(params);
    that.className = 'webrtc.XMPPContact';

    var presence = 'unavailable';
    var subscription = 'both';
    var resources = {};

    /**
     * Set the presence on the Contact and the resource
     * @memberof! webrtc.XMPPContact
     * @method webrtc.XMPPContact.setPresence
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
     * @memberof! webrtc.XMPPContact
     * @method webrtc.XMPPContact.setPresence
     * @private
     * @fires webrtc.XMPPPresentable#presence
     */
    var resolvePresence = function () {
        resources.forOwn(function (resource) {
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
        that.fire('presence', presence);
    };

    return that;
}; // End webrtc.XMPPContact

/**
 * Create a new XMPPUser. This class does NOT extend {webrtc.User} but should! Make
 * {webrtc.Class.extend} support multiple inheritance?
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.XMPPPresentable
 * @classdesc XMPP User class
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPUser}
 */
webrtc.XMPPUser = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.XMPPPresentable(params);
    that.className = 'webrtc.XMPPUser';

    var subscription = 'both';
    var remoteUserSessions = {};
    var mediaSessions = [];
    var contactList = new webrtc.ContactList();
    var presenceQueue = [];
    var presence = 'unavailable';
    var signalingChannel = mercury.getSignalingChannel();
    var userSession = new webrtc.UserSession({
        'token': params.token,
        'timeLoggedIn': params.timeLoggedIn,
        'loggedIn': params.loggedIn
    });

    // listen to webrtc.User#presence:update -- the logged-in user's presence
    that.listen("presence", function (presenceString) {
        presence = presenceString;
        if (signalingChannel && signalingChannel.isOpen()) {
            console.log('sending my presence update ' + presenceString);
            signalingChannel.sendPresence(presenceString);
        } else {
            console.log("Can't send my presence: no signaling channel.");
        }
    });

    // listen to webrtc.ContactList#presence -- the contacts's presences
    contactList.listen('new', function (contact) {
        that.fire('contact:new', contact);
    });

    // listen to webrtc.ContactList#presence -- the contacts's presences
    contactList.listen('presence', function (presenceMessage) {
        try {
            var presPayload = presenceMessage.getPayload();
            if (presPayload.presence === 'error') {
                return;
            }

            var from = presenceMessage.sender.split('/');
            var jid = from[0];
            var resource = from[1];
            var contact = this.get(jid);

            if (jid === that.jid && resource !== that.resource) {
                // Found another of our own user's resources.
                this.remoteUserSessions[resource] = {
                    'jid': that.jid,
                    'resource': resource,
                    'presence': presPayload.presence
                };
                return;
            } else if (!contact) {
                // Not us, but not on our roster either. This should never happen per XMPP spec.
                return;
            }
            contact.setPresence(presPayload.presence, resource);
        } catch (f) {
            console.log(f.message);
            console.log(f.stack);
            console.log(presenceMessage);
        }
    });

    /**
     * Send iq stanza requesting roster.
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.requestContacts
     * @returns {Promise<webrtc.ContactList>}
     */
    var requestContacts = that.publicize('requestContacts', function () {
        var deferred = Q.defer();
        if (!userSession.isLoggedIn()) {
            deferred.reject(new Error("Can't request contacts unless logged in."));
            return deferred.promise;
        }
        deferred.promise.then(function (contactList) {
            setTimeout(function () { contactList.processPresenceQueue(); }, 1000);
        }).done();

        /* This seems like not a good place to define this handler, but it must have access
         * to the promise that requestContacts must return, so it is necessary.
         */
        signalingChannel.addHandler('iq', function (stanza) {
            console.log(stanza);
            var itemElements = $j(stanza).find("item");
            if (itemElements.length === 0) {
                deferred.reject(new Error("No items in the roster."));
                return true;
            }

            itemElements.each(function () {
                var sub = $j(this).attr('subscription');
                var jid = $j(this).attr('jid');
                var name = $j(this).attr('name');
                var contact = null;
                if (!(!sub || sub === 'to' || sub === 'both')) {
                    return;
                }
                try {
                    contact = new webrtc.XMPPContact({
                        'jid': jid,
                        'name': name,
                        'subscription': sub
                    });
                } catch (e) {
                    console.log("Couldn't create contact: " + e.message);
                    return;
                }
                contactList.add(contact);
            });
            deferred.resolve(contactList);
            return true;
        });

        signalingChannel.requestRoster(that.getResourceFormat());
        return deferred.promise;
    });

    /**
     * Get the User's locally logged-in UserSession
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.getUserSession
     * @returns {webrtc.UserSession}
     */
    var getUserSession = that.publicize('getUserSession', function () {
        return userSession;
    });

    /**
     * Create a new MediaSession for a voice and/or video call. If initiator is set to true,
     * the MediaSession will start the call.
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.getUserSession
     * @param {string} contactJID The JID of the remote party.
     * @param {boolean} initiator Whether the User is the initiator of the call.
     * @returns {webrtc.UserSession}
     * @fires webrtc.User#media:started
     * @todo TODO: Don't make developer pass in initiator boolean.
     * @todo TODO: Move this to Endpoint so we also don't have to pass the JID
     * @todo TODO: Make this take a constraints object.
     */
    var startMedia = that.publicize('startMedia', function (contactJID, initiator) {
        var mediaSession = webrtc.MediaSession({
            'username': that.username,
            'remoteEndpoint': contactJID,
            'initiator': initiator,
            'signalInitiate' : function (sdp) {
                sdp.type = 'offer';
                signalingChannel.sendSDP(contactJID, sdp);
            },
            'signalAccept' : function (sdp) {
                sdp.type = 'answer';
                signalingChannel.sendSDP(contactJID, sdp);
            },
            'signalCandidate' : function (oCan) {
                if (oCan !== null) {
                    signalingChannel.sendCandidate(contactJID, oCan);
                }
            },
            'signalTerminate' : function () {
                console.log('signalTerminate');
                signalingChannel.sendBye(contactJID);
            },
            'signalReport' : function (oReport) {
                console.log("Not sending report");
                console.log(oReport);
            }
        });
        mediaSessions.push(mediaSession);
        mediaSession.start();
        that.fire('media:started', mediaSession, contactJID);
        mediaSession.listen('hangup', function (locallySignaled) {
            removeMediaSession(contactJID);
        });
        return mediaSession;
    });

    /**
     * Get the active MediaSession.  Can there be multiple active MediaSessions? Should we timestamp
     * them and return the most recently used? Should we create a MediaSession if none exist?
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.getActiveMediaSession
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
        console.log(mediaSessions);
        return session;
    });

    /**
     * Get the MediaSession with the contact specified.
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.getMediaSessionByContact
     * @param {string} JID without resource of the contact to search for.
     * @returns {webrtc.MediaSession}
     */
    var getMediaSessionByContact = that.publicize('getMediaSessionByContact', function (contactJID){
        var session = null;
        mediaSessions.forEach(function (mediaSession) {
            if (mediaSession.remoteEndpoint === contactJID) {
                session = mediaSession;
            }
        });

        if (session === null) {
            session = startMedia(contactJID, false);
        }

        return session;
    });

    /**
     * Remove the media session.
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.removeMediaSession
     * @param {string} Optional JID without resource of the contact to search for.
     */
    var removeMediaSession = that.publicize('removeMediaSession', function (contactJID) {
        var toDelete = null;

        if (!contactJID) {
            mediaSessions = [];
        }

        mediaSessions.forEach(function (mediaSession, index) {
            if (mediaSession.remoteEndpoint === contactJID) {
                toDelete = index;
            }
        });

        if (toDelete === null) {
            console.log("Couldn't find mediaSession in removeMediaSession");
            return;
        }

        mediaSessions.splice(toDelete);
    });


    /**
     * Set presence to available. First use of this function triggers reception of presence per XMPP
     * spec, so we will add a handler to listen for it before sending our presence.
     * @memberof! webrtc.XMPPUser
     * @method webrtc.XMPPUser.setOnline
     */
    var setOnline = that.publicize('setOnline', function () {
        /* Now we know this user cares about their own presence, we can assume he
         * will also care about his contacts' presences.
         */
        signalingChannel.addHandler('presence', function (stanza) {
            console.log(stanza);
            var message = mercury.presenceMessage({
                'rawMessage': stanza,
                'sender': stanza.getAttribute('from'),
                'recipient': that
            });
            if (contactList.length === 0) {
                contactList.queuePresence(message);
            } else {
                contactList.fire('presence', message);
            }
            return true;
        });

        /* There's not really a better place for us to know the user will care about receiving
         * messages. We'll just put it here since messages tend to go along with presence.
         */
        signalingChannel.addHandler('message', function (stanza) {
            console.log(stanza);
            var from = stanza.getAttribute('from');
            var type = stanza.getAttribute('type');
            if (['chat', 'signaling', 'groupchat'].indexOf(type) === -1) {
                console.log('wrong type ' + type);
                return true;
            }

            var fromPieces = from.split('/');
            var contact = contactList.get(fromPieces[0]);
            if (!contact) {
                console.log("no contact");
                return true;
            }
            var params = {
                'rawMessage': stanza,
                'recipient': that,
                'sender': contact.getResourceFormat()
            };
            if (type === 'signaling') {
                contact.fire('signaling:received', mercury.signalingMessage(params));
            } else {
                contact.fire('message:received', mercury.chatMessage(params));
            }
            return true;
        });

        that.setPresence('available');
    });

    return that;
}; // End webrtc.XMPPUser

/**
 * Create a new XMPPChatMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.XMPPChatMessage
 * @constructor
 * @augments webrtc.Message
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPChatMessage}
 */
webrtc.XMPPChatMessage = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Message(params);

    that.className = 'webrtc.XMPPChatMessage';
    var rawMessage = params.rawMessage; // Only set on incoming message.
    var payload = params.payload; // Only set on outgoing message.
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.XMPPChatMessage
     * @method webrtc.XMPPChatMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        if (thisMsg) {
            rawMessage = thisMsg;
        }
        try {
            payload = Strophe.getText(rawMessage.getElementsByTagName('body')[0]);
        } catch (e) {
            console.log("Not an XMPP text message!");
        }
    });

    /**
     * Construct an XMPP Stanza
     * @memberof! webrtc.XMPPChatMessage
     * @method webrtc.XMPPChatMessage.getXMPP
     * @returns {object} Strophe XMPP stanza.
     */
    var getXMPP = that.publicize('getXMPP', function () {
        return $msg({
            'to': recipient.getEmailFormat(),
            'from': sender,
            'type': 'chat'
        }).c('body').t(payload);
    });

    /**
     * Get the whole payload.
     * @memberof! webrtc.XMPPChatMessage
     * @method webrtc.XMPPChatMessage.getPayload
     * @returns {string}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the whole chat message.
     * @memberof! webrtc.XMPPChatMessage
     * @method webrtc.XMPPChatMessage.getText
     * @returns {string}
     */
    var getText = that.publicize('getText', getPayload);

    /**
     * Get the recipient.
     * @memberof! webrtc.XMPPChatMessage
     * @method webrtc.XMPPChatMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.XMPPChatMessage

/**
 * Create a new XMPPSignalingMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.XMPPSignalingMessage
 * @constructor
 * @augments webrtc.Message
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPSignalingMessage}
 */
webrtc.XMPPSignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Message(params);
    that.className = 'webrtc.XMPPSignalingMessage';

    var rawMessage = params.rawMessage;
    var payload = null;
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse and format messages for consumption by the router
     * @memberof! webrtc.XMPPSignalingMessage
     * @method webrtc.XMPPSignalingMessage.parse
     */
    var parse = that.publicize('parse', function () {
        payload = mercury.getSignalingChannel().parseText(rawMessage);
    });

    /**
     * Attempt to construct a string from the payload.
     * @memberof! webrtc.XMPPSignalingMessage
     * @method webrtc.XMPPSignalingMessage.getText
     * @returns {string} A string that may represent the value of the payload.
     * @abstract
     */
    var getText = that.publicize('getText', function () {
        return payload.type;
    });

    /**
     * Get the whole payload
     * @memberof! webrtc.XMPPSignalingMessage
     * @method webrtc.XMPPSignalingMessage.getPayload
     * @returns {object}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the recipient.
     * @memberof! webrtc.XMPPSignalingMessage
     * @method webrtc.XMPPSignalingMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.XMPPSignalingMessage

/**
 * Create a new XMPPPresenceMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.XMPPPresenceMessage
 * @constructor
 * @augments webrtc.Message
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.XMPPPresenceMessage}
 */
webrtc.XMPPPresenceMessage = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Message(params);
    that.className = 'webrtc.XMPPPresenceMessage';

    var rawMessage = params.rawMessage;
    var payload = {};
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.XMPPPresenceMessage
     * @method webrtc.XMPPPresenceMessage.parse
     * @param {object|string} rawMessage Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        var show = '';
        var showElements = [];

        if (thisMsg) {
            rawMessage = thisMsg;
        }

        payload.presence = rawMessage.getAttribute('type') || "available";

        showElements = $j(rawMessage).find('show');
        if (showElements.length === 0) {
            return;
        }

        show = Strophe.getText(showElements[0]);
        if (show) {
            payload.presence = show;
        }
    });

    /**
     * Construct an XMPP Presence Stanza
     * @memberof! webrtc.XMPPPresenceMessage
     * @method webrtc.XMPPPresenceMessage.getXMPP
     */
    var getXMPP = that.publicize('getXMPP', function () {
        if (!payload) {
            throw new Error("No message payload.");
        }
        return $msg({
            'to': recipient.getEmailFormat(),
            'from': sender,
            'type': 'chat'
        }).c('body').t(payload);
    });

    /**
     * Get the presence string.
     * @memberof! webrtc.XMPPPresenceMessage
     * @method webrtc.XMPPPresenceMessage.getText
     * @returns {string}
     */
    var getText = that.publicize('getText', function () {
        if (!payload) {
            throw new Error("No message payload.");
        }
        return payload.presence;
    });

    /**
     * Get the whole payload
     * @memberof! webrtc.XMPPPreseceMessage
     * @method webrtc.XMPPPresenceMessage.getPayload
     * @returns {object}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the recipient.
     * @memberof! webrtc.XMPPPresenceMessage
     * @method webrtc.XMPPPresenceMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.XMPPPresenceMessage
