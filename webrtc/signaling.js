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
     * @returns {string}
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
    var socket = null;
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    /**
     * Open a connection to the REST API. This is where we would do apikey validation/app
     * authentication if we want to do that.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.open
     */
    var open = that.publicize('open', function () {
        // TODO: Disable this being able to change the base URL
        if (baseURL === null || appId === null) {
            var clientSettings = webrtc.getClient(client).getClientSettings();
            baseURL = clientSettings.baseUrl || 'http://localhost:1337';
            appId = clientSettings.appId || '1';
        }
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
     * Return the state of the signaling channel
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
        log.trace("Signaling sendPresence");
        wsCall({
            'path': '/v1/presence',
            'httpMethod': 'POST',
            'parameters': {
                'presence': presenceString || "available"
            }
        });
    });

    /**
     * Call the API to get a list of the user's contacts. Call the API to register interest
     * in presence notifications for all users on the contact list.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getContactList
     */
    var getContactList = that.publicize('getContactList', function (callback) {
        wsCall({
            'path': '/v1/contacts/'
        }, function (contactList) {
            var userIdList = [];
            if (callback) {
                callback(contactList);
            }
            contactList.forEach(function (contact) {
                userIdList.push({'userId': contact.id});
            });
            console.log('userIdList');
            console.log(userIdList);
            wsCall({
                'path': '/v1/presence/observer',
                'httpMethod' : 'POST',
                'parameters': {
                    'users': userIdList
                }
            }, function (presenceList) {
                console.log('got presence');
                presenceList.forOwn(function (presence) {
                    console.log(presence);
                });
            });
        });
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
     * Send message to server.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.send
     * @param {string} recipient The recipient of the message.
     * @param {object} msgObj A JavaScript object to JSONify before sending.
     * @deprecated
     */
    var send = that.publicize('send', function (recipient, msgObj) {
    });

    /**
     * Send an ICE candidate.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendCandidate
     * @param {string} recipient The JID of the recipient.
     * @param {RTCIceCandidate} candObj An ICE candidate to JSONify and send.
     */
    var sendCandidate = that.publicize('sendCandidate', function (recipient, candObj) {
    });

    /**
     * Send an SDP.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendSDP
     * @param {string} recipient The JID of the recipient.
     * @param {RTCSessionDescription} sdpObj An SDP to JSONify and send.
     */
    var sendSDP = that.publicize('sendSDP', function (recipient, sdpObj) {
    });

    /**
     * Send a message terminating the WebRTC session.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendBye
     * @param {string} recipient The JID of the recipient.
     * @param {string} reason The reason the session is being terminated.
     */
    var sendBye = that.publicize('sendBye', function (recipient, reason) {
    });

    /**
     * Parse a message and find the JSON signaling blob in it.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.parseText
     * @param {object} msgString A signaling message.
     * @return {object} signalingObj A JavaScript object containing the signaling information.
     */
    var parseText = that.publicize('parseText', function (msgString) {
        return msgString;
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
     * Add a handler to the connection for messages of different types.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.addHandler
     * @param {string} type The type of message, e. g., 'iq', 'pres'
     * @param {function} handler A function to which to pass the message
     * @deprecated Not sure how we will route messages yet.
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
                    'password': password,
                    'appId': appId
                }
            }, function (response) {
                socket = io.connect('http://localhost:1337', {
                    'host': 'localhost',
                    'port': 1337,
                    'protocol': 'http',
                    'secure': false
                });
                socket.on('presence', function (msg) {
                    log.debug('presence');
                    log.debug(msg);
                });
                socket.on('signaling', function (msg) {
                    log.debug('signaling');
                    log.debug(msg);
                });
                socket.on('message', function (msg) {
                    log.debug('message');
                    log.debug(msg);
                });
                if (response.code === 200) {
                    wsCall({
                        'path': '/v1/usersessions',
                        'httpMethod': 'POST',
                        'parameters': {
                            'presence': 'online'
                        }
                    });
                }
                callback(response);
            });
        }
    );

    /**
     * Construct a websocket API call and return the formatted response and errors. The 'success'
     * attribute indicates the success or failure of the API call. The 'response' attribute
     * is an associative array constructed by json.decode. The 'error' attriute is a message.
     * If the API call is successful but the server returns invalid JSON, error will be
     * "Invalid JSON." and response will be the unchanged content of the response body.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.wsCall
     * @private
     * @param {object} params Object containing httpMethod, objectId, path, and parameters.
     */
    var wsCall = function (params, responseHandler) {
        if (!params) {
            throw new Error('No params.');
        }

        if (!params.path) {
            throw new Error('No request path.');
        }

        params.httpMethod = (params.httpMethod || 'get').toLowerCase();

        if (params.objectId) {
            params.path = params.path.replace(/\%s/ig, params.objectId);
        }

        if (!responseHandler) {
            responseHandler = function (response, data) {
                log.debug('default responseHandler');
                log.debug(response);
            };
        }

        socket[params.httpMethod](params.path, params.parameters, function (response) {
            log.debug("wsCall response to " + params.httpMethod + " " + params.path);
            log.debug(response);
            responseHandler(response, {
                'uri' : params.path,
                'params' : params.parameters
            });
        });
    };

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
        var responseCodes = [200, 400, 401, 403, 404, 409];
        var response = {
            'result': null,
            'code': null
        };

        uri = baseURL + params.path;

        if (!params) {
            throw new Error('No params.');
        }

        if (!params.httpMethod) {
            throw new Error('No HTTP method.');
        }

        if (!params.path) {
            throw new Error('No request path.');
        }

        if (params.objectId) {
            params.path = params.path.replace(/\%s/ig, params.objectId);
        }

        if (!responseHandler) {
            responseHandler = function (response, data) {
                log.debug('default responseHandler');
                log.debug(response);
            };
        }

        if (['GET', 'DELETE'].indexOf(params.httpMethod) > -1) {
            uri += makeParamString(params.parameters);
        }

        xhr.open(params.httpMethod, uri);
        if (['POST', 'PUT'].indexOf(params.httpMethod) > -1) {
            paramString = JSON.stringify(params.parameters);
            try {
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            } catch (e) {
                log.debug("Can't set content-type header in readyState " +
                    xhr.readyState + ". " + e.message);
            }
        } else if (['GET', 'DELETE'].indexOf(params.httpMethod) === -1) {
            throw new Error('Illegal HTTP request method ' + params.httpMethod);
        }
        log.debug('calling ' + params.httpMethod + " " + uri + " with params " + paramString);

        try {
            xhr.send(paramString);
        } catch (e) {
            log.warn("Can't call xhr.send. " + e.message);
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
                log.debug(response);
                responseHandler(response, {
                    'uri' : uri,
                    'params' : params.parameters
                });
            } else {
                log.warn('unexpected response ' + this.status);
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

/**
 * Create a new ChatMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.ChatMessage
 * @constructor
 * @augments webrtc.AbstractMessage
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.ChatMessage}
 */
webrtc.ChatMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractMessage(params);
    delete that.client;

    that.className = 'webrtc.ChatMessage';
    var rawMessage = params.rawMessage; // Only set on incoming message.
    var payload = params.payload; // Only set on outgoing message.
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.ChatMessage
     * @method webrtc.ChatMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        if (thisMsg) {
            rawMessage = thisMsg;
        }
        try {
            payload = JSON.parse(rawMessage);
        } catch (e) {
            log.error("Not a JSON message!");
        }
    });

    /**
     * Get the whole payload.
     * @memberof! webrtc.ChatMessage
     * @method webrtc.ChatMessage.getPayload
     * @returns {string}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the whole chat message.
     * @memberof! webrtc.ChatMessage
     * @method webrtc.ChatMessage.getText
     * @returns {string}
     */
    var getText = that.publicize('getText', function () {
        return payload.message;
    });

    /**
     * Get the recipient.
     * @memberof! webrtc.ChatMessage
     * @method webrtc.ChatMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.ChatMessage

/**
 * Create a new SignalingMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.SignalingMessage
 * @constructor
 * @augments webrtc.AbstractMessage
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingMessage}
 */
