/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/*global brightstream: false */
/**
 * Create a new UserSession.
 * @class brightstream.UserSession
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @classdesc UserSession including logged-in status about a user account. There may be more than
 * one of these per User.
 * @param {Date} timeLoggedIn
 * @param {boolean} loggedIn
 * @param {string} client
 * @param {string} token
 * @returns {brightstream.UserSession}
 * @property {string} username
 * @property {string} token
 * @property {datetime} timeLoggedIn
 * @property {boolean} loggedIn
 */
brightstream.UserSession = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.UserSession';

    var token = params.token || '';
    var timeLoggedIn = params.timeLoggedIn || null;
    var loggedIn = params.loggedIn || false;
    delete params.token;
    delete params.timeLoggedIn;
    delete params.loggedIn;

    /**
     * Get User's OAuth token
     * @memberof! brightstream.UserSession
     * @method brightstream.UserSession.getAuthToken
     * @returns {string} The auth token for this session.
     */
    var getAuthToken = that.publicize('getAuthToken', function () {
        return token;
    });

    /**
     * Determine whether this is a valid logged-in UserSession
     * @memberof! brightstream.UserSession
     * @method brightstream.UserSession.isLoggedIn
     * @returns {boolean}
     */
    var isLoggedIn = that.publicize('isLoggedIn', function () {
        return !!loggedIn;
    });

    return that;
}; // End brightstream.UserSession

/**
 * Create a new Presentable.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc Presentable class
 * @param {string} client
 * @param {string} id
 * @property {string} username
 * @returns {brightstream.Presentable}
 */
brightstream.Presentable = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.Presentable';

    var sessions = [];
    var presence = 'unavailable';

    /**
     * Return the user ID
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.getID
     * @return {string}
     */
    var getID = that.publicize('getID', function () {
        return that.id;
    });

    /**
     * Get the name.
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.getName
     * @return {string}
     */
    var getName = that.publicize('getName', function () {
        return that.name;
    });

    /**
     * Indicate whether the entity has an active Call. Should we only return true if
     * media is flowing, or anytime a WebRTC call is active? Should it return true if the
     * engaged in a Call on another device?
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.callInProgress
     * @returns {boolean}
     */
    var callInProgress = that.publicize('callInProgress', function () {
        return false;
    });

    /**
     * Set the presence on the object and the session
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.setPresence
     * @param {string} presence
     * @param {string} sessionId
     * @fires brightstream.Presentable#presence
     */
    var setPresence = that.publicize('setPresence', function (params) {
        params = params || {};
        params.presence = params.presence || 'available';
        params.sessionId = params.sessionId || 'local';

        sessions[params.sessionId] = {
            'sessionId': params.sessionId,
            'presence': params.presence
        };

        if (typeof that.resolvePresence === 'function') {
            presence = that.resolvePresence({sessions: sessions});
        } else {
            presence = params.presence;
        }

        /**
         * @event brightstream.Presentable#presence
         * @type {string}
         */
        that.fire('presence', presence);
    });

    /**
     * Get the presence.
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.getPresence
     * @returns {string}
     */
    var getPresence = that.publicize('getPresence', function () {
        return presence;
    });

    return that;
}; // End brightstream.Presentable

/**
 * Create a new Endpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @classdesc Endpoint class
 * @param {string} client
 * @param {string} id
 * @returns {brightstream.Endpoint}
 */
