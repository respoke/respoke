/**
 * Create a new SignalingChannel.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractSignalingChannel
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc Wrap signaling protocols in a generic class. This class is meant to be extended. It
 * cannot be used as-is. It is expected that an implementing class will also implement additional
 * formatting methods and perhaps methods for sending particular types of messages.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.SignalingChannel}
 */
/*global webrtc: false */
webrtc.AbstractSignalingChannel = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventThrower(params);
    delete that.client;
    that.className = 'webrtc.AbstractSignalingChannel';

    var state = 'new';

    /**
     * Open and initiate a signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.open
     * @abstract
     */
    var open = that.publicize('open', function () {
        state = 'open';
    });

    /**
     * Close a signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.close
     * @abstract
     */
    var close = that.publicize('close', function () {
        state = 'closed';
    });

    /**
     * Get the state of the signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.getState
     * @abstract
     */
    var getState = that.publicize('getState', function () {
        return state;
    });

    /**
     * Get the state of the signaling protocol connection or session.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.isOpen
     * @abstract
     */
    var isOpen = that.publicize('isOpen', function () {
        return state === 'open';
    });

    /**
     * Send a message on the signaling protocol.
     * @memberof! webrtc.AbstractSignalingChannel
     * @method webrtc.AbstractSignalingChannel.send
     * @param {string|object} message The string or object to stringify and send.
     * @abstract
     */
    var send = that.publicize('send', function (message) {
    });

    return that;
}; // End webrtc.AbstractSignalingChannel

/**
 * Create a new Message.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.AbstractMessage
 * @constructor
 * @augments webrtc.Class
 * @classdesc A message.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Message}
 */
webrtc.AbstractMessage = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Class(params);
    delete that.client;
    that.className = 'webrtc.AbstractMessage';

    var rawMessage = null;
    var payload = null;
    var recipient = null;
    var sender = null;

    /**
     * Parse rawMessage and save information in payload.
     * @memberof! webrtc.AbstractMessage
     * @method webrtc.AbstractMessage.parse
     * @param {object|string} rawMessage Optional message to parse and replace rawMessage with.
     * @abstract
     */
    var parse = that.publicize('parse', function (thisMsg) {
    });

    /**
     * Get the text portion of the chat message.
     * @memberof! webrtc.AbstractMessage
     * @method webrtc.AbstractMessage.getPayload
     * @returns {object|string} Message payload.
     * @abstract
     */
    var getPayload = that.publicize('getPayload', function () {
    });

    /**
     * Attempt to construct a string from the payload.
     * @memberof! webrtc.AbstractMessage
     * @method webrtc.AbstractMessage.getText
     * @returns {string} A string that may represent the value of the payload.
     * @abstract
     */
    var getText = that.publicize('getText', function () {
    });

    return that;
}; // End webrtc.AbstractMessage
