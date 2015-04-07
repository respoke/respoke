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

/**
 * Empty base class. Use params.that (if exists) for the base object, but delete it from the instance.
 * Copy all params that were passed in onto the base object. Add the class name.
 * @class respoke.Class
 * @private
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    var that = params.that || {};

    that.className = 'respoke.Class';
    delete params.that;
    delete that.client;

    Object.keys(params).forEach(function copyParam(name) {
        that[name] = params[name];
    });

    return that;
};
