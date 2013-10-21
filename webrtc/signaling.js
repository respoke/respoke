/**
 * Create a new SignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.SignalingChannel
 * @constructor
 * @classdesc REST API Signaling class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingChannel}
 */
 /*global webrtc: false */
webrtc.SignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventEmitter(params);
    delete that.client;
    that.className = 'webrtc.SignalingChannel';

    var state = 'new';
    var baseURL = null;
    var appId = null;
    var socket = null;
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    var handlerQueue = {
        'chat': [],
        'signaling': [],
        'presence': []
    };

    /**
     * Open a connection to the REST API. This is where we would do apikey validation/app
     * authentication if we want to do that.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.open
     */
    var open = that.publicize('open', function () {
        if (appId === null) {
            var clientSettings = webrtc.getClient(client).getClientSettings();
            baseURL = 'https://demo.digiumlabs.com:1337';
            appId = clientSettings.appId;
        }
        if (!appId) {
            throw new Error("No appId specified.");
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
     * Signal to log the user out.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.logout
     * @returns Promise<String>
     */
    var logout = that.publicize('logout', function () {
        var deferred = Q.defer();
        call({
            'path': '/v1/authsession',
            'httpMethod': 'DELETE'
        }, function (response) {
            if (!response.error) {
                socket.disconnect();
                deferred.resolve("Logged out.");
            } else {
                deferred.reject(new Error("Couldn't log out."));
            }
        });
        return deferred.promise;
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
                'presence': {
                    'show': "no show",
                    'status': "Hey, I'm having fun!",
                    'type': presenceString || "available"
                }
            }
        });
    });

    /**
     * Call the API to get a list of the user's contacts. Call the API to register interest
     * in presence notifications for all users on the contact list.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getContacts
     */
    var getContacts = that.publicize('getContacts', function (onContacts, onPresence) {
        wsCall({
            'path': '/v1/contacts/'
        }, function (contactList) {
            var userIdList = [];
            contactList.forEach(function (contact) {
                userIdList.push({'userId': contact.id});
            });
            if (onContacts) {
                onContacts(contactList);
            }
            wsCall({
                'path': '/v1/presence/observer',
                'httpMethod' : 'POST',
                'parameters': {
                    'users': userIdList
                }
            }, function (presenceList) {
                if (onPresence) {
                    onPresence(presenceList);
                }
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
        wsCall({
            'path': '/v1/chat',
            'httpMethod': 'POST',
            'parameters': {
                'destUserId': message.getRecipient().getID(),
                'text': message.getPayload()
            }
        }, null);
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
        recipient.sendMessage(JSON.stringify(candObj));
    });

    /**
     * Send an SDP.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendSDP
     * @param {string} recipient The JID of the recipient.
     * @param {RTCSessionDescription} sdpObj An SDP to JSONify and send.
     */
    var sendSDP = that.publicize('sendSDP', function (recipient, sdpObj) {
        recipient.sendMessage(JSON.stringify(sdpObj));
    });

    /**
     * Send a message terminating the WebRTC session.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendBye
     * @param {string} recipient The JID of the recipient.
     * @param {string} reason The reason the session is being terminated.
     */
    var sendBye = that.publicize('sendBye', function (recipient, reason) {
        recipient.sendMessage(JSON.stringify({'type': 'bye', 'reason': reason}));
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
        var call = webrtc.getClient(client).user.getCallByContact(message.sender);
        var signal = message.getPayload();

        switch (signal.type) {
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'bye':
            that.fire('received:' + signal.type, signal);
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
        if (socket.socket && socket.socket.open) {
            socket.on(type, handler);
        } else {
            handlerQueue[type].push(handler);
        }
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
                var pieces = baseURL.split(/:\/\//);
                var protocol = pieces[0];
                var pieces = pieces[1].split(/:/);
                var host = pieces[0];
                var port = pieces[1];
                socket = io.connect(baseURL, {
                    'host': host,
                    'port': port,
                    'protocol': protocol,
                    'secure': (protocol === 'https')
                });
                socket.on('connect', function () {
                    handlerQueue.forOwn(function (array, category) {
                        array.forEach(function (handler) {
                            socket.on(category, handler);
                        });
                        array = [];
                    });
                });
                socket.on('signaling', that.routeSignal);
                if (response.code === 200) {
                    wsCall({
                        'path': '/v1/usersessions',
                        'httpMethod': 'POST',
                        'parameters': {
                            'presence': {
                                'show': "no show",
                                'status': "Hey, I'm having fun!",
                                'type': "available"
                            }
                        }
                    });
                }
                callback(response);
            });
        }
    );

    /**
     * Get ephemeral TURN credentials.  This method is called every 20 hours in setInterval
     * in the Client so that credentials are ready to use quickly when a call begins. We
     * don't want to have to wait on a REST request to finish between the user clicking the
     * call button and the call beginning.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getTurnCredentials
     */
    var getTurnCredentials = that.publicize('getTurnCredentials', function (onCredentials) {
        var deferred = Q.defer();
        wsCall({
            'httpMethod': 'GET',
            'path': '/v1/turncredentials'
        }, function (creds) {
            var result = [];

            if (!creds || !creds.uris) {
                deferred.reject(new Error(creds.message || "Can't get TURN credentials."));
            }

            creds.uris.forEach(function (uri) {
                var cred = null;

                if (!uri) {
                    return;
                }

                cred = createIceServer(uri, creds.username, creds.password);
                result.push(cred);
                /*
                 * I'm not entirely sure that we can trust createIceServer. This is the code
                 * to convert back to the old method of TURN format, with no 'username' attribute.
                 * Someday we will be able to delete this.
                uri = uri.replace('turn:', 'turn:' + creds.username + '@');
                uri = uri.replace('?transport=udp', '');
                result.push({
                    'url': uri,
                    'credential': cred.credential
                });*/
            });

            if (result.length === 0) {
                deferred.reject(new Error("Got no TURN credentials."));
            }

            deferred.resolve(result);
        });
        return deferred.promise;
    });

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

        if (responseHandler === undefined) { // allow null to indicate no handler
            responseHandler = function (response, data) {
                log.debug('default responseHandler');
                log.debug(response);
            };
        }

        socket[params.httpMethod](params.path, params.parameters, function (response) {
            log.debug("wsCall response to " + params.httpMethod + " " + params.path);
            log.debug(response);
            if (responseHandler) {
                responseHandler(response, {
                    'uri' : params.path,
                    'params' : params.parameters
                });
            }
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
     * Parse rawMessage and save information in payload. In this base class, assume text.
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        payload = thisMsg || rawMessage;
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
    var getText = that.publicize('getText', function () {
        return payload;
    });

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
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        try {
            payload = JSON.parse(rawMessage || thisMsg);
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
    delete params.rawMessage;
    var payload = {};
    var sender = params.sender;
    var sessionId = null;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.TextMessage
     * @method webrtc.TextMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (thisMsg) {
        var pieces;
        if (thisMsg) {
            rawMessage = thisMsg;
        }

        try {
            pieces = rawMessage.header.from.split(':')[1].split('@');
            sender = pieces[0];
            sessionId = pieces[1];
        } catch (e) {
            // Wasn't a socket message.
            sender = rawMessage.userId;
            sessionId = rawMessage.sessionId;
        }

        delete rawMessage.header;
        payload = rawMessage;
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
        return payload.type;
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
     * Get the sender.
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.getSender
     * @returns {string}
     */
    var getSender = that.publicize('getSender', function () {
        return sender;
    });

    /**
     * Get the session ID of the sender.
     * @memberof! webrtc.PresenceMessage
     * @method webrtc.PresenceMessage.getSessionID
     * @returns {string}
     */
    var getSessionID = that.publicize('getSessionID', function () {
        return sessionId;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End webrtc.PresenceMessage
