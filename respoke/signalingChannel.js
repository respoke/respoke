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
 * Endpoint authentication, and all App interactions thereafter.  Almost all methods return a Promise.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.SignalingChannel
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId - client id
 * @private
 * @returns {respoke.SignalingChannel}
 */
 /*global respoke: false */
respoke.SignalingChannel = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.SignalingChannel
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    /**
     * @memberof! respoke.SignalingChannel
     * @name className
     * @type {string}
     */
    that.className = 'respoke.SignalingChannel';

    /**
     * @memberof! respoke.SignalingChannel
     * @name client
     * @private
     * @type {respoke.Client}
     */
    var client = respoke.getClient(instanceId);
    /**
     * The state of the signaling channel.
     * @memberof! respoke.SignalingChannel
     * @name state
     * @type {boolean}
     */
    that.connected = false;
    /**
     * @memberof! respoke.SignalingChannel
     * @name socket
     * @private
     * @type {Socket.io.Socket}
     */
    var socket = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name heartbeat
     * @private
     * @type {number}
     */
    var heartbeat = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name clientSettings
     * @private
     * @type {object}
     */
    var clientSettings = params.clientSettings;
    delete that.clientSettings;
    clientSettings.baseURL = clientSettings.baseURL || 'https://api.respoke.io';
    /**
     * A map to avoid duplicate endpoint presence registrations.
     * @memberof! respoke.SignalingChannel
     * @name presenceRegistered
     * @private
     * @type {object}
     */
    var presenceRegistered = {};
    /**
     * A reference to the private function Client.actuallyConnect that gets set in SignalingChannel.open() so we
     * don't have to make it public.
     * @memberof! respoke.SignalingChannel
     * @name actuallyConnect
     * @private
     * @type {function}
     */
    var actuallyConnect = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name reconnectTimeout
     * @private
     * @type {number}
     */
    var reconnectTimeout = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name maxReconnectTimeout
     * @private
     * @type {number}
     */
    var maxReconnectTimeout = 5 * 60 * 1000;
    /**
     * @memberof! respoke.SignalingChannel
     * @name appId
     * @private
     * @type {string}
     */
    var appId = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name endpointId
     * @private
     * @type {string}
     */
    var endpointId = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name token
     * @private
     * @type {string}
     */
    var token = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name appToken
     * @private
     * @type {string}
     */
    var appToken = null;
    /**
     * @memberof! respoke.SignalingChannel
     * @name xhr
     * @private
     * @type {XMLHttpRequest}
     */
    var xhr = new XMLHttpRequest();
    /**
     * @memberof! respoke.SignalingChannel
     * @name routingMethods
     * @private
     * @type {object}
     * @desc The methods contained in this object are statically defined methods that are called by constructing
     * their names dynamically. 'do' + $className + $signalType == 'doCallOffer', et. al.
     */
    var routingMethods = {};
    /**
     * @memberof! respoke.SignalingChannel
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
     * @memberof! respoke.SignalingChannel
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
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.open
     * @param {object} params
     * @param {string} [params.token] - The Endpoint's auth token
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @return {Promise}
     */
    that.open = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.trace('SignalingChannel.open', params, clientSettings);
        token = params.token || token;
        actuallyConnect = typeof params.actuallyConnect === 'function' ? params.actuallyConnect : actuallyConnect;

        Q.fcall(function tokenPromise() {
            if (clientSettings.developmentMode === true && clientSettings.appId && params.endpointId) {
                return that.getToken({
                    appId: clientSettings.appId,
                    endpointId: params.endpointId
                });
            }
            return null;
        }).then(function successHandler(newToken) {
            token = newToken || token;
            return doOpen({token: token});
        }).done(function successHandler() {
            deferred.resolve();
            log.verbose('client', client);
        }, function errorHandler(err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Get a developer mode token for an endpoint. App must be in developer mode.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.getToken
     * @param {object} params
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @return {Promise<String>}
     */
    that.getToken = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.trace('SignalingChannel.getToken', params);

        call({
            path: '/v1/tokens',
            httpMethod: 'POST',
            parameters: {
                appId: clientSettings.appId,
                endpointId: params.endpointId,
                ttl: 60 * 60 * 6
            },
            responseHandler: function responseHandler(response) {
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
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.doOpen
     * @param {object} params
     * @param {string} params.token - The Endpoint's auth token
     * @return {Promise}
     * @private
     */
    function doOpen(params) {
        params = params || {};
        var deferred = Q.defer();
        log.trace('SignalingChannel.doOpen', params);

        if (!params.token) {
            deferred.reject(new Error("Can't open connection to Respoke without a token."));
            return deferred.promise;
        }

        call({
            path: '/v1/appauthsessions',
            httpMethod: 'POST',
            parameters: {
                tokenId: params.token
            },
            responseHandler: function responseHandler(response) {
                if (response.code === 200) {
                    appToken = response.result.token;
                    deferred.resolve();
                    log.trace("Signaling connection open to", clientSettings.baseURL);
                    that.connected = true;
                } else {
                    that.connected = false;
                    deferred.reject(new Error("Couldn't authenticate app."));
                }
            }
        });

        return deferred.promise;
    }

    /**
     * Close a connection to the REST API. Invalidate the appauthsession.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.close
     * @param {object} params
     * @return {Promise}
     */
    that.close = function (params) {
        params = params || {};
        var deferred = Q.defer();
        clearInterval(heartbeat);

        wsCall({
            path: '/v1/endpointconnections/%s/',
            httpMethod: 'DELETE',
            objectId: client.endpointId
        }).fin(function finallyHandler() {
            call({
                path: '/v1/appauthsessions',
                httpMethod: 'DELETE',
                responseHandler: function responseHandler(response) {
                    socket.removeAllListeners();
                    socket.disconnect();
                    that.connected = false;
                    deferred.resolve();
                }
            });
        });

        return deferred.promise;
    };

    /**
     * Generate and send a presence message representing the client's current status. This triggers
     * the server to send the client's endpoint's presence.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendPresence
     * @param {object} params
     * @param {string} params.presence - description, "unavailable", "available", "away", "xa", "dnd"
     * @param {string} [params.status] - Non-enumeration human-readable status.
     * @param {string} [params.show] - I can't remember what this is.
     * @returns {Promise}
     */
    that.sendPresence = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.trace("Signaling sendPresence");

        wsCall({
            path: '/v1/presence',
            httpMethod: 'POST',
            parameters: {
                'presence': {
                    show: params.show,
                    'status': params.status,
                    type: params.presence || "available"
                }
            }
        }).done(function successHandler() {
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return deferred.promise;
    };

    /**
     * Get or create a group in the infrastructure.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.getGroup
     * @returns {Promise<respoke.Group>}
     * @param {object} params
     * @param {string} name
     */
    that.getGroup = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.trace('signalingChannel.getGroup');

        wsCall({
            httpMethod: 'POST',
            path: '/v1/channels/',
            parameters: {
                name: params.name
            }
        }).then(function successHandler(group) {
            deferred.resolve(group);
        }, function errorHandler(err) {
            // Group was already created, just return back the same params we were given.
            deferred.resolve({id: params.name});
        });

        return deferred.promise;
    };

    /**
     * Join a group.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.leaveGroup
     * @returns {Promise}
     * @param {object} params
     * @param {string} params.id
     */
    that.leaveGroup = function (params) {
        params = params || {};
        var deferred = Q.defer();

        wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'DELETE'
        }).done(function successHandler() {
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Join a group.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.joinGroup
     * @returns {Promise}
     * @param {object} params
     * @param {string} params.id
     */
    that.joinGroup = function (params) {
        params = params || {};
        var deferred = Q.defer();

        wsCall({
            path: '/v1/channels/%s/subscribers/',
            objectId: params.id,
            httpMethod: 'POST'
        }).done(function successHandler() {
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Publish a message to a group.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.publish
     * @returns {Promise}
     * @param {object} params
     * @param {string} params.id
     * @param {string} params.message
     */
    that.publish = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var message = respoke.TextMessage({
            endpointId: params.id,
            message: params.message
        });

        wsCall({
            path: '/v1/channels/%s/publish/',
            objectId: params.id,
            httpMethod: 'POST',
            parameters: message
        }).done(function successHandler() {
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return deferred.promise;
    };

    /**
     * Register as an observer of presence for the specified endpoint ids.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.registerPresence
     * @param {object} params
     * @param {Array<string>} params.endpointList
     */
    that.registerPresence = function (params) {
        return wsCall({
            httpMethod: 'POST',
            path: '/v1/presenceobservers',
            parameters: {
                endpointList: params.endpointList
            }
        }).then(function successHandler() {
            params.endpointList.forEach(function eachId(id) {
                presenceRegistered[id] = true;
            });
        });
    };

    /**
     * Join a group.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.getGroupMembers
     * @returns {Promise<Array>}
     * @param {object} params
     * @param {string} params.id
     */
    that.getGroupMembers = function (params) {
        var deferred = Q.defer();
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

        promise.done(function successHandler(list) {
            list.forEach(function eachSubscriber(params) {
                presenceRegistered[params.endpointId] = true;
            });
        });
        return promise;
    };

    /**
     * Send a chat message.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendMessage
     * @param {object} params
     * @param {respoke.SignalingMessage} params.message - The string text message to send.
     * @param {respoke.Endpoint} params.recipient
     * @param {string} [params.connectionId]
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var message = respoke.TextMessage({
            endpointId: params.recipient.id,
            connectionId: params.connectionId,
            message: params.message
        });

        wsCall({
            path: '/v1/messages',
            httpMethod: 'POST',
            parameters: message
        }).then(function successHandler() {
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return deferred.promise;
    };

    /**
     * Send an ACK signal to acknowlege reception of a signal.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendACK
     * @param {object} params
     * @param {respoke.SignalingMessage} params.signal
     * @return {Promise}
     */
    that.sendACK = function (params) {
        var endpoint;
        params = params || {};
        if (!params.signal) {
            return Q.reject("Can't send ACK, no signal was given.");
        }

        endpoint = client.getEndpoint({id: params.signal.endpointId});
        if (!endpoint) {
            return Q.reject("Can't send ACK, can't get endpoint.");
        }

        return that.sendSignal({
            recipient: endpoint,
            signalType: 'ack',
            signalId: params.signal.signalId,
            sessionId: params.signal.sessionId,
            target: params.signal.target,
            ackedSignalType: params.signal.signalType
        });
    };

    /**
     * Send a signaling message.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendSignal
     * @param {object} params
     * @param {respoke.Call} [params.call] - For getting the sessionId & connectionId. Not required for 'ack'.
     * @return {Promise}
     */
    that.sendSignal = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var signal;

        if (params.call) {
            params.sessionId = params.call.id;
            if (params.call.connectionId) { // the recipient's connectionId
                params.connectionId = params.call.connectionId;
            }
        }

        try {
            params.signalId = respoke.makeGUID();
            // This will strip off non-signaling attributes.
            signal = respoke.SignalingMessage(params);
        } catch (e) {
            deferred.reject(e);
            return deferred.promise;
        }

        wsCall({
            path: '/v1/signaling',
            httpMethod: 'POST',
            parameters: {
                signal: JSON.stringify(signal),
                to: signal.to,
                toConnection: signal.toConnection
            }
        }).done(function successHandler() {
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Send an ICE candidate.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendCandidate
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {Array<RTCIceCandidate>} params.iceCandidates - An array of ICE candidate.
     * @return {Promise}
     */
    that.sendCandidate = function (params) {
        params = params || {};
        params.signalType = 'iceCandidates';
        return that.sendSignal(params);
    };

    /**
     * Send an SDP.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendSDP
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {RTCSessionDescription} params.sdp - An SDP to JSONify and send.
     * @return {Promise}
     */
    that.sendSDP = function (params) {
        params = params || {};
        if (['offer', 'answer'].indexOf(params.signalType) === -1) {
            return Q.reject("Not an SDP type signal.");
        }

        return that.sendSignal(params);
    };

    /**
     * Send a call report to the cloud infrastructure.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendReport
     * @param {object} params
     * @todo TODO document the params.
     * @return {Promise}
     */
    that.sendReport = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var message = {
            debugData: params
        };

        wsCall({
            path: '/v1/calldebugs',
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
     * Send a message hanging up the WebRTC session.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendHangup
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {string} params.reason - The reason the session is being hung up.
     * @return {Promise}
     */
    that.sendHangup = function (params) {
        params = params || {};
        params.signalType = 'hangup';
        return that.sendSignal(params);
    };

    /**
     * Send a message to all connection ids indicating we have negotiated a call with one connection.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendConnected
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @return {Promise}
     */
    that.sendConnected = function (params) {
        params = params || {};
        params.signalType = 'connected';
        return that.sendSignal(params);
    };

    /**
     * Send a message to the remote party indicating a desire to renegotiate media.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendModify
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} params.action - The state of the modify request, one of: 'initiate', 'accept', 'reject'
     * @return {Promise}
     */
    that.sendModify = function (params) {
        params = params || {};
        params.signalType = 'modify';
        if (['initiate', 'accept', 'reject'].indexOf(params.action) === -1) {
            return Q.reject("No valid action in modify signal.");
        }
        return that.sendSignal(params);
    };

    /**
     * Uppercase the first letter of the word.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.firstUpper
     * @private
     */
    function firstUpper(str) {
        return str[0].toUpperCase() + str.slice(1);
    }

    /**
     * Route different types of signaling messages via events.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routeSignal
     * @param {respoke.SignalingMessage} message - A message to route
     * @fires respoke.Call#offer
     * @fires respoke.Call#connected
     * @fires respoke.Call#answer
     * @fires respoke.Call#iceCandidates
     * @fires respoke.Call#hangup
     * @fires respoke.DirectConnection#offer
     * @fires respoke.DirectConnection#connected
     * @fires respoke.DirectConnection#answer
     * @fires respoke.DirectConnection#iceCandidates
     * @fires respoke.DirectConnection#hangup
     */
    that.routeSignal = function (signal) {
        var target = null;
        var toCreate;
        var method = 'do';

        if (signal.signalType !== 'iceCandidates') { // Too many of these!
            log.verbose(signal.signalType, signal);
        }

        // Only create if this signal is an offer.
        Q.fcall(function makePromise() {
            toCreate = (signal.signalType === 'offer');
            /*
             * This will return calls regardless of whether they are associated
             * with a direct connection or not, and it will create a call if no
             * call is found and this signal is an offer. Direct connections get
             * created in the next step.
             */
            target = client.getCall({
                id: signal.sessionId,
                endpointId: signal.endpointId,
                create: (toCreate && signal.target === 'call')
            });
            return target;
        }).then(function successHandler(target) {
            if (!target && signal.target === 'directConnection') {
                // return a promise
                return client.getEndpoint({
                    id: signal.endpointId
                }).startDirectConnection({
                    id: signal.sessionId,
                    create: (signal.signalType === 'offer'),
                    caller: (signal.signalType !== 'offer')
                });
            }
            /*
             * Return the call from the previous promise. This might also return
             * null if we have no record of this call and the signal wasn't an offer (thus
             * we weren't supposed to create it).
             */
            return target;
        }).done(function successHandler(target) {
            // target might be null, a Call, or a DirectConnection.
            if (target) {
                target = target.call || target;
            }
            if (!target || target.id !== signal.sessionId) {
                // orphaned signal
                log.warn("Couldn't associate signal with a call.", signal);
                return;
            }

            method += firstUpper(signal.signalType);
            routingMethods[method]({
                call: target,
                signal: signal
            });
        }, null);
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.doOffer
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-offer
     */
    routingMethods.doOffer = function (params) {
        params.call.connectionId = params.signal.connectionId;
        /**
         * @event respoke.Call#signal-offer
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        params.call.fire('signal-offer', {
            signal: params.signal
        });
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.doConnected
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-connected
     */
    routingMethods.doConnected = function (params) {
        /**
         * @event respoke.Call#signal-connected
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        params.call.fire('signal-connected', {
            signal: params.signal
        });
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.dModify
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-modify
     */
    routingMethods.doModify = function (params) {
        /**
         * @event respoke.Call#signal-modify
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        params.call.fire('signal-modify', {
            signal: params.signal
        });
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.doAnswer
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-answer
     */
    routingMethods.doAnswer = function (params) {
        params.call.connectionId = params.signal.connectionId;
        /**
         * @event respoke.Call#signal-answer
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        params.call.fire('signal-answer', {
            signal: params.signal
        });
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.doIceCandidates
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-icecandidates
     */
    routingMethods.doIceCandidates = function (params) {
        /**
         * @event respoke.Call#signal-icecandidates
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        params.call.fire('signal-icecandidates', {
            signal: params.signal
        });
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.doHangup
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-hangup
     */
    routingMethods.doHangup = function (params) {
        /**
         *  We may receive hangup from one or more parties after connectionId is set if the call is rejected
         *  by a connection that didn't win the call. In this case, we have to ignore the signal since
         *  we are already on a call. TODO: this should really be inside PeerConnection.
         */
        if (params.call.connectionId && params.call.connectionId !== params.signal.connectionId) {
            return;
        }
        /**
         * @event respoke.Call#signal-hangup
         * @type {respoke.Event}
         * @property {object} signal
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        params.call.fire('signal-hangup', {
            signal: params.signal
        });
    };

    /**
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.routingMethods.doUnknown
     * @private
     * @params {object} params
     * @params {object} params.signal
     */
    routingMethods.doUnknown = function (params) {
        log.error("Don't know what to do with", params.signal.target, "msg of unknown type", params.signal.signalType);
    };

    /**
     * Add a handler to the connection for messages of different types.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.addHandler
     * @param {object} params
     * @param {string} params.type - The type of socket message, i. e., 'message', 'presence', 'join'
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
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onPubSub
     * @param {object} The Socket.io message.
     * @private
     * @fires respoke.Group#message
     * @fires respoke.Client#message
     */
    var onPubSub = function onPubSub(message) {
        var group;
        var groupMessage;

        if (message.header.from === client.endpointId) {
            return;
        }

        groupMessage = respoke.TextMessage({
            rawMessage: message
        });

        group = client.getGroup({id: message.header.channel});
        if (group) {
            /**
             * @event respoke.Group#message
             * @type {respoke.Event}
             * @property {respoke.TextMessage} message
             * @property {string} name - the event name.
             * @property {respoke.Group} target
             */
            group.fire('message', {
                message: groupMessage
            });
        }
        /**
         * @event respoke.Client#message
         * @type {respoke.Event}
         * @property {respoke.TextMessage} message
         * @property {respoke.Group} [group] - If the message is to a group we already know about,
         * this will be set. If null, the developer can use client.join({id: evt.message.header.channel}) to join
         * the group. From that point forward, Group#message will fire when a message is received as well. If
         * group is undefined instead of null, the message is not a group message at all.
         * @property {string} name - the event name.
         * @property {respoke.Client} target
         */
        client.fire('message', {
            message: groupMessage,
            group: group || null
        });
    };

    /**
     * Socket handler for join messages.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onJoin
     * @param {object} The Socket.io message.
     * @private
     */
    var onJoin = function onJoin(message) {
        var group;
        var presenceMessage;
        var endpoint;
        var connection;

        if (message.endpoint === client.endpointId) {
            return;
        }

        endpoint = client.getEndpoint({
            id: message.endpoint,
            instanceId: instanceId,
            name: message.endpoint
        });

        connection = endpoint.getConnection({connectionId: message.connectionId});

        // Handle presence not associated with a channel
        if (message.header.channel.indexOf('system') > -1 || !connection) {
            endpoint.setPresence({
                connectionId: message.connectionId
            });
            connection = client.getConnection({
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
        group = client.getGroup({id: message.header.channel});

        if (group && connection) {
            group.addMember({connection: connection});
        } else {
            log.error("Can't add endpoint to group:", message, group, endpoint, connection);
        }
    };

    /**
     * Socket handler for leave messages.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onLeave
     * @param {object} The Socket.io message.
     * @private
     */
    var onLeave = function onLeave(message) {
        var group;
        var presenceMessage;
        var endpoint;

        if (message.endpoint === client.endpointId) {
            return;
        }

        endpoint = client.getEndpoint({
            id: message.endpoint
        });

        endpoint.connections.every(function eachConnection(conn, index) {
            if (conn.id === message.connectionId) {
                endpoint.connections.splice(index, 1);
                return false;
            }
            return true;
        });

        group = client.getGroup({id: message.header.channel});
        group.removeMember({connectionId: message.connectionId});
    };

    /**
     * Socket handler for presence messages.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onMessage
     * @param {object} The Socket.io message.
     * @private
     * @fires respoke.Endpoint#message
     * @fires respoke.Client#message
     */
    var onMessage = function onMessage(message) {
        var endpoint;
        message = respoke.TextMessage({rawMessage: message});
        if (message.endpointId) {
            endpoint = client.getEndpoint({
                id: message.endpointId,
                skipCreate: true
            });
        }
        if (endpoint) {
            /**
             * @event respoke.Endpoint#message
             * @type {respoke.Event}
             * @property {respoke.TextMessage} message
             * @property {string} name - the event name.
             * @property {respoke.Endpoint} target
             */
            endpoint.fire('message', {
                message: message
            });
        }
        /**
         * @event respoke.Client#message
         * @type {respoke.Event}
         * @property {respoke.TextMessage} message
         * @property {respoke.Endpoint} [endpoint] - If the message is from an endpoint we already know about,
         * this will be set. If null, the developer can use client.getEndpoint({id: evt.message.endpointId}) to get
         * the Endpoint. From that point forward, Endpoint#message will fire when a message is received as well.
         * @property {string} name - the event name.
         * @property {respoke.Client} target
         */
        client.fire('message', {
            endpoint: endpoint || null,
            message: message
        });
    };

    /**
     * Create a socket handler for the onConnect event with all the right things in scope.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.generateConnectHandler
     * @param {respoke.Client.successHandler} [onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [onError] - Error handler for this invocation of this
     * method only.
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
            }).then(function successHandler(res) {
                log.debug('endpointconnections result', res);
                client.endpointId = res.endpointId;
                client.connectionId = res.id;
                onSuccess();
            }, onError);
        };
    };

    /**
     * Socket handler for presence messages.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onPresence
     * @param {object} The Socket.io message.
     * @private
     */
    function onPresence(message) {
        var endpoint;
        var groups;

        if (message.header.from === client.endpointId) {
            // Skip ourselves
            return;
        }
        log.verbose('socket.on presence', message);

        endpoint = client.getEndpoint({
            id: message.header.from,
            instanceId: instanceId,
            name: message.header.from,
            connection: message.header.fromConnection
        });

        endpoint.setPresence({
            connectionId: message.header.fromConnection,
            presence: message.type
        });

        if (endpoint.getPresence() === 'unavailable') {
            var groups = client.getGroups();
            if (groups) {
                groups.forEach(function eachGroup(group) {
                    group.removeMember({connectionId: message.header.fromConnection});
                });
            }
        }
    }

    /*
    * On reconnect, start with a reconnect interval of 500ms. Every time reconnect fails, the interval
    * is doubled up to a maximum of 5 minutes. From then on, it will attempt to reconnect every 5 minutes forever.
    * @memberof! respoke.SignalingChannel
    * @method respoke.SignalingChannel.reconnect
    * @private
    */
    function reconnect() {
        reconnectTimeout = (reconnectTimeout === null) ? 500 : 2 * reconnectTimeout;

        if (reconnectTimeout > (maxReconnectTimeout)) {
            reconnectTimeout = maxReconnectTimeout;
        }

        setTimeout(function actuallyReconnect() {
            actuallyConnect().then(function successHandler() {
                reconnectTimeout = null;
                log.debug('socket reconnected');
                return Q.all(client.getGroups().map(function iterGroups(group) {
                    client.join({
                        id: group.id,
                        onMessage: clientSettings.onMessage,
                        onJoin: clientSettings.onJoin,
                        onLeave: clientSettings.onLeave
                    });
                }));
            }).done(function successHandler(user) {
                /**
                 * @event respoke.Client#reconnect
                 * @property {string} name - the event name.
                 * @property {respoke.Client}
                 */
                client.fire('reconnect');
            }, function (err) {
                log.error("Couldn't rejoin previous groups.", err.message, err.stack);
            });
        }, reconnectTimeout);
    }

    /**
     * Authenticate to the cloud and call the handler on state change.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.authenticate
     * @param {object} params
     * @return {Promise}
     */
    that.authenticate = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var pieces = [];
        var protocol = null;
        var host = null;
        var port = null;

        if (!appToken) {
            deferred.reject(new Error("Can't open a websocket without an app token."));
        }

        pieces = clientSettings.baseURL.split(/:\/\//);
        protocol = pieces[0];
        pieces = pieces[1].split(/:/);
        host = pieces[0];
        port = pieces[1];

        /*
         * Try to connect for 2 seconds before failing.
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

        socket = io.connect(clientSettings.baseURL + '?app-token=' + appToken, connectParams);

        socket.on('connect', generateConnectHandler(function onSuccess() {
            deferred.resolve();
            heartbeat = setInterval(function heartbeatHandler() {
                that.sendMessage({
                    message: 'heartbeat',
                    recipient: {id: 'system-heartbeat'}
                }).done(null, function errorHandler(err) {
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

        socket.on('connect_failed', function connectFailedHandler(res) {
            log.error('Socket.io connect failed.', res || "");
            reconnect();
        });

        socket.on('error', function errorHandler(res) {
            log.trace('Socket.io error.', res || "");
            if (!client.connected) {
                reconnect();
            }
        });

        that.addHandler({
            type: 'signal',
            handler: function signalHandler(message) {
                var knownSignals = ['offer', 'answer', 'connected', 'modify', 'iceCandidates', 'hangup'];
                var signal = respoke.SignalingMessage({
                    rawMessage: message
                });

                if (signal.signalType === 'ack') {
                    return;
                }

                if (!signal.target || !signal.signalType || knownSignals.indexOf(signal.signalType) === -1) {
                    log.error("Got malformed signal.", signal);
                    throw new Error("Can't route signal without target or type.");
                }

                that.routeSignal(signal);
            }
        });

        socket.on('disconnect', function onDisconnect() {
            /**
             * @event respoke.Client#disconnect
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            client.fire('disconnect');

            if (clientSettings.reconnect !== true) {
                socket = null;
                return;
            }
            reconnect();
        });

        return deferred.promise;
    };

    /**
     * Get ephemeral TURN credentials.  This method is called whenever a call is either
     * sent or received, prior to creating a PeerConnection
     *
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.getTurnCredentials
     * @return {Promise<Array>}
     */
    that.getTurnCredentials = function () {
        var deferred = Q.defer();

        wsCall({
            httpMethod: 'GET',
            path: '/v1/turn'
        }).done(function successHandler(creds) {
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

            log.debug('TURN creds', result);
            deferred.resolve(result);
        }, function errorHandler(err) {
            deferred.reject(err);
        });

        return deferred.promise;
    }

    /**
     * Construct a websocket API call and return the formatted response and errors. The 'success'
     * attribute indicates the success or failure of the API call. The 'response' attribute
     * is an associative array constructed by json.decode. The 'error' attriute is a message.
     * If the API call is successful but the server returns invalid JSON, error will be
     * "Invalid JSON." and response will be the unchanged content of the response body.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.wsCall
     * @private
     * @param {object} params
     * @param {string} params.httpMethod
     * @param {string} params.path
     * @param {string} params.objectId
     * @param {object} params.parameters
     * @return {Promise<object>}
     */
    function wsCall(params) {
        params = params || {};
        var deferred = Q.defer();
        var requestTimer = setTimeout(function () {
            log.error('request timeout');
            socket.disconnect();
            deferred.reject(new Error("Request timeout. Disconnecting."));
        }, 10 * 1000);

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
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

        socket.emit(params.httpMethod, JSON.stringify({
            url: params.path,
            data: params.parameters,
            headers: {'App-Token': appToken}
        }), function handleResponse(response) {
            clearTimeout(requestTimer);
            // Too many of these!
            if (params.path.indexOf('messages') === -1 && params.path.indexOf('signaling') === -1) {
                log.verbose('socket response', params.httpMethod, params.path, response);
            }

            try {
                response = JSON.parse(response);
            } catch (e) {
                deferred.reject(new Error("Server response could not be parsed!"));
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
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.call
     * @private
     * @param {object} params
     * @param {string} params.httpMethod
     * @param {string} params.objectId
     * @param {string} params.path
     * @param {object} params.parameters
     * @param {respoke.SignalingChannel.responseHandler} responseHandler
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

        uri = clientSettings.baseURL + params.path;

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
                    xhr.setRequestHeader("App-Token", appToken);
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
                throw new Error("Status is 0: Incomplete request, SSL error, or CORS error.");
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
                throw new Error('unexpected response ' + this.status);
            }
        };
    }

    /**
     * Turn key/value and key/list pairs into an HTTP URL parameter string.
     * var1=value1&var2=value2,value3,value4
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.makeParamString
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
            if (value instanceof Array) {
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

    return {signalingChannel: that};
}; // End respoke.SignalingChannel
/**
 * Handle an error that resulted from a method call.
 * @callback respoke.SignalingChannel.errorHandler
 * @params {Error} err
 */
/**
 * Handle sending successfully.
 * @callback respoke.SignalingChannel.sendHandler
 */
/**
 * Receive a group.
 * @callback respoke.SignalingChannel.groupHandler
 * @param {respoke.Group}
 */
/**
 * Receive a list of groups.
 * @callback respoke.SignalingChannel.groupListHandler
 * @param {Array}
 */
/**
 * Receive a list of TURN credentials.
 * @callback respoke.SignalingChannel.turnSuccessHandler
 * @param {Array}
 */
/**
 * Receive an HTTP response
 * @callback respoke.SignalingChannel.responseHandler
 * @param {object}
 */

/**
 * A text message and the information needed to route it.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.TextMessage
 * @constructor
 * @param {object} params
 * @param {string} [params.endpointId] - If sending, endpoint ID of the thing we're sending a message to.
 * @param {string} [params.connectionId] - If sending, connection ID of the thing we're sending a message to.
 * @param {string} [params.message] - If sending, a message to send
 * @param {object} [params.rawMessage] - If receiving, the parsed JSON we got from the server
 * @private
 * @returns {respoke.TextMessage}
 */
respoke.TextMessage = function (params) {
    "use strict";
    params = params || {};
    var that = {};

    /**
     * Parse rawMessage and set attributes required for message delivery.
     * @memberof! respoke.TextMessage
     * @method respoke.TextMessage.parse
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
}; // End respoke.TextMessage

/**
 * A signaling message and the information needed to route it.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.SignalingMessage
 * @constructor
 * @param {object} params
 * @param {string} [params.endpointId] - If sending, the endpoint ID of the recipient
 * @param {string} [params.connectionId] - If sending, the connection ID of the recipient
 * @param {string} [params.signal] - If sending, a message to send
 * @param {respoke.Endpoint} [params.recipient]
 * @param {string} [params.signalType]
 * @param {string} [params.sessionId] - A globally unique ID to identify this call.
 * @param {string} [params.target] - Either 'call' or 'directConnection', TODO remove the need for this.
 * @param {string} [params.signalId] - A globally unique ID to identify this signal and it's ACK.
 * @param {string} [params.callerId] - Human readable caller ID. Not implemented.
 * @param {RTCSessionDescription} [params.sdp]
 * @param {Array<RTCIceCandidate>} [params.iceCandidates]
 * @param {object} [params.offering] - Object describing the media we're offering to send the remote party in a more
 * usable way than SDP. Not implemented.
 * @param {object} [params.requesting] - Object describing the media we're requesting from the remote party in a more
 * usable way than SDP. Not implemented.
 * @param {string} [params.reason] - Human readable reason for hanging up.
 * @param {string} [params.error] - String indicating that a previous signal was malformed or received in the wrong
 * state. Not implemented.
 * @param {string} [params.status] - "Ringing". Not implemented.
 * @param {object} [params.rawMessage] - If receiving, the parsed JSON we got from the server
 * @private
 * @returns {respoke.SignalingMessage}
 */
respoke.SignalingMessage = function (params) {
    "use strict";
    params = params || {};
    var that = {};
    /**
     * Attributes without which we cannot build a signaling message.
     * @memberof! respoke.SignalingMessage
     * @name required
     * @private
     * @type {string}
     */
    var required = ['recipient', 'signalType', 'sessionId', 'target', 'signalId'];
    /**
     * Attributes which we will copy onto the signal if defined.
     * @memberof! respoke.SignalingMessage
     * @name required
     * @private
     * @type {string}
     */
    var allowed = [
        'signalType', 'sessionId', 'callerId', 'sdp', 'iceCandidates', 'offering', 'target', 'signalId',
        'requesting', 'reason', 'error', 'status'
    ];

    /**
     * Parse rawMessage and set attributes required for message delivery.
     * @memberof! respoke.SignalingMessage
     * @method respoke.SignalingMessage.parse
     * @private
     */
    function parse() {
        if (params.rawMessage) {
            try {
                that = JSON.parse(params.rawMessage.signal); // Incoming message
                that.endpointId = params.rawMessage.header.from;
                that.connectionId = params.rawMessage.header.fromConnection;
            } catch (e) {
                throw new Error(e);
            }
        } else {
            required.forEach(function eachAttr(attr) {
                if (params[attr] === 0 || !params[attr]) {
                    throw new Error("Can't build a signaling without " + attr);
                }
            });

            allowed.forEach(function eachAttr(attr) {
                if (params[attr] === 0 || params[attr]) {
                    that[attr] = params[attr];
                }
            });

            that.to = params.recipient.id;
            that.toConnection = params.connectionId;
        }
    }

    parse();
    return that;
}; // End respoke.SignalingMessage

/**
 * A group, representing a collection of endpoints and the method by which to communicate with them.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.Group
 * @constructor
 * @param {object} params
 * @param {string} params.instanceId
 * @param {respoke.Group.onJoin} params.onJoin - A callback to receive notifications every time a new
 * endpoint has joined the group. This callback does not get called when the client joins the group.
 * @param {respoke.Group.onMessage} params.onMessage - A callback to receive messages sent to the group from
 * remote endpoints.
 * @param {respoke.Group.onLeave} params.onLeave - A callback to receive notifications every time a new
 * endpoint has left the group. This callback does not get called when the client leaves the group.
 * @returns {respoke.Group}
 */
respoke.Group = function (params) {
    "use strict";
    params = params || {};

    var that = respoke.EventEmitter(params);
    /**
     * @memberof! respoke.Group
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var client = respoke.getClient(instanceId);

    if (!that.id) {
        throw new Error("Can't create a group without an ID.");
    }

    /**
     * @memberof! respoke.Group
     * @name signalingChannel
     * @type respoke.SignalingChannel
     * @private
     */
    var signalingChannel = params.signalingChannel;
    delete params.signalingChannel;

    /**
     * @memberof! respoke.Group
     * @name endpoints
     * @type {array<respoke.Endpoint>}
     * @desc A list of the members of this group.
     */
    that.connections = [];
    /**
     * A name to identify the type of this object.
     * @memberof! respoke.Group
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Group';
    that.listen('join', params.onJoin);
    that.listen('message', params.onMessage);
    that.listen('leave', params.onLeave);
    client.listen('disconnect', function disconnectHandler() {
        that.connections = [];
    });

    delete that.instanceId;
    delete that.onMessage;
    delete that.onPresence;
    delete that.onJoin;
    delete that.onLeave;

    /**
     * Join this group.
     * @memberof! respoke.Group
     * @method respoke.Group.join
     * @return {Promise|undefined}
     * @param {object} params
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires respoke.Client#join
     */
    that.join = function () {
        var params = {
            id: that.id
        };
        var promise;
        var deferred;
        var retVal;

        try {
            validateConnection();
        } catch (err) {
            deferred = Q.defer();
            retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
            deferred.reject(err);
            return retVal;
        }

        promise = client.join(params);
        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        return retVal;
    };

    /**
     * Leave this group.
     * @memberof! respoke.Group
     * @method respoke.Group.leave
     * @param {object} params
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @return {Promise|undefined}
     * @fires respoke.Client#leave
     */
    that.leave = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            deferred.reject(err);
            return retVal;
        }

        signalingChannel.leaveGroup({
            id: that.id
        }).then(function successHandler() {
            /**
             * This event is fired when the client leaves a group.
             * @event respoke.Client#leave
             * @type {respoke.Event}
             * @property {respoke.Group} group
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            client.fire('leave', {
                group: that
            });
            that.connections = [];
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject();
        });
        return retVal;
    };

    /**
     * Remove a Connection from a Group. This does not change the status of the remote Endpoint, it only changes the
     * internal representation of the Group membership. This method should only be used internally.
     * @private
     * @memberof! respoke.Group
     * @method respoke.Group.removeMember
     * @param {object} params
     * @param {string} [params.connectionId] - Endpoint's connection id
     * @fires respoke.Group#leave
     */
    that.removeMember = function (params) {
        params = params || {};
        validateConnection();
        validateMembership();

        if (!params.connectionId) {
            throw new Error("Can't remove a member to the group without it's Connection id.");
        }

        that.connections.every(function eachConnection(conn, index) {
            if (conn.id === params.connectionId) {
                that.connections.splice(index, 1);

                /**
                 * This event is fired when a member leaves a group the client is a member of.
                 * @event respoke.Group#leave
                 * @type {respoke.Event}
                 * @property {respoke.Connection} connection
                 * @property {string} name - the event name.
                 * @property {respoke.Group} target
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
     * Return true if the logged-in user is a member of this group and false if not.
     * @memberof! respoke.Group
     * @method respoke.Group.isJoined
     * @returns {boolean}
     */
    that.isJoined = function () {
        // connections array contains some connections and ours is among them.
        return (that.connections.length > 0 && !that.connections.every(function (conn) {
            return conn.id !== client.connectionId;
        }));
    };

    /**
     * Add a Connection to a group. This does not change the status of the remote Endpoint, it only changes the
     * internal representation of the Group membership. This method should only be used internally.
     * @memberof! respoke.Group
     * @private
     * @method respoke.Group.addMember
     * @param {object} params
     * @param {respoke.Connection} params.connection
     * @fires respoke.Group#join
     */
    that.addMember = function (params) {
        params = params || {};
        var absent;

        validateConnection();

        if (!params.connection) {
            throw new Error("Can't add a member to the group without it's Connection object.");
        }

        absent = that.connections.every(function eachConnection(conn) {
            return (conn.id !== params.connection.id);
        });

        if (absent) {
            that.connections.push(params.connection);
            if (params.skipEvent) {
                return;
            }

            /**
             * This event is fired when a member joins a Group that the currently logged-in endpoint is a member
             * of.
             * @event respoke.Group#join
             * @type {respoke.Event}
             * @property {respoke.Connection} connection
             * @property {string} name - the event name.
             * @property {respoke.Group} target
             */
            that.fire('join', {
                connection: params.connection
            });
        }
    };

    /**
     * Validate that the client is connected to the Respoke infrastructure.
     * @memberof! respoke.Group
     * @method respoke.Group.validateConnection
     * @private
     */
    function validateConnection() {
        if (!signalingChannel || !signalingChannel.connected) {
            throw new Error("Can't complete request when not connected. Please reconnect!");
        }
    }

    /**
     * Validate that the client is a member of this group.
     * @memberof! respoke.Group
     * @method respoke.Group.validateMembership
     * @private
     */
    function validateMembership() {
        if (!that.isJoined()) {
            throw new Error("Not a member of this group anymore.");
        }
    }

    /**
     * Send a message to the entire group.
     * @memberof! respoke.Group
     * @method respoke.Group.sendMessage
     * @param {object} params
     * @param {string} params.message - The message.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        params.id = that.id;
        var retVal;
        var deferred;

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            deferred = Q.defer();
            retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
            deferred.reject(err);
            return retVal;
        }

        return signalingChannel.publish(params);
    };

    /**
     * Get an array containing the members of the group.
     * @memberof! respoke.Group
     * @method respoke.Group.getMembers
     * @returns {Promise<Array>} A promise to an array of Connections.
     * @param {object} params
     * @fires respoke.Group#join
     */
    that.getMembers = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            deferred.reject(err);
            return retVal;
        }

        if (that.connections.length > 0) {
            deferred.resolve(that.connections);
            return retVal;
        }
        signalingChannel.getGroupMembers({
            id: that.id
        }).done(function successHandler(list) {
            var endpointList = [];
            list.forEach(function eachMember(params) {
                var connection = client.getConnection({
                    endpointId: params.endpointId,
                    connectionId: params.connectionId
                });

                if (endpointList.indexOf(params.endpointId) === -1) {
                    endpointList.push(params.endpointId);
                }
                that.addMember({
                    connection: connection,
                    skipEvent: true
                });
            });

            if (endpointList.length > 0) {
                signalingChannel.registerPresence({
                    endpointList: endpointList
                });
            }
            deferred.resolve(that.connections);
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return retVal;
    };

    return that;
}; // End respoke.Group
/**
 * Receive notification that an endpoint has joined this group. This callback is called everytime
 * respoke.Group#join is fired.
 * @callback respoke.Group.onJoin
 * @param {respoke.Event} evt
 * @param {respoke.Connection} evt.connection
 * @param {string} evt.name - the event name.
 * @param {respoke.Group} evt.target
 */
/**
 * Receive notification that an endpoint has left this group. This callback is called everytime
 * respoke.Group#leave is fired.
 * @callback respoke.Group.onLeave
 * @param {respoke.Event} evt
 * @param {respoke.Connection} evt.connection
 * @param {string} evt.name - the event name.
 * @param {respoke.Group} evt.target
 */
/**
 * Receive notification that a message has been received to a group. This callback is called every time
 * respoke.Group#message is fired.
 * @callback respoke.Group.onMessage
 * @param {respoke.Event} evt
 * @param {respoke.TextMessage} evt.message
 * @param {string} evt.name - the event name.
 * @param {respoke.Group} evt.target
 */
/**
 * Get a list of the Connections which are members of this Group.
 * @callback respoke.Group.connectionsHandler
 * @param {Array<respoke.Connection>} connections
 */
