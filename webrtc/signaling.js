/**
 * Create a new SignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractSignalingChannel
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc Wrap signaling protocols in a generic class. This class is meant to be extended. It
 * cannot be used as-is. It is expected that an implementing class will also implement additional
 * formatting methods and perhaps methods for sending particular types of messages.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingChannel}
 */
/*global webrtc: false */
webrtc.AbstractSignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventThrower(params);
    delete that.client;
    that.className = 'webrtc.AbstractSignalingChannel';

    var state = 'new';

    /**
     * Open and initiate a signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.open
     * @abstract
     */
    var open = that.publicize('open', function () {
        state = 'open';
    });

    /**
     * Close a signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.close
     * @abstract
     */
    var close = that.publicize('close', function () {
        state = 'closed';
    });

    /**
     * Get the state of the signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.getState
     * @abstract
     */
    var getState = that.publicize('getState', function () {
        return state;
    });

    /**
     * Get the state of the signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.isOpen
     * @abstract
     */
    var isOpen = that.publicize('isOpen', function () {
        return state === 'open';
    });

    /**
     * Send a message on the signaling protocol.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.send
     * @param {string|object} message The string or object to stringify and send.
     * @abstract
     */
    var send = that.publicize('send', function (message) {
    });

    return that;
}; // End webrtc.AbstractSignalingChannel

/**
 * Create a new Message.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractMessage
 * @constructor
 * @augments webrtc.Class
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Message}
 */
webrtc.AbstractMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Class(params);
    delete that.client;
    that.className = 'webrtc.AbstractMessage';

    var rawMessage = null;
    var payload = null;
    var recipient = null;
    var sender = null;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.AbstractMessage
     * @method webrtc.AbstractMessage.parse
     * @param {object|string} rawMessage Optional message to parse and replace rawMessage with.
     * @abstract
     */
    var parse = that.publicize('parse', function (thisMsg) {
    });

    /**
     * Get the text portion of the chat message.
     * @memberof! webrtc.AbstractMessage
     * @method webrtc.AbstractMessage.getPayload
     * @returns {object|string} Message payload.
     * @abstract
     */
    var getPayload = that.publicize('getPayload', function () {
    });

    /**
     * Attempt to construct a string from the payload.
     * @memberof! webrtc.AbstractMessage
     * @method webrtc.AbstractMessage.getText
     * @returns {string} A string that may represent the value of the payload.
     * @abstract
     */
    var getText = that.publicize('getText', function () {
    });

    return that;
}; // End webrtc.AbstractMessage

/**
 * Create a new SignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.SignalingChannel
 * @augments webrtc.AbstractSignalingChannel
 * @constructor
 * @classdesc REST API Signaling class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingChannel}
 */
