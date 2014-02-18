/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/**
 * Create a new Call.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.Call
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc WebRTC Call including getUserMedia, path and codec negotation, and call state.
 * @param {string} client - client id
 * @param {boolean} initiator - whether or not we initiated the call
 * @param {boolean} receiveOnly - whether or not we accept media
 * @param {boolean} sendOnly - whether or not we send media
 * @param {string} remoteEndpoint
 * @param {function} [previewLocalMedia]
 * @param {function} signalOffer
 * @param {function} signalAnswer
 * @param {function} signalTerminate
 * @param {function} signalReport
 * @param {function} signalCandidate
 * @param {function} [onLocalVideo]
 * @param {function} [onRemoteVideo]
 * @param {function} [onHangup]
 * @param {object} callSettings
 * @param {object} [localVideoElements]
 * @param {object} [remoteVideoElements]
 * @returns {brightstream.Call}
 * @property {boolean} initiator Indicate whether this Call belongs to the Endpoint
 * that initiated the WebRTC session.
 */
/*global brightstream: false */
brightstream.Call = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    that.className = 'brightstream.Call';
    that.id = brightstream.makeUniqueID().toString();

    if (!that.initiator) {
        that.initiator = false;
    }

    var pc = null;
    var defOffer = Q.defer();
    var defApproved = Q.defer();
    var previewLocalMedia = typeof params.previewLocalMedia === 'function' ? params.previewLocalMedia : undefined;
    var sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : false;
    var receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : false;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var mediaStreams = [];
    var clientObj = brightstream.getClient(client);
    var localVideoElements = params.localVideoElements || [];
    var remoteVideoElements = params.remoteVideoElements || [];
    var videoLocalElement = null;
    var videoRemoteElement = null;
    var remoteEndpoint = params.remoteEndpoint;
    var signalOffer = params.signalOffer;
    var signalAnswer = params.signalAnswer;
    var signalTerminate = params.signalTerminate;
    var signalReport = params.signalReport;
    var signalCandidate = function (oCan) {
        params.signalCandidate(oCan);
        report.candidatesSent.push(oCan);
    };
    var callSettings = params.callSettings;
    var options = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    var report = {
        'callStarted' : 0,
        'callStopped' : 0,
        'roomkey' : null,
        'sessionkey' : null,
        'lastSDPString' : '',
        'sdpsSent' : [],
        'sdpsReceived' : [],
        'candidatesSent' : [],
        'candidatesReceived' : [],
        'userAgent' : navigator.userAgent,
        'os' : navigator.platform
    };

    var ST_STARTED = 0;
    var ST_INREVIEW = 1;
    var ST_APPROVED = 2;
    var ST_OFFERED = 3;
    var ST_ANSWERED = 4;
    var ST_FLOWING = 5;
    var ST_ENDED = 6;
    var ST_MEDIA_ERROR = 7;

    /**
     * If we're not the initiator, we need to listen for approval AND the remote SDP to come in
     * before we can act on the call.
     */
    Q.all([defApproved.promise, defOffer.promise]).spread(function (approved, oOffer) {
        if (approved === true && oOffer && oOffer.sdp) {
            processOffer(oOffer);
        }
    }).done();

    /**
     * Register any event listeners passed in as callbacks
     * @memberof! brightstream.Call
     * @method brightstream.Call.registerListeners
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @param {function} [onHangup]
     * @private
     */
    var registerListeners = function (params) {
        if (typeof params.onLocalVideo === 'function') {
            that.listen('local-stream-received', function (evt) {
                params.onLocalVideo(evt.element);
            });
        }

        if (typeof params.onRemoteVideo === 'function') {
            that.listen('remote-stream-received', function (evt) {
                params.onRemoteVideo(evt.element);
            });
        }

        if (typeof params.onHangup === 'function') {
            that.listen('hangup', function (evt) {
                params.onHangup(evt.sentSignal);
            });
        }
    };

    /**
     * Must call registerListeners as part of object construction.
     */
    registerListeners(params);

    /**
     * Start the process of obtaining media. registerListeners will only be meaningful for the non-initiate,
     * since the library calls this method for the initiate. Developers will use this method to pass in
     * callbacks for the non-initiate.
     * @memberof! brightstream.Call
     * @method brightstream.Call.answer
     * @fires brightstream.Call#answer
     * @param {function} [previewLocalMedia]
     * @param {function} [onLocalVideo]
     * @param {function} [onRemoteVideo]
     * @param {function} [onHangup]
     * @param {boolean} [receiveOnly]
     */
    var answer = that.publicize('answer', function (params) {
        that.state = ST_STARTED;
        params = params || {};
        log.trace('answer');
        registerListeners(params);

        receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : receiveOnly;
        previewLocalMedia = typeof params.previewLocalMedia === 'function' ?
            params.previewLocalMedia : previewLocalMedia;

        if (!that.username) {
            throw new Error("Can't use a Call without username.");
        }
        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");

        /**
         * @event brightstream.Call#answer
         */
        that.fire('answer');

        if (receiveOnly !== true) {
            requestMedia(params);
        } else if (typeof previewLocalMedia !== 'function') {
            approve();
        }
    });

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! brightstream.Call
     * @method brightstream.Call.approve.
     * @fires brightstream.Call#approve
     */
    var approve = that.publicize('approve', function () {
        that.state = ST_APPROVED;
        log.trace('Call.approve');
        /**
         * @event brightstream.Call#approve
         */
        that.fire('approve');

        if (that.initiator === true) {
            log.info('creating offer');
            pc.createOffer(saveOfferAndSend, function errorHandler(p) {
                log.error('createOffer failed');
            }, null);
            return;
        } else {
            defApproved.resolve(true);
        }
    });

    /**
     * Process a remote offer if we are not the initiator.
     * @memberof! brightstream.Call
     * @method brightstream.Call.processOffer
     * @private
     * @param {RTCSessionDescriptor}
     */
    var processOffer = function (oOffer) {
        log.trace('processOffer');
        log.debug('processOffer', oOffer);

        try {
            pc.setRemoteDescription(new RTCSessionDescription(oOffer),
                function successHandler() {
                    log.debug('set remote desc of offer succeeded');
                    pc.createAnswer(saveAnswerAndSend, function errorHandler(err) {
                        log.error("Error creating SDP answer.", err);
                        report.callStoppedReason = 'Error creating SDP answer.';
                    });
                }, function errorHandler(err) {
                    log.error('set remote desc of offer failed', err);
                    report.callStoppedReason = 'setLocalDescr failed at offer.';
                    hangup();
                }
            );
            that.state = ST_OFFERED;
        } catch (err) {
            log.error("error processing offer: ", err);
        }
    };

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onReceiveUserMedia
     * @private
     * @param {MediaStream}
     * @fires brightstream.Call#local-stream-received
     */
    var onReceiveUserMedia = function (stream) {
        log.debug('User gave permission to use media.');
        log.trace('onReceiveUserMedia');

        if (pc === null) {
            log.error("Peer connection is null!");
            return;
        }

        pc.addStream(stream);

        for (var i = 0; (i < localVideoElements.length && videoLocalElement === null); i += 1) {
            if (localVideoElements[i].tagName === 'VIDEO' && !localVideoElements[i].used) {
                videoLocalElement = localVideoElements[i];
            }
        }

        if (videoLocalElement === null) {
            videoLocalElement = document.createElement('video');
        }

        // This still needs some work. Using cached streams causes an unused video element to be passed
        // back to the App. This is because we assume at the moment that only one local media video element
        // will be needed. The first one passed back will contain media and the others will fake it. Media
        // will still be sent with every peer connection. Also need to study the use of getLocalElement
        // and the implications of passing back a video element with no media attached.
        if (brightstream.streams[callSettings.constraints]) {
            brightstream.streams[callSettings.constraints].numPc += 1;
            /**
             * @event brightstream.Call#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             */
            that.fire('local-stream-received', {
                element: videoLocalElement
            });
        } else {
            stream.numPc = 1;
            brightstream.streams[callSettings.constraints] = stream;
            mediaStreams.push(brightstream.MediaStream({
                'stream': stream,
                'isLocal': true
            }));

            stream.id = clientObj.user.getID();
            attachMediaStream(videoLocalElement, stream);
            // We won't want our local video outputting audio.
            videoLocalElement.muted = true;
            videoLocalElement.autoplay = true;
            videoLocalElement.used = true;

            /**
             * @event brightstream.Call#local-stream-received
             * @type {brightstream.Event}
             * @property {Element} element - the HTML5 Video element with the new stream attached.
             */
            that.fire('local-stream-received', {
                element: videoLocalElement
            });
        }

        if (typeof previewLocalMedia === 'function') {
            that.state = ST_INREVIEW;
            previewLocalMedia(videoLocalElement, that);
        } else {
            approve();
        }
    };

    /**
     * Return local video element.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getLocalElement
     */
    var getLocalElement = that.publicize('getLocalElement', function () {
        return videoLocalElement;
    });

    /**
     * Return remote video element.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getRemoteElement
     */
    var getRemoteElement = that.publicize('getRemoteElement', function () {
        return videoRemoteElement;
    });

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! brightstream.Call
     * @method brightstream.Call.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
     * @param {object} callSettings
     */
    var requestMedia = function (finalCallSettings) {
        var now = new Date();
        var toDelete = [];
        var url = '';

        finalCallSettings = finalCallSettings || {};
        if (finalCallSettings.servers) {
            callSettings.servers = finalCallSettings.servers;
        }
        if (finalCallSettings.constraints) {
            callSettings.constraints = finalCallSettings.constraints;
        }

        report.callStarted = now.getTime();
        log.trace('requestMedia');

        try {
            pc = new RTCPeerConnection(callSettings.servers, options);
        } catch (e) {
            /* TURN is not supported, delete them from the array.
             * TODO: Find out when we can remove this workaround
             */
            log.debug("Removing TURN servers.");
            for (var i in callSettings.servers.iceServers) {
                if (callSettings.servers.iceServers.hasOwnProperty(i)) {
                    url = callSettings.servers.iceServers[i].url;
                    if (url.toLowerCase().indexOf('turn') > -1) {
                        toDelete.push(i);
                    }
                }
            }
            toDelete.sort(function sorter(a, b) { return b - a; });
            toDelete.forEach(function deleteByIndex(value, index) {
                callSettings.servers.iceServers.splice(index);
            });
            pc = new RTCPeerConnection(callSettings.servers, options);
        }

        pc.onaddstream = onRemoteStreamAdded;
        pc.onremovestream = onRemoteStreamRemoved;
        pc.onicecandidate = onIceCandidate;
        pc.onnegotiationneeded = onNegotiationNeeded;

        if (brightstream.streams[callSettings.constraints]) {
            log.debug('using old stream');
            onReceiveUserMedia(brightstream.streams[callSettings.constraints]);
            return;
        }

        try {
            log.debug("Running getUserMedia with constraints", callSettings.constraints);
            // TODO set brightstream.streams[callSettings.constraints] = true as a flag that we are already
            // attempting to obtain this media so the race condition where gUM is called twice with
            // the same constraints when calls are placed too quickly together doesn't occur.
            getUserMedia(callSettings.constraints, onReceiveUserMedia, onUserMediaError);
        } catch (e) {
            log.error("Couldn't get user media: " + e.message);
        }
    };

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onUserMediaError
     * @private
     * @param {object}
     */
    var onUserMediaError = function (p) {
        log.trace('onUserMediaError');
        that.state = ST_MEDIA_ERROR;
        if (p.code === 1) {
            log.warn("Permission denied.");
            report.callStoppedReason = 'Permission denied.';
        } else {
            log.warn(p);
            report.callStoppedReason = p.code;
        }
        hangup({signal: !that.initiator});
    };

    /**
     * Listen for the remote side to remove media in the middle of the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteStreamRemoved
     * @private
     * @param {object}
     */
    var onRemoteStreamRemoved = function (evt) {
        log.trace('pc event: remote stream removed');
    };

    /**
     * Listen for the remote side to add additional media in the middle of the call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteStreamAdded
     * @private
     * @param {object}
     * @fires brightstream.Call#remote-stream-received
     */
    var onRemoteStreamAdded = function (evt) {
        that.state = ST_FLOWING;
        log.trace('received remote media');

        for (var i = 0; (i < remoteVideoElements.length && videoRemoteElement === null); i += 1) {
            if (remoteVideoElements[i].tagName === 'VIDEO' && !remoteVideoElements[i].used) {
                videoRemoteElement = remoteVideoElements[i];
            }
        }

        if (videoRemoteElement === null) {
            videoRemoteElement = document.createElement('video');
        }

        videoRemoteElement.autoplay = true;
        videoRemoteElement.used = true;
        videoRemoteElement.play();
        attachMediaStream(videoRemoteElement, evt.stream);
        /**
         * @event brightstream.Call#remote-stream-received
         * @type {brightstream.Event}
         * @property {Element} element - the HTML5 Video element with the new stream attached.
         */
        that.fire('remote-stream-received', {
            element: videoRemoteElement
        });

        mediaStreams.push(brightstream.MediaStream({
            'stream': evt.stream,
            'isLocal': false
        }));
    };

    /**
     * Process a local ICE Candidate
     * @memberof! brightstream.Call
     * @method brightstream.Call.onIceCandidate
     * @private
     * @param {RTCICECandidate}
     */
    var onIceCandidate = function (oCan) {
        if (!oCan.candidate || !oCan.candidate.candidate) {
            return;
        }

        if (callSettings.forceTurn === true &&
                oCan.candidate.candidate.indexOf("typ relay") === -1) {
            return;
        }

        log.debug("local candidate", oCan.candidate);
        if (that.initiator && that.state < ST_ANSWERED) {
            candidateSendingQueue.push(oCan.candidate);
        } else {
            signalCandidate(oCan.candidate);
        }
    };

    /**
     * Handle renegotiation
     * @memberof! brightstream.Call
     * @method brightstream.Call.onNegotiationNeeded
     * @private
     */
    var onNegotiationNeeded = function () {
        log.warn("Negotiation needed.");
    };

    /**
     * Process any ICE candidates that we received either from the browser or the other side while
     * we were trying to set up our RTCPeerConnection to handle them.
     * @memberof! brightstream.Call
     * @method brightstream.Call.processQueues
     * @private
     */
    var processQueues = function () {
        /* We only need to queue (and thus process queues) if
         * we are the initiator. The person receiving the call
         * never has a valid PeerConnection at a time when we don't
         * have one. */
        var can = null;
        for (var i = 0; i < candidateSendingQueue.length; i += 1) {
            signalCandidate(candidateSendingQueue[i]);
        }
        candidateSendingQueue = [];
        for (var i = 0; i < candidateReceivingQueue.length; i += 1) {
            addRemoteCandidate(candidateReceivingQueue[i]);
        }
        candidateReceivingQueue = [];
    };

    /**
     * Save an SDP we've gotten from the browser which will be an offer and send it to the other
     * side.
     * @memberof! brightstream.Call
     * @method brightstream.Call.saveOfferAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    var saveOfferAndSend = function (oSession) {
        oSession.type = 'offer';
        that.state = ST_OFFERED;
        log.debug('setting and sending offer', oSession);
        report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'offer';
            signalOffer(oSession);
        }, function errorHandler(p) {
            log.error('setLocalDescription failed');
            log.error(p);
        });
    };

    /**
     * Save our SDP we've gotten from the browser which will be an answer and send it to the
     * other side.
     * @memberof! brightstream.Call
     * @method brightstream.Call.saveAnswerAndSend
     * @param {RTCSessionDescription}
     * @private
     */
    var saveAnswerAndSend = function (oSession) {
        oSession.type = 'answer';
        that.state = ST_ANSWERED;
        log.debug('setting and sending answer', oSession);
        report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function successHandler(p) {
            oSession.type = 'answer';
            signalAnswer(oSession);
        }, function errorHandler(p) {
            log.error('setLocalDescription failed');
            log.error(p);
        });
    };

    /**
     * Handle shutting the session down if the other side hangs up.
     * @memberof! brightstream.Call
     * @method brightstream.Call.onRemoteHangup
     * @private
     */
    var onRemoteHangup = function () {
        if (pc && pc.readyState !== 'active') {
            report.callStoppedReason = report.byeReasonReceived ||
                'Remote side did not confirm media.';
        } else {
            report.callStoppedReason = 'Remote side hung up.';
        }
        log.info('Callee busy or or call rejected:' + report.callStoppedReason);
        hangup({signal: false});
    };

    /**
     * Tear down the call, release user media.  Send a bye signal to the remote party if
     * signal is not false and we have not received a bye signal from the remote party.
     * @memberof! brightstream.Call
     * @method brightstream.Call.hangup
     * @fires brightstream.Call#hangup
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var hangup = that.publicize('hangup', function (params) {
        params = params || {};
        if (that.state === ST_ENDED) {
            log.trace("Call.hangup got called twice.");
            return;
        }
        that.state = ST_ENDED;

        log.trace("at hangup, call state is " + that.state);
        if (that.initiator === true) {
            if (that.state < ST_OFFERED) {
                // Never send bye if we are the initiator but we haven't sent any other signal yet.
                params.signal = false;
            }
        } else {
            if (defApproved.promise.isPending()) {
                defApproved.reject(new Error("Call hung up before approval."));
            }
        }

        clientObj.updateTurnCredentials();
        log.debug('hanging up');

        params.signal = (typeof params.signal === 'boolean' ? params.signal : true);
        if (params.signal) {
            log.info('sending bye');
            signalTerminate();
        }

        report.callStopped = new Date().getTime();
        signalReport(report);

        /**
         * @event brightstream.Call#hangup
         * @type {brightstream.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'bye' signal to the other party.
         */
        that.fire('hangup', {
            sentSignal: params.signal
        });
        that.ignore();

        mediaStreams.forEach(function stopEach(mediaStream) {
            var stream = mediaStream.getStream();
            stream.numPc -= 1;
            if (stream.numPc === 0) {
                stream.stop();
                delete brightstream.streams[callSettings.constraints];
            }
        });

        if (pc) {
            pc.close();
        }

        mediaStreams = [];
        pc = null;
    });

    /*
     * Expose hangup as reject for approve/reject workflow.
     * @memberof! brightstream.Call
     * @method brightstream.Call.reject
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var reject = that.publicize('reject', hangup);

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! brightstream.Call
     * @method brightstream.Call.isActive
     * @returns {boolean}
     */
    var isActive = that.publicize('isActive', function () {
        var inProgress = false;

        log.trace('isActive');

        if (!pc || that.state < ST_ENDED) {
            return inProgress;
        }

        inProgress = pc.readyState in ['new', 'active'];
        log.info('readyState is ' + pc.readyState + '. Call is ' +
            (inProgress ? '' : 'not ') + 'in progress.');

        return inProgress;
    });

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setOffer
     * @param {RTCSessionDescription} oSession The remote SDP.
     */
    var setOffer = that.publicize('setOffer', function (oOffer) {
        log.debug('got offer', oOffer);

        if (!that.initiator) {
            report.sdpsReceived.push(oOffer);
            report.lastSDPString = oOffer.sdp;
            defOffer.resolve(oOffer);
        } else {
            defOffer.reject(new Error("Received offer in a bad state."));
            log.warn('Got offer in precall state.');
            signalTerminate();
        }
    });

    /**
     * Save the answer and tell the browser about it.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setAnswer
     * @param {RTCSessionDescription} oSession The remote SDP.
     */
    var setAnswer = that.publicize('setAnswer', function (oSession) {
        that.state = ST_ANSWERED;
        log.debug('got answer', oSession);

        report.sdpsReceived.push(oSession);
        report.lastSDPString = oSession.sdp;

        pc.setRemoteDescription(
            new RTCSessionDescription(oSession),
            processQueues,
            function errorHandler(p) {
                log.error('set remote desc of answer failed');
                report.callStoppedReason = 'setRemoteDescription failed at answer.';
                log.error(oSession);
                hangup();
            }
        );
    });

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! brightstream.Call
     * @method brightstream.Call.addRemoteCandidate
     * @param {RTCIceCandidate} oCan The ICE candidate.
     */
    var addRemoteCandidate = that.publicize('addRemoteCandidate', function (oCan) {
        if (!oCan || oCan.candidate === null) {
            return;
        }
        if (!oCan.hasOwnProperty('sdpMLineIndex') || !oCan.candidate) {
            log.warn("addRemoteCandidate got wrong format!", oCan);
            return;
        }
        if (that.initiator && that.state < ST_ANSWERED) {
            candidateReceivingQueue.push(oCan);
            log.debug('Queueing a candidate.');
            return;
        }
        try {
            pc.addIceCandidate(new RTCIceCandidate(oCan));
        } catch (e) {
            log.error("Couldn't add ICE candidate: " + e.message, oCan);
            return;
        }
        log.debug('Got a remote candidate.', oCan);
        report.candidatesReceived.push(oCan);
    });

    /**
     * Get the state of the Call
     * @memberof! brightstream.Call
     * @method brightstream.Call.getState
     * @returns {string}
     */
    var getState = that.publicize('getState', function () {
        return pc ? that.state : "before";
    });

    /**
     * Indicate whether the logged-in User initated the Call.
     * @memberof! brightstream.Call
     * @method brightstream.Call.isInitiator
     * @returns {boolean}
     */
    var isInitiator = that.publicize('isInitiator', function () {
        return that.initiator;
    });

    /**
     * Return the ID of the remote endpoint.
     * @memberof! brightstream.Call
     * @method brightstream.Call.getEndpointID
     * @returns {string}
     */
    var getEndpointID = that.publicize('getEndpointID', function () {
        return remoteEndpoint;
    });

    /**
     * Return all MediaStreams
     * @memberof! brightstream.Call
     * @method brightstream.Call.getStreams
     * @returns {brightstream.MediaStream[]}
     */
    var getStreams = that.publicize('getStreams', function () {
        return mediaStreams;
    });

    /**
     * Return all local MediaStreams
     * @memberof! brightstream.Call
     * @method brightstream.Call.getLocalStreams
     * @returns {brightstream.MediaStream[]}
     */
    var getLocalStreams = that.publicize('getLocalStreams', function () {
        var streams = [];

        mediaStreams.forEach(function addLocal(stream) {
            if (stream.isLocal()) {
                streams.push(stream);
            }
        });

        return streams;
    });

    /**
     * Return all remote MediaStreams
     * @memberof! brightstream.Call
     * @method brightstream.Call.getRemoteStreams
     * @returns {brightstream.MediaStream[]}
     */
    var getRemoteStreams = that.publicize('getRemoteStreams', function () {
        var streams = [];

        mediaStreams.forEach(function addRemote(stream) {
            if (!stream.isLocal()) {
                streams.push(stream);
            }
        });

        return streams;
    });

    /**
     * If video is muted, unmute. If not muted, mute. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.toggleVideo
     */
    var toggleVideo = that.publicize('toggleVideo', function () {
        if (that.isActive()) {
            if (pc.localStreams[0].videoTracks[0].enabled) {
                that.muteVideo();
            } else {
                that.unmuteVideo();
            }
        }
    });

    /**
     * If audio is muted, unmute. If not muted, mute. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.toggleAudio
     */
    var toggleAudio = that.publicize('toggleAudio', function () {
        if (that.isActive()) {
            if (pc.localStreams[0].audioTracks[0].enabled) {
                that.muteAudio();
            } else {
                that.unmuteAudio();
            }
        }
    });

    /**
     * Mute video. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.muteVideo
     * @fires brightstream.Call#video-muted
     */
    var muteVideo = that.publicize('muteVideo', function () {
        mediaStreams.forEach(function muteEach(stream) {
            stream.muteVideo();
        });
        /**
         * @event brightstream.Call#video-muted
         */
        that.fire('video-muted');
    });

    /**
     * Unmute video. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.unmuteVideo
     * @fires brightstream.Call#video-unmuted
     */
    var unmuteVideo = that.publicize('unmuteVideo', function () {
        mediaStreams.forEach(function unmuteEach(stream) {
            stream.unmuteVideo();
        });
        /**
         * @event brightstream.Call#video-unmuted
         */
        that.fire('video-unmuted');
    });

    /**
     * Mute audio. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.muteAudio
     * @fires brightstream.Call#audio-muted
     */
    var muteAudio = that.publicize('muteAudio', function () {
        mediaStreams.forEach(function muteEach(stream) {
            stream.muteAudio();
        });
        /**
         * @event brightstream.Call#audio-muted
         */
        that.fire('audio-muted');
    });

    /**
     * Unmute audio. TODO: How should this behave?
     * @memberof! brightstream.Call
     * @method brightstream.Call.unmuteAudio
     * @fires brightstream.Call#audio-unmuted
     */
    var unmuteAudio = that.publicize('unmuteAudio', function () {
        mediaStreams.forEach(function unmuteEach(stream) {
            stream.unmuteAudio();
        });
        /**
         * @event brightstream.Call#audio-unmuted
         */
        that.fire('audio-unmuted');
    });

    /**
     * Save the hangup reason and hang up.
     * @memberof! brightstream.Call
     * @method brightstream.Call.setBye
     */
    var setBye = that.publicize('setBye', function (params) {
        params = params || {};
        report.callStoppedReason = params.reason || "Remote side hung up";
        hangup({signal: false});
    });

    return that;
}; // End brightstream.Call

