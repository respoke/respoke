/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/*global respoke: false */
/**
 * The purpose of the class is so that Client and Endpoint can share the same presence.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId
 * @param {string} params.id
 * @returns {respoke.Presentable}
 */
respoke.Presentable = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Presentable
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    /**
     * A name to identify the type of this object.
     * @memberof! respoke.Presentable
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Presentable';
    /**
     * @memberof! respoke.Presentable
     * @name presence
     * @type {string}
     */
    that.presence = 'unavailable';

    /**
     * @memberof! respoke.DirectConnection
     * @name client
     * @type {respoke.Client}
     * @private
     */
    var client = respoke.getClient(instanceId);

    /**
     * Set the presence on the object and the session
     * @memberof! respoke.Presentable
     * @method respoke.Presentable.setPresence
     * @param {object} params
     * @param {string} params.presence
     * @param {string} params.connectionId
     * @fires respoke.Presentable#presence
     * @private
     */
    that.setPresence = function (params) {
        var connection;
        params = params || {};
        params.presence = params.presence || 'available';
        params.connectionId = params.connectionId || that.connectionId;

        if (that.className === 'respoke.Client' || that.className === 'respoke.Connection') {
            that.presence = params.presence;
            if (that.className === 'respoke.Connection') {
                that.getEndpoint().resolvePresence();
            }
        } else if (that.className === 'respoke.Endpoint') {
            if (!params.connectionId) {
                throw new Error("Can't set Endpoint presence without a connectionId.");
            }

            connection = that.getConnection({connectionId: params.connectionId}) || client.getConnection({
                connectionId: params.connectionId,
                skipCreate: false,
                endpointId: that.id
            });

            connection.presence = params.presence;
            that.resolvePresence();
        }

        /**
         * This event indicates that the presence for this endpoint has been updated.
         * @event respoke.Presentable#presence
         * @type {respoke.Event}
         * @property {string} presence
         * @property {string} name - the event name.
         * @property {respoke.Presentable} target
         */
        that.fire('presence', {
            presence: that.presence
        });
    };

    /**
     * Get the presence.
     * @memberof! respoke.Presentable
     * @method respoke.Presentable.getPresence
     * @returns {string} A string representing the current presence of this endpoint.
     */
    that.getPresence = function () {
        return that.presence;
    };

    return that;
}; // End respoke.Presentable

/**
 * Represents remote Endpoints. Endpoints are users of this application that are not the one logged into this
 * instance of the application. An Endpoint could be logged in from multiple other instances of this app, each of
 * which is represented by a Connection. The client can interact with endpoints by calling them or
 * sending them messages. An endpoint can be a person using an app from a browser or a script using the APIs on
 * a server.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments respoke.Presentable
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.instanceId
 * @returns {respoke.Endpoint}
 */
