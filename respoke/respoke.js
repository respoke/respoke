"use strict";
/*global respoke: true */
/*jshint bitwise: false*/

/*!
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 * @ignore
 */

var Airbrake = require('airbrake-js');
var log = require('loglevel');
log.setLevel(log.levels.WARN);

var originalFactory = log.methodFactory;
log.methodFactory = function logMethodFactory(methodName, logLevel) {
    var logMethod = originalFactory(methodName, logLevel);
    var errorReporter;

    if (!window.skipErrorReporting && methodName === 'error') {
        var airbrake = new Airbrake({
            projectId: '98133',
            projectKey: 'cd3e085acc5e554658ebcdabd112a6f4'
        });
        errorReporter = function (message) {
            airbrake.push({ error: { message: message } });
        };
    } else {
        errorReporter = function () { };
    }

    return function (message) {
        var args = Array.prototype.slice.call(arguments);
        var reporterMessage = args.join(' ');

        args.unshift('[Respoke]');
        logMethod.apply(this, args);
        errorReporter(reporterMessage);
    };
};

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

var EventEmitter = require('./event');
var respoke = module.exports = EventEmitter({
    buildNumber: 'NO BUILD NUMBER',
    streams: [],
    Q: require('q')
});

respoke.Q.longStackSupport = true;
respoke.Q.stackJumpLimit = 5;
respoke.Q.longStackJumpLimit = 20;
respoke.Q.stopUnhandledRejectionTracking();

/**
 * A map of respoke.Client instances available for use. This is useful if you would like to separate some
 * functionality of your app into a separate Respoke app which would require a separate appId.
 * @type {boolean}
 */
respoke.instances = {};

/**
 * Indicate whether the user's browser is Chrome and requires the Respoke Chrome extension to do screen sharing.
 * @type {boolean}
 * @private
 */
respoke.needsChromeExtension = !!(window.chrome && !window.opera && navigator.webkitGetUserMedia);

/**
 * Indicate whether the user's browser is Firefox and requires the Respoke Firefox extension to do screen sharing.
 * @type {boolean}
 * @private
 */
respoke.needsFirefoxExtension = window.webrtcDetectedBrowser === 'firefox';

/**
 * Indicate whether the user has a Respoke Chrome extension installed and running correcty on this domain.
 * @type {boolean}
 * @private
 */
respoke.hasChromeExtension = false;

/**
 * Indicate whether the user has a Respoke Firefox extension installed and running correcty on this domain.
 * @type {boolean}
 * @private
 */
respoke.hasFirefoxExtension = false;

/**
 * This method will be overridden in the case that an extension or plugin is available for screen sharing.
 *
 * @static
 * @private
 * @memberof respoke
 */
respoke.chooseDesktopMedia = function () {
    log.warn("Screen sharing is not implemented for this browser.");
};

/**
 * Indicate whether we are dealing with node-webkit, and expose chooseDesktopMedia if so
 * @type {boolean}
 * @private
 */
respoke.isNwjs = (function () {
    var gui;
    var isNwjs = !!((typeof process !== 'undefined') && (typeof global !== 'undefined') &&
        global.window && global.window.nwDispatcher);

    if (isNwjs) {
        // expose native node-webkit chooseDesktopMedia (requires nw.js 0.12+)
        gui = window.nwDispatcher.requireNwGui();
        respoke.chooseDesktopMedia = function (data, callback) {
            // make data param optional
            if (!callback && (typeof data === 'function')) {
                callback = data;
                data = null;
            }

            /*
             * mediaSources can be one of 'window', 'screen', or 'tab', or an array with multiples
             * https://developer.chrome.com/extensions/desktopCapture
             */
            var mediaSources = data && data.source ? [data.source] : ['window', 'screen'];

            gui.Screen.Init();
            gui.Screen.chooseDesktopMedia(mediaSources, function (sourceId) {
                callback({
                    type: 'respoke-source-id',
                    sourceId: sourceId
                });
            });
        };
    }

    return isNwjs;
})();

