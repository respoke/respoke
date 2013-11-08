/**
 * Create a generic EventEmitter class for objects with events to extend.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.EventEmitter
 * @augments webrtc.Class
 * @constructor
 * @classdesc EventEmitter class.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.EventEmitter}
 */
/*global webrtc: false */
webrtc.EventEmitter = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.Class(params);
    delete that.client;
    that.className = 'webrtc.EventEmitter';

    var eventList = {};

    /**
     * Add a listener to an object.
     * @memberof! webrtc.EventEmitter
     * @method webrtc.EventEmitter.listen
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
     * @memberof! webrtc.EventEmitter
     * @method webrtc.EventEmitter.ignore
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
        eventList[eventType].reverse().forEach(function checkListener (eachListener, index) {
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
     * @memberof! webrtc.EventEmitter
     * @method webrtc.EventEmitter.fire
     * @param {string} eventType A developer-specified string identifying the event to fire.
     * @param {string|number|object|array} any Any number of optional parameters to be passed to
     * the listener
     */
    var fire = that.publicize('fire', function (eventType) {
        var args = null;
        var count = 0;

        if (!eventType || !eventList[eventType]) {
            return;
        }

        args = Array.prototype.slice.call(arguments, 1);
        eventList[eventType].forEach(function fireListener (listener) {
            if (typeof listener === 'function') {
                try {
                    listener.apply(that, args);
                    count += 1;
                } catch (e) {
                    log.error('Error in ' + that.className + "#" + eventType + ": " + e.message);
                    log.error(e.stack);
                }
            }
        });
        log.debug("fired " + that.className + "#" + eventType + " " + count + " listeners called.");
    });

    return that;
}; // End webrtc.EventEmitter
