/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

/**
 * A text message and the information needed to route it.
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
module.exports = function (params) {
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
                that.timestamp = params.rawMessage.header.timestamp;
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
