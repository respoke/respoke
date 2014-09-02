/**
 * Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software.
 * @ignore
 */

//var Q = require('q');
var log = require('loglevel');
var respoke = require('./respoke');
var Statechart = require('statechart');
var Q = require('q');

/**
 * State machine for WebRTC calling, data channels, and screen sharing.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.CallState
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {respoke.Call} call
 * @link https://www.respoke.io/min/respoke.min.js
 * @returns {respoke.CallState}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    var fsm;
    var that = respoke.EventEmitter(params);
    that.className = 'respoke.CallState';

    var answerTimer;
    var answerTimeout = 10000;
    var receiveAnswerTimer;
    var receiveAnswerTimeout = 60000;
    var connectionTimer;
    var connectionTimeout = 10000;
    var savedOffer;
    var savedAnswer;

    var nontransitionEvents = ['receiveLocalMedia', 'receiveRemoteMedia', 'approve', 'answer', 'sentOffer',
        'receiveAnswer'];

    var setMediaFlowingEvent = {
        action: function () {
            // re-evaluate whether media is flowing
        }
    };

    function assert(condition) {
        if (!condition) {
            throw new Error("Assertion failed.");
        }
    }

    that.isMediaFlowing = false;
    that.hasLocalMediaApproval = false;
    that.hasLocalMedia = false;
    that.hasRemoteMedia = false; // TODO turn into ice connection

    function eventRedirect(evt) {
        that.fire.call(evt.name, evt);
    }
    // Event
    var rejectEvent = [setMediaFlowingEvent, {
        target: 'connected',
        guard: function () {
            // we have any media flowing or data channel open
            return (that.isMediaFlowing === true);
        }
    }, {
        target: 'terminated',
        guard: function () {
            // we have no media flowing or data channel open
            return (that.isMediaFlowing === false);
        }
    }];

    function needToObtainMedia(params) {
        assert(params.directConnectionOnly !== undefined);
        assert(params.receiveOnly !== undefined);
        return (params.directConnectionOnly !== true && params.receiveOnly !== true);
    }

    function onlyNeedToApproveDirectConnection(params) {
        assert(params.directConnectionOnly !== undefined);
        assert(params.receiveOnly !== undefined);
        return (typeof params.previewLocalMedia === 'function' && params.directConnectionOnly === true &&
            params.receiveOnly !== true);
    }

    function Timer(func, name, time) {
        var id = setTimeout(function () {
            respoke.log.debug(name, "timer expired.");
            func();
        }, time);
        respoke.log.debug('setting timer', name, 'for', time/1000, 'secs');
        return {
            name: name,
            clear: function () {
                respoke.log.debug('clearing timer', name);
                clearTimeout(id);
            }
        };
    }

    var stateParams = {
        initialState: 'idle',
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
                        assert(params.client !== undefined);
                        return params.client.hasListeners('call');
                    }
                }, {
                    target: 'terminated',
                    guard: function (params) {
                        return !params.client.hasListeners('call');
                    }
                }]
            },
            // State
            negotiatingContainer: {
                init: "preparing",
                states: {
                    preparing: {
                        // Event
                        entry: [setMediaFlowingEvent, {
                            action: function () {
                                that.hasLocalMediaApproval = false;
                                that.hasMedia = false;
                                answerTimer = new Timer(function () {
                                    that.dispatch('reject');
                                }, 'answer own call', answerTimeout);
                                that.fire('preparing:entry');
                            }
                        }],
                        // Event
                        exit: function () {
                            that.fire('preparing:exit');
                        },
                        // Event
                        reject: rejectEvent,
                        // Event
                        answer: [{
                            action: function (params) {
                                assert(that.hasLocalMediaApproval !== undefined);
                                if (answerTimer) {
                                    answerTimer.clear();
                                }
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
                            guard: onlyNeedToApproveDirectConnection
                        }, {
                            // we are not sending anything or developer does not want to approve media.
                            target: 'connecting',
                            guard: function (params) {
                                if (needToObtainMedia(params) || onlyNeedToApproveDirectConnection(params)) {
                                    return false;
                                }
                                if (typeof params.previewLocalMedia !== 'function' || params.receiveOnly === true) {
                                    params.approve();
                                }
                                return (params.receiveOnly === true);
                            }
                        }]
                    },
                    // State
                    gettingMedia: {
                        reject: rejectEvent,
                        // Event
                        receiveLocalMedia: [function () {
                            that.hasLocalMedia = true;
                        }, {
                            target: 'offering',
                            guard: function (params) {
                                return (params.caller === true && that.hasLocalMediaApproval === true &&
                                    that.hasLocalMedia === true);
                            }
                        }, {
                            target: 'connecting',
                            guard: function (params) {
                                return (params.caller === false && that.hasLocalMediaApproval === true &&
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
                                        assert(that.hasLocalMedia !== undefined);
                                        assert(params.caller !== undefined);
                                        return (typeof params.previewLocalMedia === 'function');
                                    }
                                }, {
                                    target: 'connecting',
                                    guard: function (params) {
                                        return (params.caller === false && that.hasLocalMedia === true &&
                                            typeof params.previewLocalMedia !== 'function');
                                    }
                                }, {
                                    target: 'offering',
                                    guard: function (params) {
                                        return (params.caller === true && that.hasLocalMedia === true &&
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
                                        assert(params.caller !== undefined);
                                        assert(that.hasLocalMedia !== undefined);
                                        return (params.caller === true && that.hasLocalMedia === true);
                                    }
                                }, {
                                    target: 'connecting',
                                    guard: function (params) {
                                        return (params.caller === false && that.hasLocalMedia === true);
                                    }
                                }]
                            }
                        }
                    },
                    // State
                    offeringContainer: {
                        init: 'offering',
                        reject: rejectEvent,
                        receiveLocalMedia: function () {
                            that.hasLocalMedia = true;
                        },
                        sentOffer: function () {
                            // start answer timer
                            receiveAnswerTimer = new Timer(function () {
                                that.dispatch('reject');
                            }, 'receive answer', receiveAnswerTimeout);
                        },
                        states: {
                            offering: {
                                // Event
                                entry: function () {
                                    that.fire('offering:entry');
                                },
                                // Event
                                receiveRemoteMedia: [function () {
                                    that.hasRemoteMedia = true;
                                }, {
                                    target: 'connected'
                                }],
                                // Event
                                receiveAnswer: [function () {
                                    if (receiveAnswerTimer) {
                                        receiveAnswerTimer.clear();
                                    }
                                }, {
                                    target: 'connecting'
                                }]
                            }
                        }
                    },
                    // State
                    connectingContainer: {
                        init: 'connecting',
                        reject: rejectEvent,
                        receiveAnswer: function () {
                            if (receiveAnswerTimer) {
                                receiveAnswerTimer.clear();
                            }
                        },
                        states: {
                            connecting: {
                                // Event
                                entry: function () {
                                    that.fire('connecting:entry');

                                    // set connection timer
                                    connectionTimer = new Timer(function () {
                                        that.dispatch('reject');
                                    }, 'connection', connectionTimeout);
                                },
                                // Event
                                receiveRemoteMedia: [{
                                    action: function () {
                                        if (connectionTimer) {
                                            connectionTimer.clear();
                                        }
                                    }
                                }, {
                                    target: 'connected'
                                }]
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
                states: {
                    modifying: {
                        // Event
                        entry: function () {
                            that.fire('modifying:entry');
                        },
                        // Event
                        modify: function () {
                            // reject modification
                        },
                        // Event
                        accept: {
                            target: 'preparing'
                        }
                    }
                }
            },
            // State
            connectedContainer: {
                init: 'connected',
                reject: rejectEvent,
                receiveAnswer: function () {
                    if (receiveAnswerTimer) {
                        receiveAnswerTimer.clear();
                    }
                },
                states: {
                    connected: {
                        // Event
                        entry: function () {
                            that.fire('connected:entry');
                        },
                        // Event
                        exit: function () {
                            that.fire('connected:exit');
                        },
                        // Event
                        modify: {
                            // begin modification
                            target: 'modifying'
                        }
                    }
                }
            },
            // State
            terminatedContainer: {
                init: 'terminated',
                states: {
                    terminated: {
                        // Event
                        entry: [{
                            action: function () {
                                that.fire('terminated:entry');
                                //that.ignore();
                            }
                        }, {
                            guard: function () {
                                // no signaling has been sent
                            },
                            action: function () {
                                // send bye
                            }
                        }]
                    }
                }
            }
        }
    };

    stateParams.that = Statechart;
    fsm = respoke.Class(stateParams);
    fsm.run();

    that.currentState = fsm.currentState.bind(fsm);
    //that.dispatch = fsm.dispatch.bind(fsm);
    that.dispatch = function (evt, args) {
        var oldState = fsm.currentState().name;
        var newState;
        respoke.log.debug('dispatching', evt, 'from', oldState, args);
        try {
            fsm.dispatch(evt, args);
        } catch (err) {
            respoke.log.debug('error dispatching event!', err);
            throw err;
        }
        newState = fsm.currentState().name;
        if (oldState === newState && nontransitionEvents.indexOf(evt) === -1) {
            respoke.log.debug("Possible bad event " + evt + ", no transition occured.");
            //throw new Error("Possible bad event " + evt + ", no transition occured.");
        }
        respoke.log.debug('new state is', newState);
    };

    /**
     * Determine whether or not we are in the middle of a call modification.
     * @memberof! respoke.CallState
     * @method respoke.Call.isModifying
     * @returns {boolean}
     */
    that.isModifying = function () {
        return (['preparing', 'modifying'].indexOf(that.currentState().name) > -1 &&
            that.isMediaFlowing && that.currentState() !== undefined);
    };

    /**
     * Helper for testing state name
     * @memberof! respoke.CallState
     * @method respoke.Call.isState
     * @param {string} name
     * @returns {boolean}
     */
    that.isState = function (name) {
        return (that.currentState() && that.currentState().name === name);
    };

    return that;
};
