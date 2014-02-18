/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a new SignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.SignalingChannel
 * @constructor
 * @classdesc REST API Signaling class.
 * @param {string} client
 * @returns {brightstream.SignalingChannel}
 */
 /*global brightstream: false */
brightstream.SignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.SignalingChannel';

    var clientObj = brightstream.getClient(client);
    var state = 'new';
    var socket = null;
    var clientSettings = null; // client is not set up yet
    var baseURL = null;
    var xhr = new XMLHttpRequest();
    var appId;
    var endpointId;
    xhr.withCredentials = true;

    var handlerQueue = {
        'message': [],
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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.open
     * @param {string} token - The App's auth token
     * @param {string} appId - The App's id
     * @return {Promise<statusString>}
     */
    var open = that.publicize('open', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        clientSettings = brightstream.getClient(client).getClientSettings();
        baseURL = clientSettings.baseURL || 'https://demo.digiumlabs.com:1337';

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
     * End an AppAuthSession
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.deleteAppAuthSession
     * @private
     */
    var deleteAppAuthSession = function () {
        call({
            path: '/v1/appauthsessions',
            httpMethod: 'DELETE',
            responseHandler: function (response) {
                socket.disconnect();
                state = 'closed';
            }
        });
    };

    /**
     * Close a connection to the REST API. Invalidate the appauthsession.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.close
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<statusString>}
     */
    var close = that.publicize('close', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        wsCall({
            path: '/v1/endpointconnections/%s/',
            httpMethod: 'DELETE',
            objectId: clientObj.user.getID()
        }).done(deleteAppAuthSession, deleteAppAuthSession);

        return deferred.promise;
    });

    /**
     * Return the state of the signaling channel
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getState
     * @return {string} The state of the signaling channel.
    */
    var getState = that.publicize('getState', function () {
        return state;
    });

    /**
     * Whether signaling channel is open.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.isOpen
     * @return {boolean}
     */
    var isOpen = that.publicize('isOpen', function () {
        return state === 'open';
    });

    /**
     * Generate and send a presence message representing the user's current status. This triggers
     * the server to send the user's endpoint's presence.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendPresence
     * @param {string} presence - description, "unavailable", "available", "away", "xa", "dnd"
     * @param {function} [onSuccess]
     * @param {function} [onError]
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
            onError: params.onError
        });
    });

    /**
     * Get or create a group in the infrastructure.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getGroup
     * @returns {Promise<brightstream.Group>}
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @param {string} name
     */
    var getGroup = that.publicize('getGroup', function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
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
            deferred.resolve({id: params.name});
        });
        return deferred.promise;
    });

    /**
     * Join a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.leaveGroup
     * @returns {Promise<undefined>}
     * @param {string} id
     * @param {function} [onSuccess]
     * @param {function} [onError]
     */
    var leaveGroup = that.publicize('leaveGroup', function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'DELETE'
        }).done(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Join a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.joinGroup
     * @returns {Promise<undefined>}
     * @param {string} id
     * @param {function} [onSuccess]
     * @param {function} [onError]
     */
    var joinGroup = that.publicize('joinGroup', function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'POST'
        }).done(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Publish a message to a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.publish
     * @returns {Promise<string>}
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @param {string} id
     * @param {string} message
     */
    var publish = that.publicize('publish', function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        if (!params.id) {
            deferred.reject(new Error("Can't publish to a group without group ID."));
            return deferred.promise;
        }

        if (!params.message) {
            deferred.reject(new Error("Can't publish to a group without message."));
            return deferred.promise;
        }

        wsCall({
            path: '/v1/channels/%s/publish/',
            objectId: params.id,
            httpMethod: 'POST',
            parameters: {
                id: params.id,
                message: params.message
            }
        }).done(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    /**
     * Register as an observer of presence for the specified endpoint ids.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.registerPresence
     * @param {array} endpointList
     */
    var registerPresence = that.publicize('registerPresence', function (params) {
        wsCall({
            httpMethod: 'POST',
            path: '/v1/presenceobservers',
            parameters: {
                endpointList: params.endpointList
            }
        });
    });

    /**
     * Join a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getGroupMembers
     * @returns {Promise<Array>}
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @param {string} id
     */
    var getGroupMembers = that.publicize('getGroupMembers', function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendMessage
     * @param {brightstream.SignalingMessage} message - The string text message to send.
     * @param {function} [onSuccess]
     * @param {function} [onError]
     */
    var sendMessage = that.publicize('sendMessage', function (params) {
        var msgText = params.message.getPayload();
        var recipient = null;
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

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
            path: '/v1/messages',
            httpMethod: 'POST',
            parameters: {
                'to': recipient,
                'message': msgText
            },
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Send a signaling message.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendSignal
     * @param {brightstream.SignalingMessage} signal
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     */
    var sendSignal = that.publicize('sendSignal', function (params) {
        var signalText = params.signal.getPayload();
        var recipient = null;
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendCandidate
     * @param {brightstream.Endpoint} recipient The recipient.
     * @param {RTCIceCandidate} candObj An ICE candidate to JSONify and send.
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     */
    var sendCandidate = that.publicize('sendCandidate', function (params) {
        params = params || {};
        return that.sendSignal({
            signal: brightstream.SignalingMessage({
                recipient: params.recipient,
                sender: brightstream.getClient(client).user.getID(),
                payload: JSON.stringify(params.candObj)
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Send an SDP.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendSDP
     * @param {brightstream.Endpoint} recipient The recipient.
     * @param {RTCSessionDescription} sdpObj An SDP to JSONify and send.
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     */
    var sendSDP = that.publicize('sendSDP', function (params) {
        params = params || {};
        return that.sendSignal({
            signal: brightstream.SignalingMessage({
                'recipient': params.recipient,
                'sender': brightstream.getClient(client).user.getID(),
                'payload': JSON.stringify(params.sdpObj)
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Send a message terminating the WebRTC session.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendBye
     * @param {brightstream.Endpoint} recipient The recipient.
     * @param {string} reason The reason the session is being terminated.
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     */
    var sendBye = that.publicize('sendBye', function (params) {
        params = params || {};
        return that.sendSignal({
            signal: brightstream.SignalingMessage({
                'recipient': params.recipient,
                'sender': brightstream.getClient(client).user.getID(),
                'payload': JSON.stringify({'type': 'bye', 'reason': params.reason})
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Route different types of signaling messages via events.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routeSignal
     * @param {brightstream.SignalingMessage} message - A message to route
     * @fires brightstream.Call#offer
     * @fires brightstream.Call#accept
     * @fires brightstream.Call#answer
     * @fires brightstream.Call#candidate
     * @fires brightstream.Call#bye
     */
    var routeSignal = that.publicize('routeSignal', function (message) {
        var signal = message.getPayload();
        var call = null;
        var toCreate = false;

        log.debug(signal.type, signal);

        // Only create a new call if this signal is an offer.
        if (signal.type === 'offer') {
            toCreate = true;
        }
        call = clientObj.user.getCallByEndpoint({
            endpointId: message.getSender(),
            create: toCreate
        });

        if (!toCreate && !call) {
            return;
        }

        switch (signal.type) {
        case 'offer':
            call.setOffer(signal);
            /**
             * @event brightstream.Call#offer
             * @type {object}
             */
            call.fire('offer', signal);
            break;
        case 'accept':
            /**
             * @event brightstream.Call#accept
             * @type {object}
             */
            call.fire('accept', signal);
            break;
        case 'answer':
            call.setAnswer(signal);
            /**
             * @event brightstream.Call#answer
             * @type {object}
             */
            call.fire('answer', signal);
            break;
        case 'candidate':
            call.addRemoteCandidate(signal);
            /**
             * @event brightstream.Call#candidate
             * @type {object}
             */
            call.fire('candidate', signal);
            break;
        case 'bye':
            call.setBye(signal);
            /**
             * @event brightstream.Call#bye
             * @type {object}
             */
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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.addHandler
     * @param {string} type - The type of message, e. g., 'iq', 'pres'
     * @param {function} handler - A function to which to pass the message
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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.authenticate
     * @param {string} username - The token ID
     * @param {function} onStatusChange - A function to which to call on every state change.
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     */
    var authenticate = that.publicize('authenticate', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var pieces = [];
        var protocol = null;
        var host = null;
        var port = null;

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
         * @fires brightstream.Group#message
         * @fires brightstream.Client#message
         */
        socket.on('pubsub', function handleMessage(message) {
            var group;
            var groupMessage;

            if (message.header.from === clientObj.user.getName()) {
                return;
            }

            groupMessage = brightstream.TextMessage({
                sender: message.header.from,
                senderSession: message.header.fromConnection,
                recipient: message.header.channel,
                rawMessage: message
            });

            group = clientObj.getGroup({id: message.header.channel});
            if (group) {
                /**
                 * @event brightstream.Group#message
                 * @type {brightstream.TextMessage}
                 */
                group.fire('message', groupMessage);
            } else if (clientObj.onMessage) {
                /**
                 * @event brightstream.Client#message
                 * @type {brightstream.TextMessage}
                 */
                clientObj.fire('message', groupMessage);
            }
        });

        socket.on('presence', function handleMessage(message) {
            var endpoint;
            var groups;

            log.debug('socket.on presence', message);
            if (message.header.from === endpointId) {
                return;
            }

            endpoint = clientObj.getEndpoint({
                id: message.header.from,
                createData: {
                    client: client,
                    id: message.header.from,
                    name: message.header.from,
                    connection: message.header.fromConnection
                }
            });

            if (message.type === 'unavailable') {
                var groups = clientObj.getGroups();
                if (groups) {
                    groups.forEach(function (group) {
                        group.getEndpoints().done(function (endpoints) {
                            endpoints.forEach(function (endpoint) {
                                if (endpoint.getName() === message.header.from) {
                                    group.fire('leave', endpoint);
                                }
                            });
                        });
                    });
                }
            }

            endpoint.setPresence({
                sessionId: message.header.fromConnection,
                presence: message.type
            });
        });

        socket.on('join', function handleMessage(message) {
            var group;
            var presenceMessage;
            var endpoint;

            if (message.endpoint === endpointId) {
                return;
            }

            endpoint = clientObj.getEndpoint({
                id: message.endpoint,
                createData: {
                    client: client,
                    id: message.endpoint,
                    name: message.endpoint,
                    connection: message.connectionId
                }
            });

            // Handle presence not associated with a channel
            if (message.header.channel.indexOf('system') > -1) {
                endpoint.setPresence({
                    sessionId: message.connectionId,
                    presence: 'available'
                });
                return;
            }

            that.registerPresence({endpointList: [message.endpoint]});
            group = clientObj.getGroup({id: message.header.channel});

            if (group && endpoint) {
                group.add(endpoint);
            } else {
                log.error("Can't add endpoint to group:", message, group, endpoint);
            }
        });

        socket.on('leave', function handleMessage(message) {
            var group;
            var presenceMessage;
            var endpoint;

            if (message.endpointId === clientObj.user.getID()) {
                return;
            }

            endpoint = clientObj.getEndpoint({
                id: message.endpointId
            });

            group = clientObj.getGroup({id: message.header.channel});
            if (group && endpoint) {
                group.remove(endpoint);
                clientObj.checkEndpointForRemoval(endpoint);
            } else {
                log.error("Can't remove endpoint from group:", group, endpoint);
            }
        });

        /**
         * @fires brightstream.Endpoint#message
         * @fires brightstream.Client#message
         */
        socket.on('message', function handleMessage(message) {
            var endpoint;
            message = brightstream.TextMessage({rawMessage: message});
            endpoint = clientObj.getEndpoint({id: message.getSender()});
            if (endpoint) {
                /**
                 * @event brightstream.Endpoint#message
                 * @type {brightstream.TextMessage}
                 */
                endpoint.fire('message', message);
            } else if (clientObj.onMessage) {
                /**
                 * @event brightstream.Client#message
                 * @type {brightstream.TextMessage}
                 */
                clientObj.fire('message', message);
            }
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
                httpMethod: 'POST'
            }).then(function (res) {
                log.debug('endpointconnections result', res);
                endpointId = res.endpointId;
                var user = brightstream.User({
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
                var message = brightstream.SignalingMessage({
                    'rawMessage': message
                });
                that.routeSignal(message);
            }
        });
        return deferred.promise;
    });

    /**
     * Get ephemeral TURN credentials.  This method is called every 20 hours in setInterval
     * in the Client so that credentials are ready to use quickly when a call begins. We
     * don't want to have to wait on a REST request to finish between the user clicking the
     * call button and the call beginning.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getTurnCredentials
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     */
    var getTurnCredentials = that.publicize('getTurnCredentials', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.wsCall
     * @private
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @param {string} httpMethod
     * @param {string} path
     * @param {string} objectId
     * @param {object} parameters
     * @return {Promise<object>}
     */
    var wsCall = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.call
     * @private
     * @param {string} httpMethod
     * @param {string} objectId
     * @param {string} path
     * @param {object} parameters
     * @param {function} responseHandler
     * @todo TODO change this to return a promise
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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.makeParamString
     * @private
     * @param {object} params - Collection of strings and arrays to serialize.
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
}; // End brightstream.SignalingChannel

/**
 * Create a new TextMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.TextMessage
 * @constructor
 * @classdesc A message.
 * @param {string} sender - ID of the sender
 * @param {string} recipient - ID of the recipient
 * @param {object} [rawMessage] - the parsed JSON we got from the server
 * @param {string|object} [payload] - the message we intend to send to the server
 * @returns {brightstream.TextMessage}
 */
brightstream.TextMessage = function (params) {
    "use strict";
    params = params || {};
    var that = params;

    that.className = 'brightstream.TextMessage';
    var rawMessage = params.rawMessage; // Only set on incoming message.
    var payload = params.payload; // Only set on outgoing message.
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload. In this base class, assume text.
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.parse
     * @param {object} Optional message to parse and replace rawMessage with.
     */
    var parse = that.publicize('parse', function (params) {
        if (params) {
            rawMessage = params;
        }
        payload = rawMessage.message || rawMessage.body;
        if (rawMessage.header) {
            sender = rawMessage.header.from;
        }
    });

    /**
     * Get the whole payload.
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.getPayload
     * @returns {string}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the whole chat message.
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.getText
     * @returns {string}
     */
    var getText = that.publicize('getText', function () {
        return payload;
    });

    /**
     * Get the recipient.
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    /**
     * Get the sender.
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.getSender
     * @returns {string}
     */
    var getSender = that.publicize('getSender', function () {
        return sender;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End brightstream.TextMessage

/**
 * Create a new SignalingMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.SignalingMessage
 * @constructor
 * @classdesc A message.
 * @param {string} sender - ID of the sender
 * @param {string} recipient - ID of the recipient
 * @param {object} [rawMessage] - the parsed JSON we got from the server
 * @param {string|object} [payload] - the message we intend to send to the server
 * @returns {brightstream.SignalingMessage}
 */
brightstream.SignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var that = params;
    that.className = 'brightstream.SignalingMessage';

    var rawMessage = params.rawMessage; // Only set on incoming message.
    var payload = params.payload; // Only set on outgoing message.
    var sender = params.sender;
    var recipient = params.recipient;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.parse
     * @param {object} Optional message to parse and replace rawMessage with.
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
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.getText
     * @returns {string} A string that may represent the value of the payload.
     */
    var getText = that.publicize('getText', function () {
        return payload.type;
    });

    /**
     * Get the whole payload
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.getPayload
     * @returns {object}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the recipient.
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.getRecipient
     * @returns {string}
     */
    var getRecipient = that.publicize('getRecipient', function () {
        return recipient;
    });

    /**
     * Get the sender.
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.getSender
     * @returns {string}
     */
    var getSender = that.publicize('getSender', function () {
        return sender;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End brightstream.SignalingMessage

/**
 * Create a new PresenceMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.PresenceMessage
 * @constructor
 * @classdesc A message.
 * @param {string} sender - ID of the sender
 * @param {string} recipient - ID of the recipient
 * @param {object} [rawMessage] - the parsed JSON we got from the server
 * @param {string|object} [payload] - the message we intend to send to the server
 * @returns {brightstream.PresenceMessage}
 */
brightstream.PresenceMessage = function (params) {
    "use strict";
    params = params || {};
    var that = params;
    that.className = 'brightstream.PresenceMessage';

    var rawMessage = params.rawMessage;
    delete params.rawMessage;
    var payload = {};
    var sender = params.sender;
    var sessionId = null;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! brightstream.PresenceMessage
     * @method brightstream.PresenceMessage.parse
     * @param {object} Optional message to parse and replace rawMessage with.
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
            try {
                sender = rawMessage.userId;
                sessionId = rawMessage.sessionId;
            } catch (f) {
                sender = rawMessage.header.from;
                sessionId = rawMessage.header.fromConnection;
            }
        }

        delete rawMessage.header;
        payload = rawMessage;
    });

    /**
     * Get the presence string.
     * @memberof! brightstream.PresenceMessage
     * @method brightstream.PresenceMessage.getText
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
     * @memberof! brightstream.PresenceMessage
     * @method brightstream.PresenceMessage.getPayload
     * @returns {object}
     */
    var getPayload = that.publicize('getPayload', function () {
        return payload;
    });

    /**
     * Get the sender.
     * @memberof! brightstream.PresenceMessage
     * @method brightstream.PresenceMessage.getSender
     * @returns {string}
     */
    var getSender = that.publicize('getSender', function () {
        return sender;
    });

    /**
     * Get the session ID of the sender.
     * @memberof! brightstream.PresenceMessage
     * @method brightstream.PresenceMessage.getSessionID
     * @returns {string}
     */
    var getSessionID = that.publicize('getSessionID', function () {
        return sessionId;
    });

    if (rawMessage) {
        parse();
    }

    return that;
}; // End brightstream.PresenceMessage

/**
 * Create a new Group.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Group
 * @constructor
 * @classdesc A group, representing a collection of users and the method by which to communicate
 * with them.
 * @param {string} client
 * @param {function} onJoin
 * @param {function} onMessage
 * @param {function} onLeave
 * @param {function} onPresence
 * @returns {brightstream.Group}
 */
brightstream.Group = function (params) {
    "use strict";
    params = params || {};

    var group = brightstream.EventEmitter(params);
    var client = params.client;
    var signalingChannel = brightstream.getClient(client).getSignalingChannel();
    var endpoints = [];

    if (!group.id) {
        throw new Error("Can't create a group without an ID.");
    }

    group.endpoints = endpoints;
    group.className = 'brightstream.Group';
    group.listen('join', params.onJoin);
    group.listen('message', params.onMessage);
    group.listen('leave', params.onLeave);
    group.listen('presence', params.onPresence);

    delete group.client;
    delete group.onMessage;
    delete group.onPresence;
    delete group.onJoin;
    delete group.onLeave;

    /**
     * Get the ID of the group
     * @memberof! brightstream.Group
     * @method brightstream.Group.getID
     * @return {string}
     */
    var getID = group.publicize('getID', function () {
        return group.id;
    });

    /**
     * Get the name of the group
     * @memberof! brightstream.Group
     * @method brightstream.Group.getName
     * @return {string}
     * @todo TODO maybe one day we will have separate group names and ids
     */
    group.publicize('getName', getID);

    /**
     * Leave a group
     * @memberof! brightstream.Group
     * @method brightstream.Group.leave
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @return {Promise<undefined>}
     * @fires brightstream.User#leave
     */
    var leave = group.publicize('leave', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var clientObj = brightstream.getClient(client);
        signalingChannel.leaveGroup({
            id: group.id
        }).done(function () {
            /**
             * @event brightstream.User#leave
             * @type {brightstream.Group}
             */
            clientObj.user.fire('leave', group);
            deferred.resolve();
        }, function (err) {
            deferred.reject();
        });
        return deferred.promise;
    });

    /**
     * Remove an endpoint from a group
     * @memberof! brightstream.Group
     * @method brightstream.Group.remove
     * @param {string} [name] Endpoint name
     * @param {string} [id] Endpoint id
     * @fires brightstream.Group#leave
     */
    var remove = group.publicize('remove', function (newEndpoint) {
        if (!newEndpoint.id || !newEndpoint.name) {
            throw new Error("Can't remove endpoint from a group without a name or id.");
        }
        for (var i = (endpoints.length - 1); i >= 0; i -= 1) {
            var endpoint = endpoints[i];
            if ((newEndpoint.id && endpoint.getID() === newEndpoint.id) ||
                    (newEndpoint.name && endpoint.getName() === newEndpoint.name)) {
                endpoints.splice(i, 1);
                /**
                 * @event brightstream.Group#leave
                 * @type {brightstream.Endpoint}
                 */
                group.fire('leave', endpoint);
            }
        }
    });

    /**
     * Add an endpoint to a group
     * @memberof! brightstream.Group
     * @method brightstream.Group.add
     * @param {string} [name] Endpoint name
     * @param {string} [id] Endpoint id
     * @fires brightstream.Group#join
     */
    var add = group.publicize('add', function (newEndpoint) {
        var foundEndpoint;
        var exists;
        if (!newEndpoint.id || !newEndpoint.name) {
            throw new Error("Can't add endpoint to a group without a name or id.");
        }
        for (var i = 0; i < endpoints.length; i += 1) {
            var ept = endpoints[i];
            if (ept.name === newEndpoint.name || ept.id === newEndpoint.id) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            endpoints.push(newEndpoint);
            /**
             * @event brightstream.Group#join
             * @type {brightstream.Group}
             * @type {brightstream.Endpoint}
             */
            group.fire('join', group, newEndpoint);
        }
    });

    /**
     * Send a message to the entire group
     * @memberof! brightstream.Group
     * @method brightstream.Group.sendMessage
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @param {string} message
     */
    var sendMessage = group.publicize('sendMessage', function (params) {
        params.id = group.id;
        return signalingChannel.publish(params);
    });

    /**
     * Get an array of subscribers of the group
     * @memberof! brightstream.Group
     * @method brightstream.Group.getEndpoints
     * @returns {Promise<Array>} A promise to an array of endpoints.
     * @param {function} [onSuccess]
     * @param {function} [onError]
     */
    var getEndpoints = group.publicize('getEndpoints', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var clientObj = brightstream.getClient(client);

        if (endpoints.length > 0) {
            deferred.resolve(endpoints);
            return deferred.promise;
        }

        signalingChannel.getGroupMembers({
            id: group.id
        }).done(function (list) {
            var endpointList = [];
            list.forEach(function (endpoint) {
                endpoint.client = client;
                endpoint.name = endpoint.endpointId;
                endpoint.id = endpoint.endpointId;
                delete endpoint.endpointId;
                endpoint = clientObj.getEndpoint({
                    id: endpoint.id,
                    createData: endpoint
                });
                if (endpoint) {
                    group.fire('join', group, endpoint);
                    if (endpointList.indexOf(endpoint.getID()) === -1) {
                        endpointList.push(endpoint.getID());
                        add(endpoint);
                    }
                }
            });

            if (endpointList.length > 0) {
                signalingChannel.registerPresence({
                    endpointList: endpointList
                });
            }
            deferred.resolve(endpoints);
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    return group;
}; // End brightstream.Group