respoke.Endpoint = function (params) {
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

    var clone = function (source) {
        return JSON.parse(JSON.stringify(source));
    };

    delete that.signalingChannel;
    delete that.instanceId;
    delete that.connectionId;
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
     * @memberof! respoke.Endpoint
     * @name connections
     * @type {Array<respoke.Connection>}
     */
    that.connections = [];
    client.listen('disconnect', function disconnectHandler() {
        that.connections = [];
    });

    /**
     * Send a message to the endpoint through the infrastructure.
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
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.startAudioCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
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
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
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
            video : false,
            audio : true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call with audio and video.
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.startVideoCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
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
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
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
            video : true,
            audio : true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Create a new call.
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
     * @returns {respoke.Call}
     */
    that.startCall = function (params) {
        var call = null;
        var combinedCallSettings = clone(client.callSettings);
        params = params || {};

        log.trace('Endpoint.call');
        client.verifyConnected();
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
        params.instanceId = instanceId;
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
            log.debug("Sending debug report", signalParams.report);
            signalingChannel.sendReport(signalParams);
        };

        params.signalingChannel = signalingChannel;

        call = respoke.Call(params);

        if (params.caller === true) {
            call.answer();
        }

        return call;
    };

    /**
     * Create a new DirectConnection.  This method creates a new Call as well, attaching this DirectConnection to
     * it for the purposes of creating a peer-to-peer link for sending data such as messages to the other endpoint.
     * Information sent through a DirectConnection is not handled by the cloud infrastructure.  If there is already
     * a direct connection open, this method will resolve the promise with that direct connection instead of
     * attempting to create a new one.
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
     * @param {RTCServers} [params.servers] - Additional ICE/STUN/TURN servers to use in connecting.
     * @param {string} [params.connectionId] - An optional connection ID to use for this connection. This allows
     * the connection to be made to a specific instance of an endpoint in the case that the same endpoint is logged
     * in from multiple locations.
     * @returns {respoke.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.startDirectConnection = function (params) {
        var combinedConnectionSettings = clone(client.callSettings);
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
        var call;
        params = params || {};

        try {
            client.verifyConnected();
        } catch (err) {
            deferred.reject(err);
            return retVal;
        }

        if (that.directConnection) {
            deferred.resolve(that.directConnection);
            return retVal;
        }

        log.trace('Endpoint.startDirectConnection', params);
        if (params.caller === undefined) {
            params.caller = true;
        }

        if (!that.id) {
            deferred.reject(new Error("Can't start a direct connection without endpoint ID!"));
            return retVal;
        }

        // Apply connection-specific connectionSettings to the app's defaults
        combinedConnectionSettings.constraints = params.constraints || combinedConnectionSettings.constraints;
        combinedConnectionSettings.servers = params.servers || combinedConnectionSettings.servers;

        params.callSettings = combinedConnectionSettings;
        params.instanceId = instanceId;
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
        // Don't include audio in the offer SDP
        params.offerOptions = {
            mandatory: {
                OfferToReceiveAudio: false
            }
        };

        call = respoke.Call(params);
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

        if (params.caller === true) {
            call.answer(params);
        }
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
     * @memberof! respoke.Endpoint
     * @method respoke.Endpoint.getConnection
     * @private
     * @param {object} params
     * @param {string} [params.connectionId]
     * @return {respoke.Connection}
     */
    that.getConnection = function (params) {
        var connection;
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
 * @param {respoke.string} evt.presence - the Endpoint's presence
 * @param {respoke.Endpoint} evt.target
 * @param {string} evt.name - the event name
 */

/**
 * Represents remote Connections which belong to an endpoint. An Endpoint can be authenticated from multiple devices,
 * browsers, or tabs. Each of these separate authentications is a Connection. The client can interact
 * with connections by calling them or sending them messages.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments respoke.Presentable
 * @param {object} params
 * @param {string} params.id
 * @returns {respoke.Connection}
 */
respoke.Connection = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Connection
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
     * @memberof! respoke.Connection
     * @name id
     * @type {string}
     */
    that.id = that.id || that.connectionId;
    if (!that.id) {
        throw new Error("Can't make a connection without an id.");
    }
    delete that.instanceId;
    delete that.connectionId;

    /**
     * A name to identify the type of this object.
     * @memberof! respoke.Connection
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Connection';

    /**
     * Send a message to this connection of an endpoint only through the infrastructure.
     * @memberof! respoke.Connection
     * @method respoke.Connection.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
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
     * @memberof! respoke.Connection
     * @method respoke.Connection.startCall
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
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @returns {respoke.Call}
     */
    that.startCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().startCall(params);
    };

    /**
     * Create a new audio-only call.
     * @memberof! respoke.Connection
     * @method respoke.Connection.startAudioCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
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
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @returns {respoke.Call}
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
     * @memberof! respoke.Connection
     * @method respoke.Connection.startVideoCall
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video
     * element with the remote
     * audio and/or video attached.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has
     * been hung up.
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
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @returns {respoke.Call}
     */
    that.startVideoCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().startCall(params);
    };

    /**
     * Create a new DirectConnection with this particular connection, only. The DirectConnection cannot be answered
     * by another connection of this Endpoint.  This method creates a new Call as well, attaching this
     * DirectConnection to it for the purposes of creating a peer-to-peer link for sending data such as messages to
     * the other endpoint. Information sent through a DirectConnection is not handled by the cloud infrastructure.
     * @memberof! respoke.Connection
     * @method respoke.Connection.startDirectConnection
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
     * @param {respoke.DirectConnection.onMessage} [params.onMessage] - A callback for receiving messages sent
     * through the DirectConnection.
     * @param {respoke.DirectConnection.onAccept} [params.onAccept] - Callback for when the user accepts the
     * request for a direct connection and setup begins.
     * @param {RTCServers} [params.servers] - Additional ICE/STUN/TURN servers to use in connecting.
     * @returns {respoke.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.startDirectConnection = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().startDirectConnection(params);
    };

    /**
     * Get the Endpoint that this Connection belongs to.
     * @memberof! respoke.Connection
     * @method respoke.Connection.getEndpoint
     * @returns {respoke.Endpoint}
     */
    that.getEndpoint = function () {
        return client.getEndpoint({id: that.endpointId});
    };

    return that;
}; // End respoke.Connection
