/**
 * Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software.
 * @ignore
 */

var Q = require('q');
var respoke = require('./respoke');

/**
 * A group, representing a collection of endpoints and the method by which to communicate with them.
 * @class respoke.Group
 * @constructor
 * @link https://cdn.respoke.io/respoke.min.js
 * @param {object} params
 * @param {string} params.instanceId
 * @param {respoke.Group.onJoin} params.onJoin - A callback to receive notifications every time a new
 * endpoint has joined the group. This callback does not get called when the client joins the group.
 * @param {respoke.Group.onMessage} params.onMessage - A callback to receive messages sent to the group from
 * remote endpoints.
 * @param {respoke.Group.onLeave} params.onLeave - A callback to receive notifications every time a new
 * endpoint has left the group. This callback does not get called when the client leaves the group.
 * @returns {respoke.Group}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};

    var that = respoke.EventEmitter(params);
    /**
     * @memberof! respoke.Group
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var client = respoke.getClient(instanceId);

    if (!that.id) {
        throw new Error("Can't create a group without an ID.");
    }

    /**
     * @memberof! respoke.Group
     * @name signalingChannel
     * @type respoke.SignalingChannel
     * @private
     */
    var signalingChannel = params.signalingChannel;
    delete params.signalingChannel;

    /**
     * @memberof! respoke.Group
     * @name endpoints
     * @type {array<respoke.Endpoint>}
     * @desc A list of the members of this group.
     */
    that.connections = [];
    /**
     * A name to identify the type of this object.
     * @memberof! respoke.Group
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Group';
    that.listen('join', params.onJoin);
    that.listen('message', params.onMessage);
    that.listen('leave', params.onLeave);
    client.listen('disconnect', function disconnectHandler() {
        that.connections = [];
    });

    delete that.instanceId;
    delete that.onMessage;
    delete that.onPresence;
    delete that.onJoin;
    delete that.onLeave;

    /**
     * Join this group.
     * **Using callbacks** will disable promises.
     * @memberof! respoke.Group
     * @method respoke.Group.join
     * @return {Promise|undefined}
     * @param {object} params
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @fires respoke.Client#join
     */
    that.join = function () {
        var params = {
            id: that.id
        };
        var promise;
        var deferred;
        var retVal;

        try {
            validateConnection();
        } catch (err) {
            deferred = Q.defer();
            retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
            deferred.reject(err);
            return retVal;
        }

        promise = client.join(params);
        retVal = respoke.handlePromise(promise, params.onSuccess, params.onError);
        return retVal;
    };

    /**
     * Leave this group.
     * @memberof! respoke.Group
     * @method respoke.Group.leave
     * @param {object} params
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @return {Promise|undefined}
     * @fires respoke.Client#leave
     */
    that.leave = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            deferred.reject(err);
            return retVal;
        }

        signalingChannel.leaveGroup({
            id: that.id
        }).then(function successHandler() {
            /**
             * This event is fired when the client leaves a group.
             * @event respoke.Client#leave
             * @type {respoke.Event}
             * @property {respoke.Group} group
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            client.fire('leave', {
                group: that
            });
            that.connections = [];
            deferred.resolve();
        }, function errorHandler(err) {
            deferred.reject();
        });
        return retVal;
    };

    /**
     * Remove a Connection from a Group. This does not change the status of the remote Endpoint, it only changes the
     * internal representation of the Group membership. This method should only be used internally.
     * @private
     * @memberof! respoke.Group
     * @method respoke.Group.removeMember
     * @param {object} params
     * @param {string} [params.connectionId] - Endpoint's connection id
     * @fires respoke.Group#leave
     */
    that.removeMember = function (params) {
        params = params || {};

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            return;
        }

        if (!params.connectionId) {
            throw new Error("Can't remove a member to the group without it's Connection id.");
        }

        that.connections.every(function eachConnection(conn, index) {
            if (conn.id === params.connectionId) {
                that.connections.splice(index, 1);

                /**
                 * This event is fired when a member leaves a group the client is a member of.
                 * @event respoke.Group#leave
                 * @type {respoke.Event}
                 * @property {respoke.Connection} connection
                 * @property {string} name - the event name.
                 * @property {respoke.Group} target
                 */
                that.fire('leave', {
                    connection: conn
                });
                return false;
            }
            return true;
        });
    };

    /**
     * Return true if the logged-in user is a member of this group and false if not.
     * @memberof! respoke.Group
     * @method respoke.Group.isJoined
     * @returns {boolean}
     */
    that.isJoined = function () {
        // connections array contains some connections and ours is among them.
        return (that.connections.length > 0 && !that.connections.every(function (conn) {
            return conn.id !== client.connectionId;
        }));
    };

    /**
     * Add a Connection to a group. This does not change the status of the remote Endpoint, it only changes the
     * internal representation of the Group membership. This method should only be used internally.
     * @memberof! respoke.Group
     * @private
     * @method respoke.Group.addMember
     * @param {object} params
     * @param {respoke.Connection} params.connection
     * @fires respoke.Group#join
     */
    that.addMember = function (params) {
        params = params || {};
        var absent;

        validateConnection();

        if (!params.connection) {
            throw new Error("Can't add a member to the group without it's Connection object.");
        }

        absent = that.connections.every(function eachConnection(conn) {
            return (conn.id !== params.connection.id);
        });

        if (absent) {
            that.connections.push(params.connection);
            if (params.skipEvent) {
                return;
            }

            /**
             * This event is fired when a member joins a Group that the currently logged-in endpoint is a member
             * of.
             * @event respoke.Group#join
             * @type {respoke.Event}
             * @property {respoke.Connection} connection
             * @property {string} name - the event name.
             * @property {respoke.Group} target
             */
            that.fire('join', {
                connection: params.connection
            });
        }
    };

    /**
     * Validate that the client is connected to the Respoke infrastructure.
     * @memberof! respoke.Group
     * @method respoke.Group.validateConnection
     * @private
     */
    function validateConnection() {
        if (!signalingChannel || !signalingChannel.isConnected()) {
            throw new Error("Can't complete request when not connected. Please reconnect!");
        }
    }

    /**
     * Validate that the client is a member of this group.
     * @memberof! respoke.Group
     * @method respoke.Group.validateMembership
     * @private
     */
    function validateMembership() {
        if (!that.isJoined()) {
            throw new Error("Not a member of this group anymore.");
        }
    }

    /**
     * Message the group
     * 
     * Send a message to the entire group.
     * 
     * @memberof! respoke.Group
     * @method respoke.Group.sendMessage
     * @param {object} params
     * @param {string} params.message - The message.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        params.id = that.id;
        var retVal;
        var deferred;

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            deferred = Q.defer();
            retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
            deferred.reject(err);
            return retVal;
        }

        return signalingChannel.publish(params);
    };

    /**
     * Get group members
     * 
     * Get an array containing the members of the group. Accepts `onSuccess` or `onError` parameters,
     * or a promise.
     * 
     * @memberof! respoke.Group
     * @method respoke.Group.getMembers
     * @param {object} params
     * @param {respoke.Client.joinHandler} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Success handler for this invocation of this method only.
     * @returns {Promise<Array>} A promise to an array of Connections.
     */
    that.getMembers = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);

        try {
            validateConnection();
            validateMembership();
        } catch (err) {
            deferred.reject(err);
            return retVal;
        }

        signalingChannel.getGroupMembers({
            id: that.id
        }).done(function successHandler(list) {
            var endpointList = [];
            list.forEach(function eachMember(params) {
                var connection = client.getConnection({
                    endpointId: params.endpointId,
                    connectionId: params.connectionId,
                    skipCreate: true
                });

                if (!connection) {
                    // Create the connection
                    connection = client.getConnection({
                        endpointId: params.endpointId,
                        connectionId: params.connectionId
                    });
                }

                if (endpointList.indexOf(params.endpointId) === -1) {
                    endpointList.push(params.endpointId);
                }
                that.addMember({
                    connection: connection,
                    skipEvent: true
                });
            });

            if (endpointList.length > 0) {
                signalingChannel.registerPresence({
                    endpointList: endpointList
                });
            }
            deferred.resolve(that.connections);
        }, function errorHandler(err) {
            deferred.reject(err);
        });
        return retVal;
    };

    return that;
}; // End respoke.Group
/**
 * Receive notification that an endpoint has joined this group. This callback is called everytime
 * respoke.Group#join is fired.
 * @callback respoke.Group.onJoin
 * @param {respoke.Event} evt
 * @param {respoke.Connection} evt.connection
 * @param {string} evt.name - the event name.
 * @param {respoke.Group} evt.target
 */
/**
 * Receive notification that an endpoint has left this group. This callback is called everytime
 * respoke.Group#leave is fired.
 * @callback respoke.Group.onLeave
 * @param {respoke.Event} evt
 * @param {respoke.Connection} evt.connection
 * @param {string} evt.name - the event name.
 * @param {respoke.Group} evt.target
 */
/**
 * Receive notification that a message has been received to a group. This callback is called every time
 * respoke.Group#message is fired.
 * @callback respoke.Group.onMessage
 * @param {respoke.Event} evt
 * @param {respoke.TextMessage} evt.message
 * @param {string} evt.name - the event name.
 * @param {respoke.Group} evt.target
 */
/**
 * Get a list of the Connections which are members of this Group.
 * @callback respoke.Group.connectionsHandler
 * @param {Array<respoke.Connection>} connections
 */
