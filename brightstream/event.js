/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a generic EventEmitter class for objects with events to extend.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.EventEmitter
 * @augments brightstream.Class
 * @constructor
 * @classdesc EventEmitter class.
 * @param {string} client
 * @returns {brightstream.EventEmitter}
 */
/*global brightstream: false */
brightstream.EventEmitter = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.Class(params);
    delete that.client;
    that.className = 'brightstream.EventEmitter';

    var eventList = {};

    /**
     * Add a listener to an object.  This method adds the given listener to the given event in the case that the same
     * listener is not already registered to this even and the listener is a function.  The third argument 'isInternal'
     * is used only internally by the library to indicate that this listener is a library-used listener and should not
     * count when we are trying to determine if an event has listeners placed by the developer.
     * @memberof! brightstream.EventEmitter
     * @method brightstream.EventEmitter.listen
     * @param {string} eventType - A developer-specified string identifying the event.
     * @param {function} listener - A function to call when the event is fire.
     * @param {boolean} [isInternal] - A flag to indicate this listener was added by the library. This parameter should
     * not be used by developers who are using the library, only by developers who are working on the library itself.
     */
    var listen = that.publicize('listen', function (eventType, listener, isInternal) {
        if (listener === undefined) {
            return;
        }

        eventList[eventType] = eventList[eventType] || [];
        listener.isInternal = !!isInternal; // boolify

        if (typeof listener === 'function' && eventList[eventType].map(function (a) {
            return a.toString();
        }).indexOf(listener.toString()) === -1) {
            eventList[eventType].push(listener);
        } else if (eventList[eventType].indexOf(listener) !== -1) {
            log.warn("not adding duplicate listener.");
        }
    });

    /**
     * Remove a listener from an object. If no eventType is specified, all eventTypes will be
     * cleared. If an eventType is specified but no listener is specified, all listeners will be
     * removed from the specified eventType.  If a listener is also specified, only that listener
     * will be removed.
     * @memberof! brightstream.EventEmitter
     * @method brightstream.EventEmitter.ignore
     * @param {string} [eventType] - An optional developer-specified string identifying the event.
     * @param {function} [listener] - An optional function to remove from the specified event.
     */
    var ignore = that.publicize('ignore', function (eventType, listener) {
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
    });

    /**
     * Trigger an event on an object. All listeners for the specified eventType will be called.
     * Listeners will be bound to the object ('this' will refer to the object), and additional
     * arguments to fire() will be passed into each listener.
     * @memberof! brightstream.EventEmitter
     * @method brightstream.EventEmitter.fire
     * @param {string} eventType - A developer-specified string identifying the event to fire.
     * @param {string|number|object|array} any - Any number of optional parameters to be passed to
     * the listener
     */
    var fire = that.publicize('fire', function (eventType, evt) {
        var args = null;
        var count = 0;

        if (!eventType || !eventList[eventType]) {
            return;
        }

        evt = evt || {};
        evt.name = eventType;
        evt.target = that;
        evt = brightstream.Event(evt);
        eventList[eventType].forEach(function fireListener(listener) {
            if (typeof listener === 'function') {
                try {
                    listener.call(that, evt);
                    count += 1;
                } catch (e) {
                    log.error('Error in ' + that.className + "#" + eventType + ": " + e.message);
                    log.error(e.stack);
                }
            }
        });
        log.debug("fired " + that.className + "#" + eventType + " " + count + " listeners called with params", evt);
    });

    /**
     * Determine if an object has had any listeners registered for a given event outside the library. This method
     * checks for the isInternal flag on each listener and doesn't count it toward an event being listened to. This
     * method is used in the library to handle situations where an action is needed if an event won't be acted on.
     * For instance, if a call comes in for the logged-in user, but the developer isn't listening to
     * {brightstream.User#call}, we'll need to reject the call immediately.
     * @memberof! brightstream.EventEmitter
     * @method brightstream.EventEmitter.hasListeners
     * @param {string} eventType - The name of the event
     */
    var hasListeners = that.publicize('hasListeners', function (eventType) {
        if (eventType === undefined) {
            throw new Error("Missing required parameter event type.");
        }

        if (!eventList[eventType]) {
            return false;
        }

        return !eventList[eventType].every(function (listener) {
            return listener.isInternal;
        });
    });

    return that;
}; // End brightstream.EventEmitter

/**
 * Create a generic Event object for EventEmitters to pass to event listeners. In addition to the two properties
 * mentioned below, this object will retain any other properties passed into the factory. This structure is used
 * to construct arbitrary POJO's to be used as event values.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Event
 * @property {string} name
 * @property {brightstream.Class} target
 * @constructor
 * @classdesc Event object.
 * @returns {brightstream.Event}
 */
brightstream.Event = function (that) {
    "use strict";

    if (!that.name) {
        throw new Error("Can't create an Event without an event name.");
    }

    if (!that.target) {
        throw new Error("Can't create an Event without a target.");
    }

    return that;
}; // End brighstream.Event