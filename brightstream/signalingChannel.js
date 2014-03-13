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
    var appId = null;
    var endpointId = null;
    var appToken = null;

    var xhr = new XMLHttpRequest();

    var routingMethods = {};
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
     * @param {string} token - The Endpoint's auth token
     * @param {string} appId - The App's id
     * @return {Promise<undefined>}
     */
    var open = that.publicize('open', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        clientSettings = brightstream.getClient(client).getClientSettings();
        baseURL = clientSettings.baseURL || 'https://collective.brightstream.io';

        call({
            path: '/v1/appauthsessions',
            httpMethod: 'POST',
            parameters: {
                appId: params.appId,
                tokenId: params.token
            },
            responseHandler: function (response) {
                if (!response.error) {
                    appToken = response.result.token;
                    deferred.resolve();
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
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.close
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var close = that.publicize('close', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        wsCall({
            path: '/v1/endpointconnections/%s/',
            httpMethod: 'DELETE',
            objectId: clientObj.user.getID()
        }).fin(function () {
            call({
                path: '/v1/appauthsessions',
                httpMethod: 'DELETE',
                responseHandler: function (response) {
                    socket.removeAllListeners();
                    socket.disconnect();
                    state = 'closed';
                    deferred.resolve();
                }
            });
        });

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
     * @param {string} [status] - Non-enumeration human-readable status.
     * @param {string} [show] - I can't remember what this is.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     */
    var sendPresence = that.publicize('sendPresence', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        log.trace("Signaling sendPresence");

        wsCall({
            path: '/v1/presence',
            httpMethod: 'POST',
            parameters: {
                'presence': {
                    show: params.show,
                    'status': params.status,
                    namespace: appId,
                    type: params.presence || "available"
                }
            }
        }).done(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    /**
     * Get or create a group in the infrastructure.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getGroup
     * @returns {Promise<brightstream.Group>}
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @param {string} name
     */
    var getGroup = that.publicize('getGroup', function (params) {
        params = params || {};
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
            // Group was already created, just return back the same params we were given.
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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     */
    var leaveGroup = that.publicize('leaveGroup', function (params) {
        params = params || {};
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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     */
    var joinGroup = that.publicize('joinGroup', function (params) {
        params = params || {};
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
     * @returns {Promise<undefined>}
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @param {string} id
     * @param {string} message
     */
    var publish = that.publicize('publish', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var message = brightstream.TextMessage({
            endpointId: params.id,
            message: params.message
        });

        wsCall({
            path: '/v1/channels/%s/publish/',
            objectId: params.id,
            httpMethod: 'POST',
            parameters: message
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
     * @param {Array<string>} endpointList
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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
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
     * @param {brightstream.Endpoint} recipient
     * @param {string} [connectionId]
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @returns {Promise<undefined>}
     */
    var sendMessage = that.publicize('sendMessage', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var message = brightstream.TextMessage({
            endpointId: params.recipient.getID(),
            connectionId: params.connectionId,
            message: params.message
        });

        wsCall({
            path: '/v1/messages',
            httpMethod: 'POST',
            parameters: message
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });

    /**
     * Send a signaling message.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendSignal
     * @param {brightstream.SignalingMessage} signal
     * @param {brightstream.Endpoint} recipient
     * @param {string} [connectionId]
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var sendSignal = that.publicize('sendSignal', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        params.toConnection = params.connectionId;
        delete params.connectionId;

        if (params.signal.signal.indexOf('target') === -1) {
            throw new Error("Can't send signal without target", params.signal);
        }

        wsCall({
            path: '/v1/signaling',
            httpMethod: 'POST',
            parameters: params.signal
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Send an ICE candidate.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendCandidate
     * @param {brightstream.Endpoint} recipient - The recipient.
     * @param {string} [connectionId]
     * @param {RTCIceCandidate} candObj - An ICE candidate to JSONify and send.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var sendCandidate = that.publicize('sendCandidate', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        that.sendSignal({
            signal: brightstream.SignalingMessage({
                endpointId: params.recipient.getID(),
                connectionId: params.connectionId,
                signal: JSON.stringify({
                    candidate: params.candObj,
                    target: params.target,
                    type: 'candidate'
                })
            })
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Send an SDP.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendSDP
     * @param {brightstream.Endpoint} recipient - The recipient.
     * @param {string} [connectionId]
     * @param {RTCSessionDescription} sdpObj - An SDP to JSONify and send.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var sendSDP = that.publicize('sendSDP', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        that.sendSignal({
            signal: brightstream.SignalingMessage({
                endpointId: params.recipient.getID(),
                connectionId: params.connectionId,
                signal: JSON.stringify({
                    sdp: params.sdpObj,
                    target: params.target,
                    type: params.type
                })
            })
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Send a message terminating the WebRTC session.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendBye
     * @param {brightstream.Endpoint} recipient - The recipient.
     * @param {string} [connectionId]
     * @param {string} reason - The reason the session is being terminated.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var sendBye = that.publicize('sendBye', function (params) {
        params = params || {};
        params.signal = params.signal || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        that.sendSignal({
            signal: brightstream.SignalingMessage({
                endpointId: params.recipient.getID(),
                connectionId: params.connectionId,
                signal: JSON.stringify({
                    type: 'bye',
                    reason: params.reason,
                    target: params.target
                })
            })
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Send a message to all connection ids indicating we have negotiated a call with one connection.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendConnected
     * @param {brightstream.Endpoint} recipient - The recipient.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var sendConnected = that.publicize('sendConnected', function (params) {
        params = params || {};
        params.signal = params.signal || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        that.sendSignal({
            signal: brightstream.SignalingMessage({
                endpointId: params.recipient.getID(),
                signal: JSON.stringify({
                    connectionId: params.connectionId,
                    type: 'connected',
                    target: params.target
                })
            })
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Route different types of signaling messages via events.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routeSignal
     * @param {brightstream.SignalingMessage} message - A message to route
     * @fires brightstream.Call#offer
     * @fires brightstream.Call#connected
     * @fires brightstream.Call#answer
     * @fires brightstream.Call#candidate
     * @fires brightstream.Call#bye
     * @todo TODO Make the call.set* methods accept the entire message.
     */
    var routeSignal = that.publicize('routeSignal', function (message) {
        var signal = message.signal;
        var target = null;
        var toCreate = false;
        var method = 'do';
        var endpoint;
        var knownSignals = ['offer', 'answer', 'connected', 'candidate', 'bye'];
        var firstUpper = function (str) {
            return str[0].toUpperCase() + str.slice(1);
        };

        if (signal.type !== 'candidate') { // Too many of these!
            log.debug(signal.type, signal);
        }

        if (!signal.target || !signal.type || knownSignals.indexOf(signal.type) === -1) {
            log.error("Got malformed signal.", signal);
            throw new Error("Can't route signal without target or type.");
        }

        // Only create if this signal is an offer.
        if (signal.type === 'offer') {
            toCreate = true;
        }

        if (signal.target === 'call') {
            target = clientObj.user.getCall({
                id: message.endpointId,
                create: toCreate
            });
            if (!toCreate && !target) {
                return;
            }

            method += firstUpper(signal.target);
            method += firstUpper((knownSignals.indexOf(signal.type) === -1) ? 'unknown' : signal.type);
        } else if (signal.target === 'directConnection') {
            try {
                endpoint = clientObj.getEndpoint({
                    id: message.endpointId
                });
                target = endpoint.getDirectConnection({
                    create: toCreate,
                    initiator: !toCreate
                });
            } catch (e) {
                log.error("Can't get direct connection.", e);
            }

            method += firstUpper(signal.target);
            method += firstUpper((knownSignals.indexOf(signal.type) === -1) ? 'unknown' : signal.type);
        }

        routingMethods[method]({
            call: target,
            message: message,
            signal: signal
        });
    });

    routingMethods.doCallOffer = function (params) {
        params.call.connectionId = params.message.connectionId;
        params.call.setOffer(params.signal);
        /**
         * @event brightstream.Call#offer
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('offer', {
            signal: params.signal
        });
    };

    routingMethods.doCallConnected = function (params) {
        params.call.setConnected(params.signal);
        /**
         * @event brightstream.Call#connected
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('connected', {
            signal: params.signal
        });
    };

    routingMethods.doCallAnswer = function (params) {
        params.signal.connectionId = params.message.connectionId;
        params.call.setAnswer(params.signal);
        /**
         * @event brightstream.Call#answer
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('answer', {
            signal: params.signal
        });
    };

    routingMethods.doCallCandidate = function (params) {
        params.call.addRemoteCandidate(params.signal);
        /**
         * @event brightstream.Call#candidate
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('candidate', {
            signal: params.signal
        });
    };

    routingMethods.doCallBye = function (params) {
        // we may receive bye before connectionId is set if the call is rejected
        if (params.call.connectionId && params.call.connectionId !== params.message.connectionId) {
            return;
        }
        params.call.setBye(params.signal);
        /**
         * @event brightstream.Call#bye
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('bye', {
            signal: params.signal
        });
    };

    routingMethods.doCallUnknown = function (params) {
        log.error("Don't know what to do with", params.signal.target, "msg of unknown type", params.signal.type);
    };

    routingMethods.doDirectConnectionOffer = function (params) {
        params.call.connectionId = params.message.connectionId;
        params.call.setOffer(params.signal);
        /**
         * @event brightstream.DirectConnection#offer
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('offer', {
            signal: params.signal
        });
    };

    routingMethods.doDirectConnectionConnected = function (params) {
        params.call.setConnected(params.signal);
        /**
         * @event brightstream.DirectConnection#connected
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('connected', {
            signal: params.signal
        });
    };

    routingMethods.doDirectConnectionAnswer = function (params) {
        params.signal.connectionId = params.message.connectionId;
        params.call.setAnswer(params.signal);
        /**
         * @event brightstream.DirectConnection#answer
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('answer', {
            signal: params.signal
        });
    };

    routingMethods.doDirectConnectionCandidate = function (params) {
        params.call.addRemoteCandidate(params.signal);
        /**
         * @event brightstream.DirectConnection#candidate
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('candidate', {
            signal: params.signal
        });
    };

    routingMethods.doDirectConnectionBye = function (params) {
        // we may receive bye before connectionId is set if the call is rejected
        if (params.call.connectionId && params.call.connectionId !== params.message.connectionId) {
            console.log('not accepting bye', params.call.connectionId, params.call.connectionId, params.message.connectionId);
            return;
        }
        params.call.setBye(params.signal);
        /**
         * @event brightstream.DirectConnection#bye
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('bye', {
            signal: params.signal
        });
    };

    routingMethods.doDirectConnectionUnknown = function (params) {
        log.error("Don't know what to do with", params.signal.target, "msg of unknown type", params.signal.type);
    };

    /**
     * Add a handler to the connection for messages of different types.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.addHandler
     * @param {string} type - The type of message, e. g., 'iq', 'pres'
     * @param {function} handler - A function to which to pass the message
     * @todo TODO See if this is necessary anymore
     */
    var addHandler = that.publicize('addHandler', function (params) {
        if (socket.socket && socket.socket.open) {
            socket.on(params.type, params.handler);
        } else {
            handlerQueue[params.type].push(params.handler);
        }
    });

    /**
     * Socket handler for pub-sub messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onPubSub
     * @private
     * @fires brightstream.Group#message
     * @fires brightstream.Client#message
     */
    var onPubSub = function onPubSub(message) {
        var group;
        var groupMessage;

        if (message.header.from === clientObj.user.getName()) {
            return;
        }

        groupMessage = brightstream.TextMessage({
            rawMessage: message
        });

        group = clientObj.getGroup({id: message.header.channel});
        if (group) {
            /**
             * @event brightstream.Group#message
             * @type {brightstream.Event}
             * @property {brightstream.TextMessage} message
             */
            group.fire('message', {
                message: groupMessage
            });
        } else if (clientObj.onMessage) {
            /**
             * @event brightstream.Client#message
             * @type {brightstream.Event}
             * @property {brightstream.TextMessage} message
             */
            clientObj.fire('message', {
                message: groupMessage
            });
        }
    };

    /**
     * Socket handler for join messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onJoin
     * @private
     */
    var onJoin = function onJoin(message) {
        var group;
        var presenceMessage;
        var endpoint;

        if (message.endpoint === endpointId) {
            return;
        }

        endpoint = clientObj.getEndpoint({
            id: message.endpoint,
            client: client,
            name: message.endpoint,
            connection: message.connectionId
        });

        // Handle presence not associated with a channel
        if (message.header.channel.indexOf('system') > -1) {
            endpoint.setPresence({
                connectionId: message.connectionId,
                presence: 'available'
            });
            return;
        }

        that.registerPresence({endpointList: [message.endpoint]});
        group = clientObj.getGroup({id: message.header.channel});

        if (group) {
            group.addEndpoint(endpoint);
        } else {
            log.error("Can't add endpoint to group:", message, group, endpoint);
        }
    };

    /**
     * Socket handler for leave messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onLeave
     * @private
     */
    var onLeave = function onLeave(message) {
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
        if (group) {
            group.removeEndpoint(endpoint);
            clientObj.checkEndpointForRemoval(endpoint);
        } else {
            log.error("Can't remove endpoint from group:", group, endpoint);
        }
    };

    /**
     * Socket handler for presence messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onPresence
     * @private
     * @fires brightstream.Endpoint#message
     * @fires brightstream.Client#message
     */
    var onMessage = function onMessage(message) {
        var endpoint;
        message = brightstream.TextMessage({rawMessage: message});
        endpoint = clientObj.getEndpoint({
            id: message.endpointId,
            skipCreate: true
        });
        if (endpoint) {
            /**
             * @event brightstream.Endpoint#message
             * @type {brightstream.Event}
             * @property {brightstream.TextMessage} message
             */
            endpoint.fire('message', {
                message: message
            });
        }
        /**
         * @event brightstream.Client#message
         * @type {brightstream.Event}
         * @property {brightstream.TextMessage} message
         * @property {brightstream.Endpoint} [endpoint] - If the message is from an endpoint we already know about,
         * this will be set. If null, the developer can use client.getEndpoint({id: evt.message.endpointId}) to get
         * the Endpoint. From that point forward, Endpoint#message will fire when a message is received as well.
         */
        clientObj.fire('message', {
            endpoint: endpoint || null,
            message: message
        });
    };

    /**
     * Create a socket handler for the onConnect event with all the right things in scope.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.generateConnectHandler
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @private
     */
    var generateConnectHandler = function generateConnectHandler(onSuccess, onError) {
        return function onConnect() {
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
                    client: client,
                    id: res.id,
                    name: res.endpointId
                });
                if (onSuccess) {
                    onSuccess(user);
                }
            }, function (err) {
                log.debug("Couldn't register endpoint.", err);
                if (onError) {
                    onError(err);
                }
            });
        };
    };

    /**
     * Socket handler for presence messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onPresence
     * @private
     */
    var onPresence = function onPresence(message) {
        var endpoint;
        var groups;

        log.debug('socket.on presence', message);
        if (message.header.from === endpointId) {
            return;
        }

        endpoint = clientObj.getEndpoint({
            id: message.header.from,
            client: client,
            name: message.header.from,
            connection: message.header.fromConnection
        });

        if (message.type === 'unavailable') {
            var groups = clientObj.getGroups();
            if (groups) {
                groups.forEach(function (group) {
                    group.getEndpoints().done(function (endpoints) {
                        endpoints.forEach(function (eachEndpoint) {
                            if (eachEndpoint.getName() === message.header.from) {
                                group.removeEndpoint(eachEndpoint);
                            }
                        });
                    });
                });
            }
        }

        endpoint.setPresence({
            connectionId: message.header.fromConnection,
            presence: message.type
        });
    };

    /**
     * Authenticate to the cloud and call the handler on state change.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.authenticate
     * @param {function} onStatusChange - A function to which to call on every state change.
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<undefined>}
     */
    var authenticate = that.publicize('authenticate', function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var pieces = [];
        var protocol = null;
        var host = null;
        var port = null;

        if (!appToken) {
            deferred.reject(new Error("Can't open a websocket without an app token."));
        }

        pieces = baseURL.split(/:\/\//);
        protocol = pieces[0];
        pieces = pieces[1].split(/:/);
        host = pieces[0];
        port = pieces[1];

        /**
         * Try to connect for 2 seconds before failing.
         * On reconnect, start with a reconnect interval of 500ms. Every time reconnect fails, the interval
         * is doubled up to a maximum of 5 minutes. From the on, it will attempt to reconnect every 5 mins forever.
         */
        socket = io.connect(baseURL, {
            'connect timeout': 2000,
            'reconnection limit': 5 * 60 * 60 * 1000,
            'max reconnection attempts': Infinity,
            'force new connection': true, // Don't try to reuse old connection.
            'sync disconnect on unload': true, // have Socket.io call disconnect() on the browser unload event.
            reconnect: true,
            host: host,
            port: port,
            protocol: protocol,
            secure: (protocol === 'https'),
            query: 'app-token=' + appToken
        });

        socket.on('connect', generateConnectHandler(function onSuccess(user) {
            deferred.resolve(user);
        }, function onError(err) {
            log.debug("Couldn't register endpoint.", err);
            deferred.reject(err);
        }));

        socket.on('join', onJoin);
        socket.on('leave', onLeave);
        socket.on('pubsub', onPubSub);
        socket.on('message', onMessage);
        socket.on('presence', onPresence);

        socket.on('connect_failed', function (res) {
            log.error('Connect failed.');
        });

        socket.on('reconnect_failed', function (res) {
            log.error('Reconnect failed.');
        });

        socket.on('reconnecting', function (res) {
            log.info('reconnecting');
        });

        socket.on('error', function (res) {
            log.trace('socket#error', res);
        });

        that.addHandler({
            type: 'signal',
            handler: function signalHandler(message) {
                var message = brightstream.SignalingMessage({
                    rawMessage: message
                });
                that.routeSignal(message);
            }
        });

        socket.on('disconnect', function onDisconnect() {
            /**
             * @event brightstream.Client#disconnect
             */
            clientObj.fire('disconnect');
            socket.removeAllListeners('connect');

            socket.on('connect', generateConnectHandler(function onSuccess(user) {
                log.debug('socket reconnected');
                Q.all(clientObj.getGroups().map(function iterGroups(group) {
                    clientObj.join({id: group.id});
                })).done(function (result) {
                    clientObj.user = user;
                    /**
                     * @event brightstream.Client#reconnect
                     */
                    clientObj.fire('reconnect');
                }, function (err) {
                    throw new Error(err.message);
                });
            }, function onError(err) {
                throw new Error(err.message);
            }));
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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @return {Promise<Array>}
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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
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

        if (params.path.indexOf('signaling') === -1) { // Too many of these!
            log.debug('socket request', params.httpMethod, params.path, params.parameters);
        }

        if (!socket) {
            deferred.reject(new Error("Can't make websocket request: no connection."));
            return deferred.promise;
        }

        socket.emit(params.httpMethod, JSON.stringify({
            url: params.path,
            data: params.parameters,
            headers: {'X-App-Token': appToken}
        }), function handleResponse(response) {
            if (params.path.indexOf('signaling') === -1) { // Too many of these!
                log.debug('socket response', params.httpMethod, params.path, response);
            }

            try {
                response = JSON.parse(response);
            } catch (e) {
                throw new Error("Server response could not be parsed!", response);
            }

            if (response && response.error) {
                deferred.reject(new Error(response.error + '(' + params.httpMethod + ' ' + params.path + ')'));
            } else {
                deferred.resolve(response);
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
                if (appToken) {
                    xhr.setRequestHeader("X-App-Token", appToken);
                }
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
 * @param {string} [endpointId] - If sending, endpoint ID of the thing we're sending a message to.
 * @param {string} [connectionId] - If sending, connection ID of the thing we're sending a message to.
 * @param {string} [message] - If sending, a message to send
 * @param {object} [rawMessage] - If receiving, the parsed JSON we got from the server
 * @returns {brightstream.TextMessage}
 */
brightstream.TextMessage = function (params) {
    "use strict";
    params = params || {};
    var that = {};

    /**
     * Parse rawMessage and set attributes required for message delivery
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.parse
     * @private
     */
    var parse = function () {
        if (params.rawMessage) {
            try {
                that.endpointId = params.rawMessage.header.from;
                that.connectionId = params.rawMessage.header.fromConnection;
            } catch (e) {
                throw new Error(e);
            }
            that.message = params.rawMessage.message || params.rawMessage.body;
            if (params.rawMessage.header.channel) {
                that.recipient = params.rawMessage.header.channel;
            }
        } else {
            try {
                that.to = params.endpointId;
                that.toConnection = params.connectionId;
                that.requestConnectionReply = (params.requestConnectionReply === true);
            } catch (e) {
                throw new Error(e);
            }
            that.message = params.message;
        }
    };

    parse();
    return that;
}; // End brightstream.TextMessage

/**
 * Create a new SignalingMessage.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.SignalingMessage
 * @constructor
 * @classdesc A message.
 * @param {string} [endpointId] - If sending, the endpoint ID of the recipient
 * @param {string} [connectionId] - If sending, the connection ID of the recipient
 * @param {string} [signal] - If sending, a message to send
 * @param {object} [rawMessage] - If receiving, the parsed JSON we got from the server
 * @returns {brightstream.SignalingMessage}
 */
brightstream.SignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var that = {};

    /**
     * Parse rawMessage and set attributes required for message delivery
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.parse
     * @private
     */
    var parse = function () {
        if (params.rawMessage) {
            try {
                that.endpointId = params.rawMessage.header.from;
                that.connectionId = params.rawMessage.header.fromConnection;
            } catch (e) {
                throw new Error(e);
            }
            that.signal = JSON.parse(params.rawMessage.signal); // Incoming message
        } else {
            try {
                that.to = params.endpointId;
                that.toConnection = params.connectionId;
            } catch (e) {
                throw new Error(e);
            }
            that.signal = params.signal; // Outgoing message
        }
    };

    parse();
    return that;
}; // End brightstream.SignalingMessage

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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
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
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             */
            clientObj.user.fire('leave', {
                group: group
            });
            deferred.resolve();
        }, function (err) {
            deferred.reject();
        });
        return deferred.promise;
    });

    /**
     * Remove an endpoint from a group
     * @memberof! brightstream.Group
     * @method brightstream.Group.removeEndpoint
     * @param {string} [name] Endpoint name
     * @param {string} [id] Endpoint id
     * @fires brightstream.Group#leave
     */
    var removeEndpoint = group.publicize('removeEndpoint', function (newEndpoint) {
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
                 * @type {brightstream.Event}
                 * @property {brightstream.Endpoint} endpoint
                 */
                group.fire('leave', {
                    endpoint: endpoint
                });
            }
        }
    });

    /**
     * Add an endpoint to a group
     * @memberof! brightstream.Group
     * @method brightstream.Group.addEndpoint
     * @param {string} [name] Endpoint name
     * @param {string} [id] Endpoint id
     * @fires brightstream.Group#join
     */
    var addEndpoint = group.publicize('addEndpoint', function (newEndpoint) {
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
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             * @property {brightstream.Endpoint} endpoint
             */
            group.fire('join', {
                group: group,
                endpoint: newEndpoint
            });
        }
    });

    /**
     * Send a message to the entire group
     * @memberof! brightstream.Group
     * @method brightstream.Group.sendMessage
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
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
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
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
                endpoint = clientObj.getEndpoint(endpoint);
                /**
                 * @event brightstream.Group#join
                 * @type {brightstream.Event}
                 * @property {brightstream.Group} group
                 * @property {brightstream.Endpoint} endpoint
                 */
                group.fire('join', {
                    group: group,
                    endpoint: endpoint
                });
                if (endpointList.indexOf(endpoint.getID()) === -1) {
                    endpointList.push(endpoint.getID());
                    addEndpoint(endpoint);
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