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
    var answerTimeout = 1000;
    var connectionTimer;
    var connectionTimeout = 1000;
    var savedOffer;
    var savedAnswer;

    var setMediaFlowingEvent = {
        action: function () {
            // re-evaluate whether media is flowing
        }
    };

    that.isMediaFlowing = false;

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
                    guard: function () {
                        return that.call.hasListeners('call');
                    }
                }, {
                    target: 'terminated',
                    guard: function () {
                        return !that.call.hasListeners('call');
                    }
                }]
            },
            // State
            negotiatingContainer: {
                init: "negotiating",
                states: {
                    negotiating: {
                        // Event
                        entry: [setMediaFlowingEvent, {
                            action: function () {
                                that.fire('negotiating:entry');
                            }
                        }],
                        // Event
                        exit: function () {
                            that.fire('negotiating:exit');
                        },
                        // Event
                        reject: rejectEvent,
                        // Event
                        answer: [{
                            action: function () {
                                clearTimeout(answerTimer);
                            }
                        }, {
                            target: 'approvingDeviceAccess',
                            guard: function () {
                                // TODO
                                return (that.call.directConnectionOnly !== true);
                            }
                        }, {
                            target: 'approvingContent',
                            guard: function () {
                                if (that.mediaApproved || !that.call.previewLocalMedia) {
                                    return false;
                                }
                                return (that.call.directConnectionOnly === true);
                            }
                        }],
                        // Event
                        receiveOffer: { // initial offer
                            target: 'answering',
                            guard: function () {
                                return (that.call.caller === false);
                            },
                            action: function (signal) {
                                savedOffer = signal;
                            }
                        },
                    },
                    // State
                    answeringContainer: { // only callee
                        init: 'answering',
                        reject: rejectEvent,
                        states: {
                            answering: {
                                entry: function () {
                                    answerTimer = setTimeout(function () {
                                        that.dispatch('reject');
                                    }, answerTimeout);
                                    that.fire('answering:entry');
                                },
                            },
                            // State
                            approvingDeviceAccess: {
                                // Event
                                entry: function () {
                                    that.fire('approving-device-access:entry');
                                },
                                // Event
                                approve: {
                                    target: 'approvingContent'
                                }
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
                                approve: [{
                                    target: 'offering',
                                    guard: function () {
                                        // Why doesn't it call offering's entry event when exiting answering?
                                        // see spec/unit/client/call-state.spec.js
                                        //that.fire('offering:entry');
                                        return that.call.caller === true;
                                    }
                                }, {
                                    target: 'connecting',
                                    guard: function () {
                                        // Why doesn't it call connecting's entry event when exiting answering?
                                        // see spec/unit/client/call-state.spec.js
                                        //that.fire('connecting:entry');
                                        return that.call.caller === false;
                                    }
                                }]
                            }
                        }
                    },
                    // State
                    offeringContainer: {
                        init: 'offering',
                        reject: rejectEvent,
                        states: {
                            offering: {
                                // Event
                                entry: function () {
                                    that.fire('offering:entry');

                                    // start answer timer
                                    answerTimer = setTimeout(function () {
                                        that.dispatch('reject');
                                    }, answerTimeout);
                                },
                                // Event
                                receiveAnswer: {
                                    target: 'connecting'
                                }
                            }
                        }
                    },
                    // State
                    connectingContainer: {
                        init: 'connecting',
                        reject: rejectEvent,
                        states: {
                            connecting: {
                                // Event
                                entry: function () {
                                    that.fire('connecting:entry');

                                    // set connection timer
                                    connectionTimer = setTimeout(function () {
                                        that.dispatch('reject');
                                    }, connectionTimeout);
                                },
                                // Event
                                receiveMedia: {
                                    target: 'connected'
                                }
                            }
                        }
                    }
                }
            },
            // State
            connectedContainer: {
                init: 'connected',
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
                        modify: { // modifying
                            target: 'negotiatingContainer',
                            action: function (signal) {
                                savedOffer = signal;
                            }
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
    that.dispatch = fsm.dispatch.bind(fsm);

    /**
     * Determine whether or not we are in the middle of a call modification.
     * @memberof! respoke.CallState
     * @method respoke.Call.isModifying
     * @returns {boolean}
     */
    that.isModifying = function () {
        return (that.currentState() !== undefined && that.currentState().name === 'negotiating' && that.isMediaFlowing);
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
