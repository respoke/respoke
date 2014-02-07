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
    var socket = null;
    var clientSettings = null; // client is not set up yet
    var baseURL = null;
    var xhr = new XMLHttpRequest();
    var appId;
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
     * Open a connection to the REST API and validate the app, creating an appauthsession.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.open
     * @param token The App's auth token
     * @param appId The App's id
     * @return {Promise<statusString>}
     */
    var open = that.publicize('open', function (params) {
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
        clientSettings = webrtc.getClient(client).getClientSettings();
        baseURL = clientSettings.baseURL || 'https://demo.digiumlabs.com:1337/v1';

        call({
            path: '/v1/appauthsessions',
            httpMethod: 'POST',
            parameters: {
                appId: params.appId,
                tokenId: params.token
            },
            responseHandler: function (response) {
                if (!response.error) {
                    deferred.resolve("App authenticated.");
                    log.trace("Signaling connection open to", baseURL);
                    state = 'open';
                } else {
                    deferred.reject(new Error("Couldn't authenticate app."));
                }
            }
        });

        return deferred.promise;
    });

    /**
     * Close a connection to the REST API. Invalidate the appauthsession.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.close
     * @return {Promise<statusString>}
     */
    var close = that.publicize('close', function (params) {
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);

        call({
            path: '/v1/appauthsessions',
            httpMethod: 'DELETE',
            responseHandler: function (response) {
                if (!response.error) {
                    socket.disconnect();
                    deferred.resolve("App session ended.");
                    state = 'open';
                } else {
                    deferred.reject(new Error("Couldn't end app session."));
                }
            }
        });

        return deferred.promise;
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
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
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
        params = params || {};
        log.trace("Signaling sendPresence");

        return wsCall({
            path: '/v1/presence',
            httpMethod: 'POST',
            parameters: {
                'presence': {
                    show: "no show",
                    'status': "Hey, I'm having fun!",
                    namespace: appId,
                    type: params.presence || "available"
                }
            },
            onSuccess: params.onSuccess,
            onError: params.onSuccess // TODO params.onError
        });
    });

    /**
     * Get or create a group in the infrastructure.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getGroup
     * @returns {Promise<webrtc.Group>}
     */
    var getGroup = that.publicize('getGroup', function (params) {
        var deferred = webrtc.makeDeferred();
        log.trace('signalingChannel.getGroup');
        wsCall({
            httpMethod: 'POST',
            path: '/v1/channels/',
            parameters: {
                name: params.name
            }
        }).then(function (group) {
            deferred.resolve(group);
        }, function (err) {
            wsCall({
                httpMethod: 'GET',
                path: '/v1/channels/',
                parameters: {
                    name: params.name
                }
            }).then(function (groups) {
                for (var i = 0; i < groups.length; i += 1) {
                    if (groups[i].name === params.name) {
                        deferred.resolve(groups[i]);
                        return;
                    }
                    deferred.reject(new Error("Couldn't create or find group", params.name));
                }
            }, function (err) {
                deferred.reject(new Error("Couldn't create or find group", params.name));
            });
        });
        return deferred.promise;
    });

    /**
     * Join a group.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.joinGroup
     * @returns {Promise<string>}
     */
    var joinGroup = that.publicize('joinGroup', function (params) {
        return wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'POST'
        });
    });

    /**
     * Publish a message to a group.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.publish
     * @returns {Promise<string>}
     */
    var publish = that.publicize('publish', function (params) {
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
        if (!params.id) {
            deferred.reject(new Error("Can't publish to a group without group ID."));
            return deferred.promise;
        }

        if (!params.message) {
            deferred.reject(new Error("Can't publish to a group without message."));
            return deferred.promise;
        }

        return wsCall({
            path: '/v1/channels/%s/publish/',
            objectId: params.id,
            httpMethod: 'POST',
            parameters: {
                id: params.id,
                message: params.message
            }
        });
    });

    /**
     * Join a group.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getGroupMembers
     * @returns {Promise<Array>}
     */
    var getGroupMembers = that.publicize('getGroupMembers', function (params) {
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
        if (!params.id) {
            deferred.reject(new Error("Can't get group's endpoints without group ID."));
            return deferred.promise;
        }

        return wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'GET'
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
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);

        try {
            recipient = params.message.getRecipient().getID();
        } catch (e) {
            log.debug("Can't get message recipient.");
            return deferred.promise;
        }

        if ([null, undefined, ""].indexOf(recipient) > -1) {
            log.debug("Can't send message without recipient.");
            return deferred.promise;
        }

        if ([null, undefined, ""].indexOf(msgText) > -1) {
            log.debug("Can't send message without message text.");
            return deferred.promise;
        }

        return wsCall({
            path: '/v1/chat',
            httpMethod: 'POST',
            parameters: {
                'to': recipient,
                'text': msgText
            },
            onSuccess: params.onSuccess,
            onError: params.onError
        });
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
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);

        try {
            recipient = params.signal.getRecipient().getID();
        } catch (e) {
            deferred.resolve(new Error("Can't get signal recipient."));
            return deferred.promise;
        }

        if ([null, undefined, ""].indexOf(recipient) > -1) {
            deferred.resolve(new Error("Can't send signal without recipient."));
            return deferred.promise;
        }

        if ([null, undefined, ""].indexOf(signalText) > -1) {
            deferred.resolve(new Error("Can't send signal without signal text."));
            return deferred.promise;
        }

        return wsCall({
            path: '/v1/signaling',
            httpMethod: 'POST',
            parameters: {
                'to': recipient,
                'signal': signalText
            },
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Send an ICE candidate.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.sendCandidate
     * @param {webrtc.Contact} recipient The recipient.
     * @param {RTCIceCandidate} candObj An ICE candidate to JSONify and send.
     */
    var sendCandidate = that.publicize('sendCandidate', function (params) {
        params = params || {};
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
        params = params || {};
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
        params = params || {};
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
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
        appId = params.appId;

        call({
            httpMethod: "POST",
            path: '/v1/authsessions',
            parameters: {
                'username': params.username,
                'password': params.password,
                'appId': params.appId
            },
            responseHandler: function (response) {
                var pieces = [];
                var protocol = null;
                var host = null;
                var port = null;

                if (response.code !== 200) {
                    deferred.reject(new Error(response.message));
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

                /**
                 * Begin development override of socket.on and socket.emit.
                 */
                (function () {
                    var emit = socket.emit;
                    socket.emit = function () {
                        console.log('***', 'emit', Array.prototype.slice.call(arguments));
                        emit.apply(socket, arguments);
                    };
                    var $emit = socket.$emit;
                    socket.$emit = function () {
                        console.log('***', 'on', Array.prototype.slice.call(arguments));
                        $emit.apply(socket, arguments);
                    };
                })();
                /**
                 * End override
                 */

                socket.on('pubsub', function handleMessage(message) {
                    console.log("pubsub websocket message", message);
                });
                socket.on('enter', function handleMessage(message) {
                    console.log("enter websocket message", message);
                });
                socket.on('leave', function handleMessage(message) {
                    console.log("leave websocket message", message);
                });
                socket.on('message', function handleMessage(message) {
                    console.log("Unrecognized websocket message", message);
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

                    wsCall({
                        path: '/v1/endpointconnections',
                        httpMethod: 'POST',
                        parameters: {
                            'name': params.username
                        }
                    }).then(function (res) {
                        log.debug('endpointconnections result', res);
                        var user = webrtc.User({
                            loggedIn: true,
                            timeLoggedIn: new Date(),
                            client: client,
                            id: res.id,
                            name: res.endpointId,
                            username: res.endpointId
                        });
                        deferred.resolve(user);
                    }, function (err) {
                        log.debug("Couldn't register endpoint.", err);
                        deferred.reject(err);
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
            }
        });
        return deferred.promise;
    });

    /**
     * Get ephemeral TURN credentials.  This method is called every 20 hours in setInterval
     * in the Client so that credentials are ready to use quickly when a call begins. We
     * don't want to have to wait on a REST request to finish between the user clicking the
     * call button and the call beginning.
     * @memberof! webrtc.SignalingChannel
     * @method webrtc.SignalingChannel.getTurnCredentials
     */
    var getTurnCredentials = that.publicize('getTurnCredentials', function (params) {
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);

        wsCall({
            httpMethod: 'GET',
            path: '/v1/turn'
        }).done(function (creds) {
            var result = [];

            if (!creds || !creds.uris) {
                deferred.reject(new Error("Turn credentials empty."));
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
        }, function (err) {
            deferred.reject(err);
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
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);

        if (!params) {
            deferred.reject(new Error('No params.'));
            return deferred.promise;
        }

        if (!params.path) {
            deferred.reject(new Error('No request path.'));
            return deferred.promise;
        }

        params.httpMethod = (params.httpMethod || 'get').toLowerCase();

        if (params.objectId) {
            params.path = params.path.replace(/\%s/ig, params.objectId);
        }

        log.debug('socket request', params.httpMethod, params.path, params.parameters);

        if (!socket || !socket[params.httpMethod]) {
            deferred.reject(new Error("Can't make websocket request: no connection."));
            return deferred.promise;
        }

        socket[params.httpMethod](params.path, params.parameters, function handleResponse(response) {
            log.debug('socket response', params.httpMethod, params.path, response);
            if (response && response.error) {
                deferred.reject(new Error(response.error + '(' + params.httpMethod + ' ' + params.path + ')'));
            } else {
                deferred.resolve(response || {statusCode: 200});
            }
        });
        return deferred.promise;
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

/**
 * Create a new Group.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Group
 * @constructor
 * @classdesc A group, representing a collection of users and the method by which to communicate
 * with them.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Group}
 */
webrtc.Group = function (params) {
    "use strict";
    params = params || {};
    params.that = [];

    console.log("new group params are", params);
    var group = webrtc.EventEmitter(params);
    var client = params.client;
    var signalingChannel = webrtc.getClient(client).getSignalingChannel();
    group.className = 'webrtc.Group';
    delete group.client;
    console.log("new group is", group);

    if (!group.id) {
        throw new Error("Can't create a group without an ID.");
    }

    /**
     * Remove an endpoint from a group
     * @memberof! webrtc.Group
     * @method webrtc.Group.remove
     * @params {string} [name] Endpoint name
     * @params {string} [id] Endpoint id
     */
    var remove = group.publicize('remove', function (params) {
        if (!params.id || !params.name) {
            throw new Error("Can't remove endpoint from a group without a name or id.");
        }
        for (var i = (group.length - 1); i >= 0; i += 1) {
            var endpoint = group[i];
            if (endpoint.id === params.id || endpoint.name === params.name) {
                group.splice(i, 1);
            }
        }
    });

    var add = group.publicize('add', group.push);

    /**
     * Send a message to each member of a group
     * @memberof! webrtc.Group
     * @method webrtc.Group.remove
     * @params {object} The message
     */
    var send = group.publicize('send', function (params) {
        params.id = group.id;
        return signalingChannel.publish(params);
    });

    /**
     * Get an array of subscribers of the group
     * @memberof! webrtc.Group
     * @method webrtc.Group.getEndpoints
     * @returns {Promise<Array>} A promise to an array of endpoints.
     */
    var getEndpoints = group.publicize('getEndpoints', function (params) {
        params = params || {};
        var deferred = webrtc.makeDeferred(params.onSuccess, params.onError);
        signalingChannel.getGroupMembers({
            id: group.id
        }).done(function (endpoints) {
            endpoints = endpoints.map(function (endpoint) {
                endpoint.client = client;
                endpoint.name = endpoint.endpointId;
                delete endpoint.endpointId;
                return webrtc.Contact(endpoint);
            });
            deferred.resolve(endpoints);
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    return group;
}; // End webrtc.Group