/**
 * Create an Event. This is used in the Chrome/Firefox extensions to communicate between the library and extension.
 * @type {function}
 * @private
 */
respoke.extEvent = function (type, data) {
    var evt = document.createEvent("CustomEvent");
    evt.initCustomEvent(type, true, true, data);
    return evt;
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

respoke.log = log;
respoke.Class = require('./class');
respoke.EventEmitter = EventEmitter;
respoke.Client = require('./client');
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
respoke.Conference = require('./conference');

/*
 * Get information from the Respoke Screen Sharing Chrome extension if it is installed.
 */
function chromeScreenSharingExtensionReady(evt) {
    var data = evt.detail;
    if (data.available !== true) {
        return;
    }

    respoke.hasChromeExtension = true;
    respoke.chooseDesktopMedia = function (params, callback) {
        if (!callback) {
            throw new Error("Can't choose desktop media without callback parameter.");
        }

        function sourceIdListener(evt) {
            var data = evt.detail;

            respoke.screenSourceId = data.sourceId;
            callback(data);
            document.removeEventListener("respoke-source-id", sourceIdListener);
        }

        document.dispatchEvent(respoke.extEvent('ct-respoke-source-id', {
            source: params.source ? [params.source] : ['screen', 'window']
        }));

        document.addEventListener("respoke-source-id", sourceIdListener);
    };

    respoke.fire('extension-loaded', {
        type: 'screen-sharing'
    });

    log.info("Respoke Screen Share Chrome extension available for use.");
}

// TODO: remove 'respoke-available' event listener on next major version bump
document.addEventListener('respoke-available', chromeScreenSharingExtensionReady);
document.addEventListener('respoke-chrome-screen-sharing-available', chromeScreenSharingExtensionReady);
document.addEventListener('respoke-firefox-screen-sharing-available', function (evt) {

    var data = evt.detail;
    if (data !== 'available') {
        return;
    }

    respoke.hasFirefoxExtension = true;

    respoke.fire('extension-loaded', {
        type: 'screen-sharing'
    });

    log.info("Respoke Screen Share Firefox extension available for use.");
});

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
respoke.callOnce = function (func) {
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
 * Does the browser have Screen Sharing enabled via browser extensions?
 * @static
 * @memberof respoke
 * @returns {boolean}
 */
respoke.hasScreenShare = function () {
    return respoke.hasChromeExtension || respoke.hasFirefoxExtension;
};

/**
 * Clone an object.
 * @static
 * @memberof respoke
 * @private
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
 * @private
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
respoke.isEqual = function (a, b) {
    var aKeys;
    var i;

    //check if arrays
    if (a && b && a.hasOwnProperty('length') && b.hasOwnProperty('length') && a.splice && b.splice) {
        if (a.length !== b.length) {
            //short circuit if arrays are different length
            return false;
        }

        for (i = 0; i < a.length; i += 1) {
            if (!respoke.isEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }

    if (typeof a === 'object' && typeof b === 'object' && Object.keys(a).length === Object.keys(b).length) {
        aKeys = Object.keys(a);
        for (i = 0; i < aKeys.length; i += 1) {
            if (!respoke.isEqual(a[aKeys[i]], b[aKeys[i]])) {
                return false;
            }
        }
        return true;
    }

    return a === b;
};

/*
 * Count the number of MediaStreams indicated by the SDP
 * @static
 * @memberof respoke
 * @params {string}
 * @returns {number}
 */
respoke.sdpStreamCount = function (sdp) {
    var matches;
    var resolvedMatches = {};

    if (!sdp) {
        throw new Error("respoke.sdpHasAudio called with no parameters.");
    }

    matches = sdp.match(/mslabel:(.*)/gi);

    if (!matches) {
        return 0;
    }

    matches.forEach(function (line) {
        resolvedMatches[line] = true;
    });
    return Object.keys(resolvedMatches).length;
};

/*
 * Does the sdp indicate an audio stream?
 * @static
 * @memberof respoke
 * @params {string}
 * @returns {boolean}
 */
respoke.sdpHasAudio = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasAudio called with no parameters.");
    }
    return (sdp.indexOf('m=audio') !== -1 && sdp.indexOf('a=recvonly') === -1);
};

