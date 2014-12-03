function MockSignalingChannel(params) {
    params = params || {};
    var that = respoke.EventEmitter(params);
    var Q = respoke.Q;
    var client = respoke.getClient(params.instanceId);
    var routingMethods = {};
    that.className = 'respoke.MockSignalingChannel';

    that.isConnected = function () {
        return that.connected;
    };

    that.isSendingReport = function (params) {
        return that.enableCallDebugReport;
    };

    that.open = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        that.connected = true;
        return deferred.promise;
    };

    that.getToken = function (params) {
        var deferred = Q.defer();
        deferred.resolve("68783999-78BD-4079-8979-EBA65FD8873F");
        return deferred.promise;
    };

    that.close = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        that.connected = false;
        return deferred.promise;
    };

    that.sendPresence = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.getGroup = function (params) {
        params = params || {};
        var deferred = Q.defer();
        deferred.resolve({id: params.name});
        return deferred.promise;
    };

    that.leaveGroup = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.joinGroup = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.publish = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.registerPresence = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.getGroupMembers = function (params) {
        var deferred = Q.defer();
        deferred.resolve([{
            endpointId: "68783999-78BD-4079-8979-EBA65FD8873F",
            connectionId: "68783999-78BD-4079-8979-EBA65FD8873F"
        }, {
            endpointId: "87839992-8BD2-0792-9792-BA65FD8873F2",
            connectionId: "87839992-8BD2-0792-9792-BA65FD8873F2"
        }]);

        return promise;
    };

    that.sendMessage = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendACK = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendSignal = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendCandidate = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendSDP = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendReport = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendHangup = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendConnected = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.sendModify = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    function firstUpper(str) {
        return str[0].toUpperCase() + str.slice(1);
    }

    that.routeSignal = function (signal) {
        var target = null;
        var method = 'do';

        if (signal.signalType !== 'iceCandidates') { // Too many of these!
            log.debug(signal.signalType, signal);
        }

        if (signal.target === undefined) {
            throw new Error("target undefined");
        }

        // Only create if this signal is an offer.
        Q.fcall(function makePromise() {
            var endpoint;
            /*
             * This will return calls regardless of whether they are associated
             * with a direct connection or not, and it will create a call if no
             * call is found and this signal is an offer. Direct connections get
             * created in the next step.
             */
            target = client.getCall({
                id: signal.sessionId,
                endpointId: signal.fromEndpoint,
                fromType: signal.fromType,
                create: (signal.target === 'call' && signal.signalType === 'offer')
            });
            if (target) {
                return target;
            }

            if (signal.target === 'directConnection') {
                // return a promise
                endpoint = client.getEndpoint({
                    id: signal.fromEndpoint
                });

                if (endpoint.directConnection && endpoint.directConnection.call.id === signal.sessionId) {
                    return endpoint.directConnection;
                }

                return endpoint.startDirectConnection({
                    id: signal.sessionId,
                    create: (signal.signalType === 'offer'),
                    caller: (signal.signalType !== 'offer')
                });
            }
        }).done(function successHandler(target) {
            // target might be null, a Call, or a DirectConnection.
            if (target) {
                target = target.call || target;
            }
            if (!target || target.id !== signal.sessionId) {
                // orphaned signal
                log.warn("Couldn't associate signal with a call.", signal);
                return;
            }

            method += firstUpper(signal.signalType);
            routingMethods[method]({
                call: target,
                signal: signal
            });
        }, null);
    };

    routingMethods.doOffer = function (params) {
        params.call.connectionId = params.signal.fromConnection;
        params.call.fire('signal-offer', {
            signal: params.signal
        });
    };

    routingMethods.doConnected = function (params) {
        params.call.fire('signal-connected', {
            signal: params.signal
        });
    };

    routingMethods.doModify = function (params) {
        params.call.fire('signal-modify', {
            signal: params.signal
        });
    };

    routingMethods.doAnswer = function (params) {
        params.call.connectionId = params.signal.fromConnection;
        params.call.fire('signal-answer', {
            signal: params.signal
        });
    };

    routingMethods.doIceCandidates = function (params) {
        params.call.fire('signal-icecandidates', {
            signal: params.signal
        });
    };

    routingMethods.doBye = function (params) {
        if (params.call.connectionId && params.call.connectionId !== params.signal.fromConnection) {
            return;
        }
        params.call.fire('signal-hangup', {
            signal: params.signal
        });
    };

    routingMethods.doUnknown = function (params) {
        log.error("Don't know what to do with", params.signal.target, "msg of unknown type", params.signal.signalType);
    };

    that.authenticate = function (params) {
        var deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    that.getTurnCredentials = function () {
        var deferred = Q.defer();
        deferred.resolve([{
            username: 'blah',
            uri: 'blah',
            password: 'blah'
        }]);
        return deferred.promise;
    };

    window.mockSignalingChannel = that;
    return that;
};

