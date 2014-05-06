/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/*global brightstream: false */
/**
 * The purpose of the class is so that Client and Endpoint can share the same presence.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client
 * @param {string} params.id
 * @returns {brightstream.Presentable}
 */
brightstream.Presentable = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Presentable
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.Presentable
     * @name className - A name to identify the type of this object.
     * @type {string}
     */
    that.className = 'brightstream.Presentable';
    /**
     * @memberof! brightstream.Presentable
     * @name presence
     * @type {string}
     */
    that.presence = 'unavailable';

    /**
     * @memberof! brightstream.DirectConnection
     * @name clientObj
     * @type {brightstream.Client}
     * @private
     */
    var clientObj = brightstream.getClient(client);

    /**
     * Set the presence on the object and the session
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.setPresence
     * @param {object} params
     * @param {string} params.presence
     * @param {string} params.connectionId
     * @fires brightstream.Presentable#presence
     * @private
     */
    that.setPresence = function (params) {
        var connection;
        params = params || {};
        params.presence = params.presence || 'available';
        params.connectionId = params.connectionId || that.connectionId;

        if (that.className === 'brightstream.Client' || that.className === 'brightstream.Connection') {
            that.presence = params.presence;
            if (that.className === 'brightstream.Connection') {
                that.getEndpoint().resolvePresence();
            }
        } else if (!params.connectionId) {
            throw new Error("Can't set Endpoint presence without a connectionId.");
        } else {
            connection = that.getConnection({connectionId: params.connectionId});
            if (connection) {
                connection.presence = params.presence;
            } else {
                connection = clientObj.getConnection({
                    connectionId: params.connectionId,
                    skipCreate: false,
                    endpointId: that.id
                });
                connection.presence = params.presence;
            }
            that.resolvePresence();
        }

        /**
         * This event indicates that the presence for this endpoint has been updated.
         * @event brightstream.Presentable#presence
         * @type {brightstream.Event}
         * @property {string} presence
         * @property {string} name - the event name.
         * @property {brightstream.Presentable} target
         */
        that.fire('presence', {
            presence: that.presence
        });
    };

    /**
     * Get the presence.
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.getPresence
     * @returns {string} A string representing the current presence of this endpoint.
     */
    that.getPresence = function () {
        return that.presence;
    };

    return that;
}; // End brightstream.Presentable

/**
 * Represents remote Endpoints. Endpoints are users of this application that are not the one logged into this
 * instance of the application. An Endpoint could be logged in from multiple other instances of this app, each of
 * which is represented by a Connection. The client can interact with endpoints by calling them or
 * sending them messages. An endpoint can be a person using an app from a browser or a script using the APIs on
 * a server.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @param {object} params
 * @param {string} params.id
 * @returns {brightstream.Endpoint}
 */
