/**
 * Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software.
 * @private
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
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.listen
     * @param {string} eventType - A developer-specified string identifying the event.
     * @param {respoke.EventEmitter.eventListener} listener - A function to call when the event is fire.
     * @param {boolean} [isInternal] - A flag to indicate this listener was added by the library. This parameter should
     * not be used by developers who are using the library, only by developers who are working on the library itself.
     */
    that.once = function (eventType, listener, isInternal) {
        listener = respoke.once(listener);
        listener.once = true;
        that.listen(eventType, listener, isInternal);
    };

    /**
     * Add a listener to an object.  This method adds the given listener to the given event in the case that the same
     * listener is not already registered to this even and the listener is a function.  The third argument 'isInternal'
     * is used only internally by the library to indicate that this listener is a library-used listener and should not
     * count when we are trying to determine if an event has listeners placed by the developer.
     * @memberof! respoke.EventEmitter
     * @method respoke.EventEmitter.listen
     * @param {string} eventType - A developer-specified string identifying the event.
     * @param {respoke.EventEmitter.eventListener} listener - A function to call when the event is fire.
     * @param {boolean} [isInternal] - A flag to indicate this listener was added by the library. This parameter should
     * not be used by developers who are using the library, only by developers who are working on the library itself.
     */
    that.listen = function (eventType, listener, isInternal) {
        if (listener === undefined) {
            return;
        }

        eventList[eventType] = eventList[eventType] || [];
        listener.isInternal = !!isInternal; // boolify

        if (typeof listener === 'function' && eventList[eventType].map(function eachListener(a) {
            return a.toString();
        }).indexOf(listener.toString()) === -1) {
            eventList[eventType].push(listener);
        } else if (eventList[eventType].indexOf(listener) !== -1) {
            log.warn("not adding duplicate listener.");
        }
    };

    /**
     * Remove a listener from an object. If no eventType is specified, all eventTypes will be
     * cleared. If an eventType is specified but no listener is specified, all listeners will be
     * removed from the specified eventType.  If a listener is also specified, only that listener
     * will be removed.
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
     */
    that.fire = function (eventType, evt) {
        var args = null;
        var count = 0;

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

        for (var i = eventList[eventType].length; i > -1; i -= 1) {
            var listener = eventList[eventType][i];
            if (typeof listener === 'function') {
                setTimeout(listenerBuilder(listener, evt, eventType));

                count += 1;
                if (listener.once) {
                    eventList[eventType].splice(i, 1);
                }
            }
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
