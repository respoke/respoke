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
    return that;
}; // End brightstream.Class
