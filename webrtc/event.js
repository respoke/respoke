/**
 * Create a generic EventThrower class for objects with events to extend.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.EventThrower
 * @augments webrtc.Class
 * @constructor
 * @classdesc EventThrower class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.EventThrower}
 */
/*global webrtc: false */
webrtc.EventThrower = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.Class(params);
    that.className = 'webrtc.EventThrower';

    var eventList = {};

    /**
     * Add a listener to an object.
     * @memberof! webrtc.EventThrower
     * @method webrtc.EventThrower.listen
     * @param {string} eventType A developer-specified string identifying the event.
     * @param {function} listener A function to call when the event is fire.
     */
    var listen = that.publicize('listen', function (eventType, listener) {
        eventList[eventType] = eventList[eventType] || [];
        if (typeof listener === 'function') {
            eventList[eventType].push(listener);
        }
    });

    /**
     * Remove a listener from an object. If no eventType is specified, all eventTypes will be
     * cleared. If an eventType is specified but no listener is specified, all listeners will be
     * removed from the specified eventType.  If a listener is also specified, only that listener
     * will be removed.
     * @memberof! webrtc.EventThrower
     * @method webrtc.EventThrower.ignore
     * @param {string} eventType An optional developer-specified string identifying the event.
     * @param {function} listener An optional function to remove from the specified event.
     */
    var ignore = that.publicize('ignore', function (eventType, listener) {
        if (eventType === undefined) {
            // Remove all events from this object
            eventList = {};
            return;
        }
        if (listener === undefined) {
            // Remove all listener from this event.
            eventList[eventType] = [];
            return;
        }
        eventList[eventType].reverse().forEach(function (eachListener, index) {
            if (listener === eachListener) {
                /* TODO: don't know if this will work. Functionally, should be fine since we
                 * are moving in reverse, but it may be prohibited by the JS engine. */
                eventList[eventType].splice(index, 1);
            }
        });
    });

    /**
     * Trigger an event on an object. All listeners for the specified eventType will be called.
     * Listeners will be bound to the object ('this' will refer to the object), and additional
     * arguments to fire() will be passed into each listener.
     * @memberof! webrtc.EventThrower
     * @method webrtc.EventThrower.fire
     * @param {string} eventType A developer-specified string identifying the event to fire.
     * @param {string|number|object|array} any Any number of optional parameters to be passed to
     * the listener
     */
    var fire = that.publicize('fire', function (eventType) {
        if (!eventType || !eventList[eventType]) {
            return;
        }
        var args = Array.prototype.slice.call(arguments, 1);
        eventList[eventType].forEach(function (listener) {
            if (typeof listener === 'function') {
                try {
                    listener.apply(that, args);
                } catch (e) {
                    log.error('Error in ' + that.className + "#" + eventType + ": " + e.message);
                    log.error(e.stack);
                }
            }
        });
    });

    return that;
}; // End webrtc.EventThrower
