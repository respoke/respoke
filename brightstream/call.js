/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * WebRTC Call including getUserMedia, path and codec negotation, and call state.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Call
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client - client id
 * @param {boolean} params.initiator - whether or not we initiated the call
 * @param {boolean} params.receiveOnly - whether or not we accept media
 * @param {boolean} params.sendOnly - whether or not we send media
 * @param {boolean} params.directConnectionOnly - flag to enable skipping media & opening direct connection.
 * @param {boolean} params.forceTurn - If true, delete all 'host' and 'srvflx' candidates and send only 'relay'
 * candidates.
 * @param {brightstream.Endpoint} params.remoteEndpoint
 * @param {string} params.connectionId - The connection ID of the remoteEndpoint.
 * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action between
 * local media becoming available and calling approve().
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalTerminate - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {function} [params.onLocalVideo] - Callback for the developer to receive the local video element.
 * @param {function} [params.onRemoteVideo] - Callback for the developer to receive the remote video element.
 * @param {function} [params.onHangup] - Callback for the developer to be notified about hangup.
 * @param {object} params.callSettings
 * @param {object} [params.localVideoElements]
 * @param {object} [params.remoteVideoElements]
 * @returns {brightstream.Call}
 */
/*global brightstream: false */
brightstream.Call = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Call
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.Call
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Call';
    /**
     * @memberof! brightstream.Call
     * @name id
     * @type {string}
     */
    that.id = brightstream.makeUniqueID().toString();

    if (!that.initiator) {
        /**
         * @memberof! brightstream.Call
         * @name initiator
         * @type {boolean}
         */
        that.initiator = false;
    }

    /**
     * Promise used to trigger actions dependant upon having received an offer.
     * @memberof! brightstream.Call
     * @name defOffer
     * @private
     * @type {Promise}
     */
    var defOffer = Q.defer();
    /**
     * Promise used to trigger actions dependant upon having received an answer.
     * @memberof! brightstream.Call
     * @name defAnswer
     * @private
     * @type {Promise}
     */
    var defAnswer = Q.defer();
    /**
     * Promise used to trigger actions dependant upon the call having been approved.
     * @memberof! brightstream.Call
     * @name defApproved
     * @private
     * @type {Promise}
     */
    var defApproved = Q.defer();
    /**
     * Promise used to trigger actions dependant upon having received media or a datachannel.
     * @memberof! brightstream.Call
     * @name defMedia
     * @private
     * @type {Promise}
     */
    var defMedia = Q.defer();
    /**
     * @memberof! brightstream.Call
     * @name previewLocalMedia
     * @private
     * @type {function}
     */
    var previewLocalMedia = null;
    /**
     * @memberof! brightstream.Call
     * @name onLocalVideo
     * @private
     * @type {function}
     */
    var onLocalVideo = null;
    /**
     * @memberof! brightstream.Call
     * @name onRemoteVideo
     * @private
     * @type {function}
     */
    var onRemoteVideo = null;
    /**
     * @memberof! brightstream.Call
     * @name onHangup
     * @private
     * @type {function}
     */
    var onHangup = null;
    /**
     * @memberof! brightstream.Call
     * @name directConnectionOnly
     * @private
     * @type {boolean}
     */
    var directConnectionOnly = null;
    /**
     * @memberof! brightstream.Call
     * @name sendOnly
     * @private
     * @type {boolean}
     */
    var sendOnly = null;
    /**
     * @memberof! brightstream.Call
     * @name receiveOnly
     * @private
     * @type {boolean}
     */
    var receiveOnly = null;
    /**
     * @memberof! brightstream.Call
     * @name forceTurn
     * @private
     * @type {boolean}
     */
    var forceTurn = null;
    /**
     * @memberof! brightstream.Call
     * @name clientObj
     * @private
     * @type {brightstream.getClient}
     */
    var clientObj = brightstream.getClient(client);
    /**
     * @memberof! brightstream.Call
     * @name localVideoElements
     * @private
     * @type {Array<Video>}
     */
    var localVideoElements = params.localVideoElements || [];
    /**
     * @memberof! brightstream.Call
     * @name remoteVideoElements
     * @private
     * @type {Array<Video>}
     */
    var remoteVideoElements = params.remoteVideoElements || [];
    /**
     * @memberof! brightstream.Call
     * @name videoLocalElement
     * @private
     * @type {Video}
     */
    var videoLocalElement = null;
    /**
     * @memberof! brightstream.Call
     * @name videoRemoteElement
     * @private
     * @type {Video}
     */
    var videoRemoteElement = null;
    /**
     * @memberof! brightstream.Call
     * @name videoIsMuted
     * @private
     * @type {boolean}
     */
    var videoIsMuted = false;
    /**
     * @memberof! brightstream.Call
     * @name audioIsMuted
     * @private
     * @type {boolean}
     */
    var audioIsMuted = false;
    /**
     * @memberof! brightstream.Call
     * @name callSettings
     * @private
     * @type {object}
     */
    var callSettings = params.callSettings;
    /**
     * @memberof! brightstream.Call
     * @name directConnection
     * @private
     * @type {brightstream.DirectConnection}
     */
    var directConnection = null;
    /**
     * @memberof! brightstream.Call
     * @name localStreams
     * @private
     * @type {Array<brightstream.LocalMedia>}
     */
    var localStreams = [];
    /**
     * @memberof! brightstream.Call
     * @name mediaOptions
     * @private
     * @type {object}
     */
    var mediaOptions = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };
    /**
     * @memberof! brightstream.Call
     * @name ST_STARTED
     * @private
     * @type {number}
     */
    var ST_STARTED = 0;
    /**
     * @memberof! brightstream.Call
     * @name ST_INREVIEW
     * @private
     * @type {number}
     */
    var ST_INREVIEW = 1;
    /**
     * @memberof! brightstream.Call
     * @name ST_APPROVED
     * @private
     * @type {number}
     */
    var ST_APPROVED = 2;
    /**
     * @memberof! brightstream.Call
     * @name ST_OFFERED
     * @private
     * @type {number}
     */
    var ST_OFFERED = 3;
    /**
     * @memberof! brightstream.Call
     * @name ST_ANSWERED
     * @private
     * @type {number}
     */
    var ST_ANSWERED = 4;
    /**
     * @memberof! brightstream.Call
     * @name ST_FLOWING
     * @private
     * @type {number}
     */
    var ST_FLOWING = 5;
    /**
     * @memberof! brightstream.Call
     * @name ST_ENDED
     * @private
     * @type {number}
     */
    var ST_ENDED = 6;
    /**
     * @memberof! brightstream.Call
     * @name ST_MEDIA_ERROR
     * @private
     * @type {number}
     */
    var ST_MEDIA_ERROR = 7;
    /**
     * @memberof! brightstream.Call
     * @name pc
     * @private
     * @type {brightstream.PeerConnection}
     */
    var pc = brightstream.PeerConnection({
        client: client,
        connectionId: that.connectionId,
        initiator: that.initiator,
        forceTurn: forceTurn,
        callSettings: callSettings,
        pcOptions: {
            optional: [
                { DtlsSrtpKeyAgreement: true },
                { RtpDataChannels: false }
            ]
        },
        offerOptions: null,
        signalOffer: params.signalOffer,
        signalConnected: params.signalConnected,
        signalAnswer: params.signalAnswer,
        signalTerminate: params.signalTerminate,
        signalReport: params.signalReport,
        signalCandidate: params.signalCandidate
    });

    /**
     * Set up promises. If we're not the initiator, we need to listen for approval AND the remote SDP to come in
     * before we can act on the call. Save parameters sent in with the constructor, then delete them off the call.
     * If this call was initiated with a DirectConnection, set it up so answer() will be the approval mechanism.
     * @method brightstream.Call.init
     * @memberof! brightstream.Call
     * @private
     */
    function init() {
        if (that.initiator !== true) {
            Q.all([defApproved.promise, defOffer.promise]).spread(function (approved, oOffer) {
                if (approved === true && oOffer && oOffer.sdp) {
                    pc.processOffer(oOffer.sdp).done(function () {
                        that.state = ST_OFFERED;
                    }, function () {
                        that.hangup({signal: !that.initiator});
                    });
                }
            }, function (err) {
                log.warn("Call rejected.");
            }).done();
        } else {
            Q.all([defApproved.promise, defMedia.promise]).done(function () {
                pc.initOffer();
            }, function (err) {
                log.warn("Call not approved or media error.");
            });
        }

        saveParameters(params);
        delete that.signalOffer;
        delete that.signalConnected;
        delete that.signalAnswer;
        delete that.signalTerminate;
        delete that.signalReport;
        delete that.signalCandidate;
        delete that.onRemoteVideo;
        delete that.onLocalVideo;
        delete that.callSettings;
        delete that.directConnectionOnly;

        if (directConnectionOnly === true) {
            that.addDirectConnection();
        }
    }

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.Call
     * @method brightstream.Call.saveParameters
     * @param {object} params
     * @param {function} [params.onLocalVideo]
     * @param {function} [params.onRemoteVideo]
     * @param {function} [params.onHangup]
     * @param {function} [params.previewLocalMedia]
     * @param {object} [params.callSettings]
     * @param {object} [params.constraints]
     * @param {array} [params.servers]
     * @param {boolean} [params.forceTurn]
     * @param {boolean} [params.receiveOnly]
     * @param {boolean} [params.sendOnly]
     * @private
     */
    function saveParameters(params) {
        that.listen('local-stream-received', params.onLocalVideo);
        that.listen('remote-stream-received', params.onRemoteVideo);
        that.listen('hangup', params.onHangup);
        forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : forceTurn;
        receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : receiveOnly;
        sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : sendOnly;
        directConnectionOnly = typeof params.directConnectionOnly === 'boolean' ?
            params.directConnectionOnly : directConnectionOnly;
        previewLocalMedia = typeof params.previewLocalMedia === 'function' ?
            params.previewLocalMedia : previewLocalMedia;
        callSettings = params.callSettings || callSettings || {};
        callSettings.servers = params.servers || callSettings.servers;
        callSettings.constraints = params.constraints || callSettings.constraints;
        callSettings.disableTurn = params.disableTurn || callSettings.disableTurn;
        pc.callSettings = callSettings;
        pc.forceTurn = forceTurn;
        pc.receiveOnly = receiveOnly;
        pc.sendOnly = sendOnly;
        pc.listen('stats', function fireStats(evt) {
            /**
             * @event brightstream.Call#stats
             * @type {brightstream.Event}
             * @property {object} stats - an object with stats in it.
             */
            that.fire('stats', {stats: evt.stats});
        }, true);
    }

    /**
     * Start the process of obtaining media. saveParameters will only be meaningful for the non-initiate,
     * since the library calls this method for the initiate. Developers will use this method to pass in
     * callbacks for the non-initiate.
     * @memberof! brightstream.Call
     * @method brightstream.Call.answer
     * @fires brightstream.Call#answer
     * @param {object} [params]
     * @param {function} [params.previewLocalMedia]
     * @param {function} [params.onLocalVideo]
     * @param {function} [params.onRemoteVideo]
     * @param {function} [params.onHangup]
     * @param {boolean} [params.disableTurn]
     * @param {boolean} [params.receiveOnly]
     * @param {boolean} [params.sendOnly]
     * @param {object} [params.constraints]
     * @param {array} [params.servers]
     */
    that.answer = function (params) {
        that.state = ST_STARTED;
        params = params || {};
        log.trace('answer');
        saveParameters(params);

        pc.listen('remote-stream-received', onRemoteStreamAdded, true);
        pc.listen('remote-stream-removed', onRemoteStreamRemoved, true);

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.Call#answer
         */
        that.fire('answer');

        pc.init(callSettings);

        /**
         * There are a few situations in which we need to call approve automatically. Approve is for previewing
         * media, so if there is no media (because we are receiveOnly or this is a DirectConnection) we do not
         * need to wait for the developer to call approve().  Secondly, if the developer did not give us a
         * previewLocalMedia callback to call, we will not wait for approval.
         */
        if (receiveOnly !== true && directConnectionOnly !== true) {
            requestMedia(params);
        } else if (typeof previewLocalMedia !== 'function') {
            that.approve();
        }
    };

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.Call
     * @method brightstream.Call.approve.
     * @fires brightstream.Call#approve
     */
    that.approve = function () {
        if (that.state < ST_APPROVED) {
            that.state = ST_APPROVED;
        }
        log.trace('Call.approve');
        /**
         * @event brightstream.Call#approve
         */
        that.fire('approve');

        defApproved.resolve(true);
    };

    /**
     * Listen for the remote side to remove media in the middle of the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteStreamRemoved
     * @private
     * @param {object}
     */
    function onRemoteStreamRemoved(evt) {
        log.trace('pc event: remote stream removed');
    }

    /**
     * Listen for the remote side to add additional media in the middle of the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteStreamAdded
     * @private
     * @param {object}
     * @fires brightstream.Call#remote-stream-received
     */
    function onRemoteStreamAdded(evt) {
        if (that.state < ST_FLOWING) {
            that.state = ST_FLOWING;
        }
        log.debug('received remote media', evt);

        videoRemoteElement = document.createElement('video');
        attachMediaStream(videoRemoteElement, evt.stream);
        videoRemoteElement.autoplay = true;
        videoRemoteElement.used = true;
        videoRemoteElement.play();
        /**
         * @event brightstream.LocalMedia#remote-stream-received
         * @type {brightstream.Event}
         * @property {Element} element - the HTML5 Video element with the new stream attached.
         */
        that.fire('remote-stream-received', {
            element: videoRemoteElement
        });
    }

    /**
     * Return media stats. Since we have to wait for both the answer and offer to be available before starting
     * statistics, we'll return a promise for the stats object. Returns null if stats module is not loaded.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getStats
     * @returns {Promise<object>|null}
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [params.onStats] - An optional callback to receive the stats. If no callback is provided,
     * the call's report will contain stats but the developer will not receive them on the client-side.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     */
    function getStats(params) {
        if (pc && pc.getStats) {
            that.listen('stats', params.onStats);
            delete params.onStats;
            return pc.getStats(params);
        }
        return null;
    }
    if (brightstream.MediaStats) {
        that.getStats = getStats;
    }

    /**
     * Return local video element.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getLocalElement
     * @returns {Video}
     */
    that.getLocalElement = function () {
        return videoLocalElement;
    };

    /**
     * Return remote video element.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getRemoteE
     * @returns {Video}
     */
    that.getRemoteElement = function () {
        return videoRemoteElement;
    };

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received. This method is called
     * after answer() so we cannot use this method to set up the DirectConnection.
     * @memberof! brightstream.Call
     * @method brightstream.Call.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
     * @param {object} params
     * @param {object} [params.constraints] - getUserMedia constraints, indicating the media being requested is
     * an audio and/or video stream.
     * @param {boolean} [params.directConnection] - Indicates media being requested is a direct connection.
     * @param {function} [params.onHangup] - Call hangup callback; requires params.constraints be set.
     * @param {function} [params.onOpen] - DirectConnection is open callback; requires params.directConnection=true.
     * @param {function} [params.onClose] - DirectConnection is closed callback; requires params.directConnection=true.
     * @param {function} [params.onMessage] - DirectConnection message callback; requires params.directConnection=true.
     */
    function requestMedia(params) {
        log.debug('requestMedia');
        params = params || {};
        params.constraints = params.constraints || callSettings.constraints;

        try {
            params.pc = pc;
            that.addVideo(params);
        } catch (e) {
            log.error("Couldn't get anything to add to the call: " + e.message);
        }
    }

    /**
     * Add a video and audio stream to the existing call. By default, this method adds both video AND audio.
     * If audio is not desired, pass {audio: false}.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addVideo
     * @param {object} params
     * @param {boolean} [audio=true]
     * @param {boolean} [video=true]
     * @param {object} [params.constraints] - getUserMedia constraints, indicating the media being requested is
     * an audio and/or video stream.
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @param {function} [onError]
     * @returns {brightstream.LocalMedia}
     */
    that.addVideo = function (params) {
        var stream;
        params = params || {};
        params.constraints = params.constraints || {video: true, audio: true};
        params.constraints.audio = typeof params.audio === 'boolean' ? params.audio : params.constraints.audio;
        params.constraints.video = typeof params.video === 'boolean' ? params.video : params.constraints.video;
        params.client = client;

        stream = brightstream.LocalMedia(params);
        stream.listen('waiting-for-allow', function (evt) {
            /**
             * The browser is asking for permission to access the User's media. This would be an ideal time
             * to modify the UI of the application so that the user notices the request for permissions
             * and approves it.
             * @event brightstream.Call#waiting-for-allow
             * @type {brightstream.Event}
             */
            that.fire('waiting-for-allow');
        });
        stream.listen('allowed', function (evt) {
            /**
             * The user has approved the request for media. Any UI changes made to remind the user to click Allow
             * should be canceled now.
             * @event brightstream.Call#allowed
             * @type {brightstream.Event}
             */
            that.fire('allowed');
        });
        stream.listen('stream-received', function (evt) {
            defMedia.resolve(true);
            pc.addStream(evt.stream);
            if (typeof previewLocalMedia === 'function') {
                previewLocalMedia(evt.element, that);
            } else {
                that.approve();
            }
            /**
             * @event brightstream.Call#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element
             */
            that.fire('local-stream-received', {
                element: evt.element
            });
        }, true);
        stream.listen('error', function (evt) {
            that.removeStream({id: stream.id});
            pc.report.callStoppedReason = evt.reason;
        });
        localStreams.push(stream);
        return stream;
    };

    /**
     * Add an audio stream to the existing call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addAudio
     * @param {object} params
     * @param {boolean} [audio=true]
     * @param {boolean} [video=false]
     * @param {object} [params.constraints] - getUserMedia constraints, indicating the media being requested is
     * an audio and/or video stream.
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @returns {brightstream.LocalMedia}
     */
    that.addAudio = function (params) {
        params = params || {};
        params.constraints = params.constraints || {video: false, audio: true};
        params.constraints.video = typeof params.constraints.video === 'boolean' ?
            params.constraints.video : false;
        params.constraints.audio = typeof params.audio === 'boolean' ? params.audio : params.constraints.audio;
        params.constraints.video = typeof params.video === 'boolean' ? params.video : params.constraints.video;
        return that.addVideo(params);
    };

    /**
     * Remove a stream from the existing call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.removeStream
     * @param {object} params
     * @param {boolean} id - the id of the stream to remove.
     */
    that.removeStream = function (params) {
        var savedIndex;
        localStreams.forEach(function (stream, idx) {
            if (stream.id === params.id) {
                stream.stop();
                savedIndex = idx;
            }
        });
        localStreams.splice(savedIndex, 1);
    };

    /**
     *
     * Get the direct connection on this call, if it exists.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getDirectConnection
     */
    that.getDirectConnection = function () {
        return directConnection || null;
    };

    /**
     *
     * Add a direct connection to the existing call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addDirectConnection
     * @param {object} params
     * @param {function} [onOpen]
     * @param {function} [onClose]
     * @param {function} [onMessage]
     * @returns {brightstream.DirectConnection}
     */
    that.addDirectConnection = function (params) {
        params = params || {};
        if (directConnection) {
            log.warn("Not creating a new direct connection.");
            return directConnection;
        }
        params.client = client;
        params.pc = pc;
        params.initiator = that.initiator;
        params.remoteEndpoint = that.remoteEndpoint;
        directConnection = brightstream.DirectConnection(params);
        directConnection.setOffer = that.setOffer;
        directConnection.setAnswer = that.setAnswer;
        directConnection.setConnected = that.setConnected;
        directConnection.addRemoteCandidate = that.addRemoteCandidate;
        directConnection.setBye = that.setBye;

        directConnection.listen('close', function () {
            if (localStreams.length === 0) {
                that.hangup();
            }
        });

        directConnection.listen('accept', function () {
            if (that.initiator === false) {
                that.answer();
            }
            directConnectionOnly = false;
        });

        directConnection.listen('error', function (err) {
            defMedia.reject(new Error(err));
        });

        directConnection.listen('started', function () {
            defMedia.resolve(true);
        });

        /**
         * @event brightstream.Call#direct-connection
         * @type {brightstream.Event}
         * @property {brightstream.DirectConnection} directConnection
         */
        that.fire('direct-connection', {
            directConnection: directConnection
        });
        return directConnection;
    };

    /**
     *
     * Close the direct connection.
     * @memberof! brightstream.Call
     * @method brightstream.Call.closeDirectConnection
     */
    that.closeDirectConnection = function () {
        if (directConnection) {
            directConnection.close();
            directConnection = null;
        }
    };

    /**
     * Tear down the call, release user media.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.Call
     * @method brightstream.Call.hangup
     * @fires brightstream.Call#hangup
     * @param {object} params
     * @param {boolean} params.signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.hangup = function (params) {
        params = params || {};
        var toHangup = false;

        if (that.state === ST_ENDED) {
            return;
        }
        that.state = ST_ENDED;

        if (!that.initiator && defApproved.promise.isPending()) {
            defApproved.reject(new Error("Call hung up before approval."));
        }

        clientObj.updateTurnCredentials();
        log.debug('hanging up');

        localStreams.forEach(function (stream) {
            stream.stop();
        });

        if (directConnection) {
            if (directConnection.isActive()) {
                directConnection.close();
            }
            directConnection.ignore();
        }

        if (pc) {
            toHangup = pc.close(params);
        }

        /**
         * @event brightstream.Call#hangup
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('hangup', {
            sentSignal: toHangup
        });

        that.ignore();
        that.remoteEndpoint.directConnection = null;
        directConnection = null;
        pc = null;
    };

    /*
     * Expose hangup as reject for approve/reject workflow.
     * @memberof! brightstream.Call
     * @method brightstream.Call.reject
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.reject = that.hangup;

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! brightstream.Call
     * @method brightstream.Call.isActive
     * @returns {boolean}
     */
    that.isActive = function () {
        return (pc.isActive() && (
            (localStreams.length > 0) ||
            (directConnection && directConnection.isActive())
        ));
    };

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setOffer
     * @param {RTCSessionDescription} sdp - The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setOffer = function (params) {
        defOffer.resolve(params);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setAnswer
     * @param {object} params
     * @param {RTCSessionDescription} params.sdp - The remote SDP.
     * @param {string} params.connectionId - The connectionId of the endpoint who answered the call.
     * @todo TODO Make this listen to events and be private.
     */
    that.setAnswer = function (params) {
        if (defAnswer.promise.isFulfilled()) {
            log.debug("Ignoring duplicate answer.");
            return;
        }
        if (that.state < ST_ANSWERED) {
            that.state = ST_ANSWERED;
        }
        pc.setAnswer(params);
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setConnected
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @todo TODO Make this listen to events and be private.
     */
    that.setConnected = function (signal) {
        pc.setConnected(signal, function endCall() {
            that.hangup(false);
        });
    };

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addRemoteCandidate
     * @param {RTCIceCandidate} candidate The ICE candidate.
     * @todo TODO Make this listen to events and be private.
     */
    that.addRemoteCandidate = pc.addRemoteCandidate;

    /**
     * Get the state of the Call
     * @memberof! brightstream.Call
     * @method brightstream.Call.getState
     * @returns {string}
     */
    that.getState = function () {
        return pc.getState();
    };

    /**
     * If video is muted, unmute. If not muted, mute.
     * @memberof! brightstream.Call
     * @method brightstream.Call.toggleVideo
     */
    that.toggleVideo = function () {
        if (that.isActive()) {
            if (!videoIsMuted) {
                that.muteVideo();
            } else {
                that.unmuteVideo();
            }
        }
    };

    /**
     * If audio is muted, unmute. If not muted, mute.
     * @memberof! brightstream.Call
     * @method brightstream.Call.toggleAudio
     */
    that.toggleAudio = function () {
        if (that.isActive()) {
            if (!audioIsMuted) {
                that.muteAudio();
            } else {
                that.unmuteAudio();
            }
        }
    };

    /**
     * Mute all local video streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.muteVideo
     * @fires brightstream.Call#video-muted
     */
    that.muteVideo = function () {
        if (videoIsMuted) {
            return;
        }
        localStreams.forEach(function (stream) {
            stream.muteVideo();
        });
        /**
         * @event brightstream.Call#video-muted
         */
        that.fire('video-muted');
        videoIsMuted = true;
    };

    /**
     * Unmute all local video streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.unmuteVideo
     * @fires brightstream.Call#video-unmuted
     */
    that.unmuteVideo = function () {
        if (!videoIsMuted) {
            return;
        }
        localStreams.forEach(function (stream) {
            stream.unmuteVideo();
        });
        /**
         * @event brightstream.Call#video-unmuted
         */
        that.fire('video-unmuted');
        videoIsMuted = false;
    };

    /**
     * Mute all local audio streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.muteAudio
     * @fires brightstream.Call#audio-muted
     */
    that.muteAudio = function () {
        if (audioIsMuted) {
            return;
        }
        localStreams.forEach(function (stream) {
            stream.muteAudio();
        });
        /**
         * @event brightstream.Call#audio-muted
         */
        that.fire('audio-muted');
        audioIsMuted = true;
    };

    /**
     * Unmute all local audio streams.
     * @memberof! brightstream.Call
     * @method brightstream.Call.unmuteAudio
     * @fires brightstream.Call#audio-unmuted
     */
    that.unmuteAudio = function () {
        if (!audioIsMuted) {
            return;
        }
        localStreams.forEach(function (stream) {
            stream.unmuteAudio();
        });
        /**
         * @event brightstream.Call#audio-unmuted
         */
        that.fire('audio-unmuted');
        audioIsMuted = false;
    };

    /**
     * Save the hangup reason and hang up.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setBye
     * @todo TODO Make this listen to events and be private.
     * @params {object} params
     * @params {string} [params.reason] - An optional reason for a hangup.
     */
    that.setBye = function (params) {
        params = params || {};
        pc.report.callStoppedReason = params.reason || "Remote side hung up";
        that.hangup({signal: false});
    };

    setTimeout(init, 5);
    return that;
}; // End brightstream.Call
