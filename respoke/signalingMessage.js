/**
 * Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software.
 * @ignore
 */

/**
 * A signaling message and the information needed to route it.
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
module.exports = function (params) {
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
        'signalType', 'sessionId', 'callerId', 'sessionDescription', 'iceCandidates', 'offering', 'target', 'signalId',
        'requesting', 'reason', 'error', 'status'
    ];

    params.version = '1.0';

    /**
     * Parse rawMessage and set attributes required for message delivery.
     * @memberof! respoke.SignalingMessage
     * @method respoke.SignalingMessage.parse
     * @private
     */
    function parse() {
        if (params.rawMessage) {
            that = JSON.parse(params.rawMessage.body); // Incoming message
            that.endpointId = params.rawMessage.header.from;
            that.connectionId = params.rawMessage.header.fromConnection;
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
        }
    }

    parse();
    return that;
}; // End respoke.SignalingMessage
