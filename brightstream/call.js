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
 * @param {boolean} [params.receiveOnly] - whether or not we accept media
 * @param {boolean} [params.sendOnly] - whether or not we send media
 * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
 * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
 * relay servers. If it cannot flow through relay servers, the call will fail.
 * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
 * required to flow peer-to-peer. If it cannot, the call will fail.
 * @param {brightstream.Endpoint} params.remoteEndpoint - The endpoint who is being called.
 * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint.
 * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action
 * between local media becoming available and calling approve().
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
     * A name to identify the type of object.
     * @memberof! brightstream.Call
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Call';
    /**
     * The call ID.
     * @memberof! brightstream.Call
     * @name id
     * @type {string}
     */
    that.id = that.id || brightstream.makeUniqueID().toString();

    if (!that.initiator) {
        /**
         * Whether or not the currently logged-in user is the initiator of the call.
         * @memberof! brightstream.Call
         * @name initiator
         * @type {boolean}
         */
        that.initiator = false;
    }

    /**
     * Promise used to trigger actions dependant upon having received an offer.
     * @memberof! brightstream.Call
     * @name defSDPOffer
     * @private
     * @type {Promise}
     */
    var defSDPOffer = Q.defer();
    /**
     * Promise used to trigger actions dependant upon having received an answer.
     * @memberof! brightstream.Call
     * @name defSDPAnswer
     * @private
     * @type {Promise}
     */
    var defSDPAnswer = Q.defer();
    /**
     * Promise used to trigger actions dependant upon the call having been answered.
     * @memberof! brightstream.Call
     * @name defAnswered
     * @private
     * @type {Promise}
     */
    var defAnswered = Q.defer();
    /**
     * Promise used to trigger actions dependant upon having received media or a datachannel.
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
     * Promise used to trigger notification of a request for renegotiating media. For the initiator of the
     * renegotiation (which doesn't have to be the same as the initiator of the call), this is resolved
     * or rejected as soon as the 'accept' or 'reject' signal is received. For the non-initiator, it is
     * resolved or rejected only after the developer or logged-in user approves or rejects the modify.
     * @memberof! brightstream.Call
     * @name defModify
     * @private
     * @type {Promise}
     */
    var defModify;
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
     * @name toSendBye
     * @private
     * @type {boolean}
     */
    var toSendBye = null;

    /**
     * @memberof! brightstream.Call
     * @name pc
     * @private
     * @type {brightstream.PeerConnection}
     */
    var pc = brightstream.PeerConnection({
        client: client,
        forceTurn: forceTurn,
        call: that,
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
        signalModify: params.signalModify,
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
        log.trace('Call.init');

        if (defModify !== undefined) {
            defSDPOffer = Q.defer();
            defSDPAnswer = Q.defer();
            defApproved = Q.defer();
            defAnswered = Q.defer();
            defMedia = Q.defer();
        }

        if (that.initiator !== true) {
            Q.all([defApproved.promise, defSDPOffer.promise]).spread(function (approved, oOffer) {
                if (oOffer && oOffer.sdp) {
                    pc.processOffer(oOffer.sdp);
                }
            }, function (err) {
                log.warn("Call rejected.");
            }).done();
        } else {
            Q.all([defApproved.promise, defMedia.promise]).spread(function (approved, media) {
                if (media) {
                    pc.initOffer();
                }
            }, function (err) {
                log.warn("Call not approved or media error.");
            });
        }

        if (defModify === undefined && directConnectionOnly === true) {
            actuallyAddDirectConnection(params);
        }
    }

    /**
     * Register any event listeners passed in as callbacks, save other params to answer() and accept().
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
     * @fires brightstream.Call#stats
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
             * This event is fired every time statistical information about audio and/or video on a call
             * becomes available.
             * @event brightstream.Call#stats
             * @type {brightstream.Event}
             * @property {object} stats - an object with stats in it.
             */
            that.fire('stats', {stats: evt.stats});
        }, true);

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
    }

    /**
     * Answer the call and start the process of obtaining media. This method is called automatically on the caller's
     * side. This method must be called on the callee's side to indicate that the endpoint does wish to accept the
     * call. The app will have a later opportunity, by passing a callback named previewLocalMedia, to approve or
     * reject the call based on whether audio and/or video is working and is working at an acceptable level.
     * @memberof! brightstream.Call
     * @method brightstream.Call.answer
     * @fires brightstream.Call#answer
     * @param {object} [params]
     * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action
     * between local media becoming available and calling approve().
     * @param {function} [params.onLocalVideo] - Callback for the developer to receive the local video element.
     * @param {function} [params.onRemoteVideo] - Callback for the developer to receive the remote video element.
     * @param {function} [params.onHangup] - Callback for the developer to be notified about hangup.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {boolean} [params.receiveOnly] - Whether or not we accept media.
     * @param {boolean} [params.sendOnly] - Whether or not we send media.
     * @param {object} [params.constraints] - Information about the media for this call.
     * @param {array} [params.servers] - A list of sources of network paths to help with negotiating the connection.
     */
    that.answer = function (params) {
        params = params || {};
        log.trace('Call.answer');

        if (!defAnswered.promise.isPending()) {
            return;
        }
        defAnswered.resolve();

        /**
         * saveParameters will only be meaningful for the non-initiate,
         * since the library calls this method for the initiate. Developers will use this method to pass in
         * callbacks for the non-initiate.
         */
        saveParameters(params);

        pc.listen('remote-stream-received', onRemoteStreamAdded, true);
        pc.listen('remote-stream-removed', onRemoteStreamRemoved, true);

        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.Call#answer
         */
        that.fire('answer');

        pc.init(callSettings); // instatiates RTCPeerConnection, can't call on modify

        /**
         * There are a few situations in which we need to call approve automatically. Approve is for previewing
         * media, so if there is no media (because we are receiveOnly or this is a DirectConnection) we do not
         * need to wait for the developer to call approve().  Secondly, if the developer did not give us a
         * previewLocalMedia callback to call, we will not wait for approval.
         */
        if (receiveOnly !== true && directConnectionOnly === null) {
            doAddVideo(params);
        } else if (typeof previewLocalMedia !== 'function') {
            that.approve();
        }
    };

    /**
     * Accept a request to modify the media on the call. This method should be called within the Call#modify
     * event listener, which gives the developer or website user a chance to see what changes are proposed and
     * to accept or reject them.
     * @memberof! brightstream.Call
     * @method brightstream.Call.accept
     * @fires brightstream.Call#accept
     * @param {object} [params]
     * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action
     * between local media becoming available and calling approve().
     * @param {function} [params.onLocalVideo] - Callback for the developer to receive the local video element.
     * @param {function} [params.onRemoteVideo] - Callback for the developer to receive the remote video element.
     * @param {function} [params.onHangup] - Callback for the developer to be notified about hangup.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {boolean} [params.receiveOnly] - Whether or not we accept media.
     * @param {boolean} [params.sendOnly] - Whether or not we send media.
     * @param {object} [params.constraints] - Information about the media for this call.
     * @param {array} [params.servers] - A list of sources of network paths to help with negotiating the connection.
     */
    that.accept = that.answer;

    /**
     * Start the process of network and media negotiation. If the app passes in a callback named previewLocalMedia
     * in order to allow the logged-in person a chance to base their decision to continue the call on whether
     * audio and/or video is working correctly,
     * this method must be called on both sides in order to begin the call. If call.approve() is called, the call
     * will progress as expected. If call.reject() is called, the call will be aborted.
     * @memberof! brightstream.Call
     * @method brightstream.Call.approve
     * @fires brightstream.Call#approve
     */
    that.approve = function () {
        if (!defApproved.promise.isPending()) {
            return;
        }
        log.trace('Call.approve');
        /**
         * @event brightstream.Call#approve
         * @type {brightstream.Event}
         */
        that.fire('approve');

        defApproved.resolve(true);
        if (defModify && defModify.promise.isPending()) {
            defModify.resolve(true);
            defModify = undefined;
        }
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
     * Start the process of listening for a continuous stream of statistics about the flow of audio and/or video.
     * Since we have to wait for both the answer and offer to be available before starting
     * statistics, the library returns a promise for the stats object. The statistics object does not contain the
     * statistics; rather it contains methods of interacting with the actions of obtaining statistics. To obtain
     * the actual statistics one time, use stats.getStats(); use the onStats callback to obtain a continuous
     * stream of statistics every `interval` seconds.  Returns null if stats module is not loaded.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getStats
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {function} [params.onStats] - An optional callback to receive the stats. If no callback is provided,
     * the call's report will contain stats but the developer will not receive them on the client-side.
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise<object>|null}
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
     * Return local video element with the logged-in endpoint's audio and/or video streams attached to it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getLocalElement
     * @returns {Video} An HTML5 video element.
     */
    that.getLocalElement = function () {
        return videoLocalElement;
    };

    /**
     * Return remote video element with the remote endpoint's audio and/or video streams attached to it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getRemoteElement
     * @returns {Video} An HTML5 video element.
     */
    that.getRemoteElement = function () {
        return videoRemoteElement;
    };

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received. This method is called
     * after answer() so we cannot use this method to set up the DirectConnection.
     * @memberof! brightstream.Call
     * @method brightstream.Call.doAddVideo
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
     * @fires brightstream.Call#waiting-for-allow
     * @fires brightstream.Call#allowed
     * @fires brightstream.Call#local-stream-received
     */
    function doAddVideo(params) {
        var stream;
        log.trace('Call.doAddVideo');
        params = params || {};
        params.constraints = params.constraints || callSettings.constraints;
        params.pc = pc;
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
        }, true);
        stream.listen('allowed', function (evt) {
            /**
             * The user has approved the request for media. Any UI changes made to remind the user to click Allow
             * should be canceled now.
             * @event brightstream.Call#allowed
             * @type {brightstream.Event}
             */
            that.fire('allowed');
        }, true);
        stream.listen('stream-received', function (evt) {
            defMedia.resolve(stream);
            pc.addStream(evt.stream);
            videoLocalElement = evt.element;
            if (typeof previewLocalMedia === 'function') {
                previewLocalMedia(evt.element, that);
            } else {
                that.approve();
            }
            /**
             * @event brightstream.Call#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element
             * @property {brightstream.LocalMedia} stream
             */
            that.fire('local-stream-received', {
                element: evt.element,
                stream: stream
            });
        }, true);
        stream.listen('error', function (evt) {
            that.removeStream({id: stream.id});
            pc.report.callStoppedReason = evt.reason;
        });
        localStreams.push(stream);
        return stream;
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
     * @returns {Promise<brightstream.LocalMedia>}
     */
    that.addVideo = function (params) {
        log.trace('Call.addVideo');
        params = params || {};
        params.constraints = params.constraints || {video: true, audio: true};
        params.constraints.audio = typeof params.audio === 'boolean' ? params.audio : params.constraints.audio;
        params.constraints.video = typeof params.video === 'boolean' ? params.video : params.constraints.video;
        params.client = client;

        if (!defMedia.promise.isFulfilled()) {
            doAddVideo(params);
        } else {
            pc.startModify({
                constraints: params.constraints
            });
            defModify = Q.defer();
            defModify.promise.done(function modifyAccepted() {
                doAddVideo(params);
            }, function modifyRejected(err) {
                throw err;
            });
        }
        return defModify.promise;
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
     * @returns {Promise<brightstream.LocalMedia>}
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
     * Remove a direct connection from the existing call. If there is no other media, this will hang up the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.removeDirectConnection
     */
    that.removeDirectConnection = function (params) {
        params = params || {};
        log.trace('Call.removeDirectConnection');

        if (directConnection && directConnection.isActive()) {
            directConnection.close({skipRemove: true});
        }

        if (localStreams.length === 0) {
            log.debug('Hanging up because there are no local streams.');
            that.hangup();
            return;
        }

        if (params.skipModify === true) {
            return;
        }

        pc.startModify({
            directConnection: false
        });
        defModify = Q.defer();
        defModify.promise.done(function onModifySuccess() {
            defMedia.resolve();
            defModify = undefined;
        }, function onModifyError(err) {
            throw err;
        });
    };

    /**
     * Add a direct connection to the existing call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addDirectConnection
     * @param {object} params
     * @param {function} [onOpen]
     * @param {function} [onClose]
     * @param {function} [onMessage]
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @returns {Promise<brightstream.DirectConnection>}
     */
    that.addDirectConnection = function (params) {
        log.trace('Call.addDirectConnection');
        pc.startModify({
            directConnection: true
        });
        defModify = Q.defer();
        return defModify.promise.then(function onModifySuccess() {
            return actuallyAddDirectConnection(params);
        }, function onModifyError(err) {
            throw err;
        });
    };

    /**
     * Add a direct connection to the existing call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.actuallyAddDirectConnection
     * private
     * @param {object} params
     * @param {function} [onOpen]
     * @param {function} [onClose]
     * @param {function} [onMessage]
     * @param {function} [onSuccess]
     * @param {function} [onError]
     * @returns {Promise<brightstream.DirectConnection>}
     * @fires brightstream.User#direct-connection
     * @fires brightstream.Call#direct-connection
     */
    function actuallyAddDirectConnection(params) {
        log.trace('Call.actuallyAddDirectConnection', params);
        params = params || {};
        defMedia.promise.done(params.onSuccess, params.onError);

        if (directConnection && directConnection.isActive()) {
            if (defMedia.promise.isPending()) {
                defMedia.resolve(directConnection);
            }
            log.warn("Not creating a new direct connection.");
            return defMedia.promise;
        }

        params.client = client;
        params.pc = pc;
        params.call = that;

        directConnection = brightstream.DirectConnection(params);

        directConnection.listen('close', function () {
            // TODO: make this look for remote streams, too. Don't want to hang up on a one-way media call.
            if (localStreams.length === 0) {
                log.debug('Hanging up because there are no local streams.');
                that.hangup();
            } else {
                if (directConnection && directConnection.isActive()) {
                    that.removeDirectConnection({skipModify: true});
                }
            }
        }, true);

        directConnection.listen('accept', function () {
            if (that.initiator === false) {
                log.debug('Answering as a result of approval.');
                that.answer();
                if (defMedia && defMedia.promise.isPending()) {
                    that.approve();
                }
            } else {
                if (defApproved.promise.isPending()) { // This happens on modify
                    defApproved.resolve(true);
                }
                defMedia.resolve(directConnection);
            }
        }, true);

        directConnection.listen('open', function () {
            directConnectionOnly = null;
        }, true);

        directConnection.listen('error', function (err) {
            defMedia.reject(new Error(err));
        }, true);

        that.remoteEndpoint.directConnection = directConnection;

        /**
         * This event is fired when the local end of the directConnection is available. It still will not be
         * ready to send and receive messages until the 'open' event fires.
         * @event brightstream.Call#direct-connection
         * @type {brightstream.Event}
         * @property {brightstream.DirectConnection} directConnection
         * @property {brightstream.Endpoint} endpoint
         */
        that.fire('direct-connection', {
            directConnection: directConnection,
            endpoint: that.remoteEndpoint
        });

        /**
         * This event is fired when the logged-in endpoint is receiving a request to open a direct connection
         * to another endpoint.  If the user wishes to allow the direct connection, calling
         * evt.directConnection.accept() will allow the connection to be set up.
         * @event brightstream.User#direct-connection
         * @type {brightstream.Event}
         * @property {brightstream.DirectConnection} directConnection
         * @property {brightstream.Endpoint} endpoint
         */
        clientObj.user.fire('direct-connection', {
            directConnection: directConnection,
            endpoint: that.remoteEndpoint
        });

        if (that.initiator === true) {
            directConnection.accept();
        }

        return defMedia.promise;
    }

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
        log.trace('hangup', directConnection);

        if (toSendBye !== null) {
            log.info("call.hangup() called when call is already hung up.");
            return;
        }
        toSendBye = false;

        if (!that.initiator && defApproved.promise.isPending()) {
            defApproved.reject(new Error("Call hung up before approval."));
        }

        clientObj.updateTurnCredentials();

        localStreams.forEach(function (stream) {
            stream.stop();
        });

        if (directConnection && directConnection.isActive()) {
            directConnection.close();
            that.remoteEndpoint.directConnection = null;
        }

        if (pc) {
            toSendBye = pc.close(params);
        }

        /**
         * This event is fired when the call has hung up.
         * @event brightstream.Call#hangup
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('hangup', {
            sentSignal: toSendBye
        });

        that.ignore();
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
    that.reject = function (params) {
        if (defModify && defModify.promise.isPending()) {
            defModify.reject(new Error("Modify rejected."));
            defModify = undefined;
        } else {
            that.hangup(params);
        }
    };

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! brightstream.Call
     * @method brightstream.Call.isActive
     * @returns {boolean}
     */
    that.isActive = function () {
        // TODO: make this look for remote streams, too. Want to make this handle one-way media calls.
        return (pc.isActive() && (
            (localStreams.length > 0) ||
            (directConnection && directConnection.isActive())
        ));
    };

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! brightstream.Call
     * @method brightstream.Call.listenOffer
     * @param {object} evt
     * @param {object} evt.signal - The offer signal including the sdp
     * @private
     * @fires brightstream.Call#modify
     */
    function listenOffer(evt) {
        log.trace('listenOffer');
        var info = {};
        if (defModify && defModify.promise.isPending()) {
            if (directConnectionOnly === true) {
                info.directConnection = directConnection;
            } else if (directConnectionOnly === false) {
                // Nothing
            } else {
                info.call = that;
                info.constraints = callSettings.constraints;
            }
            /**
             * Indicates a request to add something to an existing call. If 'constraints' is set, evt.constraints
             * describes the media the other side has added. In this case, call.approve() must be called in order
             * to approve the new media and send the same type of media.  If directConnection exists, the other side
             * wishes to to open a direct connection. In order to approve, call directConnection.accept(). In either
             * case, call.reject() and directConnection.reject() can be called to decline the request to add to the
             * call.
             * @event brightstream.Call#modify
             * @type {brightstream.Event}
             * @property {object} [constraints]
             * @property {boolean} [directConnection]
             */
            that.fire('modify', info);
        }
        defSDPOffer.resolve(evt.signal);
    }

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.listenAnswer
     * @param {object} evt
     * @param {object} evt.signal - The offer signal including the sdp and the connectionId of the endpoint who
     * answered the call.
     * @private
     */
    function listenAnswer(evt) {
        log.trace('Call.listenAnswer');
        if (defSDPAnswer.promise.isFulfilled()) {
            log.debug("Ignoring duplicate answer.");
            return;
        }
        defSDPAnswer.resolve(evt.signal.sdp);
    }

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.listenModify
     * @private
     */
    function listenModify(evt) {
        log.trace('Call.listenModify', evt);
        if (evt.signal.action === 'initiate') {
            defModify = Q.defer();
        }
    }

    /**
     * Set up state and media for the modify.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onModifyAccept
     * @param {brightstream.Event} evt
     * @private
     */
    function onModifyAccept(evt) {
        that.initiator = evt.signal.action === 'initiate' ? false : true;
        init();

        if (evt.signal.action !== 'initiate') {
            defModify.resolve(); // resolved later for non-initiator
            defModify = undefined;
            return;
        }

        // non-initiator only from here down

        // init the directConnection if necessary. We don't need to do anything with
        // audio or video right now.
        if (evt.signal.directConnection === true) {
            actuallyAddDirectConnection().done(function (dc) {
                directConnection = dc;
                directConnection.accept();
            }, function (err) {
                throw err;
            });
        } else if (evt.signal.directConnection === false) {
            if (directConnection) {
                that.removeDirectConnection({skipModify: true});
                defMedia.resolve(false);
                defApproved.resolve(false);
            }
        }
        directConnectionOnly = typeof evt.signal.directConnection === 'boolean' ? evt.signal.directConnection : null;
        callSettings.constraints = evt.signal.constraints || callSettings.constraints;
    }

    /**
     * Ignore the modify.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onModifyReject
     * @param {brightstream.Event} evt
     * @param {Error} evt.err
     * @private
     */
    function onModifyReject(evt) {
        if (evt.signal.action !== 'initiate') {
            defMedia.reject(evt.err);
            defModify.reject(evt.err);
            defModify = undefined;
        }
    }

    /**
     * Get the state of the Call. 0 indicates the call has just been created. 1 indicates the call is waiting for the
     * audio and/or video to be approved. 2 indicates the audio and/or video have been approved. 3 indicates the caller
     * has requested the call. 4 indicates the callee has answered the call and the call is being set up. 5 indicates
     * that audio and/or video is flowing successfully.  6 indicates the call has ended. 7 indicates the call was never
     * successful due to an error setting up the audio and/or video.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getState
     * @returns {number} A number representing the current state of the call.
     */
    that.getState = function () {
        return pc.getState();
    };

    /**
     * If video is muted, unmute. If not muted, mute.
     * @deprecated
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
     * @deprecated
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
         * This event indicates that local video has been muted.
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
         * This event indicates that local video has been unmuted.
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
         * This event indicates that local audio has been muted.
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
         * This event indicates that local audio has been unmuted.
         * @event brightstream.Call#audio-unmuted
         */
        that.fire('audio-unmuted');
        audioIsMuted = false;
    };

    /**
     * Save the hangup reason and hang up.
     * @memberof! brightstream.Call
     * @method brightstream.Call.listenBye
     * @params {object} evt
     * @params {object} evt.signal - The bye signal, including an optional hangup reason.
     * @private
     */
    function listenBye(evt) {
        pc.report.callStoppedReason = evt.signal.reason || "Remote side hung up";
        that.hangup({signal: false});
    }

    that.listen('signal-offer', listenOffer, true);
    that.listen('signal-answer', listenAnswer, true);
    that.listen('signal-bye', listenBye, true);
    that.listen('signal-modify', listenModify, true);
    pc.listen('modify-reject', onModifyReject, true);
    pc.listen('modify-accept', onModifyAccept, true);
    that.listen('signal-candidate', pc.addRemoteCandidate, true);

    setTimeout(function initTimeout() {
        saveParameters(params);
        init();
    }, 0);
    return that;
}; // End brightstream.Call
