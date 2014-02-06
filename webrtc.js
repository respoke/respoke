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
    streams: {},
    instances: {}
};
log.setLevel('debug');

Q.longStackSupport = true;
Q.stackJumpLimit = 5;
Q.longStackJumpLimit = 20;
Q.stopUnhandledRejectionTracking();

/**
 * @static
 * @member webrtc
 * @returns {webrtc.Client}
 * @params {object} Parameters to the webrtc.Client constructor.
 */
webrtc.connect = function (params) {
    "use strict";
    return webrtc.Client(params);
};

/**
 * @static
 * @member webrtc
 * @returns {webrtc.Client}
 * @params {number} The Client ID.
 */
webrtc.getClient = function (id) {
    "use strict";
    if (id === undefined) {
        log.debug("Can't call getClient with no client ID.", new Error().stack);
    }
    if (!webrtc.instances[id]) {
        log.debug("No client instance with id", id);
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
 * @static
 * @member webrtc
 * @returns {number}
 */
webrtc.makeDeferred = function (onSuccess, onError) {
    "use strict";
    var deferred = Q.defer();
    if (onSuccess || onError) {
        onSuccess = typeof onSuccess === 'function' ? onSuccess : function () {};
        onError = typeof onError === 'function' ? onError : function () {};
        deferred.promise.done(onSuccess, onError);
    }
    return deferred;
};

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
    var that = params.that || {};
    that.className = 'webrtc.Class';
    params = params || {};
    var client = params.client;
    delete params.that;
    delete that.client;
    Object.keys(params).forEach(function copyParam(name) {
        that[name] = params[name];
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
