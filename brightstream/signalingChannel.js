/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * The purpose of this class is to make a method call for each API call
 * to the backend REST interface.  This class takes care of App authentication, websocket connection,
 * Endpoint authentication, and all App interactions thereafter.  Almost all methods return a Promise which
 * can be thenned directly, but to abstract that from developers who might prefer not to use Promises, they
 * also take callbacks named onSuccess and onError which the methods attach to the promises themselves so
 * that the developer doesn't have to.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.SignalingChannel
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client - client id
 * @private
 * @returns {brightstream.SignalingChannel}
 */
 /*global brightstream: false */
brightstream.SignalingChannel = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.SignalingChannel
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.SignalingChannel';

    /**
     * @memberof! brightstream.SignalingChannel
     * @name clientObj
     * @private
     * @type {brightstream.Client}
     */
    var clientObj = brightstream.getClient(client);
    /**
     * @memberof! brightstream.SignalingChannel
     * @name state
     * @private
     * @type {string}
     */
    var state = 'new';
    /**
     * @memberof! brightstream.SignalingChannel
     * @name socket
     * @private
     * @type {Socket.io.Socket}
     */
    var socket = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name heartbeat
     * @private
     * @type {number}
     */
    var heartbeat = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name clientSettings
     * @private
     * @type {object}
     */
    var clientSettings = null;
    /**
     * A map to avoid duplicate endpoint presence registrations.
     * @memberof! brightstream.SignalingChannel
     * @name presenceRegistered
     * @private
     * @type {object}
     */
    var presenceRegistered = {};
    /**
     * @memberof! brightstream.SignalingChannel
     * @name baseURL
     * @private
     * @type {string}
     */
    var baseURL = that.baseURL || 'https://collective.brightstream.io';
    delete that.baseURL;
    /**
     * A reference to the private function Client.actuallyConnect that gets set in SignalingChannel.open() so we
     * don't have to make it public.
     * @memberof! brightstream.SignalingChannel
     * @name actuallyConnect
     * @private
     * @type {function}
     */
    var actuallyConnect = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name appId
     * @private
     * @type {string}
     */
    var appId = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name endpointId
     * @private
     * @type {string}
     */
    var endpointId = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name token
     * @private
     * @type {string}
     */
    var token = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name appToken
     * @private
     * @type {string}
     */
    var appToken = null;
    /**
     * @memberof! brightstream.SignalingChannel
     * @name xhr
     * @private
     * @type {XMLHttpRequest}
     */
    var xhr = new XMLHttpRequest();
    /**
     * @memberof! brightstream.SignalingChannel
     * @name routingMethods
     * @private
     * @type {object}
     * @desc The methods contained in this object are statically defined methods that are called by constructing
     * their names dynamically. 'do' + $className + $signalType == 'doCallOffer', et. al.
     */
    var routingMethods = {};
    /**
     * @memberof! brightstream.SignalingChannel
     * @name handlerQueue
     * @private
     * @type {object}
     */
    var handlerQueue = {
        'message': [],
        'signal': [],
        'presence': []
    };
    /**
     * @memberof! brightstream.SignalingChannel
     * @name errors
     * @private
     * @type {object}
     */
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
     * @param {object} params
     * @param {string} [params.token] - The Endpoint's auth token
     * @param {string} [params.appId] - The App's id
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @param {string} [params.developmentMode] - Indicates the library should request a token from the service.
     * App must be set to development mode in your developer portal, and you must pass in your appId & endpointId.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.open = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        log.trace('SignalingChannel.open', params);
        token = params.token || token;
        actuallyConnect = typeof params.actuallyConnect === 'function' ? params.actuallyConnect : actuallyConnect;

        Q.fcall(function () {
            if (params.developmentMode === true && params.appId && params.endpointId) {
                return that.getToken({
                    appId: params.appId,
                    endpointId: params.endpointId
                });
            }
            return null;
        }).then(function (newToken) {
            token = newToken || token;
            if (!token) {
                throw new TypeError("Must pass either endpointID & appId & developmentMode=true, or a token," +
                    " to client.connect().");
            }
            return doOpen({token: token});
        }).done(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Get a developer mode token for an endpoint. App must be in developer mode.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getToken
     * @param {object} params
     * @param {string} [params.appId] - The App's id
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * be set to development mode in your developer portal, and you must pass in your appId.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise<String>}
     */
    that.getToken = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        log.trace('SignalingChannel.getToken', params);

        call({
            path: '/v1/tokens',
            httpMethod: 'POST',
            parameters: {
                appId: params.appId,
                endpointId: params.endpointId,
                ttl: 60 * 60 * 6
            },
            responseHandler: function (response) {
                if (response.code === 200 && response.result && response.result.tokenId) {
                    token = response.result.tokenId;
                    deferred.resolve(response.result.tokenId);
                    return;
                }
                deferred.reject(new Error("Couldn't get a developer mode token."));
            }
        });
        return deferred.promise;
    };

    /**
     * Open a connection to the REST API and validate the app, creating an appauthsession.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.doOpen
     * @param {object} params
     * @param {string} [params.token] - The Endpoint's auth token
     * @param {string} [params.appId] - The App's id
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     * @private
     */
    function doOpen(params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        log.trace('SignalingChannel.doOpen', params);

        call({
            path: '/v1/appauthsessions',
            httpMethod: 'POST',
            parameters: {
                tokenId: params.token
            },
            responseHandler: function (response) {
                if (response.code === 200) {
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
    }

    /**
     * Close a connection to the REST API. Invalidate the appauthsession.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.close
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.close = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        clearInterval(heartbeat);

        wsCall({
            path: '/v1/endpointconnections/%s/',
            httpMethod: 'DELETE',
            objectId: clientObj.user.id
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
    };

    /**
     * Return the state of the signaling channel.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getState
     * @return {string} The state of the signaling channel.
    */
    that.getState = function () {
        return state;
    };

    /**
     * Whether signaling channel is open.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.isOpen
     * @return {boolean}
     */
    that.isOpen = function () {
        return state === 'open';
    };

    /**
     * Generate and send a presence message representing the user's current status. This triggers
     * the server to send the user's endpoint's presence.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendPresence
     * @param {object} params
     * @param {string} params.presence - description, "unavailable", "available", "away", "xa", "dnd"
     * @param {string} [params.status] - Non-enumeration human-readable status.
     * @param {string} [params.show] - I can't remember what this is.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     */
    that.sendPresence = function (params) {
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
    };

    /**
     * Get or create a group in the infrastructure.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getGroup
     * @returns {Promise<brightstream.Group>}
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {string} name
     */
    that.getGroup = function (params) {
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
    };

    /**
     * Join a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.leaveGroup
     * @returns {Promise}
     * @param {object} params
     * @param {string} params.id
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     */
    that.leaveGroup = function (params) {
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
    };

    /**
     * Join a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.joinGroup
     * @returns {Promise}
     * @param {object} params
     * @param {string} params.id
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     */
    that.joinGroup = function (params) {
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
    };

    /**
     * Publish a message to a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.publish
     * @returns {Promise}
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {string} params.id
     * @param {string} params.message
     */
    that.publish = function (params) {
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
    };

    /**
     * Register as an observer of presence for the specified endpoint ids.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.registerPresence
     * @param {object} params
     * @param {Array<string>} params.endpointList
     */
    that.registerPresence = function (params) {
        wsCall({
            httpMethod: 'POST',
            path: '/v1/presenceobservers',
            parameters: {
                endpointList: params.endpointList
            }
        }).done(function () {
            params.endpointList.forEach(function (id) {
                presenceRegistered[id] = true;
            });
        });
    };

    /**
     * Join a group.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getGroupMembers
     * @returns {Promise<Array>}
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {string} params.id
     */
    that.getGroupMembers = function (params) {
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var promise;

        if (!params.id) {
            deferred.reject(new Error("Can't get group's endpoints without group ID."));
            return deferred.promise;
        }

        promise = wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'GET'
        });

        promise.done(function (list) {
            list.forEach(function (params) {
                presenceRegistered[params.endpointId] = true;
            });
        });
        return promise;
    };

    /**
     * Send a chat message.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendMessage
     * @param {object} params
     * @param {brightstream.SignalingMessage} params.message - The string text message to send.
     * @param {brightstream.Endpoint} params.recipient
     * @param {string} [params.connectionId]
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var message = brightstream.TextMessage({
            endpointId: params.recipient.id,
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
    };

    /**
     * Send a signaling message.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendSignal
     * @param {object} params
     * @param {brightstream.SignalingMessage} params.signal
     * @param {string} [params.connectionId]
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.sendSignal = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        params.toConnection = params.connectionId;
        delete params.connectionId;

        if (!params.signal || !params.signal.signal) {
            deferred.reject(new Error("Can't send signal without signal."));
            return deferred.promise;
        }
        if (params.signal.signal.indexOf('target') === -1) {
            deferred.reject(new Error("Can't send signal without target", params.signal));
            return deferred.promise;
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
    };

    /**
     * Send an ICE candidate.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendCandidate
     * @param {object} params
     * @param {brightstream.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {RTCIceCandidate} params.candidate - An ICE candidate to JSONify and send.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.sendCandidate = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        delete params.onSuccess;
        delete params.onError;

        var signalingMessage = {
            endpointId: params.recipient.id,
            connectionId: params.connectionId
        };
        delete params.recipient;
        delete params.connectionId;

        params.type = 'candidate';
        signalingMessage.signal = JSON.stringify(params);

        that.sendSignal({
            signal: brightstream.SignalingMessage(signalingMessage)
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Send an SDP.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendSDP
     * @param {object} params
     * @param {brightstream.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {RTCSessionDescription} params.sdp - An SDP to JSONify and send.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.sendSDP = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        delete params.onSuccess;
        delete params.onError;

        var signalingMessage = {
            endpointId: params.recipient.id,
            connectionId: params.connectionId
        };
        delete params.recipient;
        delete params.connectionId;

        signalingMessage.signal = JSON.stringify(params);

        that.sendSignal({
            signal: brightstream.SignalingMessage(signalingMessage)
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Send a message terminating the WebRTC session.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendBye
     * @param {object} params
     * @param {brightstream.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {string} params.reason - The reason the session is being terminated.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.sendBye = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        delete params.onSuccess;
        delete params.onError;

        var signalingMessage = {
            endpointId: params.recipient.id,
            connectionId: params.connectionId
        };
        delete params.recipient;
        delete params.connectionId;

        params.type = 'bye';
        signalingMessage.signal = JSON.stringify(params);

        that.sendSignal({
            signal: brightstream.SignalingMessage(signalingMessage)
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Send a message to all connection ids indicating we have negotiated a call with one connection.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendConnected
     * @param {object} params
     * @param {brightstream.Endpoint} params.recipient - The recipient.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.sendConnected = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        delete params.onSuccess;
        delete params.onError;

        var signalingMessage = {
            endpointId: params.recipient.id,
            connectionId: params.connectionId
        };
        delete params.recipient;

        params.type = 'connected';
        signalingMessage.signal = JSON.stringify(params);

        that.sendSignal({
            signal: brightstream.SignalingMessage(signalingMessage)
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Send a message to the remote party indicating a desire to renegotiate media.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.sendModify
     * @param {object} params
     * @param {brightstream.Endpoint} params.recipient - The recipient.
     * @param {string} params.action - The state of the modify request, one of: 'initiate', 'accept', 'reject'
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.sendModify = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        delete params.onSuccess;
        delete params.onError;

        var signalingMessage = {
            endpointId: params.recipient.id,
            connectionId: params.connectionId
        };
        delete params.recipient;
        delete params.connectionId;

        params.type = 'modify';
        signalingMessage.signal = JSON.stringify(params);

        that.sendSignal({
            signal: brightstream.SignalingMessage(signalingMessage)
        }).then(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Uppercase the first letter of the word.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.firstUpper
     * @private
     */
    function firstUpper(str) {
        return str[0].toUpperCase() + str.slice(1);
    }

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
     * @fires brightstream.DirectConnection#offer
     * @fires brightstream.DirectConnection#connected
     * @fires brightstream.DirectConnection#answer
     * @fires brightstream.DirectConnection#candidate
     * @fires brightstream.DirectConnection#bye
     * @todo TODO Make the call.set* methods accept the entire message.
     */
    that.routeSignal = function (message) {
        var signal = message.signal;
        var target = null;
        var toCreate;
        var method = 'do';
        var endpoint;
        var knownSignals = ['offer', 'answer', 'connected', 'modify', 'candidate', 'bye'];

        if (signal.type !== 'candidate') { // Too many of these!
            log.verbose(signal.type, signal);
        }

        if (!signal.target || !signal.type || knownSignals.indexOf(signal.type) === -1) {
            log.error("Got malformed signal.", signal);
            throw new Error("Can't route signal without target or type.");
        }

        // Only create if this signal is an offer.

        toCreate = (signal.type === 'offer' && signal.target === 'call');
        target = clientObj.user.getCall({
            id: signal.callId,
            endpointId: message.endpointId,
            create: toCreate
        });

        if (!target) {
            toCreate = (signal.type === 'offer' && signal.target === 'directConnection');
            endpoint = clientObj.getEndpoint({
                id: message.endpointId
            });

            endpoint.getDirectConnection({
                create: toCreate,
                initiator: !toCreate
            }).done(function (directConnection) {
                target = directConnection.call;
                method += firstUpper((knownSignals.indexOf(signal.type) === -1) ? 'unknown' : signal.type);
                routingMethods[method]({
                    call: target,
                    message: message,
                    signal: signal
                });
            }, function (err) {
                throw new Error(err.message);
            });
            return;
        }

        method += firstUpper((knownSignals.indexOf(signal.type) === -1) ? 'unknown' : signal.type);
        routingMethods[method]({
            call: target,
            message: message,
            signal: signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.doOffer
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires brightstream.Call#signal-offer
     */
    routingMethods.doOffer = function (params) {
        params.call.connectionId = params.message.connectionId;
        /**
         * @event brightstream.Call#signal-offer
         * @type {brightstream.Event}
         * @property {object} signal
         */
        clientObj.updateTurnCredentials();
        params.call.fire('signal-offer', {
            signal: params.signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.doConnected
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires brightstream.Call#signal-connected
     */
    routingMethods.doConnected = function (params) {
        /**
         * @event brightstream.Call#signal-connected
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('signal-connected', {
            signal: params.signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.dModify
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires brightstream.Call#signal-modify
     */
    routingMethods.doModify = function (params) {
        /**
         * @event brightstream.Call#signal-modify
         * @type {brightstream.Event}
         * @property {object} signal
         */
        clientObj.updateTurnCredentials();
        params.call.fire('signal-modify', {
            signal: params.signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.doAnswer
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires brightstream.Call#signal-answer
     */
    routingMethods.doAnswer = function (params) {
        params.signal.connectionId = params.message.connectionId;
        /**
         * @event brightstream.Call#signal-answer
         * @type {brightstream.Event}
         * @property {object} signal
         */
        clientObj.updateTurnCredentials();
        params.call.fire('signal-answer', {
            signal: params.signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.doCandidate
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires brightstream.Call#signal-candidate
     */
    routingMethods.doCandidate = function (params) {
        /**
         * @event brightstream.Call#signal-candidate
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('signal-candidate', {
            signal: params.signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.doBye
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires brightstream.Call#signal-bye
     */
    routingMethods.doBye = function (params) {
        // we may receive bye before connectionId is set if the call is rejected
        if (params.call.connectionId && params.call.connectionId !== params.message.connectionId) {
            return;
        }
        /**
         * @event brightstream.Call#signal-bye
         * @type {brightstream.Event}
         * @property {object} signal
         */
        params.call.fire('signal-bye', {
            signal: params.signal
        });
    };

    /**
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.routingMethods.doUnknown
     * @private
     * @params {object} params
     * @params {object} params.signal
     */
    routingMethods.doUnknown = function (params) {
        log.error("Don't know what to do with", params.signal.target, "msg of unknown type", params.signal.type);
    };

    /**
     * Add a handler to the connection for messages of different types.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.addHandler
     * @param {object} params
     * @param {string} params.type - The type of message, e. g., 'iq', 'pres'
     * @param {function} params.handler - A function to which to pass the message
     * @todo TODO See if this is necessary anymore
     */
    that.addHandler = function (params) {
        if (socket.socket && socket.socket.open) {
            socket.on(params.type, params.handler);
        } else {
            handlerQueue[params.type].push(params.handler);
        }
    };

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

        if (message.header.from === clientObj.user.id) {
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
        }
        /**
         * @event brightstream.Client#message
         * @type {brightstream.Event}
         * @property {brightstream.TextMessage} message
         * @property {brightstream.Group} [group] - If the message is to a group we already know about,
         * this will be set. If null, the developer can use client.join({id: evt.message.header.channel}) to join
         * the group. From that point forward, Group#message will fire when a message is received as well. If
         * group is undefined instead of null, the message is not a group message at all.
         */
        clientObj.fire('message', {
            message: groupMessage,
            group: group || null
        });
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
        var connection;

        if (message.endpoint === endpointId) {
            return;
        }

        endpoint = clientObj.getEndpoint({
            id: message.endpoint,
            client: client,
            name: message.endpoint
        });

        connection = endpoint.getConnection({connectionId: message.connectionId});

        // Handle presence not associated with a channel
        if (message.header.channel.indexOf('system') > -1 || !connection) {
            endpoint.setPresence({
                connectionId: message.connectionId
            });
            connection = clientObj.getConnection({
                connectionId: message.connectionId,
                endpointId: message.endpoint
            });
            if (message.header.channel.indexOf('system') > -1) {
                log.error("Still getting these weird join presence messages.", message);
                return;
            }
        }

        if (!presenceRegistered[message.endpoint]) {
            that.registerPresence({endpointList: [message.endpoint]});
        }
        group = clientObj.getGroup({id: message.header.channel});

        if (group && connection) {
            group.addMember({connection: connection});
        } else {
            log.error("Can't add endpoint to group:", message, group, endpoint, connection);
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

        if (message.endpointId === clientObj.user.id) {
            return;
        }

        endpoint = clientObj.getEndpoint({
            id: message.endpointId
        });

        endpoint.connections.every(function (conn, index) {
            if (conn.id === message.connectionId) {
                endpoint.connections.splice(index, 1);
                return false;
            }
            return true;
        });

        group = clientObj.getGroup({id: message.header.channel});
        group.removeMember({connectionId: message.connectionId});
    };

    /**
     * Socket handler for presence messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onMessage
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
        onSuccess = onSuccess || function () {};
        onError = onError || function () {};
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
                onSuccess(brightstream.User({
                    client: client,
                    connectionId: res.id,
                    id: res.endpointId
                }));
            }, onError);
        };
    };

    /**
     * Socket handler for presence messages.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.onPresence
     * @private
     */
    function onPresence(message) {
        var endpoint;
        var groups;

        if (message.header.from === endpointId) {
            // Skip ourselves
            return;
        }
        log.verbose('socket.on presence', message);

        endpoint = clientObj.getEndpoint({
            id: message.header.from,
            client: client,
            name: message.header.from,
            connection: message.header.fromConnection
        });

        endpoint.setPresence({
            connectionId: message.header.fromConnection,
            presence: message.type
        });

        if (endpoint.getPresence() === 'unavailable') {
            var groups = clientObj.getGroups();
            if (groups) {
                groups.forEach(function (group) {
                    group.removeMember({connectionId: message.header.fromConnection});
                });
            }
        }
    }

    /**
     * Authenticate to the cloud and call the handler on state change.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.authenticate
     * @param {object} params
     * @param {function} params.onStatusChange - A function to which to call on every state change.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     */
    that.authenticate = function (params) {
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
         * is doubled up to a maximum of 5 minutes. From then on, it will attempt to reconnect every 5 minutes forever.
         */
        var connectParams = {
            'connect timeout': 2000,
            'reconnection limit': 5 * 60 * 60 * 1000,
            'max reconnection attempts': Infinity,
            'force new connection': true, // Don't try to reuse old connection.
            'sync disconnect on unload': true, // have Socket.io call disconnect() on the browser unload event.
            reconnect: false,
            host: host,
            port: port || '443',
            protocol: protocol,
            secure: (protocol === 'https'),
            query: 'app-token=' + appToken
        };

        socket = io.connect(baseURL + '?app-token=' + appToken, connectParams);

        socket.on('connect', generateConnectHandler(function onSuccess(user) {
            deferred.resolve(user);
            heartbeat = setInterval(function () {
                that.sendMessage({
                    message: 'heartbeat',
                    recipient: {id: 'system-heartbeat'}
                }).done(null, function (err) {
                    if (err.message.indexOf('Not authorized') > -1) {
                        clearInterval(heartbeat);
                        socket.disconnect();
                    }
                });
            }, 5000);
        }, function onError(err) {
            deferred.reject(err);
        }));

        socket.on('join', onJoin);
        socket.on('leave', onLeave);
        socket.on('pubsub', onPubSub);
        socket.on('message', onMessage);
        socket.on('presence', onPresence);

        socket.on('connect_failed', function (res) {
            log.error('Socket.io connect failed.', res || "");
        });

        socket.on('error', function (res) {
            log.trace('Socket.io error.', res || "");
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
            var clientSettings = clientObj.getClientSettings();
            /**
             * @event brightstream.Client#disconnect
             */
            clientObj.fire('disconnect');

            if (clientSettings.reconnect !== true) {
                socket = null;
                return;
            }

            actuallyConnect().then(function (user) {
                clientObj.user = user;
                log.debug('socket reconnected');
                return Q.all(clientObj.getGroups().map(function iterGroups(group) {
                    clientObj.join({
                        id: group.id,
                        onMessage: clientSettings.onMessage,
                        onJoin: clientSettings.onJoin,
                        onLeave: clientSettings.onLeave
                    });
                }));
            }, function onError(err) {
                throw new Error(err.message);
            }).done(function (user) {
                /**
                 * @event brightstream.Client#reconnect
                 */
                clientObj.fire('reconnect');
            }, function (err) {
                throw new Error(err.message);
            });
        });

        return deferred.promise;
    };

    /**
     * Get ephemeral TURN credentials.  This method is called every 20 hours in setInterval
     * in the Client so that credentials are ready to use quickly when a call begins. We
     * don't want to have to wait on a REST request to finish between the user clicking the
     * call button and the call beginning.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.getTurnCredentials
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise<Array>}
     */
    that.getTurnCredentials = function (params) {
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
    };

    /**
     * Construct a websocket API call and return the formatted response and errors. The 'success'
     * attribute indicates the success or failure of the API call. The 'response' attribute
     * is an associative array constructed by json.decode. The 'error' attriute is a message.
     * If the API call is successful but the server returns invalid JSON, error will be
     * "Invalid JSON." and response will be the unchanged content of the response body.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.wsCall
     * @private
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {string} params.httpMethod
     * @param {string} params.path
     * @param {string} params.objectId
     * @param {object} params.parameters
     * @return {Promise<object>}
     */
    function wsCall(params) {
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

        // Too many of these!
        if (params.path.indexOf('messages') === -1 && params.path.indexOf('signaling') === -1) {
            log.verbose('socket request', params.httpMethod, params.path, params.parameters);
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
            // Too many of these!
            if (params.path.indexOf('messages') === -1 && params.path.indexOf('signaling') === -1) {
                log.verbose('socket response', params.httpMethod, params.path, response);
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
    }

    /**
     * Construct an API call and return the formatted response and errors. The 'success'
     * attribute indicates the success or failure of the API call. The 'response' attribute
     * is an associative array constructed by json.decode. The 'error' attriute is a message.
     * If the API call is successful but the server returns invalid JSON, error will be
     * "Invalid JSON." and response will be the unchanged content of the response body.
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.call
     * @private
     * @param {object} params
     * @param {string} params.httpMethod
     * @param {string} params.objectId
     * @param {string} params.path
     * @param {object} params.parameters
     * @param {function} responseHandler
     * @todo TODO change this to return a promise
     */
    function call(params) {
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
                log.verbose('default responseHandler');
                log.verbose(response);
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
                throw new Error("Can't set content-type header in readyState " +
                    xhr.readyState + ". " + e.message);
            }
        } else if (['GET', 'DELETE'].indexOf(params.httpMethod) === -1) {
            throw new Error('Illegal HTTP request method ' + params.httpMethod);
        }
        log.verbose('calling', params.httpMethod, uri, "with params", paramString);

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
            if ([200, 204, 205, 302, 401, 403, 404, 418].indexOf(this.status) > -1) {
                response.code = this.status;
                if (this.response) {
                    try {
                        response.result = JSON.parse(this.response);
                    } catch (e) {
                        response.result = this.response;
                        response.error = "Invalid JSON.";
                    }
                }
                log.verbose(response);
                params.responseHandler(response, {
                    'uri' : uri,
                    'params' : params.parameters
                });
            } else {
                log.warn('unexpected response ' + this.status);
            }
        };
    }

    /**
     * Turn key/value and key/list pairs into an HTTP URL parameter string.
     * var1=value1&var2=value2,value3,value4
     * @memberof! brightstream.SignalingChannel
     * @method brightstream.SignalingChannel.makeParamString
     * @private
     * @param {object} params - Arbitrary collection of strings and arrays to serialize.
     * @returns {string}
     */
    function makeParamString(params) {
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
    }

    return that;
}; // End brightstream.SignalingChannel

/**
 * A text message and the information needed to route it.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.TextMessage
 * @constructor
 * @param {object} params
 * @param {string} [params.endpointId] - If sending, endpoint ID of the thing we're sending a message to.
 * @param {string} [params.connectionId] - If sending, connection ID of the thing we're sending a message to.
 * @param {string} [params.message] - If sending, a message to send
 * @param {object} [params.rawMessage] - If receiving, the parsed JSON we got from the server
 * @private
 * @returns {brightstream.TextMessage}
 */
brightstream.TextMessage = function (params) {
    "use strict";
    params = params || {};
    var that = {};

    /**
     * Parse rawMessage and set attributes required for message delivery.
     * @memberof! brightstream.TextMessage
     * @method brightstream.TextMessage.parse
     * @private
     */
    function parse() {
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
    }

    parse();
    return that;
}; // End brightstream.TextMessage

/**
 * A signaling message and the informaiton needed to route it.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.SignalingMessage
 * @constructor
 * @param {object} params
 * @param {string} [params.endpointId] - If sending, the endpoint ID of the recipient
 * @param {string} [params.connectionId] - If sending, the connection ID of the recipient
 * @param {string} [params.signal] - If sending, a message to send
 * @param {object} [params.rawMessage] - If receiving, the parsed JSON we got from the server
 * @private
 * @returns {brightstream.SignalingMessage}
 */
brightstream.SignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var that = {};

    /**
     * Parse rawMessage and set attributes required for message delivery.
     * @memberof! brightstream.SignalingMessage
     * @method brightstream.SignalingMessage.parse
     * @private
     */
    function parse() {
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
    }

    parse();
    return that;
}; // End brightstream.SignalingMessage

/**
 * A group, representing a collection of endpoints and the method by which to communicate with them.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Group
 * @constructor
 * @param {object} params
 * @param {function} params.onJoin - A callback to receive notifications every time a new endpoint has joined
 * the group. This callback does not get called when the currently logged-in user joins the group.
 * @param {function} params.onMessage - A callback to receive messages sent to the group from remote endpoints.
 * @param {function} params.onLeave - A callback to receive notifications every time a new endpoint has left
 * the group. This callback does not get called when the currently logged-in user leaves the group.
 * @returns {brightstream.Group}
 */
brightstream.Group = function (params) {
    "use strict";
    params = params || {};

    var that = brightstream.EventEmitter(params);
    /**
     * @memberof! brightstream.Group
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var clientObj = brightstream.getClient(client);
    var signalingChannel = clientObj.getSignalingChannel();

    if (!that.id) {
        throw new Error("Can't create a group without an ID.");
    }

    /**
     * @memberof! brightstream.Group
     * @name endpoints
     * @type {array<brightstream.Endpoint>}
     * @desc A list of the members of this group.
     */
    that.connections = [];
    /**
     * A name to identify the type of this object.
     * @memberof! brightstream.group
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Group';
    that.listen('join', params.onJoin);
    that.listen('message', params.onMessage);
    that.listen('leave', params.onLeave);
    clientObj.listen('disconnect', function () {
        that.connections = [];
    });

    delete that.client;
    delete that.onMessage;
    delete that.onPresence;
    delete that.onJoin;
    delete that.onLeave;

    /**
     * Leave this group.
     * @memberof! brightstream.Group
     * @method brightstream.Group.leave
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @return {Promise}
     * @fires brightstream.User#leave
     */
    that.leave = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var clientObj = brightstream.getClient(client);
        signalingChannel.leaveGroup({
            id: that.id
        }).done(function () {
            /**
             * This event is fired when the currently logged-in user leaves a group.
             * @event brightstream.User#leave
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             */
            clientObj.user.fire('leave', {
                group: that
            });
            deferred.resolve();
        }, function (err) {
            deferred.reject();
        });
        return deferred.promise;
    };

    /**
     * Remove a Connection from a Group. This does not change the status of the remote Endpoint, it only changes the
     * internal representation of the Group membership. This method should only be used internally.
     * @private
     * @memberof! brightstream.Group
     * @method brightstream.Group.removeMember
     * @param {object} params
     * @param {string} [params.connectionId] - Endpoint's connection id
     * @fires brightstream.Group#leave
     */
    that.removeMember = function (params) {
        params = params || {};
        if (!params.connectionId) {
            throw new Error("Can't remove a Connection from a group without an id.");
        }
        that.connections.every(function (conn, index) {
            if (conn.id === params.connectionId) {
                that.connections.splice(index, 1);

                /**
                 * This event is fired when a member leaves a group the currently logged-in user is a member of.
                 * @event brightstream.Group#leave
                 * @type {brightstream.Event}
                 * @property {brightstream.Connection} connection
                 */
                that.fire('leave', {
                    connection: conn
                });
                return false;
            }
            return true;
        });
    };

    /**
     * Add a Connection to a group. This does not change the status of the remote Endpoint, it only changes the
     * internal representation of the Group membership. This method should only be used internally.
     * @memberof! brightstream.Group
     * @private
     * @method brightstream.Group.addMember
     * @param {object} params
     * @param {brightstream.Connection} params.connection
     * @fires brightstream.Group#join
     */
    that.addMember = function (params) {
        params = params || {};
        var foundConn;
        var absent;

        if (!params.connection) {
            throw new Error("Can't add member to a group without a connection.");
        }

        absent = that.connections.every(function (conn) {
            return (conn.id !== params.connection.id);
        });

        if (absent) {
            that.connections.push(params.connection);
            /**
             * This event is fired when a member joins a Group that the currently logged-in endpoint is a member
             * of.
             * @event brightstream.Group#join
             * @type {brightstream.Event}
             * @property {brightstream.Group} group
             * @property {brightstream.Connection} connection
             */
            that.fire('join', {
                group: that,
                connection: params.connection
            });
        }
    };

    /**
     * Send a message to the entire group.
     * @memberof! brightstream.Group
     * @method brightstream.Group.sendMessage
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {string} params.message - The message.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        params.id = that.id;
        return signalingChannel.publish(params);
    };

    /**
     * Get an array containing the members of the group.
     * @memberof! brightstream.Group
     * @method brightstream.Group.getMembers
     * @returns {Promise<Array>} A promise to an array of Connections.
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {function} [onMessage] TODO
     * @param {function} [onPresence] TODO
     * @fires brightstream.Group#join
     */
    that.getMembers = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var clientObj = brightstream.getClient(client);

        if (that.connections.length > 0) {
            deferred.resolve(that.connections);
            return deferred.promise;
        }

        signalingChannel.getGroupMembers({
            id: that.id
        }).done(function (list) {
            var endpointList = [];
            list.forEach(function (params) {
                var connection = clientObj.getConnection({
                    endpointId: params.endpointId,
                    connectionId: params.connectionId
                });

                if (endpointList.indexOf(params.endpointId) === -1) {
                    endpointList.push(params.endpointId);
                }
                that.addMember({connection: connection});
            });

            if (endpointList.length > 0) {
                signalingChannel.registerPresence({
                    endpointList: endpointList
                });
            }
            deferred.resolve(that.connections);
        }, function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    };

    return that;
}; // End brightstream.Group