webrtc.SignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractSignalingChannel(params);
    delete that.client;
    that.className = 'webrtc.SignalingChannel';

    var state = 'new';
    var baseURL = null;
    var appId = null;
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    /**
     * Open a connection to the REST API. This is where we would do apikey validation/app
     * authentication if we want to do that.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.open
     */
    var open = that.publicize('open', function () {
        log.trace("Signaling connection open.");
        state = 'open';
    });

    /**
     * Close a connection to the REST API. This is where we would do apikey invalidation
     * if we want to do that.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.close
     */
    var close = that.publicize('close', function () {
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
     * Generate and send a presence message representing the user's current status. This triggers
     * the server to send the user's contact's presence.
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
    });

    /**
     * Get a list of the user's contacts
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getContactList
     */
    var getContactList = that.publicize('getContactList', function (callback) {
        call({
            'httpMethod': "GET",
            'path': '/v1/contacts/'
        }, callback);
    });

    /**
     * Send a chat message.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendMessage
     * @param {string} message The string text message to send.
     * @fires webrtc.Endpoint#message:sent
     */
    var sendMessage = that.publicize('sendMessage', function (message) {
        message.getRecipient().fire('message:sent', message);
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
    });

    /**
     * Send an ICE candidate to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendCandidate
     * @param {string} recipient The JID of the recipient.
     * @param {RTCIceCandidate} candObj An ICE candidate to JSONify and send as an XMPP message.
     */
    var sendCandidate = that.publicize('sendCandidate', function (recipient, candObj) {
    });

    /**
     * Send an SDP to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendSDP
     * @param {string} recipient The JID of the recipient.
     * @param {RTCSessionDescription} sdpObj An SDP to JSONify and send as an XMPP message.
     */
    var sendSDP = that.publicize('sendSDP', function (recipient, sdpObj) {
    });

    /**
     * Send an message terminating the WebRTC session to the XMPP server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendBye
     * @param {string} recipient The JID of the recipient.
     * @param {string} reason The reason the session is being terminated.
     */
    var sendBye = that.publicize('sendBye', function (recipient, reason) {
    });

    /**
     * Parse an XMPP message and find the JSON signaling blob in it.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.parseText
     * @param {object} msgXML An XMPP signaling stanza.
     * @return {object} signalingObj A JavaScript object containing the signaling information.
     */
    var parseText = that.publicize('parseText', function (msgXML) {
        return msgXML;
    });

    /**
     * Route different types of signaling messages via events.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.routeSignal
     * @param {webrtc.SignalingMessage} message A message to route
     */
    var routeSignal = that.publicize('routeSignal', function (message) {
        var mediaSession = webrtc.getClient(client).user.getMediaSessionByContact(message.sender);
        var signal = message.getPayload();

        switch (signal.type) {
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'bye':
            that.fire('received:' + signal.type, signal.value);
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
    });

    /**
     * Authenticate to via Strophe and call the handler on state change.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.authenticate
     * @param {string} username The user's username.
     * @param {string} password The user's password.
     * @param {function} onStatusChange A function to which to call on every state change.
     */
    var authenticate = that.publicize('authenticate',
        function (username, password, callback) {
            call({
                'httpMethod': "POST",
                'path': '/v1/authsession',
                'parameters': {
                    'username': username,
                    'password': password
                }
            }, callback);
        }
    );

    /**
     * Construct an API call and return the formatted response and errors. The 'success'
     * attribute indicates the success or failure of the API call. The 'response' attribute
     * is an associative array constructed by json.decode. The 'error' attriute is a message.
     * If the API call is successful but the server returns invalid JSON, error will be
     * "Invalid JSON." and response will be the unchanged content of the response body.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.call
     * @private
     * @param {object} params Object containing httpMethod, objectId, path, and parameters.
     */
    var call = function (params, responseHandler) {
        /* Params go in the URI for GET, DELETE, same format for
         * POST and PUT, but they must be sent separately after the
         * request is opened. */
        var paramString = null;
        var uri = null;
        var response = null;
        var clientSettings =  null;
        var responseCodes = [200, 400, 401, 403, 404, 409];
        var response = {
            'result': null,
            'code': null
        };

        // TODO: Disable this being able to change the base URL
        if (baseURL === null || appId === null) {
            clientSettings = webrtc.getClient(client).getClientSettings();
            baseURL = clientSettings.baseUrl || 'http://localhost:1337';
            appId = clientSettings.appId || '1';
        }
        uri = baseURL + params.path;

        if (!params) {
            throw new Error('No params.');
        } else if (params.parameters) {
            params.parameters.appId = appId;
        }

        if (!params.httpMethod) {
            throw new Error('No HTTP method.');
        }

        if (params.objectId) {
            params.path = params.path.replace(/\%s/ig, params.objectId);
        }

        if (!responseHandler) {
            responseHandler = function (response, data) {
                console.log('default responseHandler');
                console.log(response);
            };
        }

        if (['GET', 'DELETE'].indexOf(params.httpMethod) > -1) {
            uri += makeParamString(params.parameters);
        }

        log.debug('calling ' + params.httpMethod + " " + uri);
        xhr.open(params.httpMethod, uri);
        if (['POST', 'PUT'].indexOf(params.httpMethod) > -1) {
            paramString = JSON.stringify(params.parameters);
            try {
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            } catch (e) {
                console.log("Can't set content-type header in readyState " +
                    xhr.readyState + ". " + e.message);
            }
        } else if (['GET', 'DELETE'].indexOf(params.httpMethod) === -1) {
            throw new Error('Illegal HTTP request method ' + params.httpMethod);
        }

        try {
            log.debug(paramString);
            xhr.send(paramString);
        } catch (e) {
            console.log("Can't call xhr.send. " + e.message);
        }
        xhr.onreadystatechange = function () {
            if (this.readyState !== 4) {
                return;
            }
            if (this.status === 0) {
                return;
            }
            if ([200, 204, 205, 302, 403, 404, 418].indexOf(this.status) > -1) {
                response.code = this.status;
                try {
                    response.result = JSON.parse(this.response);
                } catch (e) {
                    response.result = this.response;
                    response.error = "Invalid JSON.";
                }
                responseHandler(response, {
                    'uri' : uri,
                    'params' : params.parameters
                });
            } else {
                console.log('unexpected response ' + this.status);
            }
        };
    };

    /**
     * Turn key/value and key/list pairs into an HTTP URL parameter string.
     * var1=value1&var2=value2,value3,value4
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.makeParamString
     * @private
     * @param {object} params Collection of strings and arrays to serialize.
     * @returns {string}
     */
    var makeParamString = function (params) {
        var strings = [];
        if (!params) {
            return '';
        }

        params.forOwn(function (value, name) {
            /* Skip objects -- We won't know how to name these. */
            if (typeof value === 'array') {
                strings.push([name, value.join(',')].join('='));
            } else if (typeof value !== 'object' && typeof value !== 'function') {
                strings.push([name, value].join('='));
            }
        });

        if (strings.length > 0) {
            return '?' + strings.join('&');
        } else {
            return '';
        }
    };

    return that;
}; // End webrtc.SignalingChannel