/**
 * Create a new MediaStream.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.MediaStream
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc Manage native MediaStreams.
 * @returns {brightstream.MediaStream}
 * @property {object} stream - The native MediaStream we are managing.
 * @property {boolean} islocal - whether the stream is local or remote.
 * @property {brightstream.Endpoint} stream The Endpoint to whom this stream belongs.
 */
brightstream.MediaStream = function (params) {
    "use strict";
    params = params || {};
    var that = brightstream.EventEmitter(params);
    that.className = 'brightstream.MediaStream';

    var stream = params.stream;
    var local = params.isLocal;

    /**
     * Stop this MediaStream
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.stop
     */
    var stop = that.publicize('stop', function () {
        stream.stop();
    });

    /**
     * Mute the audio on this MediaStream
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.muteAudio
     * @fires brightstream.MediaStream#audio-muted
     */
    var muteAudio = that.publicize('muteAudio', function () {
        stream.audioTracks[0].enabled = false;
        /**
         * @event brightstream.MediaStream#audio-muted
         */
        that.fire('audio-muted');
    });

    /**
     * Mute the video on this MediaStream
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.muteVideo
     * @fires brightstream.MediaStream#video-muted
     */
    var muteVideo = that.publicize('muteVideo', function () {
        stream.videoTracks[0].enabled = false;
        /**
         * @event brightstream.MediaStream#video-muted
         */
        that.fire('video-muted');
    });

    /**
     * Unmute the audio on this MediaStream
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.unmuteAudio
     * @fires brightstream.MediaStream#audio-unmuted
     */
    var unmuteAudio = that.publicize('unmuteAudio', function () {
        stream.audioTracks[0].enabled = true;
        /**
         * @event brightstream.MediaStream#audio-unmuted
         */
        that.fire('audio-unmuted');
    });

    /**
     * Unmute the video on this MediaStream
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.unmuteVideo
     * @fires brightstream.MediaStream#video-unmuted
     */
    var unmuteVideo = that.publicize('unmuteVideo', function () {
        stream.videoTracks[0].enabled = true;
        /**
         * @event brightstream.MediaStream#video-unmuted
         */
        that.fire('video-unmuted');
    });

    /**
     * Indicate whether the MediaStream is the local User's stream.
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.isLocal
     * @return {boolean}
     */
    var isLocal = that.publicize('isLocal', function () {
        return !!local;
    });

    /**
     * Indicate whether the MediaStream is a Endpoint's stream. Do we need this if we
     * have MediaStream.isLocal()?
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.isRemote
     * @return {boolean}
     */
    var isRemote = that.publicize('isRemote', function () {
        return !isLocal();
    });

    /**
     * Get the media stream's unique id.
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.getID
     * @return {string}
     */
    var getID = that.publicize('getID', function () {
        return stream.id;
    });

    /**
     * Get the stream
     * @memberof! brightstream.MediaStream
     * @method brightstream.MediaStream.getStream
     * @return {MediaStream}
     */
    var getStream = that.publicize('getStream', function () {
        return stream;
    });

    return that;
}; // End brightstream.MediaStream