brightstream.Endpoint = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.Presentable(params);
    delete that.client;
    that.className = 'brightstream.Endpoint';
    var sessions = {};

    var signalingChannel = brightstream.getClient(client).getSignalingChannel();

    /**
     * Send a message to the endpoint.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.sendMessage
     * @param {string} message
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @returns {Promise}
     */
    var sendMessage = that.publicize('sendMessage', function (params) {
        params = params || {};
        return signalingChannel.sendMessage({
            message: brightstream.TextMessage({
                'recipient': that,
                'sender': brightstream.getClient(client).user.getID(),
                'payload': params.message
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    });

    /**
     * Send a signal to the endpoint.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.sendSignal
     * @param {object|string} signal
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @returns {Promise}
     */
    var sendSignal = that.publicize('sendSignal', function (params) {
        log.debug('Endpoint.sendSignal, no support for custom signaling profiles.');
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);

        if (!params.signal) {
            deferred.reject(new Error("Can't send a signal without a 'signal' paramter."));
        }

        signalingChannel.sendSignal({
            signal: brightstream.SignalingMessage({
                'recipient': that,
                'sender': brightstream.getClient(client).user.getID(),
                'payload': params.signal
            }),
            onSuccess: params.onSuccess,
            onError: params.onError
        }).done(function () {
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });

        return deferred.promise;
    });

    /**
     * Create a new Call for a voice and/or video call. If initiator is set to true,
     * the Call will start the call.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.call
     * @param {RTCServers} [servers]
     * @param {RTCConstraints} [constraints]
     * @param {boolean} [initiator] Whether the logged-in user initiated the call.
     * @returns {brightstream.Call}
     */
    var call = that.publicize('call', function (params) {
        var id = that.getID();
        var call = null;
        var clientObj = brightstream.getClient(client);
        var combinedCallSettings = clientObj.getCallSettings();
        var user = clientObj.user;

        log.trace('Endpoint.call');
        log.debug('Default callSettings is', combinedCallSettings);
        if (params.initiator === undefined) {
            params.initiator = true;
        }

        if (!id) {
            log.error("Can't start a call without endpoint ID!");
            return;
        }

        // Apply call-specific callSettings to the app's defaults
        combinedCallSettings.constraints = params.constraints || combinedCallSettings.constraints;
        combinedCallSettings.servers = params.servers || combinedCallSettings.servers;
        log.debug('Final callSettings is', combinedCallSettings);

        params.callSettings = combinedCallSettings;
        params.client = client;
        params.username = user.getName();
        params.remoteEndpoint = id;

        params.signalOffer = function (sdp) {
            log.trace('signalOffer');
            signalingChannel.sendSDP({
                recipient: that,
                sdpObj: sdp
            });
        };
        params.signalAnswer = function (sdp) {
            log.trace('signalAnswer');
            signalingChannel.sendSDP({
                recipient: that,
                sdpObj: sdp
            });
        };
        params.signalCandidate = function (oCan) {
            oCan.type = 'candidate';
            signalingChannel.sendCandidate({
                recipient: that,
                candObj: oCan
            });
        };
        params.signalTerminate = function () {
            log.trace('signalTerminate');
            signalingChannel.sendBye({
                recipient: that
            });
        };
        params.signalReport = function (oReport) {
            log.debug("Not sending report");
            log.debug(oReport);
        };
        call = brightstream.Call(params);

        if (params.initiator === true) {
            call.answer();
        }
        user.addCall({call: call});

        // Don't use params.onHangup here. Will overwrite the developer's callback.
        call.listen('hangup', function hangupListener(locallySignaled) {
            user.removeCall({endpointId: id});
        });
        return call;
    });

    /**
     * Find the presence out of all known sessions with the highest priority (most availability)
     * and set it as the endpoint's resolved presence.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.setPresence
     * @param {array} sessions - Endpoint's sessions
     * @private
     * @returns {string}
     */
    var resolvePresence = that.publicize('resolvePresence', function (params) {
        var presence;
        var options = ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'];
        params = params || {};
        var sessionIds = Object.keys(params.sessions);

        /**
         * Sort the sessionIds array by the priority of the value of the presence of that
         * sessionId. This will cause the first element in the sessionsId to be the id of the
         * session with the highest priority presence so we can access it by the 0 index.
         * TODO: If we don't really care about the sorting and only about the highest priority
         * we could use Array.prototype.every to improve this algorithm.
         */
        sessionIds = sessionIds.sort(function sorter(a, b) {
            var indexA = options.indexOf(params.sessions[a].presence);
            var indexB = options.indexOf(params.sessions[b].presence);
            // Move it to the end of the list if it isn't one of our accepted presence values
            indexA = indexA === -1 ? 1000 : indexA;
            indexB = indexB === -1 ? 1000 : indexB;
            return indexA < indexB ? -1 : (indexB < indexA ? 1 : 0);
        });

        presence = sessionIds[0] ? params.sessions[sessionIds[0]].presence : 'unavailable';

        return presence;
    });

    return that;
}; // End brightstream.Endpoint

/**
 * Create a new User.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @classdesc User class
 * @param {string} client
 * @param {Date} timeLoggedIn
 * @param {boolean} loggedIn
 * @param {string} token
 * @returns {brightstream.User}
 */
brightstream.User = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.Presentable(params);
    var superClass = {
        setPresence: that.setPresence
    };
    delete that.client;
    that.className = 'brightstream.User';

    var remoteUserSessions = {};
    var calls = [];
    var presenceQueue = [];
    var signalingChannel = brightstream.getClient(client).getSignalingChannel();
    var userSession = brightstream.UserSession({
        'client': client,
        'token': params.token,
        'timeLoggedIn': params.timeLoggedIn,
        'loggedIn': params.loggedIn
    });

    /**
     * Override Presentable.setPresence to send presence to the server before updating the object.
     * @memberof! brightstream.User
     * @method brightstream.User.setPresence
     * @param {string} presence
     * @param {function} onSuccess
     * @param {function} onError
     * @return {Promise}
     */
    var setPresence = that.publicize('setPresence', function (params) {
        params = params || {};
        params.presence = params.presence || "available";
        log.info('sending my presence update ' + params.presence);

        return signalingChannel.sendPresence({
            presence: params.presence,
            onSuccess: function (p) {
                superClass.setPresence(params);
                if (typeof params.onSuccess === 'function') {
                    params.onSuccess(p);
                }
            },
            onError: params.onError
        });
    });

    /**
     * Get the User's locally logged-in UserSession
     * @memberof! brightstream.User
     * @method brightstream.User.getUserSession
     * @returns {brightstream.UserSession}
     */
    var getUserSession = that.publicize('getUserSession', function () {
        return userSession;
    });

    /**
     * Get the active Call.  Can there be multiple active Calls? Should we timestamp
     * them and return the most recently used? Should we create a Call if none exist?
     * @memberof! brightstream.User
     * @method brightstream.User.getActiveCall
     * @returns {brightstream.Call}
     */
    var getActiveCall = that.publicize('getActiveCall', function () {
        // TODO search by user, create if doesn't exist?
        var call = null;
        calls.forEach(function findCall(one) {
            if (one.isActive()) {
                call = one;
            }
        });
        return call;
    });

    /**
     * Get the Call with the endpoint specified.
     * @memberof! brightstream.User
     * @method brightstream.User.getCallByEndpoint
     * @param {string} endpointId - Endpoint ID
     * @param {boolean} create - whether or not to create a new call if the specified endpointId isn't found
     * @returns {brightstream.Call}
     */
    var getCallByEndpoint = that.publicize('getCallByEndpoint', function (params) {
        var call = null;
        var endpoint = null;
        var callSettings = null;
        var clientObj = brightstream.getClient(client);

        calls.forEach(function findCall(one) {
            if (one.remoteEndpoint === params.endpointId) {
                if (one.getState() >= 6) { // ended or media error
                    return;
                }
                call = one;
            }
        });

        if (call === null && params.create === true) {
            endpoint = clientObj.getEndpoint({id: params.endpointId});
            try {
                callSettings = clientObj.getCallSettings();
                call = endpoint.call({
                    callSettings: callSettings,
                    initiator: false
                });
            } catch (e) {
                log.error("Couldn't create Call: " + e.message);
            }
        }
        return call;
    });

    /**
     * Associate the call with this user.
     * @memberof! brightstream.User
     * @method brightstream.User.addCall
     * @param {brightstream.Call} call
     * @fires brightstream.User#call
     */
    var addCall = that.publicize('addCall', function (params) {
        if (calls.indexOf(params.call) === -1) {
            calls.push(params.call);
            /**
             * @event brightstream.User#call
             * @type {brightstream.Call}
             * @type {string}
             */
            that.fire('call', params.call, params.call.getEndpointID());
        }
    });

    /**
     * Remove the call.
     * @memberof! brightstream.User
     * @method brightstream.User.removeCall
     * @param {string} [endpointId]
     * @param {brightstream.Call} [call]
     */
    var removeCall = that.publicize('removeCall', function (params) {
        var match = false;
        if (!params.endpointId && !params.call) {
            throw new Error("Must specify endpointId of Call to remove or the call itself.");
        }

        // Loop backward since we're modifying the array in place.
        for (var i = calls.length - 1; i >= 0; i -= 1) {
            if ((params.endpointId && calls[i].getEndpointID() === params.endpointId) ||
                    (params.call && calls[i] === params.call)) {
                calls.splice(i);
                match = true;
            }
        }

        if (!match) {
            log.warn("No call removed.");
        }
    });


    /**
     * Set presence to available.
     * @memberof! brightstream.User
     * @method brightstream.User.setOnline
     * @param {string}
     */
    var setOnline = that.publicize('setOnline', function (params) {
        params = params || {};
        params.presence = params.presence || 'available';
        return that.setPresence(params);
    });

    return that;
}; // End brightstream.User

