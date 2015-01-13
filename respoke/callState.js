/*
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var log = require('loglevel');
var respoke = require('./respoke');
var Statechart = require('statechart');
var Q = require('q');

/**
 * State machine for WebRTC calling, data channels, and screen sharing.
 * NOTE: All state transitions are synchronous! However, listeners to the events this class fires will be called
 * asynchronously.
 * @class respoke.CallState
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {respoke.Call} call
 * @link https://cdn.respoke.io/respoke.min.js
 * @returns {respoke.CallState}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    var fsm;
    var that = respoke.EventEmitter(params);
    that.className = 'respoke.CallState';

    var allTimers = [];
    var answerTimer;
    var answerTimeout = params.answerTimeout || 10000;
    var receiveAnswerTimer;
    var receiveAnswerTimeout = params.receiveAnswerTimeout || 60000;
    var connectionTimer;
    var connectionTimeout = params.connectionTimeout || 10000;
    var modifyTimer;
    var modifyTimeout = params.modifyTimeout || 60000;
    var oldRole;

    /*
     * These can quite often result in a condition in which they do not cause a transition to occur.
     * There is at least one "universal" (air quotes) event which probably? shouldn't? but may
     * result in a non-transition error when it's OK, and that is the 'reject' event.
     */
    var nontransitionEvents = ['receiveLocalMedia', 'receiveRemoteMedia', 'approve', 'answer', 'sentOffer',
        'receiveAnswer'];

    function assert(condition) {
        if (!condition) {
            throw new Error("Assertion failed.");
        }
    }

    that.hasLocalMediaApproval = false;
    that.hasLocalMedia = false;
    that.receivedBye = false;
    that.isAnswered = false;
    that.sentSDP = false;
    that.receivedSDP = false;
    that.processedRemoteSDP = false;
    that.needDirectConnection = !!that.needDirectConnection;
    that.sendOnly = !!that.sendOnly;
    that.receiveOnly = !!that.receiveOnly;

    // Event
    var rejectEvent = [{
        target: 'connected',
        guard: function (params) {
            // we have any media flowing or data channel open
            if (typeof oldRole === 'boolean') {
                // Reset the role if we have aborted a modify.
                that.caller = oldRole;
            }

            if (modifyTimer) {
                modifyTimer.clear();
            }

            return that.hasMedia();
        }
    }, {
        target: 'terminated',
        guard: function (params) {
            params = params || {};
            // we have no media flowing or data channel open
            that.hangupReason = params.reason || "no media";
            return !that.hasMedia();
        }
    }];

    // Event
    function rejectModify() {
        // reject modification
        if (modifyTimer) {
            modifyTimer.clear();
        }
    }

    // Event
    function clearReceiveAnswerTimer() {
        that.processedRemoteSDP = true;
        if (receiveAnswerTimer) {
            receiveAnswerTimer.clear();
        }
    }

    // Event
    var hangupEvent = {
        target: 'terminated',
        action: function (params) {
            params = params || {};
            that.signalBye = params.signal;
            that.hangupReason = that.hangupReason || params.reason || "none";
        }
    };

    function needToObtainMedia(params) {
        return (that.needDirectConnection !== true && that.receiveOnly !== true);
    }

    function needToApproveDirectConnection(params) {
        return (that.needDirectConnection === true && typeof params.previewLocalMedia === 'function');
    }

    function automaticDirectConnectionCaller(params) {
        return (that.needDirectConnection === true && typeof params.previewLocalMedia !== 'function' &&
            that.caller === true);
    }

    function createTimer(func, name, time) {
        var id = setTimeout(function () {
            id = null;
            respoke.log.error(name, "timer expired.");
            func();
        }, time);
        respoke.log.debug('setting timer', name, 'for', time / 1000, 'secs');
        var timer  = {
            name: name,
            clear: function () {
                if (id === null) {
                    return;
                }
                respoke.log.debug('clearing timer', name);
                clearTimeout(id);
                id = null;
            }
        };
        allTimers.push(timer);
        return timer;
    }

    var stateParams = {
        initialState: 'idle',
        receiveLocalMedia: function () {
            that.hasLocalMedia = true;
        },
        states: {
            // State
            idle: {
                // Event
                exit: function () {
                    that.fire('idle:exit');
                },
                // Event
                initiate: [{
                    target: 'negotiatingContainer',
                    guard: function (params) {
                        assert(typeof params.client === 'object');
                        assert(typeof params.caller === 'boolean');
                        return (params.caller === true || params.client.hasListeners('call'));
                    }
                }, {
                    target: 'terminated',
                    guard: function (params) {
                        if (params.caller !== true && !params.client.hasListeners('call')) {
                            that.hangupReason = 'no call listener';
                            that.signalBye = true;
                            return true;
                        }
                        return false;
                    }
                }],
                // Event
                receiveOffer: {
                    action: function (params) {
                        that.receivedSDP = true;
                    }
                },
                // Event
                hangup: hangupEvent
            },
            // State
            negotiatingContainer: {
                init: "preparing",
                // Event
                hangup: hangupEvent,
                // Event
                modify: rejectModify,
                states: {
                    preparing: {
                        // Event
                        entry: {
                            action: function () {
                                that.hasLocalMediaApproval = false;
                                that.hasLocalMedia = false;
                                that.sentSDP = false;
                                that.receivedSDP = false;
                                that.processedRemoteSDP = false;
                                that.isAnswered = false;
                                if (!that.isModifying()) {
                                    answerTimer = createTimer(function () {
                                        that.dispatch('reject', {reason: "answer own call timer " + that.caller});
                                    }, 'answer own call', answerTimeout);
                                }
                                that.fire('preparing:entry');
                            }
                        },
                        // Event
                        exit: function () {
                            that.fire('preparing:exit');
                            if (answerTimer) {
                                answerTimer.clear();
                            }
                        },
                        // Event
                        reject: rejectEvent,
                        // Event
                        receiveOffer: {
                            action: function (params) {
                                that.receivedSDP = true;
                                if (that.isAnswered) {
                                    // If we get here, we are the callee and we've answered the call before the call
                                    // creation/receive offer promise chain completed.
                                    setTimeout(function () {
                                        that.dispatch('answer', params);
                                    });
                                }
                            }
                        },
                        // Event
                        answer: [{
                            action: function (params) {
                                assert(!params.previewLocalMedia || typeof params.previewLocalMedia === 'function');
                                that.isAnswered = true;
                                if (typeof params.previewLocalMedia !== 'function') {
                                    that.hasLocalMediaApproval = true;
                                }
                            }
                        }, {
                            // we are going to send media
                            target: 'approvingDeviceAccess',
                            guard: needToObtainMedia
                        }, {
                            // we are sending a direct connection & developer wants to approve
                            target: 'approvingContent',
                            guard: needToApproveDirectConnection
                        }, {
                            target: 'offering',
                            guard: automaticDirectConnectionCaller
                        }, {
                            // we are not sending anything or developer does not want to approve media.
                            target: 'connecting',
                            guard: function (params) {
                                // always for callee, caller will always answer before sending offer.
                                // callee should always answer after receiving offer.
                                if (!that.receivedSDP) {
                                    return false;
                                }

                                if (needToObtainMedia(params) || needToApproveDirectConnection(params) ||
                                        automaticDirectConnectionCaller(params)) {
                                    return false;
                                }

                                if (!params.previewLocalMedia || that.receiveOnly) {
                                    setTimeout(function () {
                                        params.approve();
                                    });
                                }
                                return (that.receiveOnly === true || that.needDirectConnection === true);
                            }
                        }]
                    },
                    // State
                    gettingMedia: {
                        reject: rejectEvent,
                        // Event
                        receiveLocalMedia: [{
                            action: function () {
                                that.hasLocalMedia = true;
                            }
                        }, {
                            target: 'offering',
                            guard: function (params) {
                                return (that.caller === true && that.hasLocalMediaApproval === true &&
                                    that.hasLocalMedia === true);
                            }
                        }, {
                            target: 'connecting',
                            guard: function (params) {
                                return (that.caller === false && that.hasLocalMediaApproval === true &&
                                    that.hasLocalMedia === true);
                            }
                        }],
                        states: {
                            // State
                            approvingDeviceAccess: {
                                // Event
                                entry: function () {
                                    that.fire('approving-device-access:entry');
                                },
                                // Event
                                approve: [{
                                    target: 'approvingContent',
                                    guard: function (params) {
                                        return (typeof params.previewLocalMedia === 'function');
                                    }
                                }, {
                                    target: 'connecting',
                                    guard: function (params) {
                                        return (that.caller === false &&
                                            (that.hasLocalMedia === true || that.needDirectConnection === true) &&
                                            typeof params.previewLocalMedia !== 'function');
                                    }
                                }, {
                                    target: 'offering',
                                    guard: function (params) {
                                        return (that.caller === true && that.hasLocalMedia === true &&
                                            typeof params.previewLocalMedia !== 'function');
                                    }
                                }]
                            },
                            // State
                            approvingContent: {
                                // Event
                                entry: function () {
                                    that.fire('approving-content:entry');
                                },
                                // Event
                                exit: function () {
                                    that.fire('approving-content:exit');
                                },
                                // Event
                                approve: [function (params) {
                                    that.hasLocalMediaApproval = true;
                                }, {
                                    target: 'offering',
                                    guard: function (params) {
                                        return (that.caller === true && that.hasLocalMedia === true);
                                    }
                                }, {
                                    target: 'connecting',
                                    guard: function (params) {
                                        return (that.caller === false && that.hasLocalMedia === true);
                                    }
                                }]
                            }
                        }
                    },
                    // State
                    offeringContainer: {
                        init: 'offering',
                        reject: rejectEvent,
                        sentOffer: function () {
                            // start answer timer
                            receiveAnswerTimer = createTimer(function () {
                                that.dispatch('reject', {reason: "receive answer timer"});
                            }, 'receive answer', receiveAnswerTimeout);
                        },
                        states: {
                            offering: {
                                // Event
                                entry: function () {
                                    that.fire('offering:entry');
                                },
                                // Event
                                exit: function () {
                                    that.fire('offering:exit');
                                },
                                // Event
                                receiveLocalMedia: [function () {
                                    that.hasLocalMedia = true;
                                }, {
                                    target: 'connected',
                                    guard: function (params) {
                                        // for direct connection, local media is the same as remote media
                                        return (that.needDirectConnection === true);
                                    }
                                }],
                                // Event
                                receiveRemoteMedia: {
                                    target: 'connected'
                                },
                                // Event
                                receiveAnswer: [clearReceiveAnswerTimer, {
                                    target: 'connecting'
                                }]
                            }
                        }
                    },
                    // State
                    connectingContainer: {
                        init: 'connecting',
                        reject: rejectEvent,
                        receiveAnswer: clearReceiveAnswerTimer,
                        states: {
                            connecting: {
                                // Event
                                entry: function () {
                                    that.fire('connecting:entry');

                                    // set connection timer
                                    connectionTimer = createTimer(function () {
                                        that.dispatch('reject', {reason: "connection timer"});
                                    }, 'connection', connectionTimeout);
                                },
                                // Event
                                exit: function () {
                                    if (connectionTimer) {
                                        connectionTimer.clear();
                                    }
                                    if (modifyTimer) {
                                        modifyTimer.clear();
                                    }
                                    that.fire('connecting:exit');
                                },
                                // Event
                                receiveLocalMedia: [{
                                    action: function () {
                                        that.hasLocalMedia = true;
                                    }
                                }, {
                                    target: 'connected',
                                    guard: function (params) {
                                        // for direct connection, local media is the same as remote media
                                        return (that.needDirectConnection === true && that.caller === false);
                                    }
                                }],
                                // Event
                                receiveRemoteMedia: {
                                    target: 'connected'
                                }
                            }
                        }
                    }
                }
            },
            // State
            // This state is for when we are in limbo between connected and negotiating and we are
            // trying to figure out if the other side will allow us to modify. If we receive modify in
            // this state, we will reject it. If the other party is in connected, we will be able to modify.
            modifyingContainer: {
                init: 'modifying',
                reject: rejectEvent,
                // Event
                modify: rejectModify,
                // Event
                hangup: hangupEvent,
                states: {
                    modifying: {
                        // Event
                        entry: function () {
                            modifyTimer = createTimer(function () {
                                that.dispatch('reject', {reason: "modify timer"});
                            }, 'modify for caller', modifyTimeout);
                            that.fire('modifying:entry');
                        },
                        // Event
                        accept: [function () {
                            that.caller = true;
                        }, {
                            target: 'preparing'
                        }],
                        // Event
                        exit: function () {
                            that.fire('modifying:exit');
                        }
                    }
                }
            },
            // State
            connectedContainer: {
                init: 'connected',
                reject: {
                    target: 'terminated',
                    action: function (params) {
                        that.hangupReason = params.reason || "got reject while connected";
                    }
                },
                receiveAnswer: clearReceiveAnswerTimer,
                // Event
                hangup: hangupEvent,
                states: {
                    connected: {
                        // Event
                        entry: function () {
                            oldRole = that.caller;
                            that.needDirectConnection = false;
                            that.fire('connected:entry');
                        },
                        // Event
                        exit: function () {
                            that.fire('connected:exit');
                        },
                        // Event
                        modify: [{
                            // be notified that the other side would like modification
                            target: 'preparing',
                            guard: function (params) {
                                params = params || {};
                                if (params.receive === true) {
                                    that.caller = false;
                                    modifyTimer = createTimer(function () {
                                        // If modify gets interrupted, go back to previous roles.
                                        that.dispatch('reject', {reason: "modify timer"});
                                    }, 'modify', modifyTimeout);
                                    return true;
                                }
                            }
                        }, {
                            // request to begin modification
                            target: 'modifying',
                            guard: function (params) {
                                params = params || {};
                                return (params.receive !== true);
                            }
                        }]
                    }
                }
            },
            // State
            terminatedContainer: {
                init: 'terminated',
                states: {
                    terminated: {
                        // Event
                        entry: {
                            action: function () {
                                that.fire('terminated:entry');
                                allTimers.forEach(function (timer) {
                                    timer.clear();
                                });
                                setTimeout(function () {
                                    fsm = null;
                                    that.ignore();
                                });
                            }
                        }
                    }
                }
            }
        }
    };

    stateParams.that = Object.create(Statechart);
    fsm = respoke.Class(stateParams);
    fsm.run({
        // rename to 'debug' to enable
        debugOff: function () {
            // So we can print the caller. Debug most often used when testing & tests run in the same tab.
            var args = Array.prototype.slice.call(arguments);
            args.splice(0, 0, that.caller);
            respoke.log.debug.apply(respoke.log, args);
        }
    });

    /**
     * Return the name of the current state.
     * @memberof! respoke.CallState
     * @method respoke.Call.getState
     * @returns {string}
     */
    that.getState = function () {
        if (!fsm) {
            return 'terminated';
        }
        return fsm.currentState().name;
    };

    /**
     * Synchronously dispatch an event, which may or may not change the state.
     * @memberof! respoke.CallState
     * @method respoke.Call.dispatch
     */
    that.dispatch = function (evt, args) {
        var oldState;
        var newState;

        if (!fsm) {
            return;
        }

        oldState = that.getState();
        try {
            fsm.dispatch(evt, args);
        } catch (err) {
            respoke.log.debug('error dispatching', evt, 'from', oldState, "with", args, err);
            throw err;
        }
        newState = that.getState();
        if (oldState === newState && nontransitionEvents.indexOf(evt) === -1) {
            respoke.log.debug(that.caller, "Possible bad event " + evt + ", no transition occured.");
        }
        respoke.log.debug(that.caller, 'dispatching', evt, 'moving from ', oldState, 'to', newState, args);
    };

    /**
     * Determine whether or not we are in the middle of a call modification.
     * @memberof! respoke.CallState
     * @method respoke.Call.isModifying
     * @returns {boolean}
     */
    that.isModifying = function () {
        var modifyingStates = ['preparing', 'modifying', 'approvingDeviceAccess', 'approvingMedia', 'offering'];
        return (modifyingStates.indexOf(that.getState()) > -1 && that.hasMedia());
    };

    /**
     * Helper for testing state name
     * @memberof! respoke.CallState
     * @method respoke.Call.isState
     * @param {string} name
     * @returns {boolean}
     */
    that.isState = function (name) {
        return (that.getState() === name);
    };

    assert(typeof that.hasMedia === 'function');
    assert(typeof that.caller === 'boolean');
    return that;
};
