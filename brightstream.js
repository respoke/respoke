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
(function brightstreamInit() {
    'use strict';
    window.brightstream = {
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
 * Empty base class. Use params.that (if exists) for the base object, but delete it from the instance.  Copy all
 * params that were passed in onto the base object. Add the class name.
 * @class brightstream.Class
 * @classdesc Empty base class.
 * @constructor
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
}; // End brightstream.Class
