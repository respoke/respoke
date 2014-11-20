"use strict";
/*global Bugsnag: true*/
/*jshint bitwise: false*/

/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var log = require('loglevel');
log.setLevel('warn');

var Q = require('q');
Q.longStackSupport = true;
Q.stackJumpLimit = 5;
Q.longStackJumpLimit = 20;
Q.stopUnhandledRejectionTracking();

require('./deps/adapter');

/**
 * `respoke` is a global static class.
 *
 *
 * Include the [latest version](https://cdn.respoke.io/respoke.min.js) or
 * [choose a previous release](http://cdn.respoke.io/list.html).
 *
 * Or use `npm install --save respoke`.
 *
 * Interact with Respoke primarily via [`respoke.Client`](respoke.Client.html):
 *
 *      var client = respoke.createClient();
 *
 *
 * **Development mode without brokered auth**
 *
 *      var client = respoke.createClient({
 *          appId: "XXXXXXX-my-app-id-XXXXXX",
 *          developmentMode: true,
 *          endpointId: "billy"
 *      });
 *
 *      client.listen('connect', function () {
 *          console.log('connected to respoke!');
 *      });
 *
 *      client.listen('error', function (err) {
 *          console.error('Connection to Respoke failed.', err);
 *      });
 *
 *      client.connect();
 *
 *
 * **Production mode with brokered auth**
 *
 *      var client = respoke.createClient();
 *
 *      client.listen('connect', function () {
 *          console.log('connected to respoke!');
 *      });
 *
 *      client.listen('error', function (err) {
 *          console.error('Connection to Respoke failed.', err);
 *      });
 *
 *      // Respoke auth token obtained by your server.
 *      // This is how you control who can connect to Respoke app.
 *      // See API docs for POST [base]/tokens
 *      var tokenId = "XXXX-XXXX-brokered-auth-token-XXXXX";
 *
 *      // connect to respoke with the token
 *      client.connect({
 *          token: tokenId
 *      });
 *
 *      // fetch a new token from your server if it expires
 *      client.listen('disconnect', function (evt) {
 *          // fetch another token from your server.
 *          var newTokenId = "XXXX-XXXX-brokered-auth-token2-XXXXX";
 *          client.connect({
 *              token: newTokenId
 *          });
 *      });
 *
 *
 *
 * ### Event listeners vs callback handlers
 *
 * There are two ways to attach listeners. It is highly recommended that you choose one pattern
 * and stick to it throughout your app.
 *
 * For every `event-name`, there is a corresponding callback `onEventName`.
 *
 * **With a listener**
 *
 *      var client = respoke.createClient();
 *      client.listen('connect', function () { });
 *
 * **or with a callback**
 *
 *      var client = respoke.createClient({
 *          // other options go here
 *
 *          onConnect: function () { }
 *      });
 *
 *
 * @namespace respoke
 * @class respoke
 * @global
 * @link https://cdn.respoke.io/respoke.min.js
 */
var respoke = module.exports = {
    buildNumber: 'NO BUILD NUMBER',
    streams: [],
    instances: {}
};

/**
 * `"v0.0.0"`
 *
 * The respoke.min.js version.
 *
 * Past versions can be found at [cdn.respoke.io/list.html](http://cdn.respoke.io/list.html)
 * @type {string}
 */
respoke.version = respoke.buildNumber + "";

respoke.EventEmitter = require('./event');
respoke.Client = require('./client');
respoke.Presentable = require('./presentable');
respoke.Connection = require('./connection');
respoke.Endpoint = require('./endpoint');
respoke.TextMessage = require('./textMessage');
respoke.SignalingMessage = require('./signalingMessage');
respoke.Group = require('./group');
respoke.SignalingChannel = require('./signalingChannel');
respoke.DirectConnection = require('./directConnection');
respoke.PeerConnection = require('./peerConnection');
respoke.CallState = require('./callState');
respoke.Call = require('./call');
respoke.LocalMedia = require('./localMedia');
respoke.RemoteMedia = require('./remoteMedia');
respoke.log = log;
respoke.Q = Q;

if (!window.skipBugsnag) {
    // Use airbrake.
    var airbrake = document.createElement('script');
    var first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(airbrake, first);

    airbrake.src = "https://ssljscdn.airbrake.io/0.3/airbrake.min.js";
    airbrake.setAttribute('data-airbrake-project-id', '98133');
    airbrake.setAttribute('data-airbrake-project-key', 'cd3e085acc5e554658ebcdabd112a6f4');
    airbrake.setAttribute('data-airbrake-project-environment-name', 'production');

    airbrake.onload = function () {
        window.onerror = function (message, file, line) {
            //Only send errors from the respoke.js file to Airbrake
            if (file.match(/respoke/)) {
                Airbrake.push({error: {message: message, fileName: file, lineNumber: line}});
            }
        };
    };
}

/**
 * This is one of two possible entry points for interating with the library.
 *
 * This method creates a new Client object
 * which represents your user's connection to your Respoke app.
 *
 * This method **automatically calls client.connect(params)** after the client is created.
 *
 * @static
 * @memberof respoke
 * @param {object} params Parameters to the respoke.Client constructor.
 * @param {string} [params.appId]
 * @param {string} [params.baseURL]
 * @param {string} [params.token]
 * @param {string|number|object|Array} [params.presence] The initial presence to set once connected.
 * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
 * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
 * operation and will limit the services you will be able to use.
 * @param {boolean} [params.reconnect=false] - Whether or not to automatically reconnect to the Respoke service
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
 * @param {boolean} [params.enableCallDebugReport=true] - Optional flag defaulting to true which allows sending
 * debugging information.
 * @returns {respoke.Client}
 */
