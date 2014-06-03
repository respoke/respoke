/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * @author Erin Spiceland <espiceland@digium.com>
 * @namespace respoke
 * @global
 */
/*global Bugsnag: true, respoke: true*/
/*jshint bitwise: false*/
(function respokeInit() {
    'use strict';
    window.respoke = {
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
 * @memberof respoke
 * @param {object} params
 * @param {string} [params.appId]
 * @param {string} [params.baseURL]
 * @param {string} [params.token]
 * @param {RTCConstraints} [params.constraints] - A set of default WebRTC call constraints if you wish to use
 * different parameters than the built-in defaults.
 * @param {RTCICEServers} [params.servers] - A set of default WebRTC ICE/STUN/TURN servers if you wish to use
 * different parameters than the built-in defaults.
 * @param {string|number|object|Array} [params.presence] The initial presence to set once connected.
 * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
 * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
 * operation and will limit the services you will be able to use.
 * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Respoke service
 * when a disconnect occurs.
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
 * @returns {respoke.Client}
 * @param {object} Parameters to the respoke.Client constructor.
 */
respoke.connect = function (params) {
    "use strict";
    var client = respoke.Client(params);
    client.connect(params);
    return client;
};

/**
 * @static
 * @memberof respoke
 * @returns {respoke.Client}
 * @param {number} The Client ID.
 */
respoke.getClient = function (id) {
    "use strict";
    if (id === undefined) {
        log.debug("Can't call getClient with no client ID.", new Error().stack);
    }
    if (!respoke.instances[id]) {
        log.debug("No client instance with id", id);
    }
    return respoke.instances[id];
};

/**
 * This is one of two possible entry points for interating with the library. This method creates a new Client object
 * which represence your app's connection to the cloud infrastructure.  This method does NOT automatically call the
 * client.connect() method after the client is created, so your app will need to call it when it is ready to
 * connect.
 * @static
 * @memberof respoke
 * @param {object} params
 * @param {string} [params.appId]
 * @param {string} [params.baseURL]
 * @param {string} [params.authToken]
 * @param {RTCConstraints} [params.constraints]
 * @param {RTCICEServers} [params.servers]
 * @returns {respoke.Client}
 * @param {object} Parameters to the Client constructor
 */
respoke.createClient = function (params) {
    "use strict";
    var client;
    params = params || {};
    if (params.instanceId) {
        client = respoke.getClient(params.instanceId);
        if (client) {
            return client;
        }
    }
    return respoke.Client(params);
};

/**
 * @static
 * @private
 * @memberof respoke
 * @returns {number}
 */
respoke.makeGUID = function () {
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
 * @memberof respoke
 * @param {Promise} promise
 * @param {function} onSuccess
 * @param {function} onError
 * @returns {Promise|undefined}
 */
respoke.handlePromise = function (promise, onSuccess, onError) {
    "use strict";
    if (onSuccess || onError) {
        onSuccess = typeof onSuccess === 'function' ? onSuccess : function () {};
        onError = typeof onError === 'function' ? onError : function () {};
        promise.done(onSuccess, onError);
        return;
    }
    return promise;
};

/**
 * Empty base class. Use params.that (if exists) for the base object, but delete it from the instance.  Copy all
 * params that were passed in onto the base object. Add the class name.
 * @class respoke.Class
 * @classdesc Empty base class.
 * @constructor
 * @private
 * @author Erin Spiceland <espiceland@digium.com>
 */
respoke.Class = function (params) {
    "use strict";
    params = params || {};
    var that = params.that || {};
    var client = params.client;

    that.className = 'respoke.Class';
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
 * @memberof respoke
 * @returns {boolean}
 * @author Dan Jenkins <djenkins@digium.com>
 */
respoke.hasUserMedia = function () {
    "use strict";
    return (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) instanceof Function;
};

/**
 * Does the browser support RTCPeerConnection
 * @static
 * @memberof respoke
 * @returns {boolean}
 * @author Dan Jenkins <djenkins@digium.com>
 */
respoke.hasRTCPeerConnection = function () {
    "use strict";
    return (window.RTCPeerConnection || window.webkitRTCPeerConnection ||
            window.mozRTCPeerConnection) instanceof Function;
};

/**
 * Does the browser support WebSocket
 * @static
 * @memberof respoke
 * @returns {boolean}
 * @author Dan Jenkins <djenkins@digium.com>
 */
respoke.hasWebsocket = function () {
    "use strict";
    return (window.WebSocket || window.webkitWebSocket || window.MozWebSocket) instanceof Function;
};// End respoke.Class
