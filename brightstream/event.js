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
     * Add a listener to an object.
     * @memberof! brightstream.EventEmitter
     * @method brightstream.EventEmitter.listen
     * @param {string} eventType - A developer-specified string identifying the event.
     * @param {function} listener - A function to call when the event is fire.
     */
    var listen = that.publicize('listen', function (eventType, listener) {
        eventList[eventType] = eventList[eventType] || [];
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
     * @param {string} eventType - An optional developer-specified string identifying the event.
     * @param {function} listener - An optional function to remove from the specified event.
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

    return that;
}; // End brightstream.EventEmitter

/**
 * Create a generic Event object for EventEmitters to pass to event listeners.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Event
 * @property {string} name
 * @property {brightstream.Class} target
 * @property {brightstream.Group} [group]
 * @property {brightsetream.Endpoint} [endpoint]
 * @property {brightsetream.Call} [call]
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