respoke.connect = function (params) {
    var client = respoke.Client(params);
    client.connect(params);
    return client;
};

/**
 * Getter for the respoke client.
 *
 * You can have more than one active client, so this method provides a way to retrieve a specific instance.
 *
 * @static
 * @memberof respoke
 * @param {number} id The Client ID.
 * @returns {respoke.Client}
 */
respoke.getClient = function (id) {
    if (id === undefined) {
        log.debug("Can't call getClient with no client ID.", new Error().stack);
    }
    if (!respoke.instances[id]) {
        log.debug("No client instance with id", id);
    }
    return respoke.instances[id];
};

/**
 * This is one of two possible entry points for interating with the library.
 *
 * This method creates a new Client object which represents your user's connection to your Respoke app.
 *
 * It **does NOT automatically call the client.connect() method** after the client is created.
 *
 * The `params` argument is the same as `respoke.connect(params)`.
 *
 * @static
 * @memberof respoke
 * @param {object} params Parameters to respoke.Client - same as respoke.connect()
 * @returns {respoke.Client}
 */
respoke.createClient = function (params) {
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
 * Build a closure from a listener that will ensure the listener can only be called once.
 * @static
 * @private
 * @memberof respoke
 * @param {function} func
 * @return {function}
 */
respoke.once = function (func) {
    return (function () {
        var called = false;
        return function () {
            if (called === false) {
                func.apply(null, arguments);
                called = true;
            }
        };
    })();
};

/**
 * @static
 * @private
 * @memberof respoke
 * @returns {number}
 */
respoke.makeGUID = function () {
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
    var returnUndef = false;
    if (onSuccess || onError) {
        returnUndef = true;
    }

    onSuccess = typeof onSuccess === 'function' ? onSuccess : function () {};
    onError = typeof onError === 'function' ? onError : function () {};
    promise.done(onSuccess, onError);
    return (returnUndef ? undefined : promise);
};

/**
 * Empty base class. Use params.that (if exists) for the base object, but delete it from the instance.  Copy all
 * params that were passed in onto the base object. Add the class name.
 * @class respoke.Class
 * @classdesc Empty base class.
 * @constructor
 * @private
 */
respoke.Class = function (params) {
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
}; // end of respoke.Class

/**
 * Does the browser support `UserMedia`?
 * @static
 * @memberof respoke
 * @returns {boolean}
 */
respoke.hasUserMedia = function () {
    return (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) instanceof Function;
};

/**
 * Does the browser support `RTCPeerConnection`?
 * @static
 * @memberof respoke
 * @returns {boolean}
 */
respoke.hasRTCPeerConnection = function () {
    return (window.RTCPeerConnection || window.webkitRTCPeerConnection ||
            window.mozRTCPeerConnection) instanceof Function;
};

/**
 * Does the browser support `WebSocket`?
 * @static
 * @memberof respoke
 * @returns {boolean}
 */
respoke.hasWebsocket = function () {
    return (window.WebSocket || window.webkitWebSocket || window.MozWebSocket) instanceof Function;
};

/**
 * Clone an object.
 * @static
 * @memberof respoke
 * @param {Object} source - The object to clone
 * @returns {Object}
 */
respoke.clone = function (source) {
    if (source) {
        return JSON.parse(JSON.stringify(source));
    }
    return source;
};

/**
 * Compares two objects for equality
 * @static
 * @memberof respoke
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
respoke.isEqual = function (a, b) {
    var aKeys;

    //check if arrays
    if (a.hasOwnProperty('length') && b.hasOwnProperty('length') && a.splice && b.splice) {
        if (a.length !== b.length) {
            //short circuit if arrays are different length
            return false;
        }

        for (var i = 0; i < a.length; i += 1) {
            if (!respoke.isEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
        aKeys = Object.keys(a);
        for (var i = 0; i < aKeys.length; i += 1) {
            if (!respoke.isEqual(a[aKeys[i]], b[aKeys[i]])) {
                return false;
            }
        }
        return true;
    }

    return a === b;
};

/*
 * Does the sdp indicate an audio stream?
 * @static
 * @memberof respoke
 * @params {RTCSessionDescription}
 * @returns {boolean}
 */
respoke.sdpHasAudio = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasAudio called with no parameters.");
    }
    return sdp.indexOf('m=audio') !== -1;
};

/**
 * Does the sdp indicate a video stream?
 * @static
 * @memberof respoke
 * @params {RTCSessionDescription}
 * @returns {boolean}
 */
respoke.sdpHasVideo = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasVideo called with no parameters.");
    }
    return sdp.indexOf('m=video') !== -1;
};

/**
 * Does the sdp indicate a data channel?
 * @static
 * @memberof respoke
 * @params {RTCSessionDescription}
 * @returns {boolean}
 */
respoke.sdpHasDataChannel = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasDataChannel called with no parameters.");
    }
    return sdp.indexOf('m=application') !== -1;
};

/**
 * Does the sdp indicate an audio stream?
 * @static
 * @memberof respoke
 * @params {MediaConstraints}
 * @returns {boolean}
 */
respoke.constraintsHasAudio = function (constraints) {
    if (!constraints) {
        throw new Error("respoke.constraintsHasAudio called with no parameters.");
    }
    return (constraints.audio === true);
};

/**
 * Does the constraints indicate a video stream?
 * @static
 * @memberof respoke
 * @params {MediaConstraints}
 * @returns {boolean}
 */
respoke.constraintsHasVideo = function (constraints) {
    if (!constraints) {
        throw new Error("respoke.constraintsHasVideo called with no parameters.");
    }
    return (constraints.video === true || typeof constraints.video === 'object');
};
