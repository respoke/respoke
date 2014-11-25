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
var respoke = require('./respoke');

/**
 * `respoke.Endpoint`s are users of a Respoke app.
 *
 * An Endpoint can be a person in a browser or device, or an app using Respoke APIs from a server.
 *
 * A Client can interact with endpoints through messages, audio or video calls, or direct connections.
 *
 * An Endpoint may be authenticated from multiple devices to the same app (each of
 * which is represented by a Connection).
 *
 *
 * @constructor
 * @class respoke.Endpoint
 * @augments respoke.Presentable
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.instanceId
 * @param {respoke.client.resolvePresence} [params.resolvePresence] An optional function for resolving presence for an endpoint.
 * @returns {respoke.Endpoint}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Endpoint
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.Presentable(params);
    /**
     * @memberof! respoke.DirectConnection
     * @name client
     * @type {respoke.Client}
     * @private
     */
    var client = respoke.getClient(instanceId);
    /**
     * @memberof! respoke.DirectConnection
     * @name signalingChannel
     * @type {respoke.SignalingChannel}
     * @private
     */
    var signalingChannel = params.signalingChannel;

    var addCall = params.addCall;

    delete that.signalingChannel;
    delete that.instanceId;
    delete that.connectionId;
    delete that.addCall;
    /**
     * A name to identify the type of this object.
     * @memberof! respoke.Endpoint
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Endpoint';
    /**
     * A direct connection to this endpoint. This can be used to send direct messages.
     * @memberof! respoke.Endpoint
     * @name directConnection
     * @type {respoke.DirectConnection}
     */
    that.directConnection = null;

    /**
     * Array of connections for this endpoint.
     * @memberof! respoke.Endpoint
     * @name connections
     * @type {Array<respoke.Connection>}
     */
    that.connections = [];
    client.listen('disconnect', function disconnectHandler() {
        that.connections = [];
    });

    var resolveEndpointPresence = params.resolveEndpointPresence;
    delete that.resolveEndpointPresence;

    /**
     * Send a message to the endpoint through the infrastructure.
     *
     *    endpoint.sendMessage({
     *        message: "wassuuuuup"
     *    });
     *
     * **Using callbacks** will disable promises.
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {string} [params.connectionId]
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation of this
     * method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this method
     * only.
     * @returns {Promise|undefined}
     */
    that.sendMessage = function (params) {
        var promise;
        var retVal;
        params = params || {};

        promise = signalingChannel.sendMessage({
            connectionId: params.connectionId,
            message: params.message,
            recipient: that
        });

        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        return retVal;
    };

    /**
     * Create a new audio-only call.
     *
     *     endpoint.startAudioCall({
     *         onConnect: function (evt) {}
     *     });
     *
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.startAudioCall
     * @param {object} params
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @returns {respoke.Call}
     */
    that.startAudioCall = function (params) {
        params = params || {};
        params.constraints = {
            video: false,
            audio: true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call with audio and video.
     *
     *     endpoint.startVideoCall({
     *         onConnect: function (evt) {}
     *     });
     *
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.startVideoCall
     * @param {object} params
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @returns {respoke.Call}
     */
    that.startVideoCall = function (params) {
        params = params || {};
        params.constraints = {
            video: true,
            audio: true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call.
     *
     *     endpoint.startCall({
     *         onConnect: function (evt) {}
     *     });
     *
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.startCall
     * @param {object} params
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {RTCConstraints} [params.constraints]
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @param {HTMLVideoElement} [params.videoLocalElement] - Pass in an optional html video element to have local video attached to it.
     * @param {HTMLVideoElement} [params.videoRemoteElement] - Pass in an optional html video element to have remote video attached to it.
     * @returns {respoke.Call}
     */
    that.startCall = function (params) {
        var call = null;
        params = params || {};

        log.debug('Endpoint.call');
        client.verifyConnected();
        if (typeof params.caller !== 'boolean') {
            params.caller = true;
        }

        if (!that.id) {
            log.error("Can't start a call without endpoint ID!");
            return;
        }

        params.instanceId = instanceId;
        params.remoteEndpoint = that;

        params.signalOffer = function (signalParams) {
            var onSuccess = signalParams.onSuccess;
            var onError = signalParams.onError;
            delete signalParams.onSuccess;
            delete signalParams.onError;

            signalParams.signalType = 'offer';
            signalParams.target = 'call';
            signalParams.recipient = that;

            signalingChannel.sendSDP(signalParams).done(onSuccess, onError);
        };
        params.signalAnswer = function (signalParams) {
            signalParams.signalType = 'answer';
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalParams.sessionId = signalParams.call.sessionId;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'call';
            signalParams.connectionId = signalParams.call.connectionId;
            signalParams.sessionId = signalParams.call.sessionId;
            signalParams.recipient = that;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalModify = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalParams.sessionId = signalParams.call.sessionId;
            signalingChannel.sendModify(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send modify.", err.message, err.stack);
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalParams.sessionId = signalParams.call.sessionId;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.warn("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalHangup = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalParams.sessionId = signalParams.call.sessionId;
            signalingChannel.sendHangup(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send hangup.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            log.debug("Sending debug report", signalParams.report);
            signalingChannel.sendReport(signalParams).done(null, function errorHandler(err) {
                log.warn("Couldn't debug report.", err.message, err.stack);
            });
        };

        params.signalingChannel = signalingChannel;
        call = respoke.Call(params);
        addCall({call: call});
        return call;
    };

    /**
     * Create a new DirectConnection.  This method creates a new Call as well, attaching this DirectConnection to
     * it for the purposes of creating a peer-to-peer link for sending data such as messages to the other endpoint.
     * Information sent through a DirectConnection is not handled by the cloud infrastructure.  If there is already
     * a direct connection open, this method will resolve the promise with that direct connection instead of
     * attempting to create a new one.
     *
     *     endpoint.startDirectConnection({
     *         onOpen: function (evt) {}
     *     });
     *
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.startDirectConnection
     * @param {object} params
     * @param {respoke.Call.directConnectionSuccessHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {respoke.DirectConnection.onStart} [params.onStart] - A callback for when setup of the direct
     * connection begins. The direct connection will not be open yet.
     * @param {respoke.DirectConnection.onOpen} [params.onOpen] - A callback for receiving notification of when
     * the DirectConnection is open and ready to be used.
     * @param {respoke.DirectConnection.onError} [params.onError] - Callback for errors setting up the direct
     * connection.
     * @param {respoke.DirectConnection.onClose} [params.onClose] - A callback for receiving notification of
     * when the DirectConnection is closed and the two Endpoints are disconnected.
     * @param {respoke.DirectConnection.onAccept} [params.onAccept] - Callback for when the user accepts the
     * request for a direct connection and setup begins.
     * @param {respoke.DirectConnection.onMessage} [params.onMessage] - A callback for receiving messages sent
     * through the DirectConnection.
     * @param {string} [params.connectionId] - An optional connection ID to use for this connection. This allows
     * the connection to be made to a specific instance of an endpoint in the case that the same endpoint is logged
     * in from multiple locations.
     * @returns {respoke.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.startDirectConnection = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
        var call;

        try {
            client.verifyConnected();
        } catch (err) {
            deferred.reject(err);
            return retVal;
        }

        if (that.directConnection || params.create === false) {
            deferred.resolve(that.directConnection);
            return retVal;
        }

        if (typeof params.caller !== 'boolean') {
            params.caller = true;
        }

        if (!that.id) {
            deferred.reject(new Error("Can't start a direct connection without endpoint ID!"));
            return retVal;
        }

        params.instanceId = instanceId;
        params.remoteEndpoint = that;

        params.signalOffer = function (signalParams) {
            var onSuccess = signalParams.onSuccess;
            var onError = signalParams.onError;
            delete signalParams.onSuccess;
            delete signalParams.onError;

            signalParams.signalType = 'offer';
            signalParams.target = 'directConnection';
            signalParams.recipient = that;

            signalingChannel.sendSDP(signalParams).done(onSuccess, onError);
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalAnswer = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalParams.signalType = 'answer';
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalHangup = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendHangup(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send hangup.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            signalParams.report.target = 'directConnection';
            log.debug("Not sending report");
            log.debug(signalParams.report);
        };
        params.needDirectConnection = true;
        // Don't include audio in the offer SDP
        params.offerOptions = {
            mandatory: {
                OfferToReceiveAudio: false
            }
        };

        params.signalingChannel = signalingChannel;
        call = respoke.Call(params);
        addCall({call: call});
        call.listen('direct-connection', function directConnectionHandler(evt) {
            that.directConnection = evt.directConnection;
            if (params.caller !== true) {
                if (!client.hasListeners('direct-connection') &&
                        !client.hasListeners('direct-connection') &&
                        !call.hasListeners('direct-connection')) {
                    that.directConnection.reject();
                    deferred.reject(new Error("Got an incoming direct connection with no handlers to accept it!"));
                    return;
                }

                deferred.resolve(that.directConnection);
                that.directConnection.listen('close', function closeHandler(evt) {
                    that.directConnection = undefined;
                }, true);
            }
        }, true);

        return retVal;
    };

    /**
     * Find the presence out of all known connections with the highest priority (most availability)
     * and set it as the endpoint's resolved presence.
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.resolvePresence
     * @private
     */
    that.resolvePresence = function () {

        var presenceList = that.connections.map(function (connection) {
            return connection.presence;
        });

        if (resolveEndpointPresence !== undefined) {
            that.presence = resolveEndpointPresence(presenceList);
        } else {
            var options = ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'];
            var idList;

            /*
             * Sort the connections array by the priority of the value of the presence of that
             * connectionId. This will cause the first element in the list to be the id of the
             * session with the highest priority presence so we can access it by the 0 index.
             * TODO: If we don't really care about the sorting and only about the highest priority
             * we could use Array.prototype.every to improve this algorithm.
             */
            idList = that.connections.sort(function sorter(a, b) {
                var indexA = options.indexOf(a.presence);
                var indexB = options.indexOf(b.presence);
                // Move it to the end of the list if it isn't one of our accepted presence values
                indexA = indexA === -1 ? 1000 : indexA;
                indexB = indexB === -1 ? 1000 : indexB;
                return indexA < indexB ? -1 : (indexB < indexA ? 1 : 0);
            });

            if (idList[0]) {
                that.presence = idList[0].presence;
            } else {
                that.presence = 'unavailable';
            }
        }
    };

    /**
     * Get the Connection with the specified id. The connection ID is optional if only one connection exists.
     *
     *     var connection = endpoint.getConnection({
     *         connectionId: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXX"
     *     });
     *
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.getConnection
     * @private
     * @param {object} params
     * @param {string} [params.connectionId]
     * @return {respoke.Connection}
     */
    that.getConnection = function (params) {
        var connection = null;
        params = params || {};
        if (that.connections.length === 1 &&
                (!params.connectionId || that.connections[0] === params.connectionId)) {
            return that.connections[0];
        }

        if (!params || !params.connectionId) {
            throw new Error("Can't find a connection without the connectionId.");
        }

        that.connections.every(function eachConnection(conn) {
            if (conn.id === params.connectionId) {
                connection = conn;
                return false;
            }
            return true;
        });

        return connection;
    };

    return that;
}; // End respoke.Endpoint
/**
 * Handle messages sent to the logged-in user from this one Endpoint.  This callback is called every time
 * respoke.Endpoint#message fires.
 * @callback respoke.Endpoint.onMessage
 * @param {respoke.Event} evt
 * @param {respoke.TextMessage} evt.message - the message
 * @param {respoke.Endpoint} evt.target
 * @param {string} evt.name - the event name
 */
/**
 * Handle presence notifications from this one Endpoint.  This callback is called every time
 * respoke.Endpoint#message fires.
 * @callback respoke.Endpoint.onPresence
 * @param {respoke.Event} evt
 * @param {string|number|object|Array} evt.presence - the Endpoint's presence
 * @param {respoke.Endpoint} evt.target
 * @param {string} evt.name - the event name
 */
 /**
 * Handle resolving presence for this endpoint
 * @callback respoke.Client.resolveEndpointPresence
 * @param {Array<object>} connectionPresence
 * @returns {object|string|number}
 */