brightstream.Endpoint = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Endpoint
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.Presentable(params);
    /**
     * @memberof! brightstream.DirectConnection
     * @name clientObj
     * @type {brightstream.Client}
     * @private
     */
    var clientObj = brightstream.getClient(client);
    /**
     * @memberof! brightstream.DirectConnection
     * @name signalingChannel
     * @type {brightstream.SignalingChannel}
     * @private
     */
    var signalingChannel = clientObj.getSignalingChannel();
    delete that.client;
    delete that.connectionId;
    /**
     * A name to identify the type of this object.
     * @memberof! brightstream.Endpoint
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Endpoint';
    /**
     * A direct connection to this endpoint. This can be used to send direct messages.
     * @memberof! brightstream.Endpoint
     * @name directConnection
     * @type {brightstream.DirectConnection}
     */
    that.directConnection = null;

    /**
     * @memberof! brightstream.Endpoint
     * @name connections
     * @type {Array<brightstream.Connection>}
     */
    that.connections = [];
    clientObj.listen('disconnect', function disconnectHandler() {
        that.connections = [];
    });

    /**
     * Send a message to the endpoint through the infrastructure.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {string} [params.connectionId]
     * @param {brightstream.Client.successHandler} [params.onSuccess] - Success handler for this invocation of this
     * method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this method
     * only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};

        return signalingChannel.sendMessage({
            connectionId: params.connectionId,
            message: params.message,
            recipient: that,
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    };

    /**
     * Create a new audio-only call.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.startAudioCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {brightstream.Call.onRemoteVideo} [params.onRemoteVideo] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {brightstream.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @returns {brightstream.Call}
     */
    that.startAudioCall = function (params) {
        params = params || {};
        params.constraints = {
            video : false,
            audio : true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call with audio and video.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.startVideoCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {brightstream.Call.onRemoteVideo} [params.onRemoteVideo] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {brightstream.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @returns {brightstream.Call}
     */
    that.startVideoCall = function (params) {
        params = params || {};
        params.constraints = {
            video : true,
            audio : true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.startCall
     * @param {object} params
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {brightstream.Call.onRemoteVideo} [params.onRemoteVideo] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {brightstream.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @returns {brightstream.Call}
     */
    that.startCall = function (params) {
        var call = null;
        var clientObj = brightstream.getClient(client);
        var combinedCallSettings = clientObj.getCallSettings();
        params = params || {};

        log.trace('Endpoint.call');
        log.debug('Default callSettings is', combinedCallSettings);
        if (params.caller === undefined) {
            params.caller = true;
        }

        if (!that.id) {
            log.error("Can't start a call without endpoint ID!");
            return;
        }

        // Apply call-specific callSettings to the app's defaults
        combinedCallSettings.constraints = params.constraints || combinedCallSettings.constraints;
        combinedCallSettings.servers = params.servers || combinedCallSettings.servers;
        log.debug('Final callSettings is', combinedCallSettings);

        params.callSettings = combinedCallSettings;
        params.client = client;
        params.remoteEndpoint = that;

        params.signalOffer = function (signalParams) {
            signalParams.signalType = 'offer';
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't place a call.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalAnswer = function (signalParams) {
            signalParams.signalType = 'answer';
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'call';
            signalParams.connectionId = signalParams.connectionId;
            signalParams.recipient = that;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalModify = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendModify(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send modify.", err.message, err.stack);
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalHangup = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendHangup(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send hangup.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            log.debug("Sending report!");
            log.debug(signalParams);
            //signalingChannel.sendReport(signalParams);
        };
        call = brightstream.Call(params);

        if (params.caller === true) {
            call.answer();
        }
        clientObj.addCall({
            call: call,
            endpoint: that
        });

        // Don't use params.onHangup here. Will overwrite the developer's callback.
        call.listen('hangup', function hangupListener(evt) {
            clientObj.removeCall({id: call.id});
        }, true);
        return call;
    };

    /**
     * Create a new DirectConnection.  This method creates a new Call as well, attaching this DirectConnection to
     * it for the purposes of creating a peer-to-peer link for sending data such as messages to the other endpoint.
     * Information sent through a DirectConnection is not handled by the cloud infrastructure.  If there is already
     * a direct connection open, this method will resolve the promise with that direct connection instead of
     * attempting to create a new one.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.startDirectConnection
     * @param {object} params
     * @param {brightstream.Call.directConnectionSuccessHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {brightstream.DirectConnection.onStart} [params.onStart] - A callback for when setup of the direct
     * connection begins. The direct connection will not be open yet.
     * @param {brightstream.DirectConnection.onOpen} [params.onOpen] - A callback for receiving notification of when
     * the DirectConnection is open and ready to be used.
     * @param {brightstream.DirectConnection.onError} [params.onError] - Callback for errors setting up the direct
     * connection.
     * @param {brightstream.DirectConnection.onClose} [params.onClose] - A callback for receiving notification of
     * when the DirectConnection is closed and the two Endpoints are disconnected.
     * @param {brightstream.DirectConnection.onAccept} [params.onAccept] - Callback for when the user accepts the
     * request for a direct connection and setup begins.
     * @param {brightstream.DirectConnection.onMessage} [params.onMessage] - A callback for receiving messages sent
     * through the DirectConnection.
     * @param {RTCServers} [params.servers] - Additional ICE/STUN/TURN servers to use in connecting.
     * @param {string} [params.connectionId] - An optional connection ID to use for this connection. This allows
     * the connection to be made to a specific instance of an endpoint in the case that the same endpoint is logged
     * in from multiple locations.
     * @returns {brightstream.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.startDirectConnection = function (params) {
        params = params || {};
        var clientObj = brightstream.getClient(client);
        var combinedConnectionSettings = clientObj.getCallSettings();
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var call;

        if (that.directConnection) {
            deferred.resolve(that.directConnection);
            return deferred.promise;
        }

        log.trace('Endpoint.startDirectConnection', params);
        if (params.caller === undefined) {
            params.caller = true;
        }

        if (!that.id) {
            deferred.reject(new Error("Can't start a direct connection without endpoint ID!"));
            return deferred.promise;
        }

        // Apply connection-specific callSettings to the app's defaults
        combinedConnectionSettings.servers = params.servers || combinedConnectionSettings.servers;

        params.connectionSettings = combinedConnectionSettings;
        params.client = client;
        params.remoteEndpoint = that;

        params.signalOffer = function (signalParams) {
            signalParams.signalType = 'offer';
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't place a call.", err.message, err.stack);
                signalParams.call.hangup();
            });
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
        params.directConnectionOnly = true;

        call = brightstream.Call(params);
        call.listen('direct-connection', function directConnectionHandler(evt) {
            that.directConnection = evt.directConnection;
            if (params.caller !== true) {
                if (!clientObj.hasListeners('direct-connection') &&
                        !clientObj.hasListeners('direct-connection') &&
                        !call.hasListeners('direct-connection')) {
                    that.directConnection.reject();
                    deferred.reject(new Error("Got an incoming direct connection with no handlers to accept it!"));
                    return deferred.promise;
                }

                deferred.resolve(that.directConnection);
                that.directConnection.listen('close', function closeHandler(evt) {
                    that.directConnection = undefined;
                }, true);
            }
        }, true);

        if (params.caller === true) {
            call.answer(params);
        }
        return deferred.promise;
    };

    /**
     * Find the presence out of all known connections with the highest priority (most availability)
     * and set it as the endpoint's resolved presence.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.resolvePresence
     * @private
     */
    that.resolvePresence = function () {
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
    };

    /**
     * Get the Connection with the specified id. The connection ID is optional if only one connection exists.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.getConnection
     * @private
     * @param {object} params
     * @param {string} [params.connectionId]
     * @return {brightstream.Connection}
     */
    that.getConnection = function (params) {
        var connection;
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
}; // End brightstream.Endpoint
/**
 * Handle messages sent to the logged-in user from this one Endpoint.  This callback is called every time
 * brightstream.Endpoint#message fires.
 * @callback brightstream.Endpoint.onMessage
 * @param {brightstream.Event} evt
 * @param {brightstream.TextMessage} evt.message - the message
 * @param {brightstream.Endpoint} evt.target
 * @param {string} evt.name - the event name
 */
/**
 * Handle presence notifications from this one Endpoint.  This callback is called every time
 * brightstream.Endpoint#message fires.
 * @callback brightstream.Endpoint.onPresence
 * @param {brightstream.Event} evt
 * @param {brightstream.string} evt.presence - the Endpoint's presence
 * @param {brightstream.Endpoint} evt.target
 * @param {string} evt.name - the event name
 */

/**
 * Represents remote Connections which belong to an endpoint. An Endpoint can be authenticated from multiple devices,
 * browsers, or tabs. Each of these separate authentications is a Connection. The client can interact
 * with connections by calling them or sending them messages.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @param {object} params
 * @param {string} params.id
 * @returns {brightstream.Connection}
 */
brightstream.Connection = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Connection
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.Presentable(params);
    /**
     * @memberof! brightstream.DirectConnection
     * @name clientObj
     * @type {brightstream.Client}
     * @private
     */
    var clientObj = brightstream.getClient(client);

    /**
     * @memberof! brightstream.Connection
     * @name id
     * @type {string}
     */
    that.id = that.id || that.connectionId;
    if (!that.id) {
        throw new Error("Can't make a connection without an id.");
    }
    delete that.client;
    delete that.connectionId;

    /**
     * A name to identify the type of this object.
     * @memberof! brightstream.Connection
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Connection';

    /**
     * Send a message to this connection of an endpoint only through the infrastructure.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {brightstream.Client.successHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().sendMessage(params);
    };

    /**
     * Create a new Call for a voice and/or video call this particular connection, only. The Call cannot be answered
     * by another connection of this Endpoint.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.startCall
     * @param {object} params
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {brightstream.Call.onRemoteVideo} [params.onRemoteVideo] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {brightstream.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @returns {brightstream.Call}
     */
    that.startCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().startCall(params);
    };

    /**
     * Create a new audio-only call.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.startAudioCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {brightstream.Call.onRemoteVideo} [params.onRemoteVideo] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been
     * hung up.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {brightstream.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @returns {brightstream.Call}
     */
    that.startAudioCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
        params.constraints = {
            video : false,
            audio : true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call with audio and video.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.startVideoCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {brightstream.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {brightstream.Call.onLocalVideo} [params.onLocalVideo] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {brightstream.Call.onRemoteVideo} [params.onRemoteVideo] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {brightstream.Call.onHangup} [params.onHangup] - Callback for being notified when the call has
     * been hung up.
     * @param {brightstream.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {brightstream.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {brightstream.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {brightstream.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {brightstream.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {brightstream.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @returns {brightstream.Call}
     */
    that.startVideoCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().call(params);
    };

    /**
     * Create a new DirectConnection with this particular connection, only. The DirectConnection cannot be answered
     * by another connection of this Endpoint.  This method creates a new Call as well, attaching this
     * DirectConnection to it for the purposes of creating a peer-to-peer link for sending data such as messages to
     * the other endpoint. Information sent through a DirectConnection is not handled by the cloud infrastructure.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.startDirectConnection
     * @param {object} params
     * @param {brightstream.Call.directConnectionSuccessHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {brightstream.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {brightstream.DirectConnection.onStart} [params.onStart] - A callback for when setup of the direct
     * connection begins. The direct connection will not be open yet.
     * @param {brightstream.DirectConnection.onOpen} [params.onOpen] - A callback for receiving notification of when
     * the DirectConnection is open and ready to be used.
     * @param {brightstream.DirectConnection.onError} [params.onError] - Callback for errors setting up the direct
     * connection.
     * @param {brightstream.DirectConnection.onClose} [params.onClose] - A callback for receiving notification of
     * when the DirectConnection is closed and the two Endpoints are disconnected.
     * @param {brightstream.DirectConnection.onMessage} [params.onMessage] - A callback for receiving messages sent
     * through the DirectConnection.
     * @param {brightstream.DirectConnection.onAccept} [params.onAccept] - Callback for when the user accepts the
     * request for a direct connection and setup begins.
     * @param {RTCServers} [params.servers] - Additional ICE/STUN/TURN servers to use in connecting.
     * @returns {brightstream.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.startDirectConnection = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().startDirectConnection(params);
    };

    /**
     * Get the Endpoint that this Connection belongs to.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.getEndpoint
     * @returns {brightstream.Endpoint}
     */
    that.getEndpoint = function () {
        return clientObj.getEndpoint({id: that.endpointId});
    };

    return that;
}; // End brightstream.Connection
