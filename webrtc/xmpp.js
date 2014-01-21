/**
 * Create a new SignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.SignalingChannel
 * @constructor
 * @classdesc XMPP Signaling class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingChannel}
 */
/*global webrtc: false, Strophe: false, $pres: false, $iq: false, $msg: false */
webrtc.SignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = params;
    delete that.client;
    that.className = 'webrtc.SignalingChannel';

    var state = 'new';
    var BOSH_SERVICE = 'http://mercury.digiumlabs.com:5280/http-bind/';
    var NS = 'mercury:signaling';
    var stropheConnection = null;

    /**
     * Open a BOSH connection to ejabberd.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.open
     */
    var open = that.publicize('open', function () {
        stropheConnection = new Strophe.Connection(BOSH_SERVICE);
        log.trace("Signaling connection open.");
        /*stropheConnection.rawInput = function (msg) {
            log.trace(msg);
        };
        stropheConnection.rawOutput = function (msg) {
            log.trace(msg);
        };*/
        state = 'open';
    });

    /**
     * Close BOSH connection to ejabberd.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.close
     */
    var close = that.publicize('close', function () {
        stropheConnection.disconnect();
        log.trace("Signaling connection closed.");
        state = 'closed';
    });

    /**
     * Generate a unique ID to identify the call.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.generateCallID
     * @private
     * @returns {string}
     */
    var generateCallID = webrtc.makeUniqueID;

    /**
     * In XMPP, there is no state to a messaging session, so this method always returns "open."
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getState
     * @return {string} The state of the signaling channel.
    */
    var getState = that.publicize('getState', function () {
        return state;
    });

    /**
     * Whether signaling channel is open.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.isOpen
     * @return {boolean}
     */
    var isOpen = that.publicize('isOpen', function () {
        return state === 'open';
    });

    /**
     * Generate and send a presence stanza representing the user's current status. This triggers the
     * server to send the user's contact's presence.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendPresence
     * @param {string} presence description, "unavailable", "available", "away", "xa", "dnd"
     */
    var sendPresence = that.publicize('sendPresence', function (presenceString) {
        var pres = null;

        log.trace("Signaling sendPresence");

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
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.requestRoster
     * @param {string} myJID User's JID.
     */
    var requestRoster = that.publicize('requestRoster', function (myJID) {
        var rosterStanza = null;

        log.trace("requestRoster");

        if (!myJID) {
            throw new Error("Can't request roster without JID.");
        }
        rosterStanza = $iq({
            'from': myJID,
            'type': 'get',
            'id': 'roster_1'
        }).c('query', { 'xmlns' : Strophe.NS.ROSTER}).tree();
        stropheConnection.send(rosterStanza);
    });

    /**
     * Send a chat message.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendMessage
     * @param {string} message The string text message to send.
     */
    var sendMessage = that.publicize('sendMessage', function (message) {
        var stanza = message.getXMPP();
        stropheConnection.send(stanza.tree());
    });

    /**
     * Stringify object message. Build an XMPP stanza with Strophe. Send it to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.send
     * @param {string} recipient The recipient of the message.
     * @param {object} msgObj A JavaScript object to JSONify before sending as an XMPP message.
     * @deprecated
     */
    var send = that.publicize('send', function (recipient, msgObj) {
        var text = '';
        if (!msgObj) {
            log.warn("Can't send, no message.");
            return;
        }
        if (!recipient) {
            log.warn("Can't send, recipient is " + recipient);
            return;
        }
        if (recipient === stropheConnection.jid) {
            log.warn("Can't send, recipient is me!");
            return;
        }

        log.debug('sending a ' + msgObj.type);
        text = $msg({
            'to': recipient,
            'from': stropheConnection.jid,
            'type' : 'signaling'
        }).c('signaling', {
            'xmlns': NS
        }).t(escape(JSON.stringify(msgObj))).tree();
        log.debug(text);
        stropheConnection.send(text);
    });

    /**
     * Send an ICE candidate to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendCandidate
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
        log.debug(text);
        stropheConnection.send(text);
    });

    /**
     * Send an SDP to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendSDP
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
        log.debug(text);
        stropheConnection.send(text);
    });

    /**
     * Send an message terminating the WebRTC session to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendBye
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
        log.debug(text);
        stropheConnection.send(text);
    });

    /**
     * Parse an XMPP message and find the JSON signaling blob in it.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.parseText
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
            log.warn("Couldn't parse JSON from msg received: " + e.message);
        }

        return json;
    });

    /**
     * Route different types of signaling messages via events.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.routeSignal
     * @param {webrtc.SignalingMessage} message A message to route
     */
    var routeSignal = that.publicize('routeSignal', function (message) {
        var call = webrtc.getClient(client).user.getCallByContact(message.sender);
        var signal = message.getPayload();

        switch (signal.type) {
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'bye':
            that.fire(signal.type, signal.value);
            break;
        case 'error':
            log.warn("Received an error");
            log.warn(signal);
            break;
        default:
            log.error("Don't know what to do with msg of unknown type " + signal.type);
            break;
        }
    });

    /**
     * Add a handler to the Strophe connection for XMPP messages of different types.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.addHandler
     * @param {string} type The type of stanza, e. g., 'iq', 'pres'
     * @param {function} handler A function to which to pass the message
     */
    var addHandler = that.publicize('addHandler', function (type, handler) {
        stropheConnection.addHandler(handler, null, type, null, null, null);
    });

    /**
     * Authenticate to via Strophe and call the handler on state change.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.authenticate
     * @param {string} username The XMPP JID and resource
     * @param {string} password The XMPP password.
     * @param {function} onStatusChange A function to which to call on every state change.
     */
    var authenticate = that.publicize('authenticate',
            function (username, password, onStatusChange) {
                stropheConnection.connect(username, password, onStatusChange);
            }
    );

    return that;
}; // End webrtc.SignalingChannel

/**
 * Create a new XMPPIdentityProvider.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.AbstractIdentityProvider
 * @classdesc XMPP Identity provider class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.IdentityProvider}
 */
webrtc.IdentityProvider = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractIdentityProvider(params);
    delete that.client;
    that.className = 'webrtc.IdentityProvider';

    var signalingChannel = null;
    var loggedIn = false;

    /**
     * Log an XMPP user in.
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.login
     * @param {string} username The XMPP user's Jabber ID (jid).
     * @param {string} password The XMPP user's password.
     * @returns {Promise<webrtc.User>}
     */
    var login = that.publicize('login', function (username, password) {
        var deferred = null;

        log.trace("User login");
        log.debug('client is ' + client);

        if (signalingChannel === null) {
            signalingChannel = webrtc.getClient(client).getSignalingChannel();
        }
        if (!signalingChannel.isOpen()) {
            signalingChannel.open();
        }
        deferred = Q.defer();
        signalingChannel.authenticate(username, password, function onAuth(statusCode) {
            var user = null;

            if (statusCode === Strophe.Status.CONNECTED) {
                log.info('Strophe is connected.');
                user = webrtc.User({
                    'client': client,
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
                log.warn("unknown strophe connection status. " + statusCode);
            }
        });
        return deferred.promise;
    });

    /**
     * Log an XMPP user out.
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.logout
     */
    var logout = that.publicize('logout', function () {
        log.trace("User logout");
        signalingChannel.listen('closed', function loggedOutHandler() {
            loggedIn = false;
        });
        signalingChannel.close();
    });

    /**
     * Whether logged in
     * @memberof! webrtc.IdentityProvider
     * @method webrtc.IdentityProvider.isLoggedIn
     * @return {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        return !!loggedIn;
    });

    return that;
}; // End webrtc.IdentityProvider

/**
 * Create a new Presentable.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments webrtc.AbstractPresentable
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
 * @returns {webrtc.Presentable}
 */
webrtc.Presentable = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractPresentable(params);
    delete that.client;

    that.className = 'webrtc.Presentable';
    that.domain = null;
    that.username = null;
    that.emailFormat = null;
    that.resourceFormat = null;
    that.idstring = null;
    var resources = [];
    var presence = 'unavailable';

    that.listen('signal', function signalHandler(message) {
        try {
            webrtc.getClient(client).getSignalingChannel().routeSignal(message);
        } catch (e) {
            log.error("Couldn't route message: " + e.message);
        }
    });

    /**
     * Set identity information such as username, domain, email format from JID. This method exists
     * in this form so that we can create instances of this class without a JID for creating
     * subclasses. Called from the constructor or from setJID().
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.init
     * @private
     */
    var init = function () {
        var resourcePieces = [];
        var jidPieces = [];
        if (!that.jid) {
            throw new Error("Can't use an Presentable without a JID.");
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
            throw new Error("Can't create an Presentable. " + that.jid + " is wrong format!");
        }

        that.idstring = that.emailFormat.replace('@', '.');
    };

    /**
     * Use getEmailFormat as getID.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getEmailFormat
     * @return {string} email
     */
    var getID = that.publicize('getID', function () {
        return that.emailFormat;
    });

    /**
     * Get the JID without the resource.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getEmailFormat
     * @return {string} email
     */
    var getEmailFormat = that.publicize('getEmailFormat', function () {
        return that.emailFormat;
    });

    /**
     * Get the JID with the resource.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getResourceFormat
     * @return {string} resourcejid
     */
    var getResourceFormat = that.publicize('getResourceFormat', function () {
        return that.jid;
    });

    /**
     * Get the a unique id formatted from the JID with resource that has the @ and / replaced with
     * periods to serve as a dom ID.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getIDString
     * @return {string} idstring
     */
    var getIDString = that.publicize('getIDString', function () {
        return that.idstring;
    });

    /**
     * Get the display name of the endpoint.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getDisplayName
     * @return {string} displayName
     */
    var getDisplayName = that.publicize('getDisplayName', function () {
        return that.name || that.username || that.jid || that.emailFormat;
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
     * Determine whether a JID matches the JID of this endpoint.
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.matchesJID
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
     * @memberof! webrtc.Presentable
     * @method webrtc.Presentable.getStatus
     * @deprecated Use or override getPresence instead.
     * @return {string}
     */
    var getStatus = that.publicize('getStatus', function () {
        return presence;
    });

    if (that.jid) {
        init();
    }

    return that;
}; // End webrtc.Presentable

/**
 * Create a new Endpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments webrtc.Presentable
 * @classdesc XMPP Endpoint class
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
            'sender': webrtc.getClient(client).user.getResourceFormat(),
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

        log.trace('startCall');
        if (initiator === undefined) {
            initiator = true;
        }

        call = webrtc.Call({
            'client': client,
            'username': user.getUsername(),
            'remoteEndpoint': id,
            'initiator': initiator,
            'signalOffer': function (sdp) {
                sdp.type = 'offer';
                signalingChannel.sendSDP(id, sdp);
            },
            'signalAnswer': function (sdp) {
                sdp.type = 'answer';
                signalingChannel.sendSDP(id, sdp);
            },
            'signalCandidate': function (oCan) {
                if (oCan !== null) {
                    signalingChannel.sendCandidate(id, oCan);
                }
            },
            'signalTerminate': function () {
                signalingChannel.sendBye(id);
            },
            'signalReport': function (oReport) {
                log.debug("Not sending report");
                log.debug(oReport);
            }
        });

        call.start();
        user.addCall(call);
        call.listen('hangup', function hangupHandler(locallySignaled) {
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
 * @classdesc XMPP Contact class
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
        resources.forOwn(function checkEachPresence(resource) {
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
 * @classdesc XMPP User class
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

    var subscription = 'both';
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
    that.listen("presence", function presenceHandler(presenceString) {
        presence = presenceString;
        if (signalingChannel && signalingChannel.isOpen()) {
            log.info('sending my presence update ' + presenceString);
            signalingChannel.sendPresence(presenceString);
        } else {
            log.error("Can't send my presence: no signaling channel.");
        }
    });

    // listen to webrtc.Contacts#presence -- the contacts's presences
    contactList.listen('new', function newContactHandler(contact) {
        that.fire('contact', contact);
    });

    // listen to webrtc.Contacts#presence -- the contacts's presences
    contactList.listen('presence', function contactPresenceHandler(presenceMessage) {
        var presPayload = null;
        var from = null;
        var jid = null;
        var resource = null;
        var contact = null;

        try {
            presPayload = presenceMessage.getPayload();
            if (presPayload.presence === 'error') {
                return;
            }

            from = presenceMessage.sender.split('/');
            jid = from[0];
            resource = from[1];
            contact = this.get(jid);

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
        } catch (e) {
            log.error("Couldn't update presence for contact " + that.jid + ": " + e.message);
            log.error(e.stack);
            log.error(presenceMessage);
        }
    });

    /**
     * Send iq stanza requesting roster.
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
        deferred.promise.done(function successHandler(contactList) {
            setTimeout(contactList.processPresenceQueue, 1000);
        }, function errorHandler(e) {
            throw e;
        });

        /* This seems like not a good place to define this handler, but it must have access
         * to the promise that getContacts must return, so it is necessary.
         */
        signalingChannel.addHandler('iq', function iqHandler(stanza) {
            log.debug(stanza);
            itemElements = $j(stanza).find("item");

            if (itemElements.length === 0) {
                deferred.reject(new Error("No items in the roster."));
                return true;
            }

            itemElements.forEach(function processEachContact() {
                var sub = $j(this).attr('subscription');
                var jid = $j(this).attr('jid');
                var name = $j(this).attr('name');
                var contact = null;

                if (!(!sub || sub === 'to' || sub === 'both')) {
                    return;
                }

                try {
                    contact = webrtc.Contact({
                        'client': client,
                        'jid': jid,
                        'name': name,
                        'subscription': sub
                    });
                } catch (e) {
                    log.error("Couldn't create contact: " + e.message);
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
        calls.forEach(function checkEachCall(call) {
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
     * @param {string} JID without resource of the contact to search for.
     * @returns {webrtc.Call}
     */
    var getCallByContact = that.publicize('getCallByContact',
            function (contactJID) {
                var session = null;
                var contact = null;
                calls.forEach(function checkEachCall(call) {
                    if (call.remoteEndpoint === contactJID) {
                        session = call;
                    }
                });

                if (session === null) {
                    try {
                        contact = contactList.get(contactJID);
                        session = contact.startCall(webrtc.getClient(client).getCallSettings(),
                            false);
                        addCall(session);
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
     * @param {string} Optional JID without resource of the contact to search for.
     */
    var removeCall = that.publicize('removeCall', function (contactJID) {
        var toDelete = null;

        if (!contactJID) {
            calls = [];
        }

        calls.forEach(function checkEachCall(call, index) {
            if (call.remoteEndpoint === contactJID) {
                toDelete = index;
            }
        });

        if (toDelete === null) {
            log.warn("Couldn't find call in removeCall");
            return;
        }

        calls.splice(toDelete);
    });


    /**
     * Set presence to available. First use of this function triggers reception of presence per XMPP
     * spec, so we will add a handler to listen for it before sending our presence.
     * @memberof! webrtc.User
     * @method webrtc.User.setOnline
     */
    var setOnline = that.publicize('setOnline', function () {
        /* Now we know this user cares about their own presence, we can assume he
         * will also care about his contacts' presences.
         */
        signalingChannel.addHandler('presence', function presenceHandler(stanza) {
            log.debug(stanza);
            var message = webrtc.PresenceMessage({
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
        signalingChannel.addHandler('message', function messageHandler(stanza) {
            var from = stanza.getAttribute('from');
            var type = stanza.getAttribute('type');
            var fromPieces = [];
            var contact = null;
            var params = null;

            log.debug(stanza);

            if (['chat', 'signaling', 'groupchat'].indexOf(type) === -1) {
                log.warn('wrong type ' + type);
                return true;
            }

            fromPieces = from.split('/');
            contact = contactList.get(fromPieces[0]);

            if (!contact) {
                log.info("no contact");
                return true;
            }

            params = {
                'client': client,
                'rawMessage': stanza,
                'recipient': that,
                'sender': contact.getResourceFormat()
            };

            if (type === 'signaling') {
                contact.fire('signal', webrtc.SignalingMessage(params));
            } else {
                contact.fire('message', webrtc.TextMessage(params));
            }
            return true;
        });

        that.setPresence('available');
    });

    return that;
}; // End webrtc.User

/**
 * Create a new TextMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.TextMessage
 * @constructor
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.TextMessage}
 */
webrtc.TextMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = params;
    delete that.client;

    that.className = 'webrtc.TextMessage';
    var rawMessage = params.rawMessage; // Only set on incoming message.
    var payload = params.payload; // Only set on outgoing message.
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        if (thisMsg) {
            rawMessage = thisMsg;
        }
        try {
            payload = Strophe.getText(rawMessage.getElementsByTagName('body')[0]);
        } catch (e) {
            log.error("Not an XMPP text message!");
        }
    });

    /**
     * Construct an XMPP Stanza
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.getXMPP
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
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.getPayload
     * @returns {string}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the whole chat message.
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.getText
     * @returns {string}
     */
    var getText = that.publicize('getText', getPayload);

    /**
     * Get the recipient.
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.TextMessage

/**
 * Create a new SignalingMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.SignalingMessage
 * @constructor
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingMessage}
 */
webrtc.SignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = params;
    delete that.client;
    that.className = 'webrtc.SignalingMessage';

    var rawMessage = params.rawMessage;
    var payload = null;
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse and format messages for consumption by the router
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.parse
     */
    var parse = that.publicize('parse', function () {
        payload = webrtc.getClient(client).getSignalingChannel().parseText(rawMessage);
    });

    /**
     * Attempt to construct a string from the payload.
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.getText
     * @returns {string} A string that may represent the value of the payload.
     * @abstract
     */
    var getText = that.publicize('getText', function () {
        return payload.type;
    });

    /**
     * Get the whole payload
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.getPayload
     * @returns {object}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the recipient.
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.SignalingMessage

/**
 * Create a new PresenceMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.PresenceMessage
 * @constructor
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.PresenceMessage}
 */
webrtc.PresenceMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = params;
    delete that.client;
    that.className = 'webrtc.PresenceMessage';

    var rawMessage = params.rawMessage;
    var payload = {};
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.parse
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
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.getXMPP
     * @return {DOM}
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
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.getText
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
     * @memberof! webrtc.PreseceMessage
     * @method webrtc.PresenceMessage.getPayload
     * @returns {object}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the recipient.
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.PresenceMessage
