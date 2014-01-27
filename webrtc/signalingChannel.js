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
        'signal': [],
        'presence': []
    };

    var errors = {
        // TODO convert this to strings
        400: "Can't perform this action: missing or invalid parameters.",
        401: "Can't perform this action: not authenticated.",
        403: "Can't perform this action: not authorized.",
        404: "Item not found.",
        409: "Can't perform this action: item in the wrong state.",
        500: "Can't perform this action: server problem."
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
            baseURL = clientSettings.baseURL || 'https://demo.digiumlabs.com:1337';
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
    var logout = that.publicize('logout', function (params) {
        var deferred = webrtc.makePromise(params.onSuccess, params.onError);
        call({
            path: '/v1/authsessions',
            httpMethod: 'DELETE',
            responseHandler: function (response) {
                if (!response.error) {
                    socket.disconnect();
                    deferred.resolve("Logged out.");
                } else {
                    deferred.reject(new Error("Couldn't log out."));
                }
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
    var sendPresence = that.publicize('sendPresence', function (params) {
        var presencePromise = webrtc.makePromise(params.onSuccess, params.onError);
        log.trace("Signaling sendPresence");
        wsCall({
            path: '/v1/presence',
            httpMethod: 'POST',
            parameters: {
                'presence': {
                    show: "no show",
                    'status': "Hey, I'm having fun!",
                    type: params.presence || "available"
                }
            },
            responseHandler: function (res, params, err) {
                if (err) {
                    presencePromise.reject(err);
                } else {
                    presencePromise.resolve();
                }
            }
        });
        return presencePromise.promise;
    });

    /**
     * Call the API to get a list of the user's contacts. Call the API to register interest
     * in presence notifications for all users on the contact list.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getContacts
     */
    var getContacts = that.publicize('getContacts', function (params) {
        wsCall({
            path: '/v1/contacts/',
            responseHandler: function (contactList, dataParams, err) {
                var userIdList = [];

                if (err && err.message) {
                    throw err;
                }

                contactList.forEach(function saveEachId(contact) {
                    userIdList.push({'userId': contact.id});
                });

                if (params.onContacts) {
                    params.onContacts(contactList);
                }

                wsCall({
                    path: '/v1/presenceobservers',
                    httpMethod: 'POST',
                    parameters: {
                        users: userIdList
                    },
                    responseHandler: function (presenceList, dataParams, err) {
                        if (err && err.message) {
                            throw err;
                        }

                        if (params.onPresence) {
                            params.onPresence(presenceList);
                        }
                    }
                });
            }
        });
    });

    /**
     * Send a chat message.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendMessage
     * @param {string} message The string text message to send.
     */
    var sendMessage = that.publicize('sendMessage', function (params) {
        var msgText = params.message.getPayload();
        var recipient = null;
        var messagePromise = webrtc.makePromise(params.onSuccess, params.onError);

        try {
            recipient = params.message.getRecipient().getID();
        } catch (e) {
            log.debug("Can't get message recipient.");
            return;
        }

        if ([null, undefined, ""].indexOf(recipient) > -1) {
            log.debug("Can't send message without recipient.");
            return;
        }

        if ([null, undefined, ""].indexOf(msgText) > -1) {
            log.debug("Can't send message without message text.");
            return;
        }

        wsCall({
            path: '/v1/chat',
            httpMethod: 'POST',
            parameters: {
                'to': recipient,
                'text': msgText
            },
            responseHandler: function (res, dataParams, err) {
                if (err) {
                    messagePromise.reject(err);
                } else {
                    messagePromise.resolve();
                }
            }
        });
        return messagePromise.promise;
    });

    /**
     * Send a signaling message.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendSignal
     * @param {string} message The string The signal to send.
     */
    var sendSignal = that.publicize('sendSignal', function (params) {
        var signalText = params.signal.getPayload();
        var recipient = null;
        var signalPromise = webrtc.makePromise(params.onSuccess, params.onError);

        try {
            recipient = params.signal.getRecipient().getID();
        } catch (e) {
            log.error("Can't get signal recipient.");
            return;
        }

        if ([null, undefined, ""].indexOf(recipient) > -1) {
            log.error("Can't send signal without recipient.");
            return;
        }

        if ([null, undefined, ""].indexOf(signalText) > -1) {
            log.error("Can't send signal without signal text.");
            return;
        }

        wsCall({
            path: '/v1/signaling',
            httpMethod: 'POST',
            parameters: {
                'to': recipient,
                'signal': signalText
            },
            responseHandler: function (res, dataParams, err) {
                if (err) {
                    signalPromise.reject(err);
                } else {
                    signalPromise.resolve();
                }
            }
        });
        return signalPromise.promise;
    });

    /**
     * Send an ICE candidate.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendCandidate
     * @param {webrtc.Contact} recipient The recipient.
     * @param {RTCIceCandidate} candObj An ICE candidate to JSONify and send.
     */
    var sendCandidate = that.publicize('sendCandidate', function (params) {
        return that.sendSignal({
            signal: webrtc.SignalingMessage({
                recipient: params.recipient,
                sender: webrtc.getClient(client).user.getID(),
                payload: JSON.stringify(params.candObj)
            }),
            onSuccess: function () {},
            onError: function (e) {
                throw e;
            }
        });
    });

    /**
     * Send an SDP.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendSDP
     * @param {webrtc.Contact} recipient The recipient.
     * @param {RTCSessionDescription} sdpObj An SDP to JSONify and send.
     */
    var sendSDP = that.publicize('sendSDP', function (params) {
        return that.sendSignal({
            signal: webrtc.SignalingMessage({
                'recipient': params.recipient,
                'sender': webrtc.getClient(client).user.getID(),
                'payload': JSON.stringify(params.sdpObj)
            }),
            onSuccess: function () {},
            onError: function (e) {
                throw e;
            }
        });
    });

    /**
     * Send a message terminating the WebRTC session.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendBye
     * @param {webrtc.Contact} recipient The recipient.
     * @param {string} reason The reason the session is being terminated.
     */
    var sendBye = that.publicize('sendBye', function (params) {
        return that.sendSignal({
            signal: webrtc.SignalingMessage({
                'recipient': params.recipient,
                'sender': webrtc.getClient(client).user.getID(),
                'payload': JSON.stringify({'type': 'bye', 'reason': params.reason})
            }),
            onSuccess: function () {},
            onError: function (e) {
                throw e;
            }
        });
    });

    /**
     * Route different types of signaling messages via events.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.routeSignal
     * @param {webrtc.SignalingMessage} message A message to route
     */
    var routeSignal = that.publicize('routeSignal', function (message) {
        var signal = message.getPayload();
        var clientObj = webrtc.getClient(client);
        var call = null;
        var toCreate = false;

        log.debug(signal.type, signal);

        // Only create a new call if this signal is an offer.
        if (signal.type === 'offer') {
            toCreate = true;
        }
        call = clientObj.user.getCallByContact({
            contactId: message.getSender(),
            create: toCreate
        });

        if (!toCreate && !call) {
            return;
        }

        switch (signal.type) {
        case 'offer':
            call.setOffer(signal);
            call.fire('offer', signal);
            break;
        case 'accept':
            call.fire('accept', signal);
            break;
        case 'answer':
            call.setAnswer(signal);
            call.fire('answer', signal);
            break;
        case 'candidate':
            call.addRemoteCandidate(signal);
            call.fire('candidate', signal);
            break;
        case 'bye':
            call.setBye(signal);
            call.fire('bye', signal);
            break;
        case 'error':
            log.warn("Received an error", signal);
            break;
        default:
            log.error("Don't know what to do with msg of unknown type", signal.type);
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
    var addHandler = that.publicize('addHandler', function (params) {
        if (socket.socket && socket.socket.open) {
            socket.on(params.type, params.handler);
        } else {
            handlerQueue[params.type].push(params.handler);
        }
    });

    /**
     * Authenticate to the cloud and call the handler on state change.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.authenticate
     * @param {string} username The user's username.
     * @param {string} password The user's password.
     * @param {function} onStatusChange A function to which to call on every state change.
     */
    var authenticate = that.publicize('authenticate', function (params) {
        var authPromise = webrtc.makePromise(params.onSuccess, params.onError);

        call({
            httpMethod: "POST",
            path: '/v1/authsessions',
            parameters: {
                'username': params.username,
                'password': params.password,
                'appId': appId
            },
            responseHandler: function (response) {
                var pieces = [];
                var protocol = null;
                var host = null;
                var port = null;

                if (response.code !== 200) {
                    authPromise.reject(new Error(response.message));
                    return;
                }

                pieces = baseURL.split(/:\/\//);
                protocol = pieces[0];
                pieces = pieces[1].split(/:/);
                host = pieces[0];
                port = pieces[1];

                socket = io.connect(baseURL, {
                    'host': host,
                    'port': port,
                    'protocol': protocol,
                    'secure': (protocol === 'https')
                });

                socket.on('connect', function handleConnect() {
                    Object.keys(handlerQueue).forEach(function addEachHandlerType(category) {
                        if (!handlerQueue[category]) {
                            return;
                        }

                        handlerQueue[category].forEach(function addEachHandler(handler) {
                            socket.on(category, handler);
                        });
                        handlerQueue[category] = [];
                    });
                });

                that.addHandler({
                    type: 'signal',
                    handler: function signalHandler(message) {
                        var message = webrtc.SignalingMessage({
                            'rawMessage': message
                        });
                        that.routeSignal(message);
                    }
                });

                wsCall({
                    path: '/v1/usersessions',
                    httpMethod: 'POST',
                    parameters: {
                        'presence': {
                            'show': "no show",
                            'status': "Hey, I'm having fun!",
                            'type': "available"
                        }
                    },
                    responseHandler: function (res, dataParams, err) {
                        if (err) {
                            authPromise.reject(err);
                            return;
                        }

                        wsCall({
                            path: '/v1/users/',
                            httpMethod: 'GET',
                            parameters: {
                                username: params.username
                            },
                            responseHandler: function (res, dataParams, err) {
                                if (err) {
                                    authPromise.reject(err);
                                    return;
                                }
                                res[0].client = client;
                                res[0].loggedIn = true;
                                res[0].timeLoggedIn = new Date();
                                authPromise.resolve(webrtc.User(res[0]));
                            }
                        });
                    }
                });
            }
        });
        return authPromise.promise;
    });

    /**
     * Get ephemeral TURN credentials.  This method is called every 20 hours in setInterval
     * in the Client so that credentials are ready to use quickly when a call begins. We
     * don't want to have to wait on a REST request to finish between the user clicking the
     * call button and the call beginning.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getTurnCredentials
     */
    var getTurnCredentials = that.publicize('getTurnCredentials', function () {
        var deferred = Q.defer();
        wsCall({
            httpMethod: 'GET',
            path: '/v1/turn',
            responseHandler: function (creds, dataParams, err) {
                var result = [];

                if (!creds || !creds.uris) {
                    deferred.reject(err);
                    return;
                }

                creds.uris.forEach(function saveTurnUri(uri) {
                    var cred = null;

                    if (!uri) {
                        return;
                    }

                    cred = createIceServer(uri, creds.username, creds.password);
                    result.push(cred);
                });

                if (result.length === 0) {
                    deferred.reject(new Error("Got no TURN credentials."));
                }

                deferred.resolve(result);
            }
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
    var wsCall = function (params) {
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

        if (params.responseHandler === undefined) { // allow null to indicate no handler
            params.responseHandler = function (response, data, error) {
                log.debug('default responseHandler', response, data, error);
            };
        }

        log.debug('kicking off socket.' + params.httpMethod + "()",
            params.path, params.parameters);

        socket[params.httpMethod](params.path, params.parameters,
            function handleResponse(response) {
                var e = null;
                var errString = null;

                if (response !== null) {
                    errString = response.message || response.error;
                    if (errString) {
                        e = new Error(errString);
                    }
                }

                if (params.responseHandler) {
                    params.responseHandler(response, {
                        'uri' : params.path,
                        'params' : params.parameters
                    }, e);
                } else if (e) {
                    throw new Error(e);
                }
            }
        );
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
    var call = function (params) {
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

        if (!params.responseHandler) {
            params.responseHandler = function (response, data) {
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
                log.error("Status is 0: Incomplete request, SSL error, or CORS error.");
                return;
            }
            if ([200, 204, 205, 302, 403, 404, 418].indexOf(this.status) > -1) {
                response.code = this.status;
                if (this.response) {
                    try {
                        response.result = JSON.parse(this.response);
                    } catch (e) {
                        response.result = this.response;
                        response.error = "Invalid JSON.";
                    }
                }
                log.debug(response);
                params.responseHandler(response, {
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

        Object.keys(params).forEach(function formatParam(name) {
            var value = params[name];
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
    var that = params;

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
    var parse = that.publicize('parse', function (params) {
        if (params && params.message) {
            rawMessage = params.message;
        }
        payload = rawMessage;
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
    var that = params;
    that.className = 'webrtc.SignalingMessage';

    var rawMessage = params.rawMessage; // Only set on incoming message.
    var payload = params.payload; // Only set on outgoing message.
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.parse
     * @param {object|string} thisMsg Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (params) {
        var sessionId = null;

        if (params && params.signal) {
            rawMessage = params.signal;
        }

        try {
            sender = rawMessage.header.from;
            sessionId = rawMessage.header.fromSession;
        } catch (e) {
            // Wasn't a socket message.
            sender = rawMessage.userId;
            sessionId = rawMessage.sessionId;
        }

        delete rawMessage.header;
        payload = JSON.parse(rawMessage.signal);
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

    /**
     * Get the sender.
     * @memberof! webrtc.SignalingMessage
     * @method webrtc.SignalingMessage.getSender
     * @returns {string}
     */
    var getSender = that.publicize('getSender', function () {
        return sender;
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
    var that = params;
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
    var parse = that.publicize('parse', function (params) {
        if (params && params.message) {
            rawMessage = params.message;
        }

        try {
            sender = rawMessage.header.from;
            sessionId = rawMessage.header.fromSession;
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
