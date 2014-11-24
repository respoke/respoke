/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var respoke = require('./respoke');
var log = require('loglevel');

/**
 * A generic class for emitting and listening to events.
 *
 * @class respoke.EventEmitter
 * @inherits respoke.Class
 * @constructor
 * @param {object} params
 * @param {string} params.instanceId
 * @returns {respoke.EventEmitter}
 */
var EventEmitter = module.exports = function (params) {
    "use strict";
    params = params || {};
    var that = respoke.Class(params);
    /**
     * A name to identify the type of this object.
     * @memberof! respoke.EventEmitter
     * @name className
     * @type {string}
     * @private
     */
    that.className = 'respoke.EventEmitter';

    /**
     * @memberof! respoke.EventEmitter
     * @name eventList
     * @private
     * @type {object}
     */
    var eventList = {};

    /**
     * Add a listener that will only be called once to an object.  This method adds the given listener to the given
     * event in the case that the same
     * listener is not already registered to this event and the listener is a function.  The third argument 'isInternal'
     * is used only internally by the library to indicate that this listener is a library-used listener and should not
     * count when we are trying to determine if an event has listeners placed by the developer.
     *
     *     client.once('connect', function (evt) {
     *         console.log("This is the first time we connected.");
     *     });
     *
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.listen
     * @param {string} eventType - A developer-specified string identifying the event.
     * @param {respoke.EventEmitter.eventListener} listener - A function to call when the event is fire.
     * @param {boolean} [isInternal] - A flag to indicate this listener was added by the library. This parameter should
     * not be used by developers who are using the library, only by developers who are working on the library itself.
     */
    that.once = function (eventType, listener, isInternal) {
        var string = listener.toString();
        listener = respoke.once(listener);
        listener.toString = function () { return string; }
        listener.once = true;
        that.listen(eventType, listener, isInternal);
    };

    /**
     * Add a `listener` function to an object.
     * 
     * This method adds the `listener` to the event `eventName`.
     * 
     * If an identical listener already registered to this event, it will **not** be added.
     * 
     * ##### Example of adding an event listener.
     *
     *     client.listen('connect', function (evt) {
     *         console.log("We've connected!", evt);
     *     });
     *
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.listen
     * @param {string} eventType - The name of the event.
     * @param {respoke.EventEmitter.eventListener} listener - A function to call when the event is
     * fired.
     * @arg {boolean} isInternal - Internal use only. A flag to indicate this listener was 
     * added by the library. This parameter should not be used by developers who are using
     * the library, only by developers who are working on the library itself.
     */
    that.listen = function (eventType, listener, isInternal) {
        if (listener === undefined) {
            return;
        }
        var invalidEventType = typeof eventType !== 'string' || !eventType;
        var invalidListener = typeof listener !== 'function';
        if (invalidEventType || invalidListener) {
            log.error("Invalid request to add event listener to", eventType, listener);
            return;
        }

        eventList[eventType] = eventList[eventType] || [];
        listener.isInternal = !!isInternal; // boolify

        var toString = function (fn) {
            return fn.toString();
        };
        var isNotAlreadyAdded = eventList[eventType].map(toString).indexOf(listener.toString()) === -1;

        if (isNotAlreadyAdded) {
            eventList[eventType].push(listener);
        } else {
            log.warn("Not adding duplicate listener to", eventType, listener);
        }
    };

    /**
     * Remove a listener from an object. If no eventType is specified, all eventTypes will be
     * cleared. If an eventType is specified but no listener is specified, all listeners will be
     * removed from the specified eventType.  If a listener is also specified, only that listener
     * will be removed.
     *
     *     client.ignore('connect', connectHandler);
     *
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.ignore
     * @param {string} [eventType] - An optional developer-specified string identifying the event.
     * @param {function} [listener] - An optional function to remove from the specified event.
     */
    that.ignore = function (eventType, listener) {
        // Remove all events from this object
        if (eventType === undefined) {
            eventList = {};
            return;
        }

        // Remove all listeners from this event.
        if (listener === undefined || !eventList[eventType]) {
            eventList[eventType] = [];
            return;
        }

        // Remove only one listener from this event.
        for (var i = eventList[eventType].length - 1; i >= 0; i -= 1) {
            if (listener === eventList[eventType][i]) {
                eventList[eventType].splice(i, 1);
                return;
            }
        }
    };

    /**
     * Trigger an event on an object. All listeners for the specified eventType will be called.
     * Listeners will be bound to the object ('this' will refer to the object), and additional
     * arguments to fire() will be passed into each listener.
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.fire
     * @param {string} eventType - A developer-specified string identifying the event to fire.
     * @param {string|number|object|array} evt - Any number of optional parameters to be passed to
     * the listener
     * @private
     */
    that.fire = function (eventType, evt) {
        var args = null;
        var count = 0;
        var toRemove = [];

        evt = evt || {};
        evt.name = eventType;
        evt.target = that;

        if (!eventType) {
            return;
        }

        if (!eventList[eventType]) {
            log.debug("fired " + that.className + "#" + eventType + " 0 listeners called with params", evt);
            return;
        }

        for (var i = 0; i < eventList[eventType].length; i += 1) {
            var listener = eventList[eventType][i];
            if (typeof listener === 'function') {
                setTimeout(listenerBuilder(listener, evt, eventType));

                count += 1;
                if (listener.once === true) {
                    toRemove.push(i);
                }
            }
        }

        for (var i = (toRemove.length - 1); i >= 0; i -= 1) {
            eventList[eventType].splice(toRemove[i], 1);
        }

        log.debug("fired " + that.className + "#" + eventType + " " + count + " listeners called with params", evt);
    };

    function listenerBuilder(listener, evt, eventType) {
        return function () {
            try {
                listener.call(that, evt);
            } catch (e) {
                log.error('Error in ' + that.className + "#" + eventType, e.message, e.stack);
            }
        };
    }

    /**
     * Determine if an object has had any listeners registered for a given event outside the library. This method
     * checks for the isInternal flag on each listener and doesn't count it toward an event being listened to. This
     * method is used in the library to handle situations where an action is needed if an event won't be acted on.
     * For instance, if a call comes in for the logged-in user, but the developer isn't listening to
     * {respoke.Client#call}, we'll need to reject the call immediately.
     *
     *     if (client.hasListeners('call')) {
     *         // already handled!
     *     }
     *
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.hasListeners
     * @param {string} eventType - The name of the event
     * @returns {boolean} Whether this event has any listeners that are external to this library.
     */
    that.hasListeners = function (eventType) {
        if (eventType === undefined) {
            throw new Error("Missing required parameter event type.");
        }

        if (!eventList[eventType]) {
            return false;
        }

        return !eventList[eventType].every(function eachListener(listener) {
            return listener.isInternal;
        });
    };

    return that;
}; // End respoke.EventEmitter
/**
 * @callback respoke.EventEmitter.eventListener
 * @param {respoke.Event} evt
 */
