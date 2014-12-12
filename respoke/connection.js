/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var respoke = require('./respoke');

/**
 * A `respoke.Connection` always belongs to an Endpoint.
 *
 * There is a distinction between Endpoint and Connection because an Endpoint can be authenticated
 * from multiple devices, browsers, or browser tabs. Each of these separate authentications is a Connection.
 * A Client can choose to interact with connections of the same endpoint in different ways.
 *
 * @constructor
 * @class respoke.Connection
 * @augments respoke.Presentable
 * @param {object} params
 * @param {string} params.id
 * @returns {respoke.Connection}
 */
module.exports = function (params) {
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
     * The connection id.
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
     * Send a message to this connection of an endpoint. If the endpoint has multiple connections,
     * it will only receive the message at this connection.
     *
     *     connection.sendMessage({
     *         message: "PJ, put that PBR down!"
     *     });
     *
     * **Using callbacks** will disable promises.
     * @memberof! respoke.Connection
     * @method respoke.Connection.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise|undefined}
     */
    that.sendMessage = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().sendMessage(params);
    };

    /**
     * Create a new Call for a voice and/or video call this particular connection, only. The Call cannot be answered
     * by another connection of this Endpoint.
     *
     *     connection.startCall({
     *         onConnect: function (evt) {}
     *     });
     *
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
     * @param {RTCConstraints} [params.constraints]
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {HTMLVideoElement} [params.videoLocalElement] - Pass in an optional html video element to have local video attached to it.
     * @param {HTMLVideoElement} [params.videoRemoteElement] - Pass in an optional html video element to have remote video attached to it.
     * @returns {respoke.Call}
     */
    that.startCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().startCall(params);
    };

    /**
     * Create a new audio-only call.
     *
     *     connection.startAudioCall({
     *         onConnect: function (evt) {}
     *     });
     *
     * @memberof! respoke.Connection
     * @method respoke.Connection.startAudioCall
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
     * @returns {respoke.Call}
     */
    that.startAudioCall = function (params) {
        params = params || {};
        params.connectionId = that.id;
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
     *     connection.startVideoCall({
     *         onConnect: function (evt) {}
     *     });
     *
     * @memberof! respoke.Connection
     * @method respoke.Connection.startVideoCall
     * @param {object} params
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
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
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
     *
     *     connection.startDirectConnection({
     *         onOpen: function (evt) {}
     *     });
     *
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
        return client.getEndpoint({
            id: that.endpointId,
            skipPresence: true
        });
    };

    return that;
}; // End respoke.Connection