webrtc.SignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractMessage(params);
    delete that.client;
    that.className = 'webrtc.SignalingMessage';

    var rawMessage = params.rawMessage;
    var payload = null;
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.ChatMessage
     * @method webrtc.ChatMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        if (thisMsg) {
            rawMessage = thisMsg;
        }
        try {
            payload = JSON.parse(rawMessage);
        } catch (e) {
            log.error("Not a JSON message!");
        }
    });

    /**
     * Attempt to construct a string from the payload.
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.getText
     * @returns {string} A string that may represent the value of the payload.
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
 * @augments webrtc.AbstractMessage
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.PresenceMessage}
 */
webrtc.PresenceMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.AbstractMessage(params);
    delete that.client;
    that.className = 'webrtc.PresenceMessage';

    var rawMessage = params.rawMessage;
    var payload = {};
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.ChatMessage
     * @method webrtc.ChatMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        if (thisMsg) {
            rawMessage = thisMsg;
        }
        try {
            payload = JSON.parse(rawMessage);
        } catch (e) {
            log.error("Not a JSON message!");
        }
    });

    /**
     * Construct an JSON Presence message
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.getJSON
     * @return {string}
     */

    var getJSON = that.publicize('getJSON', function () {
        if (!payload) {
            throw new Error("No message payload.");
        }
        return JSON.stringify(payload);
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
