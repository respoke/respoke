/**************************************************************************************************
 *
 * Copyright (c) 2013 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 * @test
 */

/**
 * @author Erin Spiceland <espiceland@digium.com>
 * @namespace webrtc
 * @global
 */
var webrtc = {
    'instances': {}
};
log.setLevel('debug');

/**
 * @static
 * @member webrtc
 * @returns {webrtc.Client}
 */
webrtc.getClient = function (id) {
    "use strict";
    if (id === undefined) {
        log.debug(new Error().stack);
    }
    return webrtc.instances[id];
};

/**
 * @static
 * @member webrtc
 * @returns {number}
 */
webrtc.makeUniqueID = function () {
    "use strict";
    return Math.floor(Math.random() * 100000000);
};

/**
 * Loop, checking hasOwnProperty() before acting on elements.
 * @params {func} A function to call on each element that is the object's own.
 */
Object.defineProperty(Object.prototype, 'forOwn', {
    value: function (func) {
        "use strict";
        for (var name in this) {
            if (this.hasOwnProperty(name)) {
                func(this[name], name);
            }
        }
    },
    enumerable: false,
    configurable: false
});

/**
 * Find out if a thing is a number.
 * @param {object} number An object to test.
 * @returns {boolean}
 * @static
 */
Object.defineProperty(Object.prototype, 'isNumber', {
    value: function (number) {
        "use strict";
        return !isNaN(parseFloat(number)) && isFinite(number) && number.length === undefined;
    },
    enumerable: false,
    configurable: false
});

/**
 * Simple function to add a method to the instance.  Meant to be used in the following form:
 * var myFunction = that.publicize('myFunction', function);
 * In this way, we have a private reference to the function so the developer cannot override
 * some functions.
 * @param {string} name The function's name
 * @param {function} func The function
 * @returns {function} The unmodified function.
 */
Object.defineProperty(Object.prototype, 'publicize', {
    value: function (name, func) {
        "use strict";
        this[name] = func;
        return func;
    },
    enumerable: false,
    configurable: false
});

/**
 * Empty base class.
 * @class webrtc.Class
 * @classdesc Empty base class.
 * @constructor
 * @author Erin Spiceland <espiceland@digium.com>
 */
webrtc.Class = function (params) {
    "use strict";
    var that = { 'className': 'webrtc.Class' };
    params = params || {};
    var client = params.client;
    delete that.client;
    params.forOwn(function (thing, name) {
        that[name] = thing;
    });

    /**
     * Get the name of the class.
     * @memberof! webrtc.Class
     * @method webrtc.Class.getClass
     * @returns {string} Class name
     */
    var getClass = that.publicize('getClass', function () {
        return that.className;
    });

    return that;
}; // End webrtc.Class


/**
 * @callback successCallback
 * @param {number|string|object} result
 */

/**
 * @callback failureCallback
 * @param {string} err
 * @param {number|string|object} result
 */

/**
 * @event webrtc.Contacts#new
 * @type {webrtc.Contact}
 */

/**
 * @event webrtc.Contacts#remove
 * @type {webrtc.Contact}
 */

/**
 * @event webrtc.Contacts#presence
 * @type {object}
 */

/**
 * @event webrtc.Presentable#presence
 * @type {string}
 */

/**
 * @event webrtc.Endpoint#message
 * @type {object}
 */

/**
 * @event webrtc.Endpoint#signaling
 * @type {object}
 */

/**
 * @event webrtc.Call#local-stream-received
 * @type {DOM}
 */

/**
 * @event webrtc.Call#remote-stream-received
 * @type {DOM}
 */

/**
 * @event webrtc.Call#remote-stream-removed
 * @type {object}
 */

/**
 * @event webrtc.Call#hangup
 * @type {boolean}
 */

/**
 * @event webrtc.Call#video-muted
 */

/**
 * @event webrtc.Call#video-unmuted
 */

/**
 * @event webrtc.Call#audio-muted
 */

/**
 * @event webrtc.Call#audio-unmuted
 */

/**
 * @event webrtc.MediaStream#video-muted
 */

/**
 * @event webrtc.MediaStream#video-unmuted
 */

/**
 * @event webrtc.MediaStream#audio-muted
 */

/**
 * @event webrtc.MediaStream#audio-unmuted
 */

/**
 * @event webrtc.SignalingChannel#offer
 * @type {RTCSessionDescription}
 */

/**
 * @event webrtc.SignalingChannel#answer
 * @type {RTCSessionDescription}
 */

/**
 * @event webrtc.SignalingChannel#candidate
 * @type {RTCIceCandidate}
 */

/**
 * @event webrtc.SignalingChannel#bye
 */

Q.longStackSupport = true;
Q.stackJumpLimit = 5;
Q.longStackJumpLimit = 20;
