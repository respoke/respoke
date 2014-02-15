/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * @author Erin Spiceland <espiceland@digium.com>
 * @namespace brightstream
 * @global
 */
var brightstream = {
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
 * @member brightstream
 * @returns {brightstream.Client}
 * @param {object} Parameters to the brightstream.Client constructor.
 */
brightstream.connect = function (params) {
    "use strict";
    return brightstream.Client(params);
};

/**
 * @static
 * @member brightstream
 * @returns {brightstream.Client}
 * @param {number} The Client ID.
 */
brightstream.getClient = function (id) {
    "use strict";
    if (id === undefined) {
        log.debug("Can't call getClient with no client ID.", new Error().stack);
    }
    if (!brightstream.instances[id]) {
        log.debug("No client instance with id", id);
    }
    return brightstream.instances[id];
};

/**
 * @static
 * @member brightstream
 * @returns {brightstream.Client}
 * @param {object} Parameters to the Client constructor
 */
brightstream.createClient = function (params) {
    "use strict";
    return brightstream.Client(params);
};

/**
 * @static
 * @member brightstream
 * @returns {number}
 */
brightstream.makeUniqueID = function () {
    "use strict";
    return Math.floor(Math.random() * 100000000);
};

/**
 * @static
 * @member brightstream
 * @returns {number}
 */
brightstream.makeDeferred = function (onSuccess, onError) {
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
 * @class brightstream.Class
 * @classdesc Empty base class.
 * @constructor
 * @author Erin Spiceland <espiceland@digium.com>
 */
brightstream.Class = function (params) {
    "use strict";
    var that = params.that || {};
    that.className = 'brightstream.Class';
    params = params || {};
    var client = params.client;
    delete params.that;
    delete that.client;
    Object.keys(params).forEach(function copyParam(name) {
        that[name] = params[name];
    });

    /**
     * Get the name of the class.
     * @memberof! brightstream.Class
     * @method brightstream.Class.getClass
     * @returns {string} Class name
     */
    var getClass = that.publicize('getClass', function () {
        return that.className;
    });

    return that;
}; // End brightstream.Class


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
 * @event brightstream.Endpoints#new
 * @type {brightstream.Endpoint}
 */

/**
 * @event brightstream.Endpoints#remove
 * @type {brightstream.Endpoint}
 */

/**
 * @event brightstream.Endpoints#presence
 * @type {object}
 */

/**
 * @event brightstream.Presentable#presence
 * @type {string}
 */

/**
 * @event brightstream.Endpoint#message
 * @type {object}
 */

/**
 * @event brightstream.Endpoint#signaling
 * @type {object}
 */

/**
 * @event brightstream.Call#local-stream-received
 * @type {DOM}
 */

/**
 * @event brightstream.Call#remote-stream-received
 * @type {DOM}
 */

/**
 * @event brightstream.Call#remote-stream-removed
 * @type {object}
 */

/**
 * @event brightstream.Call#hangup
 * @type {boolean}
 */

/**
 * @event brightstream.Call#video-muted
 */

/**
 * @event brightstream.Call#video-unmuted
 */

/**
 * @event brightstream.Call#audio-muted
 */

/**
 * @event brightstream.Call#audio-unmuted
 */

/**
 * @event brightstream.MediaStream#video-muted
 */

/**
 * @event brightstream.MediaStream#video-unmuted
 */

/**
 * @event brightstream.MediaStream#audio-muted
 */

/**
 * @event brightstream.MediaStream#audio-unmuted
 */

/**
 * @event brightstream.SignalingChannel#offer
 * @type {RTCSessionDescription}
 */

/**
 * @event brightstream.SignalingChannel#answer
 * @type {RTCSessionDescription}
 */

/**
 * @event brightstream.SignalingChannel#candidate
 * @type {RTCIceCandidate}
 */

/**
 * @event brightstream.SignalingChannel#bye
 */
