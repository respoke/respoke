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
var Q = require('q');
var respoke = require('./respoke');

/**
 * `respoke.Client` is the top-level interface to the API. Interacting with Respoke should be done using
 * a `respoke.Client` instance.
 *
 * There are two ways to get a client:
 *
 *      var client = respoke.createClient(clientParams);
 *      // . . . set stuff up, then . . .
 *      client.connect(connectParams);
 *
 * or
 *
 *      // creates client and connects to Respoke all at once
 *      var client = respoke.connect(allParams);
 *
 * A client does the following things:
 *
 * 1. authentication with the Respoke API
 * 1. receives server-side app-specific information
 * 1. tracks connections and presence
 * 1. provides methods to get and interact with tracked entities (like groups and endpoints)
 * 1. stores default settings for calls and direct connections
 * 1. automatically reconnects to the API when network activity is lost*
 *
 * *If `developmentMode` is set to true. If not using `developmentMode`, disable automatic
 * reconnect by sending `reconnect: false` and listening to the Client's disconnect event
 * to fetch a new brokered auth token, then call `client.connect()` with the new token.
 *
 * @class respoke.Client
 * @constructor
 * @augments respoke.Presentable
 * @param {object} params
 * @param {string} [params.appId] - The ID of your Respoke app. This must be passed either to
 * respoke.connect, respoke.createClient, or to client.connect.
 * @param {string} [params.token] - The endpoint's authentication token.
 * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
 * endpoint. This is only used when `developmentMode` is set to `true`.
 * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
 * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
 * operation and will limit the services you will be able to use.
 * @param {string|number|object|Array} [params.presence=unavailable] The initial presence to set once connected.
 * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Respoke service
 * when a disconnect occurs.
 * @param {respoke.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
 * @param {respoke.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves a group.
 * @param {respoke.Client.onClientMessage} [params.onMessage] - Callback for when any message is received
 * from anywhere on the system.
 * @param {respoke.Client.onConnect} [params.onConnect] - Callback for Client connect.
 * @param {respoke.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
 * @param {respoke.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect.
 * @param {respoke.Client.onCall} [params.onCall] - Callback for when this client's user receives a call.
 * @param {respoke.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this client's user
 * receives a request for a direct connection.
 * @returns {respoke.Client}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Client
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId || respoke.makeGUID();
    params.instanceId = instanceId;
    var that = respoke.Presentable(params);
    respoke.instances[instanceId] = that;
    delete that.instanceId;
    that.connectTries = 0;
    /**
     * A name to identify this class
     * @memberof! respoke.Client
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Client';
    /**
     * @memberof! respoke.Client
     * @name host
     * @type {string}
     * @private
     */
    var host = window.location.hostname;
    /**
     * @memberof! respoke.Client
     * @name port
     * @type {number}
     * @private
     */
    var port = window.location.port;
    /**
     * A simple POJO to store some methods we will want to override but reference later.
     * @memberof! respoke.Client
     * @name superClass
     * @private
     * @type {object}
     */
    var superClass = {
        setPresence: that.setPresence
    };
    /**
     * A container for baseURL, token, and appId so they won't be accidentally viewable in any JavaScript debugger.
     * @memberof! respoke.Client
     * @name clientSettings
     * @type {object}
     * @private
     * @property {string} [baseURL] - the URL of the cloud infrastructure's REST API.
     * @property {string} [token] - The endpoint's authentication token.
     * @property {string} [appId] - The id of your Respoke app.
     * @property {string} [endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @property {boolean} [developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @property {boolean} [reconnect=false] - Whether or not to automatically reconnect to the Respoke service
     * when a disconnect occurs.
     * @param {respoke.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {respoke.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves a group.
     * @property {respoke.Client.onClientMessage} [onMessage] - Callback for when any message is received
     * from anywhere on the system.
     * @property {respoke.Client.onConnect} [onConnect] - Callback for Client connect.
     * @property {respoke.Client.onDisconnect} [onDisconnect] - Callback for Client disconnect.
     * @property {respoke.Client.onReconnect} [onReconnect] - Callback for Client reconnect. Not Implemented.
     * @property {respoke.Client.onCall} [onCall] - Callback for when this client receives a call.
     * @property {respoke.Client.onDirectConnection} [onDirectConnection] - Callback for when this client
     * receives a request for a direct connection.
     * @property {boolean} enableCallDebugReport=true - Upon finishing a call, should the client send debugging
     * information to the API? Defaults to `true`.
     */
    var clientSettings = {};

    delete that.appId;
    delete that.baseURL;
    delete that.developmentMode;
    delete that.token;
    delete that.resolveEndpointPresence;

    /**
     * Internal list of known groups.
     * @memberof! respoke.Client
     * @name groups
     * @type {Array<respoke.Group>}
     * @private
     */
    var groups = [];
    /**
     * Internal list of known endpoints.
     * @memberof! respoke.Client
     * @name endpoints
     * @type {Array<respoke.Endpoint>}
     * @private
     */
    var endpoints = [];
    /**
     * Array of calls in progress, made accessible for informational purposes only.
     * **Never modify this array directly.**
     *
     * @memberof! respoke.Client
     * @name calls
     * @type {array}
     */
    that.calls = [];
    log.debug("Client ID is ", instanceId);

    /**
     * @memberof! respoke.Client
     * @name signalingChannel
     * @type {respoke.SignalingChannel}
     * @private
     */
    var signalingChannel = respoke.SignalingChannel({
        instanceId: instanceId,
        clientSettings: clientSettings
    });

    /**
     * Save parameters of the constructor or client.connect() onto the clientSettings object
     * @memberof! respoke.Client
     * @method respoke.saveParameters
     * @param {object} params
     * @param {respoke.Client.connectSuccessHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {string} [params.appId] - The ID of your Respoke app. This must be passed either to
     * respoke.connect, respoke.createClient, or to client.connect.
     * @param {string} [params.token] - The endpoint's authentication token.
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @param {string|number|object|Array} [params.presence] The initial presence to set once connected.
     * @param {respoke.client.resolveEndpointPresence} [params.resolveEndpointPresence] An optional function for
     * resolving presence for an endpoint.  An endpoint can have multiple Connections this function will be used
     * to decide which Connection's presence gets precedence for the Endpoint.
     * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Respoke service
     * when a disconnect occurs.
     * @param {respoke.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {respoke.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves
     * a group.
     * @param {respoke.Client.onClientMessage} [params.onMessage] - Callback for when any message is
     * received from anywhere on the system.
     * @param {respoke.Client.onConnect} [params.onConnect] - Callback for Client connect.
     * @param {respoke.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
     * @param {respoke.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
     * @param {respoke.Client.onCall} [params.onCall] - Callback for when this client receives a call.
     * @param {respoke.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this
     * client receives a request for a direct connection.
     * @private
     */
    function saveParameters(params) {
        Object.keys(params).forEach(function eachParam(key) {
            if (['onSuccess', 'onError', 'reconnect'].indexOf(key) === -1 && params[key] !== undefined) {
                clientSettings[key] = params[key];
            }
        });

        clientSettings.developmentMode = !!clientSettings.developmentMode;
        clientSettings.enableCallDebugReport = typeof clientSettings.enableCallDebugReport === 'boolean' ?
            clientSettings.enableCallDebugReport : true;

        if (typeof params.reconnect !== 'boolean') {
            clientSettings.reconnect = typeof params.developmentMode === 'boolean' ? params.developmentMode : false;
        } else {
            clientSettings.reconnect = !!params.reconnect;
        }
    }
    saveParameters(params);

    /**
     * Connect to the Respoke infrastructure and authenticate using `params.token`.
     *
     * After `connect`, the app auth session token is stored so it can be used in API requests.
     *
     * This method attaches quite a few event listeners for things like group joining and connection status changes.
     *
     * #### Usage
     *
     *      client.connect({
     *          appId: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXX",
     *          token: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXX", // if not developmentMode
     *          developmentMode: false || true,
     *          // if developmentMode, otherwise your server will set endpointId
     *          endpointId: "billy"
     *      });
     *      client.listen("connect", function () { } );
     *
     *
     * If no `params.token` is given and `developmentMode` is set to true, it will attempt to obtain a token
     * automatically. You must set an `endpointId`.
     *
     *
     * #### App auth session token expiration
     *
     * If `params.reconnect` is set to true (which it is by default for `developmentMode`), the `client`
     * will attempt to keep reconnecting each time the app auth session expires.
     *
     * If not using `developmentMode`, automatic reconnect will be disabled. You will need to
     * listen to the Client's `disconnect` event to fetch a new brokered auth token and call
     * `client.connect()` with the new token.
     *
     *      client.listen('disconnect', function () {
     *
     *          // example method you implemented to get a new token from your server
     *          myServer.getNewRespokeAccessToken(function (newToken) {
     *              // reconnect with respoke.Client
     *              client.connect({ token: newToken });
     *          });
     *
     *      });
     *
     *
     * @memberof! respoke.Client
     * @method respoke.Client.connect
     * @param {object} params
     * @param {respoke.Client.connectSuccessHandler} [params.onSuccess] - Success handler for this invocation
     * of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {string} [params.appId] - The ID of your Respoke app. This must be passed either to
     * respoke.connect, respoke.createClient, or to client.connect.
     * @param {string} [params.token] - The endpoint's authentication token.
     * @param {string} [params.endpointId] - An identifier to use when creating an authentication token for this
     * endpoint. This is only used when `developmentMode` is set to `true`.
     * @param {string|number|object|Array} [params.presence] The initial presence to set once connected.
     * @param {respoke.client.resolveEndpointPresence} [params.resolveEndpointPresence] An optional function for
     * resolving presence for an endpoint.  An endpoint can have multiple Connections this function will be used
     * to decide which Connection's presence gets precedence for the Endpoint.
     * @param {boolean} [params.developmentMode=false] - Indication to obtain an authentication token from the service.
     * Note: Your app must be in developer mode to use this feature. This is not intended as a long-term mode of
     * operation and will limit the services you will be able to use.
     * @param {boolean} [params.reconnect=true] - Whether or not to automatically reconnect to the Respoke service
     * when a disconnect occurs.
     * @param {respoke.Client.onJoin} [params.onJoin] - Callback for when this client's endpoint joins a group.
     * @param {respoke.Client.onLeave} [params.onLeave] - Callback for when this client's endpoint leaves
     * a group.
     * @param {respoke.Client.onClientMessage} [params.onMessage] - Callback for when any message is
     * received from anywhere on the system.
     * @param {respoke.Client.onConnect} [params.onConnect] - Callback for Client connect.
     * @param {respoke.Client.onDisconnect} [params.onDisconnect] - Callback for Client disconnect.
     * @param {respoke.Client.onReconnect} [params.onReconnect] - Callback for Client reconnect. Not Implemented.
     * @param {respoke.Client.onCall} [params.onCall] - Callback for when this client receives a call.
     * @param {respoke.Client.onDirectConnection} [params.onDirectConnection] - Callback for when this
     * client receives a request for a direct connection.
     * @returns {Promise|undefined}
     * @fires respoke.Client#connect
     */
    that.connect = function (params) {
        var promise;
        var retVal;
        params = params || {};
        log.debug('Client.connect');
        that.connectTries += 1;

        saveParameters(params);

        that.endpointId = clientSettings.endpointId;
        promise = actuallyConnect(params);
        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        promise.then(function successHandler() {
            /**
             * This event is fired the first time the library connects to the cloud infrastructure.
             * @event respoke.Client#connect
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            that.fire('connect');

            /**
             * This event fires only when the initial `connect` fails.
             *
             * @ignore **This comment is for documentation purposes**, since #error bubbles
             * up from other classes, but it should show on `respoke.Client` docs.
             *
             * @event respoke.Client#error
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
        });
        return retVal;
    };

    /**
     * This function contains the meat of the connection, the portions which can be repeated again on reconnect.
     *
     * When `reconnect` is true, this function will be added in an event listener to the Client#disconnect event.
     *
     * **Using callbacks** by passing `params.onSuccess` or `params.onError` will disable promises.
     * @memberof! respoke.Client
     * @method respoke.Client.actuallyConnect
     * @private
     * @param {object} params
     * @param {connectSuccessHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise|undefined}
     */
    function actuallyConnect(params) {
        params = params || {};
        var deferred = Q.defer();

        if (!clientSettings.token &&
                (!clientSettings.appId || !clientSettings.endpointId || clientSettings.developmentMode !== true)) {
            deferred.reject(new Error("Must pass either endpointID & appId & developmentMode=true, or a token, " +
                "to client.connect()."));
            return deferred.promise;
        }

        signalingChannel.open({
            actuallyConnect: actuallyConnect,
            endpointId: that.endpointId,
            token: clientSettings.token
        }).then(function successHandler() {
            return signalingChannel.authenticate();
        }).done(function successHandler() {
            // set initial presence for the connection
            if (clientSettings.presence) {
                that.setPresence({presence: clientSettings.presence});
            }

            /*
             * These rely on the EventEmitter checking for duplicate event listeners in order for these
             * not to be duplicated on reconnect.
             */

            /**
             * This event provides notification for when an incoming call is being received.  If the user wishes
             * to allow the call, `evt.call.answer()`.
             * @event respoke.Client#call
             * @type {respoke.Event}
             * @property {respoke.Call} call
             * @property {respoke.Endpoint} endpoint
             * @property {string} name - The event name.
             * @property {respoke.Client} target
             */
            that.listen('call', clientSettings.onCall);
            /**
             * This event is fired when the local end of the directConnection is available. It still will not be
             * ready to send and receive messages until the 'open' event fires.
             * @event respoke.Client#direct-connection
             * @type {respoke.Event}
             * @property {respoke.DirectConnection} directConnection
             * @property {respoke.Endpoint} endpoint
             * @property {string} name - the event name.
             * @property {respoke.Call} target
             */
            that.listen('direct-connection', clientSettings.onDirectConnection);
            that.listen('join', clientSettings.onJoin);
            /**
             * This event is fired every time the client leaves a group.
             * @event respoke.Client#leave
             * @type {respoke.Event}
             * @property {respoke.Group} group
             * @property {string} name - the event name.
             */
            that.listen('leave', clientSettings.onLeave);
            /**
             * A generic message handler when a message was received by the client.
             *
             * @event respoke.Client#message
             * @type {respoke.Event}
             * @property {string} name - The event name.
             * @property {respoke.Endpoint} endpoint - If the message was private, this is the Endpoint who sent it.
             * @property {respoke.Group} group - If the message was to a group, this is the group.
             * @property {respoke.TextMessage} message - The generic message object.
             * @property {string} message.connectionId
             * @property {string} message.endpointId
             * @property {string} message.message - Message body text.
             * @property {respoke.Client} target
             */
            that.listen('message', clientSettings.onMessage);
            that.listen('connect', clientSettings.onConnect);
            /**
             * Client has disconnected from Respoke.
             *
             * @event respoke.Client#disconnect
             * @type {respoke.Event}
             * @property {string} name - The event name.
             * @property {respoke.Client} target
             */
            that.listen('disconnect', clientSettings.onDisconnect);
            that.listen('disconnect', function () {
                that.calls.forEach(function (call) {
                    call.hangup({signal: false});
                });
            }, true);
            /**
             * Client has reconnected to Respoke.
             *
             * @event respoke.Client#reconnect
             * @type {respoke.Event}
             * @property {string} name - The event name.
             * @property {respoke.Client} target
             */
            that.listen('reconnect', clientSettings.onReconnect);

            log.info('logged in as ' + that.endpointId, that);
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject(err);
            log.error(err.message, err.stack);
        });

        return deferred.promise;
    }

    /**
     * Disconnect from the Respoke infrastructure, leave all groups, invalidate the token, and disconnect the websocket.
     * **Using callbacks** by passing `params.onSuccess` or `params.onError` will disable promises.
     * @memberof! respoke.Client
     * @method respoke.Client.disconnect
     * @returns {Promise|undefined}
     * @param {object} params
     * @param {disconnectSuccessHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires respoke.Client#disconnect
     */
    that.disconnect = function (params) {
        // TODO: also call this on socket disconnect
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        try {
            that.verifyConnected();
        } catch (e) {
            deferred.reject(e);
            return retVal;
        }

        var leaveGroups = groups.map(function eachGroup(group) {
            group.leave();
        });

        Q.all(leaveGroups).fin(function successHandler() {
            return signalingChannel.close();
        }).fin(function finallyHandler() {
            that.presence = 'unavailable';
            endpoints = [];
            groups = [];
            /**
             * This event is fired when the library has disconnected from the cloud infrastructure.
             * @event respoke.Client#disconnect
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            that.fire('disconnect');
            deferred.resolve();
        }).done();

        return retVal;
    };

    /**
     * Set the presence for this client.
     *
     * The value of presence can be a string, number, object, or array - in any format -
     * depending on the needs of your application. The only requirement is that
     * `JSON.stringify()` must work (no circular references).
     *
     *      var myPresence = 'At lunch'
     *                      || 4
     *                      || { status: 'Away', message: 'At lunch' }
     *                      || ['Away', 'At lunch'];
     *
     *      client.setPresence({
     *          presence: myPresence,
     *          onSuccess: function (evt) {
     *              // successfully updated my presence
     *          }
     *      });
     *
     * **Using callbacks** by passing `params.onSuccess` or `params.onError` will disable promises.
     *
     * @memberof! respoke.Client
     * @method respoke.Client.setPresence
     * @param {object} params
     * @param {string|number|object|array} params.presence
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @overrides Presentable.setPresence
     * @return {Promise|undefined}
     */
    that.setPresence = function (params) {
        var promise;
        var retVal;
        params = params || {};

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            return respoke.handlePromise(promise, params.onSuccess, params.onError);
        }

        log.info('sending my presence update ' + params.presence);

        promise = signalingChannel.sendPresence({
            presence: params.presence
        });

        promise.then(function successHandler(p) {
            superClass.setPresence(params);
            clientSettings.presence = params.presence;
        });
        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        return retVal;
    };

    /**
     * Get the Call with the endpoint specified.
     *
     *     // hang up on chad
     *     var call = client.getCall({
     *         endpointId: 'chad'
     *     });
     *
     *     if (call) {
     *         call.hangup()
     *     }
     *
     * @memberof! respoke.Client
     * @method respoke.Client.getCall
     * @param {object} params
     * @param {string} [params.id] - Call ID.
     * @param {string} [params.endpointId] - Endpoint ID. Warning: If you pass only the endpointId, this method
     * will just return the first call that matches. If you are placing multiple calls to the same endpoint,
     * pass in the call ID, too.
     * @param {boolean} params.create - whether or not to create a new call if the specified endpointId isn't found
     * @returns {respoke.Call}
     */
    that.getCall = function (params) {
        var call = null;
        var endpoint = null;
        var methods = {
            did: "startPhoneCall",
            web: "startCall",
            sip: "startSIPCall"
        };
        params.fromType = params.fromType || "web";

        that.calls.every(function findCall(one) {
            if (params.id && one.id === params.id) {
                call = one;
                return false;
            }

            if (!params.id && params.endpointId && one.remoteEndpoint.id === params.endpointId) {
                call = one;
                return false;
            }
            return true;
        });

        if (call === null && params.create === true) {
            try {
                call = that[methods[params.fromType]]({
                    id: params.id,
                    number: params.fromType === "did" ? params.endpointId : undefined,
                    uri: params.fromType === "sip" ? params.endpointId : undefined,
                    endpointId: params.fromType === "web" ? params.endpointId : undefined,
                    caller: false,
                    toType: params.fromType,
                    fromType: "web"
                });
            } catch (e) {
                log.error("Couldn't create Call.", e.message, e.stack);
            }
        }
        return call;
    };

    /**
     * Add the call to internal record-keeping.
     * @memberof! respoke.Client
     * @method respoke.Client.addCall
     * @param {object} evt
     * @param {respoke.Call} evt.call
     * @param {respoke.Endpoint} evt.endpoint
     * @private
     */
    function addCall(evt) {
        log.debug('addCall');
        if (!evt.call) {
            throw new Error("Can't add call without a call parameter.");
        }
        if (that.calls.indexOf(evt.call) === -1) {
            that.calls.push(evt.call);
        }

        evt.call.listen('hangup', function () {
            removeCall({call: evt.call});
        });
    }

    /**
     * Remove the call or direct connection from internal record-keeping.
     * @memberof! respoke.Client
     * @method respoke.Client.removeCall
     * @param {object} evt
     * @param {respoke.Call} evt.target
     * @private
     */
    function removeCall(evt) {
        var match = 0;
        if (!evt.call) {
            throw new Error("Can't remove call without a call parameter.");
        }

        // Loop backward since we're modifying the array in place.
        for (var i = that.calls.length - 1; i >= 0; i -= 1) {
            if (that.calls[i].id === evt.call.id) {
                that.calls.splice(i, 1);
                match += 1;
            }
        }

        if (match !== 1) {
            log.warn("Something went wrong.", match, "calls were removed!");
        }
    }

    /**
     * Convenience method for setting presence to `"available"`.
     *
     * **Using callbacks** by passing `params.onSuccess` or `params.onError` will disable promises.
     *
     * @memberof! respoke.Client
     * @method respoke.Client.setOnline
     * @param {object} params
     * @param {string|number|object|Array} [params.presence=available] - The presence to set.
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise|undefined}
     */
    that.setOnline = function (params) {
        var promise;

        params = params || {};
        params.presence = params.presence || 'available';

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            return respoke.handlePromise(promise, params.onSuccess, params.onError);
        }

        return that.setPresence(params);
    };

    /**
     * Convenience method for setting presence to `"unavailable"`.
     *
     * **Using callbacks** by passing `params.onSuccess` or `params.onError` will disable promises.
     *
     * @memberof! respoke.Client
     * @method respoke.Client.setOffline
     * @param {object} params
     * @param {string|number|object|Array} [params.presence=unavailable] - The presence to set.
     * @param {respoke.Client.successHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise|undefined}
     */
    that.setOffline = function (params) {
        var promise;

        params = params || {};
        params.presence = params.presence || 'unavailable';

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            return respoke.handlePromise(promise, params.onSuccess, params.onError);
        }

        return that.setPresence(params);
    };

    /**
     * Send a message to an endpoint.
     *
     *     client.sendMessage({
     *         endpointId: 'dan',
     *         message: "Jolly good."
     *     });
     *
     *
     * **Using callbacks** by passing `params.onSuccess` or `params.onError` will disable promises.
     * @memberof! respoke.Client
     * @method respoke.Client.sendMessage
     * @param {object} params
     * @param {string} params.endpointId - The endpoint id of the recipient.
     * @param {string} [params.connectionId] - The optional connection id of the receipient. If not set, message will be
     * broadcast to all connections for this endpoint.
     * @param {string} params.message - a string message.
     * @param {sendHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise|undefined}
     */
    that.sendMessage = function (params) {
        var promise;
        var retVal;
        var endpoint;
        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }
        endpoint = that.getEndpoint({
            skipPresence: true,
            id: params.endpointId
        });
        delete params.endpointId;
        return endpoint.sendMessage(params);
    };

    /**
     * Place an audio and/or video call to an endpoint.
     *
     *     // defaults to video when no constraints are supplied
     *     client.startCall({
     *         endpointId: 'erin',
     *         onConnect: function (evt) { },
     *         onLocalMedia: function (evt) { }
     *     });
     *
     * @memberof! respoke.Client
     * @method respoke.Client.startCall
     * @param {object} params
     * @param {string} params.endpointId - The id of the endpoint that should be called.
     * @param {RTCConstraints} [params.constraints]
     * @param {string} [params.connectionId]
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video element
     * with the local audio and/or video attached.
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video element
     * with the remote audio and/or video attached.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @param {HTMLVideoElement} [params.videoLocalElement] - Pass in an optional html video element to have local video attached to it.
     * @param {HTMLVideoElement} [params.videoRemoteElement] - Pass in an optional html video element to have remote video attached to it.
     * @return {respoke.Call}
     */
    that.startCall = function (params) {
        var promise;
        var retVal;
        var endpoint;

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        endpoint = that.getEndpoint({
            skipPresence: true,
            id: params.endpointId
        });
        delete params.endpointId;
        return endpoint.startCall(params);
    };

    /**
     * Place an audio only call to an endpoint.
     *
     *     client.startAudioCall({
     *         endpointId: 'erin',
     *         onConnect: function (evt) { },
     *         onLocalMedia: function (evt) { }
     *     });
     *
     * @memberof! respoke.Client
     * @method respoke.Client.startAudioCall
     * @param {object} params
     * @param {string} params.endpointId - The id of the endpoint that should be called.
     * @param {string} [params.connectionId]
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 element
     * with the local audio and/or video attached.
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 element
     * with the remote audio and/or video attached.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @param {HTMLVideoElement} [params.videoLocalElement] - Pass in an optional html video element to have local
     * video attached to it.
     * @param {HTMLVideoElement} [params.videoRemoteElement] - Pass in an optional html video element to have remote
     * video attached to it.
     * @return {respoke.Call}
     */
    that.startAudioCall = function (params) {
        params = params || {};
        params.constraints = {
            video: false,
            audio: true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Place a video call to an endpoint.
     *
     *     client.startVideoCall({
     *         endpointId: 'erin',
     *         onConnect: function (evt) { },
     *         onLocalMedia: function (evt) { }
     *     });
     *
     * @memberof! respoke.Client
     * @method respoke.Client.startVideoCall
     * @param {object} params
     * @param {string} params.endpointId - The id of the endpoint that should be called.
     * @param {string} [params.connectionId]
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video element
     * with the local audio and/or video attached.
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video element
     * with the remote audio and/or video attached.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @param {HTMLVideoElement} [params.videoLocalElement] - Pass in an optional html video element to have local
     * video attached to it.
     * @param {HTMLVideoElement} [params.videoRemoteElement] - Pass in an optional html video element to have remote
     * video attached to it.
     * @return {respoke.Call}
     */
    that.startVideoCall = function (params) {
        params = params || {};
        params.constraints = {
            video: true,
            audio: true,
            optional: [],
            mandatory: {}
        };
        return that.startCall(params);
    };

    /**
     * Place an audio call with a phone number.
     * @memberof! respoke.Client
     * @method respoke.Client.startPhoneCall
     * @param {object} params
     * @param {string} params.number - The phone number that should be called.
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video element
     * with the local audio and/or video attached.
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video element
     * with the remote audio and/or video attached.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @return {respoke.Call}
     */
    that.startPhoneCall = function (params) {
        var promise;
        var retVal;
        var call = null;
        var recipient = {};
        params = params || {};
        params.constraints = {
            video: false,
            audio: true,
            mandatory: {},
            optional: []
        };

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        if (typeof params.caller !== 'boolean') {
            params.caller = true;
        }

        if (!params.number) {
            log.error("Can't start a phone call without a number.");
            promise = Q.reject(new Error("Can't start a phone call without a number."));
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        recipient.id = params.number;

        params.instanceId = instanceId;
        params.remoteEndpoint = recipient;

        params.toType = params.toType || 'did';
        params.fromType = params.fromType || 'web';

        params.signalOffer = function (signalParams) {
            var onSuccess = signalParams.onSuccess;
            var onError = signalParams.onError;
            delete signalParams.onSuccess;
            delete signalParams.onError;

            signalParams.signalType = 'offer';
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendSDP(signalParams).done(onSuccess, onError);
        };
        params.signalAnswer = function (signalParams) {
            signalParams.signalType = 'answer';
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'call';
            signalParams.connectionId = signalParams.connectionId;
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalModify = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendModify(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send modify.", err.message, err.stack);
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalHangup = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendHangup(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send hangup.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            log.debug("Sending debug report", signalParams.report);
            signalingChannel.sendReport(signalParams);
        };

        params.signalingChannel = signalingChannel;
        call = respoke.Call(params);
        addCall({call: call});
        return call;
    };

    /**
     * Place an audio call to a SIP URI.
     * @memberof! respoke.Client
     * @method respoke.Client.startSIPCall
     * @param {object} params
     * @param {string} params.uri - The SIP URI to call.
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video element
     * with the local audio and/or video attached.
     * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
     * media renegotiation.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for receiving an HTML5 Video element
     * with the remote audio and/or video attached.
     * @param {respoke.Call.onAllow} [params.onAllow] - When setting up a call, receive notification that the
     * browser has granted access to media.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for being notified when the call has been hung
     * up.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - Callback for receiving statistical
     * information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @return {respoke.Call}
     */
    that.startSIPCall = function (params) {
        var promise;
        var retVal;
        var call = null;
        var recipient = {};
        params = params || {};
        params.constraints = {
            video: false,
            audio: true,
            mandatory: {},
            optional: []
        };

        try {
            that.verifyConnected();
        } catch (e) {
            promise = Q.reject(e);
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        if (typeof params.caller !== 'boolean') {
            params.caller = true;
        }

        if (!params.uri) {
            log.error("Can't start a phone call without a SIP URI.");
            promise = Q.reject(new Error("Can't start a phone call without a SIP URI."));
            retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
            return retVal;
        }

        recipient.id = params.uri;

        params.instanceId = instanceId;
        params.remoteEndpoint = recipient;

        params.toType = params.toType || 'sip';
        params.fromType = params.fromType || 'web';

        params.signalOffer = function (signalParams) {
            var onSuccess = signalParams.onSuccess;
            var onError = signalParams.onError;
            delete signalParams.onSuccess;
            delete signalParams.onError;

            signalParams.signalType = 'offer';
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendSDP(signalParams).done(onSuccess, onError);
        };
        params.signalAnswer = function (signalParams) {
            signalParams.signalType = 'answer';
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'call';
            signalParams.connectionId = signalParams.connectionId;
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalModify = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendModify(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send modify.", err.message, err.stack);
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalHangup = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = recipient;
            signalParams.toType = params.toType;
            signalParams.fromType = params.fromType;
            signalingChannel.sendHangup(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send hangup.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            log.debug("Sending debug report", signalParams.report);
            signalingChannel.sendReport(signalParams);
        };

        params.signalingChannel = signalingChannel;
        call = respoke.Call(params);
        addCall({call: call});
        return call;
    };

    /**
     * Assert that we are connected to the backend infrastructure.
     * @memberof! respoke.Client
     * @method respoke.Client.verifyConnected
     * @throws {Error}
     * @private
     */
    that.verifyConnected = function () {
        if (!signalingChannel.isConnected()) {
            throw new Error("Can't complete request when not connected. Please reconnect!");
        }
    };

    /**
     * Check whether this client is connected to the Respoke API.
     * @memberof! respoke.Client
     * @method respoke.Client.isConnected
     * @returns boolean
     */
    that.isConnected = function () {
        return signalingChannel.isConnected();
    };

    /**
     * Join a group and begin keeping track of it. If this method is called multiple times synchronously, it will
     * batch requests and only make one API call to Respoke.
     *
     * You can leave the group by calling `group.leave()`;
     *
     * ##### Joining and leaving a group
     *
     *      var group;
     *
     *      client.join({
     *          id: "book-club",
     *          onSuccess: function (evt) {
     *              console.log('I joined', evt.group.id);
     *              // "I joined book-club"
     *              group = evt.group;
     *              group.sendMessage({
     *                  message: 'sup'
     *              });
     *          }
     *      });
     *
     *      // . . .
     *      // Some time later, leave the group.
     *      // . . .
     *      group.leave({
     *          onSuccess: function (evt) {
     *              console.log('I left', evt.group.id);
     *              // "I left book-club"
     *          }
     *      });
     *
     * @memberof! respoke.Client
     * @method respoke.Client.join
     * @param {object} params
     * @param {string} params.id - The name of the group.
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @param {respoke.Group.onMessage} [params.onMessage] - Message handler for messages from this group only.
     * @param {respoke.Group.onJoin} [params.onJoin] - Join event listener for endpoints who join this group only.
     * @param {respoke.Group.onLeave} [params.onLeave] - Leave event listener for endpoints who leave
     * this group only.
     * @returns {Promise<respoke.Group>|undefined} The instance of the respoke.Group which the client joined.
     * @fires respoke.Client#join
     */
    that.join = function (params) {
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
        try {
            that.verifyConnected();
        } catch (e) {
            deferred.reject(e);
            return retVal;
        }

        if (!params.id) {
            deferred.reject(new Error("Can't join a group with no group id."));
            return retVal;
        }

        signalingChannel.joinGroup({
            groupList: [params.id]
        }).done(function successHandler() {
            var group;
            params.signalingChannel = signalingChannel;
            params.instanceId = instanceId;

            group = that.getGroup({id: params.id});

            if (!group) {
                group = respoke.Group(params);
                that.addGroup(group);
            }

            group.listen('join', params.onJoin);
            group.listen('leave', params.onLeave);
            group.listen('message', params.onMessage);

            group.addMember({
                connection: that.getConnection({
                    endpointId: that.endpointId,
                    connectionId: that.connectionId
                })
            });

            /**
             * This event is fired every time the client joins a group. If the client leaves
             * a group, this event will be fired again on the next time the client joins the group.
             * @event respoke.Client#join
             * @type {respoke.Event}
             * @property {respoke.Group} group
             * @property {string} name - the event name.
             */
            that.fire('join', {
                group: group
            });
            deferred.resolve(group);
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return retVal;
    };

    /**
     * Add a Group. This is called when we join a group and need to begin keeping track of it.
     * @memberof! respoke.Client
     * @method respoke.Client.addGroup
     * @param {respoke.Group}
     * @private
     */
    that.addGroup = function (newGroup) {
        if (!newGroup || newGroup.className !== 'respoke.Group') {
            throw new Error("Can't add group to internal tracking without a group.");
        }

        newGroup.listen('leave', function leaveHandler(evt) {
            newGroup.removeMember({connectionId: evt.connection.id});
            var endpt = evt.connection.getEndpoint();
            if (!endpt.hasListeners('presence')) {
                checkEndpointForRemoval(endpt);
            }
        }, true);

        groups.push(newGroup);
    };

    /**
     * Get a list of all the groups the client is currently a member of.
     * @memberof! respoke.Client
     * @method respoke.Client.getGroups
     * @returns {Array<respoke.Group>} All of the groups the library is aware of.
     */
    that.getGroups = function () {
        return groups;
    };

    /**
     * Find a group by id and return it.
     *
     *     var group = client.getGroup({
     *         id: "resistance"
     *     });
     *
     * @memberof! respoke.Client
     * @method respoke.Client.getGroup
     * @param {object} params
     * @param {string} params.id
     * @param {respoke.Group.onJoin} [params.onJoin] - Receive notification that an endpoint has joined this group.
     * @param {respoke.Group.onLeave} [params.onLeave] - Receive notification that an endpoint has left this group.
     * @param {respoke.Group.onMessage} [params.onMessage] - Receive notification that a message has been
     * received to a group.
     * @returns {respoke.Group|undefined} The group whose ID was specified.
     */
    that.getGroup = function (params) {
        var group;
        if (!params || !params.id) {
            throw new Error("Can't get a group without group id.");
        }

        groups.every(function eachGroup(grp) {
            if (grp.id === params.id) {
                group = grp;
                return false;
            }
            return true;
        });

        if (group) {
            group.listen('join', params.onJoin);
            group.listen('leave', params.onLeave);
            group.listen('message', params.onMessage);
        }

        return group;
    };

    /**
     * Remove an Endpoint. Since an endpoint can be a member of multiple groups, we can't just remove it from
     * our list on respoke.Endpoint#leave. We must see if it's a member of any more groups. If it's not
     * a member of any other groups, we can stop keeping track of it.
     * @todo TODO Need to account for Endpoints not created as part of a group. These do not need to be
     * deleted based on group membership.
     * @memberof! respoke.Client
     * @method respoke.Client.checkEndpointForRemoval
     * @param {object} params
     * @param {string} params.id - The ID of the Endpoint to check for removal.
     * @private
     */
    function checkEndpointForRemoval(params) {
        params = params || {};
        if (!params.id) {
            throw new Error("Can't remove endpoint from internal tracking without group id.");
        }

        Q.all(groups.map(function eachGroup(group) {
            return group.getMembers();
        })).done(function successHandler(connectionsByGroup) {
            // connectionsByGroup is a two-dimensional array where the first dimension is a group
            // and the second dimension is a connection.
            var absent = connectionsByGroup.every(function eachConnectionList(connectionList) {
                return connectionList.every(function eachConnection(conn) {
                    return (conn.endpointId !== params.id);
                });
            });
            if (absent) {
                endpoints.every(function eachEndpoint(ept, index) {
                    if (ept.id === params.id) {
                        endpoints.splice(index, 1);
                        return false;
                    }
                    return true;
                });
            }
        });
    }

    /**
     * Find an endpoint by id and return the `respoke.Endpoint` object.
     *
     * If it is not already cached locally, will be added to the local cache of tracked endpoints,
     * its presence will be determined, and will be available in `client.getEndpoints()`.
     *
     *     var endpoint = client.getEndpoint({
     *         id: "dlee"
     *     });
     *
     * @ignore If the endpoint is not found in the local cache of endpoint objects (see `client.getEndpoints()`),
     * it will be created. This is useful, for example, in the case of dynamic endpoints where groups are
     * not in use. Override dynamic endpoint creation by setting `params.skipCreate = true`.
     *
     * @memberof! respoke.Client
     * @method respoke.Client.getEndpoint
     * @param {object} params
     * @param {string} params.id
     * @param {respoke.Endpoint.onMessage} [params.onMessage] - Handle messages sent to the logged-in user
     * from this one Endpoint.
     * @param {respoke.Endpoint.onPresence} [params.onPresence] - Handle presence notifications from this one
     * Endpoint.
     * @arg {boolean} [params.skipCreate] - Skip the creation step and return undefined if we don't yet
     * @arg {boolean} [params.skipPresence] - Skip registering for this endpoint's presence.
     * @returns {respoke.Endpoint} The endpoint whose ID was specified.
     */
    that.getEndpoint = function (params) {
        var endpoint;
        if (!params || !params.id) {
            throw new Error("Can't get an endpoint without endpoint id.");
        }

        endpoints.every(function eachEndpoint(ept) {
            if (ept.id === params.id) {
                endpoint = ept;
                return false;
            }
            return true;
        });

        if (!endpoint && params && !params.skipCreate) {
            params.instanceId = instanceId;
            params.signalingChannel = signalingChannel;
            params.resolveEndpointPresence = clientSettings.resolveEndpointPresence;
            params.addCall = addCall;

            endpoint = respoke.Endpoint(params);
            endpoints.push(endpoint);
        }

        if (!endpoint) {
            return;
        }

        if (params.skipPresence !== true) {
            signalingChannel.registerPresence({
                endpointList: [endpoint.id]
            }).done(null, function (err) {
                log.error("Couldn't register for presence on", endpoint.id, err.message);
            });
        }
        endpoint.listen('presence', params.onPresence);
        endpoint.listen('message', params.onMessage);

        return endpoint;
    };

    /**
     * Find a Connection by id and return it.
     *
     *     var connection = client.getConnection({
     *         id: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXX"
     *     });
     *
     * @ignore In most cases, if we don't find it we will create it. This is useful
     * in the case of dynamic endpoints where groups are not in use. Set skipCreate=true
     * to return undefined if the Connection is not already known.
     *
     * @memberof! respoke.Client
     * @method respoke.Client.getConnection
     * @param {object} params
     * @param {string} params.connectionId
     * @param {string} [params.endpointId] - An endpointId to use in the creation of this connection.
     * @param {respoke.Endpoint.onMessage} [params.onMessage] - Handle messages sent to the logged-in user
     * from this one Connection.
     * @param {respoke.Endpoint.onPresence} [params.onPresence] - Handle presence notifications from this one
     * Connection.
     * @returns {respoke.Connection} The connection whose ID was specified.
     */
    that.getConnection = function (params) {
        var connection;
        var endpoint;
        var endpointsToSearch = endpoints;

        params = params || {};
        if (!params.connectionId) {
            throw new Error("Can't get a connection without connection id.");
        }
        if (!params.endpointId && !params.skipCreate) {
            throw new Error("Can't create a connection without endpoint id.");
        }

        if (params.endpointId) {
            endpoint = that.getEndpoint({
                id: params.endpointId,
                skipPresence: true,
                skipCreate: params.skipCreate
            });

            endpointsToSearch = [];
            if (endpoint) {
                endpointsToSearch = [endpoint];
            }
        }

        endpointsToSearch.every(function eachEndpoint(ept) {
            connection = ept.getConnection(params);
            return !connection;
        });

        if (!connection && !params.skipCreate) {
            params.instanceId = instanceId;
            connection = respoke.Connection(params);
            endpoint.connections.push(connection);
        }

        return connection;
    };

    /**
     * Get the list of **all endpoints** that the library has knowledge of.
     * These are `respoke.Endpoint` objects, not just the endpointIds.
     *
     * The library gains knowledge of an endpoint in two ways:
     * 1. when an endpoint joins a group that the user (currently logged-in endpoint) is a member of (if group presence is enabled)
     * 2. when an endpoint that the user (currently logged-in endpoint) is watching*
     *
     * *If an endpoint that the library does not know about sends a message to the client, you
     * can immediately call the `client.getEndpoint()` method on the sender of the message to enable
     * watching of the sender's endpoint.
     *
     *      client.on('message', function (data) {
     *          if (data.endpoint) {
     *              // start tracking this endpoint.
     *              client.getEndpoint({ id: data.endpoint.id });
     *          }
     *      });
     *
     *
     * @memberof! respoke.Client
     * @method respoke.Client.getEndpoints
     * @returns {Array<respoke.Endpoint>}
     */
    that.getEndpoints = function () {
        return endpoints;
    };

    return that;
}; // End respoke.Client

/**
 * Handle sending successfully.
 * @callback respoke.Client.successHandler
 */
/**
 * Handle joining a group successfully. This callback is called only once when Client.join() is called.
 * @callback respoke.Client.joinHandler
 * @param {respoke.Group} group
 */
/**
 * Receive notification that the client has joined a group. This callback is called everytime
 * respoke.Client#join is fired.
 * @callback respoke.Client.onJoin
 * @param {respoke.Event} evt
 * @param {respoke.Group} evt.group
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that the client has left a group. This callback is called everytime
 * respoke.Client#leave is fired.
 * @callback respoke.Client.onLeave
 * @param {respoke.Event} evt
 * @param {respoke.Group} evt.group
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that a message has been received. This callback is called every time
 * respoke.Client#message is fired.
 * @callback respoke.Client.onClientMessage
 * @param {respoke.Event} evt
 * @param {respoke.TextMessage} evt.message
 * @param {respoke.Group} [evt.group] - If the message is to a group we already know about,
 * this will be set. If null, the developer can use client.join({id: evt.message.header.channel}) to join
 * the group. From that point forward, Group#message will fire when a message is received as well. If
 * group is undefined instead of null, the message is not a group message at all.
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Receive notification that the client is receiving a call from a remote party. This callback is called every
 * time respoke.Client#call is fired.
 * @callback respoke.Client.onCall
 * @param {respoke.Event} evt
 * @param {respoke.Call} evt.call
 * @param {respoke.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 */
/**
 * Receive notification that the client is receiving a request for a direct connection from a remote party.
 * This callback is called every time respoke.Client#direct-connection is fired.
 * @callback respoke.Client.onDirectConnection
 * @param {respoke.Event} evt
 * @param {respoke.DirectConnection} evt.directConnection
 * @param {respoke.Endpoint} evt.endpoint
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * Receive notification Respoke has successfully connected to the cloud. This callback is called every time
 * respoke.Client#connect is fired.
 * @callback respoke.Client.onConnect
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Receive notification Respoke has successfully disconnected from the cloud. This callback is called every time
 * respoke.Client#disconnect is fired.
 * @callback respoke.Client.onDisconnect
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Receive notification Respoke has successfully reconnected to the cloud. This callback is called every time
 * respoke.Client#reconnect is fired.
 * @callback respoke.Client.onReconnect
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Client} evt.target
 */
/**
 * Handle disconnection to the cloud successfully.
 * @callback respoke.Client.disconnectSuccessHandler
 */
/**
 * Handle an error that resulted from a method call.
 * @callback respoke.Client.errorHandler
 * @params {Error} err
 */
/**
 * Handle connection to the cloud successfully.
 * @callback respoke.Client.connectSuccessHandler
 */
