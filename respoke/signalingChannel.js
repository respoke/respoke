'use strict';
/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var log = require('loglevel');
var Q = require('q');
var io = require('socket.io-client');
var respoke = require('./respoke');

/**
 * Returns a timestamp, measured in milliseconds.
 *
 * This method will use high resolution time, if available. Otherwise it falls back to just
 * using the wall clock.
 *
 * @return {number} Number of milliseconds that have passed since some point in the past.
 * @private
 */
var now;
var performance;
if (performance && performance.now) {
    now = performance.now.bind(performance);
} else if (Date.now) {
    now = Date.now.bind(Date);
} else {
    now = function () {
        return new Date().getTime();
    };
}

/**
 * Container for holding requests that are currently waiting on responses.
 * @returns {PendingRequests}
 * @private
 * @constructor
 */
var PendingRequests = function () {
    /**
     * Pending requests.
     * @private
     * @type {Array}
     */
    var contents = [];
    /**
     * Counter to provide the next id.
     * @private
     * @type {number}
     */
    var counter = 0;
    var that = {};

    /**
     * Add a new pending request.
     *
     * @memberof PendingRequests
     * @param obj
     * @returns {*} The key to use for the `remove` method.
     */
    that.add = function (obj) {
        contents[counter] = obj;
        counter++;
        return counter;
    };

    /**
     * Remove a pending request.
     *
     * @param {*} key Key returned from `add` method.
     */
    that.remove = function (key) {
        delete contents[key];
    };

    /**
     * Disposes of any currently pending requests, synchronously invoking the provided function on
     * each.
     *
     * @param {function} [fn] Callback for pending requests.
     */
    that.reset = function (fn) {
        if (fn) {
            contents.forEach(fn);
        }
        contents = [];
    };

    return that;
};

/**
 * The purpose of this class is to make a method call for each API call
 * to the backend REST interface.  This class takes care of App authentication, websocket connection,
 * Endpoint authentication, and all App interactions thereafter.  Almost all methods return a Promise.
 * @class respoke.SignalingChannel
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId - client id
 * @private
 * @returns {respoke.SignalingChannel}
 */