/**
 * Does the sdp indicate a video stream?
 * @static
 * @memberof respoke
 * @params {string}
 * @returns {boolean}
 */
respoke.sdpHasVideo = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasVideo called with no parameters.");
    }
    return (sdp.indexOf('m=video') !== -1 && sdp.indexOf('a=recvonly') === -1);
};

/**
 * Does the sdp indicate a data channel?
 * @static
 * @memberof respoke
 * @params {string}
 * @returns {boolean}
 */
respoke.sdpHasDataChannel = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasDataChannel called with no parameters.");
    }
    return sdp.indexOf('m=application') !== -1;
};

/**
 * Does the sdp indicate the creator is sendOnly?
 * @static
 * @memberof respoke
 * @params {string}
 * @returns {boolean}
 */
respoke.sdpHasSendOnly = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasSendOnly called with no parameters.");
    }
    return sdp.indexOf('a=sendonly') !== -1;
};

/**
 * Does the sdp indicate the creator is receiveOnly?
 * @static
 * @memberof respoke
 * @params {string}
 * @returns {boolean}
 */
respoke.sdpHasReceiveOnly = function (sdp) {
    if (!sdp) {
        throw new Error("respoke.sdpHasReceiveOnly called with no parameters.");
    }
    return sdp.indexOf('a=recvonly') !== -1;
};

/**
 * Do the constraints indicate an audio stream?
 * @static
 * @memberof respoke
 * @params {RTCConstraints}
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
 * @params {RTCConstraints}
 * @returns {boolean}
 */
respoke.constraintsHasVideo = function (constraints) {
    if (!constraints) {
        throw new Error("respoke.constraintsHasVideo called with no parameters.");
    }
    return (constraints.video === true || typeof constraints.video === 'object');
};

/**
 * Does the constraints indicate a screenshare?
 * @static
 * @memberof respoke
 * @params {RTCConstraints}
 * @returns {boolean}
 */
respoke.constraintsHasScreenShare = function (constraints) {
    if (!constraints) {
        throw new Error("respoke.constraintsHasScreenShare called with no parameters.");
    }

    return (constraints.video && constraints.video.mandatory &&
            (constraints.video.mandatory.chromeMediaSource || constraints.video.mediaSource));
};

/**
 * Convert old-style constraints parameter into a constraints array.
 * @static
 * @memberof respoke
 * @params {Array<RTCConstraints>|RTCConstraints} [constraints]
 * @params {Array<RTCConstraints>} [defaults]
 * @returns {Array<RTCConstraints>}
 */
respoke.convertConstraints = function (constraints, defaults) {
    constraints = constraints || [];
    defaults = defaults || [];

    if (!constraints.splice) {
        if (typeof constraints === 'object') {
            constraints = [constraints];
        } else {
            constraints = [];
        }
    }

    if (constraints.length === 0 && defaults.length > 0) {
        return defaults;
    }

    return constraints;
};

/**
 * Queue items until a trigger is called, then process them all with an action. Before trigger, hold items for
 * processing. After trigger, process new items immediately.
 * @static
 * @memberof respoke
 * @returns {Array}
 * @private
 */
respoke.queueFactory = function () {
    var queue = [];
    /**
     * @param {function} action - the action to perform on each item. Thrown errors will be caught and logged.
     */
    queue.trigger = function (action) {
        if (!action) {
            throw new Error("Trigger function requires an action parameter.");
        }

        function safeAction(item) {
            try {
                action(item);
            } catch (err) {
                log.error("Error calling queue action.", err);
            }
        }
        queue.forEach(safeAction);
        queue.length = 0;
        queue.push = safeAction;
    };

    return queue;
};

/**
 * Retrieve browser-specific WebRTC getUserMedia constraints needed to start a screen sharing call.
 *
 * @memberof respoke
 * @static
 * @param {object} [params]
 * @param {string} [params.source] The media source name to pass to firefox
 * @param {RTCConstraints|Array<RTCConstraints>} [params.constraints] constraints to use as a base
 * @returns {Array<RTCConstraints>}
 * @private
 */
