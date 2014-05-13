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
/*global Bugsnag: true, brightstream: true*/
/*jshint bitwise: false*/
(function brightstreamInit() {
    'use strict';
    window.brightstream = {
        buildNumber: 'NO BUILD NUMBER',
        streams: {},
        instances: {}
    };
    log.setLevel('trace');

    if (!window.skipBugsnag) {
        // Use bugsnag.
        var bugsnag = document.createElement('script');
        var first = document.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(bugsnag, first);

        bugsnag.onload = function () {
            Bugsnag.apiKey = 'dd002244e1682c1c4d8041920207467f';
        };
        bugsnag.src = 'https://d2wy8f7a9ursnm.cloudfront.net/bugsnag-2.min.js';
    }
}());

Q.longStackSupport = true;
Q.stackJumpLimit = 5;
Q.longStackJumpLimit = 20;
Q.stopUnhandledRejectionTracking();

/**
 * This is one of two possible entry points for interating with the library. This method creates a new Client object
 * which represence your app's connection to the cloud infrastructure.  This method automatically calls the
 * client.connect() method after the client is created.
 * @static
 * @member brightstream
 * @param {object} params
 * @param {string} [params.appId]
 * @param {string} [params.baseURL]
 * @param {string} [params.authToken]
 * @param {RTCConstraints} [params.constraints]
 * @param {RTCICEServers} [params.servers]
 * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
 * @param {function} [params.onError] - Error handler for this invocation of this method only.
 * @param {function} [params.onJoin] - Callback for when this client's endpoint joins a group.
 * @param {function} [params.onLeave] - Callback for when this client's endpoint leaves a group.
 * @param {function} [params.onMessage] - Callback for when any message is received from anywhere on the system.
 * @param {function} [params.onDisconnect] - Callback for Client disconnect.
 * @param {function} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
 * @param {function} [params.onCall] - Callback for when this client's user receives a call.
 * @param {function} [params.onDirectConnection] - Callback for when this client's user receives a request for a
 * direct connection.
 * @returns {brightstream.Client}
 * @param {object} Parameters to the brightstream.Client constructor.
 */
brightstream.connect = function (params) {
    "use strict";
    var client = brightstream.Client(params);
    client.connect(params);
    return client;
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
 * This is one of two possible entry points for interating with the library. This method creates a new Client object
 * which represence your app's connection to the cloud infrastructure.  This method does NOT automatically call the
 * client.connect() method after the client is created, so your app will need to call it when it is ready to
 * connect.
 * @static
 * @member brightstream
 * @param {object} params
 * @param {string} [params.appId]
 * @param {string} [params.baseURL]
 * @param {string} [params.authToken]
 * @param {RTCConstraints} [params.constraints]
 * @param {RTCICEServers} [params.servers]
 * @returns {brightstream.Client}
 * @param {object} Parameters to the Client constructor
 */
brightstream.createClient = function (params) {
    "use strict";
    var client;
    if (params.instanceId) {
        client = brightstream.getClient(params.instanceId);
        if (client) {
            return client;
        }
    }
    return brightstream.Client(params);
};

/**
 * @static
 * @private
 * @member brightstream
 * @returns {number}
 */
brightstream.makeGUID = function () {
    "use strict";
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    var uuid = new Array(36);
    var rnd = 0;
    var r;
    for (var i = 0; i < 36; i += 1) {
        if (i === 8 || i === 13 ||  i === 18 || i === 23) {
            uuid[i] = '-';
        } else if (i === 14) {
            uuid[i] = '4';
        } else {
            if (rnd <= 0x02) {
                rnd = 0x2000000 + (Math.random() * 0x1000000) | 0;
            }
            r = rnd & 0xf;
            rnd = rnd >> 4;
            uuid[i] = chars[(i === 19) ? (r & 0x3) | 0x8 : r];
        }
    }
    return uuid.join('');
};

/**
 * This method is used internally to attach handlers to promises that are returned by many methods in the library.
 * It's not recommended that this method be used by developers and apps.
 * @private
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
 * @private
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
 * Simple clone by JSON encode/parse.
 * @param {object}
 * @returns {object}
 * @static
 * @private
 */
Object.defineProperty(Object.prototype, 'clone', {
    value: function () {
        "use strict";
        return JSON.parse(JSON.stringify(this));
    },
    enumerable: false,
    configurable: false
});

/**
 * Empty base class. Use params.that (if exists) for the base object, but delete it from the instance.  Copy all
 * params that were passed in onto the base object. Add the class name.
 * @class brightstream.Class
 * @classdesc Empty base class.
 * @constructor
 * @private
 * @author Erin Spiceland <espiceland@digium.com>
 */
brightstream.Class = function (params) {
    "use strict";
    params = params || {};
    var that = params.that || {};
    var client = params.client;

    that.className = 'brightstream.Class';
    delete params.that;
    delete that.client;

    Object.keys(params).forEach(function copyParam(name) {
        that[name] = params[name];
    });

    return that;
};

/**
 * Does the browser support UserMedia
 * @static
 * @member brightstream
 * @returns {boolean}
 * @author Dan Jenkins <djenkins@digium.com>
 */
brightstream.hasUserMedia = function () {
    "use strict";
    return (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) instanceof Function;
};

/**
 * Does the browser support RTCPeerConnection
 * @static
 * @member brightstream
 * @returns {boolean}
 * @author Dan Jenkins <djenkins@digium.com>
 */
brightstream.hasRTCPeerConnection = function () {
    "use strict";
    return (window.RTCPeerConnection || window.webkitRTCPeerConnection ||
            window.mozRTCPeerConnection) instanceof Function;
};

/**
 * Does the browser support WebSocket
 * @static
 * @member brightstream
 * @returns {boolean}
 * @author Dan Jenkins <djenkins@digium.com>
 */
brightstream.hasWebsocket = function () {
    "use strict";
    return (window.WebSocket || window.webkitWebSocket || window.MozWebSocket) instanceof Function;
};// End brightstream.Class