module.exports = function (params) {
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
     * @private
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
     * @memberof! respoke.SignalingChannel
     * @name socket
     * @private
     * @type {Socket.io.Socket}
     */
    var socket = null;
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
     * Set of promises for any pending requests on the WebSocket.
     * @private
     * @type {PendingRequests}
     */
    var pendingRequests = PendingRequests();
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
     * Rejects a message if the body size is greater than this. It is enforced servcer side, so changing this
     * won't make the bodySizeLimit any bigger, this just gives you a senseable error if it's too big.
     * @memberof! respoke.signalingChannel
     * @name bodySizeLimit
     * @private
     * @type {number}
     */
    var bodySizeLimit = 20000;
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
        400: "Can't perform this action: missing or invalid parameters.",
        401: "Can't perform this action: not authenticated.",
        403: "Can't perform this action: not authorized.",
        404: "Item not found.",
        409: "Can't perform this action: item in the wrong state.",
        429: "API rate limit was exceeded.",
        500: "Can't perform this action: server problem."
    };

    /**
     * Indicate whether the signaling channel has a valid connection to Respoke.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.isConnected
     * @return {boolean}
     */
    that.isConnected = function () {
        return !!(socket && socket.socket.connected);
    };

    /**
     * Indicate whether the signaling channel is currently waiting on a websocket to connect.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.isConnecting
     * @private
     * @return {boolean}
     */
    function isConnecting() {
        return !!(socket && socket.socket.connecting);
    }

    /**
     * Get the call debug preference.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.isSendingReport
     * @private
     * @return {boolean}
     */
    that.isSendingReport = function (params) {
        return  clientSettings.enableCallDebugReport;
    };

    /**
     * Open a connection to the REST API and validate the app, creating a session token.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.open
     * @private
     * @param {object} params
     * @param {string} [params.token] - The Endpoint's auth token
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @return {Promise}
     */
    that.open = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.debug('SignalingChannel.open', params, clientSettings);
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
            log.debug('client', client);
        }, function errorHandler(err) {
            deferred.reject(err);
        });

        return deferred.promise;
    };

    /**
     * Get a developer mode token for an endpoint. App must be in developer mode.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.getToken
     * @private
     * @param {object} params
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @return {Promise<String>}
     */
    that.getToken = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.debug('SignalingChannel.getToken', params);

        var callParams = {
            path: '/v1/tokens',
            httpMethod: 'POST',
            parameters: {
                appId: clientSettings.appId,
                endpointId: params.endpointId,
                ttl: 60 * 60 * 6
            }
        };

        call(callParams).done(function (response) {
            if (response.code === 200 && response.result && response.result.tokenId) {
                token = response.result.tokenId;
                deferred.resolve(response.result.tokenId);
                return;
            }
            deferred.reject(new Error("Couldn't get a developer mode token: " + response.error));
        }, function (err) {
            deferred.reject(new Error("Couldn't get a developer mode token: " + err));
        });
        return deferred.promise;
    };

    /**
     * Open a connection to the REST API and validate the app, creating a session token.
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
        log.debug('SignalingChannel.doOpen', params);

        if (!params.token) {
            deferred.reject(new Error("Can't open connection to Respoke without a token."));
            return deferred.promise;
        }

        call({
            path: '/v1/session-tokens',
            httpMethod: 'POST',
            parameters: {
                tokenId: params.token
            }
        }).done(function (response) {
            if (response.code === 200) {
                appToken = response.result.token;
                deferred.resolve();
                log.debug("Signaling connection open to", clientSettings.baseURL);
            } else {
                deferred.reject(new Error("Couldn't authenticate app: " + response.error));
            }
        }, function (err) {
            log.error("Network call failed:", err.message);
            deferred.reject(new Error("Couldn't authenticate app: " + err.message));
        });

        return deferred.promise;
    }

    /**
     * Close a connection to the REST API. Invalidate the session token.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.close
     * @private
     * @param {object} params
     * @return {Promise}
     */
    that.close = function (params) {
        params = params || {};
        var deferred = Q.defer();

        wsCall({
            path: '/v1/connections/%s/',
            httpMethod: 'DELETE',
            objectId: client.endpointId
        }).fin(function finallyHandler() {
            return call({
                path: '/v1/session-tokens',
                httpMethod: 'DELETE'
            });
        }).fin(function finallyHandler() {
            if (socket) {
                socket.removeAllListeners();
                socket.disconnect();
            }
            deferred.resolve();
        }).done();

        return deferred.promise;
    };

    /**
     * Generate and send a presence message representing the client's current status. This triggers
     * the server to send the client's endpoint's presence.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendPresence
     * @private
     * @param {object} params
     * @param {string|number|object|Array} [params.presence=available]
     * @param {string} [params.status] - Non-enumeration human-readable status.
     * @param {string} [params.show] - I can't remember what this is.
     * @returns {Promise}
     */
    that.sendPresence = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.debug("Signaling sendPresence");

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

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
     * @private
     * @returns {Promise<respoke.Group>}
     * @param {object} params
     * @param {string} name
     */
    that.getGroup = function (params) {
        params = params || {};
        var deferred = Q.defer();
        log.debug('signalingChannel.getGroup');

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

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
     * Leave a group. In order to aggregate subsequent repeated requests, this function, when called synchronously,
     * will continue to accumulate group ids until the next tick of the event loop, when the request will be
     * issued. The same instance of Promise is returned each time.
     * @memberof! respoke.SignalingChannel
     * @private
     * @method respoke.SignalingChannel.leaveGroup
     * @returns {Promise}
     * @param {object} params
     * @param {array} params.groupList
     */
    that.leaveGroup = (function () {
        var groups = {};
        var deferred = Q.defer();

        return function (params) {
            params = params || {};
            params.groupList = params.groupList || [];

            var toRun = (Object.keys(groups).length === 0);

            if (!that.isConnected()) {
                deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
                return deferred.promise;
            }

            params.groupList.forEach(function (id) {
                if (typeof id === 'string') {
                    groups[id] = true;
                }
            });

            if (!toRun) {
                return deferred.promise;
            }

            setTimeout(function () {
                // restart accumulation
                var groupList = Object.keys(groups);
                groups = {};
                var saveDeferred = deferred;
                deferred = Q.defer();

                if (groupList.length === 0) {
                    saveDeferred.resolve();
                    return;
                }

                wsCall({
                    path: '/v1/groups/',
                    parameters: {
                        groups: groupList
                    },
                    httpMethod: 'DELETE'
                }).done(function successHandler() {
                    saveDeferred.resolve();
                }, function errorHandler(err) {
                    saveDeferred.reject(err);
                });
            });
            return deferred.promise;
        };
    })();

    /**
     * Join a group. In order to aggregate subsequent repeated requests, this function, when called synchronously,
     * will continue to accumulate group ids until the next tick of the event loop, when the request will be
     * issued. The same instance of Promise is returned each time.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.joinGroup
     * @private
     * @returns {Promise}
     * @param {object} params
     * @param {array} params.groupList
     */
    that.joinGroup = (function () {
        var groups = {};
        var deferred = Q.defer();

        return function (params) {
            params = params || {};
            params.groupList = params.groupList || [];

            var toRun = (Object.keys(groups).length === 0);

            if (!that.isConnected()) {
                deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
                return deferred.promise;
            }

            params.groupList.forEach(function (id) {
                if (typeof id === 'string') {
                    groups[id] = true;
                }
            });

            if (!toRun) {
                return deferred.promise;
            }

            setTimeout(function () {
                // restart accumulation
                var groupList = Object.keys(groups);
                groups = {};
                var saveDeferred = deferred;
                deferred = Q.defer();

                if (groupList.length === 0) {
                    saveDeferred.resolve();
                    return;
                }

                wsCall({
                    path: '/v1/groups/',
                    parameters: {
                        groups: groupList
                    },
                    httpMethod: 'POST'
                }).done(function successHandler() {
                    saveDeferred.resolve();
                }, function errorHandler(err) {
                    saveDeferred.reject(err);
                });
            });
            return deferred.promise;
        };
    })();

    /**
     * Publish a message to a group.
     * @memberof! respoke.SignalingChannel
     * @private
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

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

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
     * Register as an observer of presence for the specified endpoint ids. In order to aggregate subsequent repeated
     * requests, this function, when called synchronously, will continue to accumulate endpoint ids until the next
     * tick of the event loop, when the request will be issued. The same instance of Promise is returned each time.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.registerPresence
     * @private
     * @param {object} params
     * @param {Array<string>} params.endpointList
     * @returns {Promise}
     */
    that.registerPresence = (function () {
        var endpoints = {};
        var deferred = Q.defer();

        return function (params) {
            params = params || {};
            params.endpointList = params.endpointList || [];
            var toRun = (Object.keys(endpoints).length === 0);

            if (!that.isConnected()) {
                return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            }

            params.endpointList.forEach(function (ep) {
                if (typeof ep === 'string' && presenceRegistered[ep] !== true) {
                    endpoints[ep] = true;
                }
            });

            if (!toRun) {
                return deferred.promise;
            }

            setTimeout(function () {
                // restart accumulation
                var endpointList = Object.keys(endpoints);
                endpoints = {};
                var saveDeferred = deferred;
                deferred = Q.defer();

                if (endpointList.length === 0) {
                    saveDeferred.resolve();
                    return;
                }

                wsCall({
                    httpMethod: 'POST',
                    path: '/v1/presenceobservers',
                    parameters: {
                        endpointList: endpointList
                    }
                }).done(function successHandler() {
                    params.endpointList.forEach(function eachId(id) {
                        presenceRegistered[id] = true;
                    });
                    saveDeferred.resolve();
                }, function (err) {
                    saveDeferred.reject(err);
                });
            // We could even add a tiny delay like 10ms if we want to get more conservative and
            // catch asychronous calls to client.getEndpoint() and other methods which call
            // this method.
            });

            return deferred.promise;
        }
    })();

    /**
     * Join a group.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.getGroupMembers
     * @private
     * @returns {Promise<Array>}
     * @param {object} params
     * @param {string} params.id
     */
    that.getGroupMembers = function (params) {
        var deferred = Q.defer();
        var promise;

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

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
     * @private
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

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

        wsCall({
            path: '/v1/messages',
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
     * Send an ACK signal to acknowlege reception of a signal.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendACK
     * @private
     * @param {object} params
     * @param {respoke.SignalingMessage} params.signal
     * @return {Promise}
     */
    that.sendACK = function (params) {
        var endpoint;
        params = params || {};

        if (!that.isConnected()) {
            return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
        }

        if (!params.signal) {
            return Q.reject(new Error("Can't send ACK, no signal was given."));
        }

        endpoint = client.getEndpoint({
            id: params.signal.fromEndpoint,
            skipPresence: true
        });
        if (!endpoint) {
            return Q.reject(new Error("Can't send ACK, can't get endpoint."));
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
     * @private
     * @param {object} params
     * @param {respoke.Call} [params.call] - For getting the sessionId & connectionId. Not required for 'ack'.
     * @return {Promise}
     */
    that.sendSignal = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var signal;
        var to;
        var toConnection;
        var toType;

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

        if (params.call) {
            params.sessionId = params.call.id;
            if (params.call.connectionId) { // the recipient's connectionId
                params.connectionId = params.call.connectionId;
            }
        }

        to = params.recipient.id;
        toConnection = params.connectionId;
        toType = params.toType || 'web';

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
                to: to,
                toConnection: toConnection,
                toType: toType
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
     * @private
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {Array<RTCIceCandidate>} params.iceCandidates - An array of ICE candidate.
     * @return {Promise}
     */
    that.sendCandidate = function (params) {
        params = params || {};
        params.signalType = 'iceCandidates';

        if (!that.isConnected()) {
            return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
        }

        return that.sendSignal(params);
    };

    /**
     * Send an SDP.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendSDP
     * @private
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {RTCSessionDescription} params.sessionDescription - An SDP to JSONify and send.
     * @return {Promise}
     */
    that.sendSDP = function (params) {
        params = params || {};

        if (!that.isConnected()) {
            return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
        }

        if (['offer', 'answer'].indexOf(params.signalType) === -1) {
            return Q.reject("Not an SDP type signal.");
        }

        return that.sendSignal(params);
    };

    /**
     * Send a call report to the cloud infrastructure.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendReport
     * @private
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

        if (!clientSettings.enableCallDebugReport) {
            log.debug('not sending call debugs - disabled');
            deferred.resolve();
            return deferred.promise;
        }

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

        wsCall({
            path: '/v1/call-debugs',
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
     * Send a message hanging up the WebRTC session.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendHangup
     * @private
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @param {string} [params.connectionId]
     * @param {string} params.reason - The reason the session is being hung up.
     * @return {Promise}
     */
    that.sendHangup = function (params) {
        params = params || {};
        params.signalType = 'bye';

        if (!that.isConnected()) {
            return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
        }

        return that.sendSignal(params);
    };

    /**
     * Send a message to all connection ids indicating we have negotiated a call with one connection.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendConnected
     * @private
     * @param {object} params
     * @param {respoke.Endpoint} params.recipient - The recipient.
     * @return {Promise}
     */
    that.sendConnected = function (params) {
        params = params || {};
        params.signalType = 'connected';

        if (!that.isConnected()) {
            return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
        }

        return that.sendSignal(params);
    };

    /**
     * Send a message to the remote party indicating a desire to renegotiate media.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.sendModify
     * @private
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

        if (!that.isConnected()) {
            return Q.reject(new Error("Can't complete request when not connected. Please reconnect!"));
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
     * @private
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
        var method = 'do';

        if (signal.signalType !== 'iceCandidates') { // Too many of these!
            log.debug(signal.signalType, signal);
        }

        if (signal.target === undefined) {
            throw new Error("target undefined");
        }

        // Only create if this signal is an offer.
        Q.fcall(function makePromise() {
            var endpoint;
            /*
             * This will return calls regardless of whether they are associated
             * with a direct connection or not, and it will create a call if no
             * call is found and this signal is an offer. Direct connections get
             * created in the next step.
             */
            target = client.getCall({
                id: signal.sessionId,
                endpointId: signal.fromEndpoint,
                fromType: signal.fromType,
                create: (signal.target === 'call' && signal.signalType === 'offer')
            });
            if (target) {
                return target;
            }

            if (signal.target === 'directConnection') {
                // return a promise
                endpoint = client.getEndpoint({
                    id: signal.fromEndpoint,
                    skipPresence: true
                });

                if (endpoint.directConnection && endpoint.directConnection.call.id === signal.sessionId) {
                    return endpoint.directConnection;
                }

                return endpoint.startDirectConnection({
                    id: signal.sessionId,
                    create: (signal.signalType === 'offer'),
                    caller: (signal.signalType !== 'offer')
                });
            }
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
        params.call.connectionId = params.signal.fromConnection;
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
        params.call.connectionId = params.signal.fromConnection;
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
     * @method respoke.SignalingChannel.routingMethods.doBye
     * @private
     * @params {object} params
     * @params {object} params.signal
     * @fires respoke.Call#signal-hangup
     */
    routingMethods.doBye = function (params) {
        /**
         *  We may receive hangup from one or more parties after connectionId is set if the call is rejected
         *  by a connection that didn't win the call. In this case, we have to ignore the signal since
         *  we are already on a call. TODO: this should really be inside PeerConnection.
         */
        if (params.call.connectionId && params.call.connectionId !== params.signal.fromConnection) {
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
     * @private
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
     * @param {object} message The Socket.io message.
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
     * @param {object} message The Socket.io message.
     * @private
     */
    var onJoin = function onJoin(message) {
        var group;
        var presenceMessage;
        var endpoint;
        var connection;

        if (message.connectionId === client.connectionId) {
            connection = client.getConnection({connectionId: message.connectionId, endpointId: message.endpointId});
            group = client.getGroup({id: message.header.channel});
            if (!group) {
                group = respoke.Group({
                    id: message.header.channel,
                    instanceId: instanceId,
                    signalingChannel: that
                });
                client.addGroup(group);
            }
            if (!group.isJoined()) {
                group.addMember({connection: connection});
                client.fire('join', {
                    group: group
                });
            }
        } else {

            endpoint = client.getEndpoint({
                skipPresence: true,
                id: message.endpointId,
                instanceId: instanceId,
                name: message.endpointId
            });

            // Handle presence not associated with a channel
            if (!connection) {
                endpoint.setPresence({
                    connectionId: message.connectionId
                });
                connection = client.getConnection({
                    connectionId: message.connectionId,
                    endpointId: message.endpointId
                });
            }

            group = client.getGroup({id: message.header.channel});

            if (group && connection) {
                group.addMember({connection: connection});
            } else {
                log.error("Can't add endpoint to group:", message, group, endpoint, connection);
            }
        }
    };

    /**
     * Socket handler for leave messages.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onLeave
     * @param {object} message The Socket.io message.
     * @private
     */
    var onLeave = function onLeave(message) {
        var group;
        var presenceMessage;
        var endpoint;
        if (message.connectionId === client.connectionId) {
            group = client.getGroup({id: message.header.channel});
            client.fire('leave', {
                group: group
            });
        } else {

            endpoint = client.getEndpoint({
                skipPresence: true,
                id: message.endpointId
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
        }
    };

    /**
     * Socket handler for presence messages.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.onMessage
     * @param {object} message The Socket.io message.
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
                path: '/v1/connections',
                httpMethod: 'POST'
            }).done(function successHandler(res) {
                log.debug('connections result', res);
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
     * @param {object} message The Socket.io message.
     * @private
     */
    function onPresence(message) {
        var endpoint;
        var groups;

        if (message.header.from === client.endpointId) {
            // Skip ourselves
            return;
        }
        log.debug('socket.on presence', message);

        endpoint = client.getEndpoint({
            skipPresence: true,
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
     * On reconnect, start with a reconnect interval of 2000ms. Every time reconnect fails, the interval
     * is doubled up to a maximum of 5 minutes. From then on, it will attempt to reconnect every 5 minutes forever.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.reconnect
     * @private
     */
    function reconnect() {
        appToken = undefined;
        token = undefined;
        reconnectTimeout = (reconnectTimeout === null) ? 2500 : 2 * reconnectTimeout;

        if (reconnectTimeout > (maxReconnectTimeout)) {
            reconnectTimeout = maxReconnectTimeout;
        }

        setTimeout(function doReconnect() {
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
                reconnect();
            });
        }, reconnectTimeout);
    }

    /**
     * Authenticate to the cloud and call the handler on state change.
     * @memberof! respoke.SignalingChannel
     * @method respoke.SignalingChannel.authenticate
     * @private
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
         * @private
         */
        var connectParams = {
            'connect timeout': 2000,
            'force new connection': true, // Don't try to reuse old connection.
            'sync disconnect on unload': true, // have Socket.io call disconnect() on the browser unload event.
            reconnect: false,
            host: host,
            port: port || '443',
            protocol: protocol,
            secure: (protocol === 'https'),
            query: '__sails_io_sdk_version=0.10.0&app-token=' + appToken
        };

        if (that.isConnected() || isConnecting()) {
            return;
        }
        socket = io.connect(clientSettings.baseURL, connectParams);

        socket.on('connect', generateConnectHandler(function onSuccess() {
            deferred.resolve();
        }, function onError(err) {
            deferred.reject(err);
        }));

        socket.on('join', onJoin);
        socket.on('leave', onLeave);
        socket.on('pubsub', onPubSub);
        socket.on('message', onMessage);
        socket.on('presence', onPresence);

        // connection timeout
        socket.on('connect_failed', function connectFailedHandler(res) {
            deferred.reject(new Error("WebSocket connection failed."));
            log.error('Socket.io connect timeout.', res || "");
            reconnect();
        });

        // handshake error, 403
        socket.on('error', function errorHandler(res) {
            log.debug('Socket.io request failed.', res || "");
            reconnect();
        });

        that.addHandler({
            type: 'signal',
            handler: function signalHandler(message) {
                var knownSignals = ['offer', 'answer', 'connected', 'modify', 'iceCandidates', 'bye'];
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
            pendingRequests.reset(function (pendingRequest) {
                log.debug('Failing pending requests');
                pendingRequest.reject(new Error("WebSocket disconnected"));
            });

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
     * @private
     * @method respoke.SignalingChannel.getTurnCredentials
     * @return {Promise<Array>}
     */
    that.getTurnCredentials = function () {
        var deferred = Q.defer();

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

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
    };

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
        var start = now();
        // Too many of these!
        var logRequest = params.path.indexOf('messages') === -1 && params.path.indexOf('signaling') === -1;
        var request;
        var bodyLength = 0;
        if (params.paramaters) {
            bodyLength = encodeURI(JSON.stringify(params.parameters)).split(/%..|./).length - 1;
        }

        if (!that.isConnected()) {
            deferred.reject(new Error("Can't complete request when not connected. Please reconnect!"));
            return deferred.promise;
        }

        if (!params) {
            deferred.reject(new Error('No params.'));
            return deferred.promise;
        }

        if (!params.path) {
            deferred.reject(new Error('No request path.'));
            return deferred.promise;
        }

        if (bodyLength > bodySizeLimit) {
            deferred.reject(new Error('Request body exceeds maximum size of ' + bodySizeLimit + ' bytes'));
            return deferred.promise;
        }

        params.httpMethod = (params.httpMethod || 'get').toLowerCase();

        if (params.objectId) {
            params.path = params.path.replace(/\%s/ig, params.objectId);
        }

        if (logRequest) {
            log.debug('socket request', {
                method: params.httpMethod,
                path: params.path,
                parameters: params.parameters
            });
        }

        request = {
            method: params.httpMethod,
            path: params.path,
            parameters: params.parameters,
            tries: 0,
            durationMillis: 0
        };

        request.id = pendingRequests.add(deferred);

        function handleResponse(response) {
            /*
             * Response:
             *  {
             *      body: {},
             *      headers: {},
             *      statusCode: 200
             *  }
             */
            try {
                response.body = JSON.parse(response.body);
            } catch (e) {
                if (typeof response.body !== 'object') {
                    deferred.reject(new Error("Server response could not be parsed!" + response.body));
                    return;
                }
            }

            if (response.statusCode === 429) {
                if (request.tries < 3 && deferred.promise.isPending()) {
                    setTimeout(function () {
                        start = now();
                        sendWebsocketRequest(request, handleResponse);
                    }, 1000); // one day this will be response.interval or something
                } else {
                    request.durationMillis = now() - start;
                    pendingRequests.remove(request.id);
                    failWebsocketRequest(request, response.body,
                            "Too many retries after rate limit exceeded.", deferred);
                }
                return;
            }

            request.durationMillis = now() - start;
            pendingRequests.remove(request.id);

            if ([200, 204, 205, 302, 401, 403, 404, 418].indexOf(this.status) === -1) {
                failWebsocketRequest(request, response.body,
                        response.body.error || errors[this.status] || "Unknown error", deferred);
            } else {
                deferred.resolve(response.body);
            }

            if (logRequest) {
                log.debug('socket response', {
                    method: request.method,
                    path: request.path,
                    durationMillis: request.durationMillis,
                    response: response.body
                });
            }
        }

        start = now();
        sendWebsocketRequest(request, handleResponse);
        return deferred.promise;
    }

    function failWebsocketRequest(request, response, error, deferred) {
        if (response && response.error) {
            deferred.reject(new Error(error + '(' + request.method + ' ' + params.path + ')'));
        } else {
            deferred.resolve(response);
        }
    }

    function sendWebsocketRequest(request, handleResponse) {
        request.tries += 1;
        socket.emit(request.method, JSON.stringify({
            url: request.path,
            data: request.parameters,
            headers: {'App-Token': appToken}
        }), handleResponse);
    }

    /**
     * Construct an API call and return the formatted response and errors. The 'success'
     * attribute indicates the success or failure of the API call. The 'response' attribute
     * is an associative array constructed by json.decode. The 'error' attribute is a message.
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
     * @returns {Promise}
     */
    function call(params) {
        /* Params go in the URI for GET, DELETE, same format for
         * POST and PUT, but they must be sent separately after the
         * request is opened. */
        var deferred = Q.defer();
        var paramString = null;
        var uri = null;
        var response = {
            'result': null,
            'code': null
        };
        var start;

        uri = clientSettings.baseURL + params.path;

        if (!params) {
            deferred.reject(new Error('No params.'));
            return;
        }

        if (!params.httpMethod) {
            deferred.reject(new Error('No HTTP method.'));
            return;
        }

        if (!params.path) {
            deferred.reject(new Error('No request path.'));
            return;
        }

        if (params.objectId) {
            params.path = params.path.replace(/\%s/ig, params.objectId);
        }

        if (['GET', 'DELETE'].indexOf(params.httpMethod) > -1) {
            uri += makeParamString(params.parameters);
        }

        xhr.open(params.httpMethod, uri);
        if (appToken) {
            xhr.setRequestHeader("App-Token", appToken);
        }
        if (['POST', 'PUT'].indexOf(params.httpMethod) > -1) {
            paramString = JSON.stringify(params.parameters);
            if (paramString.length > bodySizeLimit) {
                deferred.reject(new Error('Request body exceeds maximum size of ' + bodySizeLimit + ' bytes'));
                return;
            }
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        } else if (['GET', 'DELETE'].indexOf(params.httpMethod) === -1) {
            deferred.reject(new Error('Illegal HTTP request method ' + params.httpMethod));
            return;
        }
        log.debug('request', {
            method: params.httpMethod,
            uri: uri,
            params: paramString
        });

        try {
            xhr.send(paramString);
        } catch (err) {
            deferred.reject(err);
            return;
        }

        xhr.onreadystatechange = function () {
            var durationMillis = now() - start;
            var limit;
            var unit;

            if (this.readyState !== 4) {
                return;
            }
            if (this.status === 0) {
                deferred.reject(new Error("Status is 0: Incomplete request, SSL error, or CORS error."));
                return;
            }
            if ([200, 204, 205, 302, 401, 403, 404, 418].indexOf(this.status) > -1) {
                response.code = this.status;
                response.uri = uri;
                response.params = params.parameters;
                response.error = errors[this.status];
                if (this.response) {
                    try {
                        response.result = JSON.parse(this.response);
                    } catch (e) {
                        response.result = this.response;
                        response.error = "Invalid JSON.";
                    }
                }
                log.debug('response', {
                    method: params.httpMethod,
                    durationMillis: durationMillis,
                    response: response
                });
                deferred.resolve(response);
            } else if (this.status === 429) {
                unit = this.getResponseHeader('RateLimit-Time-Units');
                limit = this.getResponseHeader('RateLimit-Limit');
                deferred.reject(new Error("Rate limit of " + limit + "/" + unit +
                    " exceeded. Try again in 1 " + unit + "."));
                return;
            } else {
                deferred.reject(new Error('unexpected response ' + this.status));
                return;
            }
        };

        return deferred.promise;
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

    return that;
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