respoke.getScreenShareConstraints = function (params) {
    params = params || {};
    var convertedConstraints = respoke.convertConstraints(params.constraints, [{
        audio: true,
        video: {},
        mandatory: {},
        optional: []
    }]);

    var screenConstraint = convertedConstraints[0];
    screenConstraint.audio = false;
    screenConstraint.video = typeof screenConstraint.video === 'object' ? screenConstraint.video : {};

    if (respoke.needsChromeExtension || respoke.isNwjs) {
        screenConstraint.audio = false;
        screenConstraint.video.optional = Array.isArray(screenConstraint.video.optional) ?
            screenConstraint.video.optional : [];
        screenConstraint.video.mandatory = typeof screenConstraint.video.mandatory === 'object' ?
            screenConstraint.video.mandatory : {};
        screenConstraint.video.mandatory.chromeMediaSource = 'desktop';
        screenConstraint.video.mandatory.maxWidth = typeof screenConstraint.video.mandatory.maxWidth === 'number' ?
            screenConstraint.video.mandatory.maxWidth : 2000;
        screenConstraint.video.mandatory.maxHeight = typeof screenConstraint.video.mandatory.maxHeight === 'number' ?
            screenConstraint.video.mandatory.maxHeight : 2000;

        if (screenConstraint.video.optional.length > 0) {
            screenConstraint.video.optional.forEach(function (thing) {
                thing.googTemporalLayeredScreencast = true;
            });
        } else {
            screenConstraint.video.optional[0] = {
                googTemporalLayeredScreencast: true
            };
        }
    } else {
        // firefox, et. al.
        screenConstraint.video.mediaSource = params.source || 'screen';
    }

    return convertedConstraints;
};

/**
 * Retrieve a started instance of `respoke.LocalMedia` containing a screen share stream. Useful if you
 * want to prepare the stream prior to starting a screen share.
 *
 *     respoke.getScreenShareMedia().then(function (localMedia) {
 *         document.getElementById('#video').appendChild(localMedia.element);
 *         group.listen('join', function (evt) {
 *             evt.connection.startScreenShare({
 *                 outgoingMedia: localMedia
 *             });
 *         });
 *     }).catch(function (err) {
 *         console.log(err);
 *     });
 *
 * @static
 * @memberof respoke
 * @param {object} params
 * @param {string} [params.source] - The source you would like to use for your screen share. Values vary by browser.
 *  In Chrome, acceptable values are one of 'screen', 'window', or 'tab'.
 *  In Firefox, acceptable values are one of 'screen', 'window', or 'application'.
 * @param {RTCConstraints|Array<RTCConstraints>} [params.constraints] - constraints to use as a base
 * @param {HTMLVideoElement} [params.element] - Pass in an optional html video element to have local
 *  video attached to it.
 * @param {function} [params.onSuccess] Upon success, called with instance of `respoke.LocalMedia`
 * @param {function} [params.onError] Upon failure, called with the error that occurred.
 * @returns {Promise|undefined}
 */
respoke.getScreenShareMedia = function (params) {
    params = params || {};

    var deferred = respoke.Q.defer();

    var criteria = {
        source: params.source,
        constraints: respoke.clone(params.constraints)
    };

    var localMedia = respoke.LocalMedia({
        hasScreenShare: true,
        constraints: respoke.getScreenShareConstraints(criteria)[0],
        source: params.source,
        element: params.element
    });

    function localMediaStreamReceivedHandler() {
        localMedia.ignore('error', localMediaErrorHandler);
        deferred.resolve(localMedia);
    }

    function localMediaErrorHandler(evt) {
        localMedia.ignore('stream-received', localMediaStreamReceivedHandler);
        deferred.reject(evt);
    }

    localMedia.once('stream-received', localMediaStreamReceivedHandler);
    localMedia.once('error', localMediaErrorHandler);
    localMedia.start();

    return respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
};
