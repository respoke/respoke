/**
 * Create a new Call.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Call
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc WebRTC Call including getUserMedia, path and codec negotation, and call state.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.Call}
 * @property {boolean} initiator Indicate whether this Call belongs to the Endpoint
 * that initiated the WebRTC session.
 */
/*global webrtc: false */
webrtc.Call = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = webrtc.EventEmitter(params);
    delete that.client;
    that.className = 'webrtc.Call';
    that.id = webrtc.makeUniqueID().toString();

    if (!that.initiator) {
        that.initiator = false;
    }

    var pc = null;
    var savedOffer = null;
    var receivedAnswer = false;
    var receivedBye = false;
    var previewLocalMedia = typeof params.previewLocalMedia === 'function' ? params.previewLocalMedia : undefined;
    var sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : false;
    var receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : false;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var mediaStreams = [];
    var clientObj = webrtc.getClient(client);
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
     * Start the process of obtaining media.
     * @memberof! webrtc.Call
     * @method webrtc.Call.answer
     * @fires webrtc.Call#answer
     */
    var answer = that.publicize('answer', function (params) {
        that.state = ST_STARTED;
        params = params || {};

        receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : receiveOnly;
        previewLocalMedia = typeof params.previewLocalMedia === 'function' ? params.previewLocalMedia : previewLocalMedia;

        if (!that.username) {
            throw new Error("Can't use a Call without username.");
        }
        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");
        that.fire('answer');

        if (receiveOnly !== true) {
            requestMedia(params);
        } else if (typeof previewLocalMedia !== 'function') {
            approve();
        }
    });

    /**
     * Start the process of network and media negotiation. Called after local video approved.
     * @memberof! webrtc.Call
     * @method webrtc.Call.approve.
     */
    var approve = that.publicize('approve', function () {
        that.state = ST_APPROVED;
        log.trace('Call.approve');
        that.fire('approve');

        if (that.initiator === true) {
            log.info('creating offer');
            pc.createOffer(saveOfferAndSend, function errorHandler(p) {
                log.error('createOffer failed');
            }, null);
            return;
        } else {
            if (savedOffer) {
                processOffer();
            }
        }
    });

    /**
     * Process a remote offer if we are not the initiator.
     * @memberof! webrtc.Call
     * @method webrtc.Call.processOffer
     * @private
     */
    var processOffer = function () {
        savedOffer.type = 'offer';
        log.trace('processOffer');
        log.debug('processOffer', savedOffer);

        try {
            pc.setRemoteDescription(new RTCSessionDescription(savedOffer),
                function successHandler() {
                    log.debug('set remote desc of offer succeeded');
                    pc.createAnswer(saveAnswerAndSend, function errorHandler(p) {
                        log.error("Error creating SDP answer.");
                        report.callStoppedReason = 'Error creating SDP answer.';
                        log.error(p);
                    });
                    that.savedOffer = null;
                }, function errorHandler(p) {
                    log.error('set remote desc of offer failed');
                    report.callStoppedReason = 'setLocalDescr failed at offer.';
                    log.error(savedOffer);
                    log.error(p);
                    hangup();
                }
            );
            that.state = ST_OFFERED;
        } catch (e) {
            log.error("error processing offer: " + e.message);
        }
    };

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onReceiveUserMedia
     * @private
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
        if (webrtc.streams[callSettings.constraints]) {
            webrtc.streams[callSettings.constraints].numPc += 1;
            setTimeout(function () {
                that.fire('local-stream-received', videoLocalElement, that);
            }, 500);
        } else {
            stream.numPc = 1;
            webrtc.streams[callSettings.constraints] = stream;
            mediaStreams.push(webrtc.MediaStream({
                'stream': stream,
                'isLocal': true
            }));

            stream.id = clientObj.user.getID();
            attachMediaStream(videoLocalElement, stream);
            // We won't want our local video outputting audio.
            videoLocalElement.muted = true;
            videoLocalElement.autoplay = true;
            videoLocalElement.used = true;

            that.fire('local-stream-received', videoLocalElement, that);
        }

        if (typeof previewLocalMedia === 'function') {
            that.state = ST_INREVIEW;
            setTimeout(function () {
                previewLocalMedia(videoLocalElement, that);
            }, 100);
        } else {
            approve();
        }
    };

    /**
     * Return local video element.
     * @memberof! webrtc.Call
     * @method webrtc.Call.getLocalElement
     */
    var getLocalElement = that.publicize('getLocalElement', function () {
        return videoLocalElement;
    });

    /**
     * Return remote video element.
     * @memberof! webrtc.Call
     * @method webrtc.Call.getRemoteElement
     */
    var getRemoteElement = that.publicize('getRemoteElement', function () {
        return videoRemoteElement;
    });

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! webrtc.Call
     * @method webrtc.Call.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
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
        pc.onstatechange = onStateChange;
        pc.onicechange = onIceChange;

        if (webrtc.streams[callSettings.constraints]) {
            log.debug('using old stream');
            onReceiveUserMedia(webrtc.streams[callSettings.constraints]);
            return;
        }

        try {
            log.debug("Running getUserMedia with constraints", callSettings.constraints);
            // TODO set webrtc.streams[callSettings.constraints] = true as a flag that we are already
            // attempting to obtain this media so the race condition where gUM is called twice with
            // the same constraints when calls are placed too quickly together doesn't occur.
            getUserMedia(callSettings.constraints, onReceiveUserMedia, onUserMediaError);
        } catch (e) {
            log.error("Couldn't get user media: " + e.message);
        }
    };

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onUserMediaError
     * @private
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.onRemoteStreamRemoved
     * @private
     */
    var onRemoteStreamRemoved = function (evt) {
        log.trace('pc event: remote stream removed');
    };

    /**
     * Listen for the remote side to add additional media in the middle of the call.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onRemoteStreamAdded
     * @private
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
        that.fire('remote-stream-received', videoRemoteElement, that);

        mediaStreams.push(webrtc.MediaStream({
            'stream': evt.stream,
            'isLocal': false
        }));
    };

    /**
     * Listen for RTCPeerConnection state change.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onStateChange
     * @private
     */
    var onStateChange = function (p, a) {
    };

    /**
     * Listen for ICE change.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onIceChange
     * @private
     */
    var onIceChange = function (p) {
    };

    /**
     * Process a local ICE Candidate
     * @memberof! webrtc.Call
     * @method webrtc.Call.onIceCandidate
     * @private
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
        if (that.initiator && !receivedAnswer) {
            candidateSendingQueue.push(oCan.candidate);
        } else {
            signalCandidate(oCan.candidate);
        }
    };

    /**
     * Handle renegotiation
     * @memberof! webrtc.Call
     * @method webrtc.Call.onNegotiationNeeded
     * @private
     */
    var onNegotiationNeeded = function (oCan) {
        log.warn("Negotiation needed.");
    };

    /**
     * Process any ICE candidates that we received either from the browser or the other side while
     * we were trying to set up our RTCPeerConnection to handle them.
     * @memberof! webrtc.Call
     * @method webrtc.Call.processQueues
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.saveOfferAndSend
     * @param {RTCSessionDescription} oSession
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.saveAnswerAndSend
     * @param {RTCSessionDescription} oSession
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.onRemoteHangup
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.hangup
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var hangup = that.publicize('hangup', function (params) {
        params = params || {};
        if (that.state === ST_ENDED) {
            // This function got called twice.
            log.trace("Call.hangup got called twice.");
            return;
        }
        that.state = ST_ENDED;

        // Never send bye if we are the initiator but we haven't sent any other signal yet.
        log.trace("at hangup, call state is " + that.state);
        if (that.initiator === true && that.state < ST_OFFERED) {
            params.signal = false;
        }

        clientObj.updateTurnCredentials();
        /*if (pc === null) {
            return;
        }*/
        log.debug('hanging up');

        params.signal = (typeof params.signal === 'boolean' ? params.signal : true);
        if (!receivedBye && params.signal) {
            log.info('sending bye');
            signalTerminate();
        }

        report.callStopped = new Date().getTime();
        signalReport(report);

        that.fire('hangup', params.signal);
        that.ignore();

        mediaStreams.forOwn(function stopEach(mediaStream) {
            var stream = mediaStream.getStream();
            stream.numPc -= 1;
            if (stream.numPc === 0) {
                stream.stop();
                delete webrtc.streams[callSettings.constraints];
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.reject
     * @param {boolean} signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    var reject = that.publicize('reject', hangup);

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! webrtc.Call
     * @method webrtc.Call.isActive
     * @returns {boolean}
     */
    var isActive = that.publicize('isActive', function () {
        var inProgress = false;

        log.trace('isActive');

        if (!pc || receivedBye === true) {
            return inProgress;
        }

        inProgress = pc.readyState in ['new', 'active'];
        log.info('readyState is ' + pc.readyState + '. Call is ' +
            (inProgress ? '' : 'not ') + 'in progress.');

        return inProgress;
    });

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! webrtc.Call
     * @method webrtc.Call.setOffer
     * @param {RTCSessionDescription} oSession The remote SDP.
     */
    var setOffer = that.publicize('setOffer', function (oSession) {
        log.debug('got offer', oSession);

        savedOffer = oSession;
        if (!that.initiator) {
            report.sdpsReceived.push(oSession);
            report.lastSDPString = oSession.sdp;
            if (that.state === ST_APPROVED) {
                // We called approve already without the offer. Call it again now that we have it
                processOffer();
            }
        } else {
            log.warn('Got offer in precall state.');
            signalTerminate();
        }
    });

    /**
     * Save the answer and tell the browser about it.
     * @memberof! webrtc.Call
     * @method webrtc.Call.setAnswer
     * @param {RTCSessionDescription} oSession The remote SDP.
     */
    var setAnswer = that.publicize('setAnswer', function (oSession) {
        that.state = ST_ANSWERED;
        log.debug('got answer', oSession);

        savedOffer = oSession; // TODO is this necessary?
        receivedAnswer = true;
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.addRemoteCandidate
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
        if (that.initiator && !receivedAnswer) {
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.getState
     * @returns {string}
     */
    var getState = that.publicize('getState', function () {
        return pc ? that.state : "before";
    });

    /**
     * Indicate whether the logged-in User initated the Call.
     * @memberof! webrtc.Call
     * @method webrtc.Call.isInitiator
     * @returns {boolean}
     */
    var isInitiator = that.publicize('isInitiator', function () {
        return that.initiator;
    });

    /**
     * Return the ID of the remote endpoint.
     * @memberof! webrtc.Call
     * @method webrtc.Call.getContactID
     * @returns {string}
     */
    var getContactID = that.publicize('getContactID', function () {
        return remoteEndpoint;
    });

    /**
     * Return all MediaStreams
     * @memberof! webrtc.Call
     * @method webrtc.Call.getStreams
     * @returns {webrtc.MediaStream[]}
     */
    var getStreams = that.publicize('getStreams', function () {
        return mediaStreams;
    });

    /**
     * Return all local MediaStreams
     * @memberof! webrtc.Call
     * @method webrtc.Call.getLocalStreams
     * @returns {webrtc.MediaStream[]}
     */
    var getLocalStreams = that.publicize('getLocalStreams', function () {
        var streams = [];

        mediaStreams.forOwn(function addLocal(stream) {
            if (stream.isLocal()) {
                streams.push(stream);
            }
        });

        return streams;
    });

    /**
     * Return all remote MediaStreams
     * @memberof! webrtc.Call
     * @method webrtc.Call.getRemoteStreams
     * @returns {webrtc.MediaStream[]}
     */
    var getRemoteStreams = that.publicize('getRemoteStreams', function () {
        var streams = [];

        mediaStreams.forOwn(function addRemote(stream) {
            if (!stream.isLocal()) {
                streams.push(stream);
            }
        });

        return streams;
    });

    /**
     * If video is muted, unmute. If not muted, mute. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.toggleVideo
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.toggleAudio
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
     * @memberof! webrtc.Call
     * @method webrtc.Call.muteVideo
     * @fires webrtc.Call#video-muted
     */
    var muteVideo = that.publicize('muteVideo', function () {
        mediaStreams.forOwn(function muteEach(stream) {
            stream.muteVideo();
        });
        that.fire('video-muted');
    });

    /**
     * Unmute video. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.unmuteVideo
     * @fires webrtc.Call#video-unmuted
     */
    var unmuteVideo = that.publicize('unmuteVideo', function () {
        mediaStreams.forOwn(function unmuteEach(stream) {
            stream.unmuteVideo();
        });
        that.fire('video-unmuted');
    });

    /**
     * Mute audio. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.muteAudio
     * @fires webrtc.Call#audio-muted
     */
    var muteAudio = that.publicize('muteAudio', function () {
        mediaStreams.forOwn(function muteEach(stream) {
            stream.muteAudio();
        });
        that.fire('audio-muted');
    });

    /**
     * Unmute audio. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.unmuteAudio
     * @fires webrtc.Call#audio-unmuted
     */
    var unmuteAudio = that.publicize('unmuteAudio', function () {
        mediaStreams.forOwn(function unmuteEach(stream) {
            stream.unmuteAudio();
        });
        that.fire('audio-unmuted');
    });

    /**
     * Set receivedBye to true and stop media.
     * @memberof! webrtc.Call
     * @method webrtc.Call.setBye
     */
    var setBye = that.publicize('setBye', function () {
        receivedBye = true;
        hangup();
    });

    return that;
}; // End webrtc.Call

/**
 * Create a new MediaStream.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.MediaStream
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc Manage native MediaStreams.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.MediaStream}
 * @property {object} stream The native MediaStream we are managing.
 * @property {webrtc.Endpoint} stream The Endpoint to whom this stream belongs.
 */
webrtc.MediaStream = function (params) {
    "use strict";
    params = params || {};
    var that = webrtc.EventEmitter(params);
    that.className = 'webrtc.MediaStream';

    var stream = params.stream;
    var local = params.isLocal;

    /**
     * Stop this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.stop
     */
    var stop = that.publicize('stop', function () {
        stream.stop();
    });

    /**
     * Mute the audio on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.muteAudio
     * @fires webrtc.MediaStream#audio-muted
     */
    var muteAudio = that.publicize('muteAudio', function () {
        stream.audioTracks[0].enabled = false;
        that.fire('audio-muted');
    });

    /**
     * Mute the video on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.muteVideo
     * @fires webrtc.MediaStream#video-muted
     */
    var muteVideo = that.publicize('muteVideo', function () {
        stream.videoTracks[0].enabled = false;
        that.fire('video-muted');
    });

    /**
     * Unmute the audio on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.unmuteAudio
     * @fires webrtc.MediaStream#audio-unmuted
     */
    var unmuteAudio = that.publicize('unmuteAudio', function () {
        stream.audioTracks[0].enabled = true;
        that.fire('audio-unmuted');
    });

    /**
     * Unmute the video on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.unmuteVideo
     * @fires webrtc.MediaStream#video-unmuted
     */
    var unmuteVideo = that.publicize('unmuteVideo', function () {
        stream.videoTracks[0].enabled = true;
        that.fire('video-unmuted');
    });

    /**
     * Indicate whether the MediaStream is the local User's stream.
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.isLocal
     * @return {boolean}
     */
    var isLocal = that.publicize('isLocal', function () {
        return !!local;
    });

    /**
     * Indicate whether the MediaStream is a Contact's stream. Do we need this if we
     * have MediaStream.isLocal()?
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.isRemote
     * @return {boolean}
     */
    var isRemote = that.publicize('isRemote', function () {
        return !isLocal();
    });

    /**
     * Get the media stream's unique id.
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.getID
     * @return {string}
     */
    var getID = that.publicize('getID', function () {
        return stream.id;
    });

    /**
     * Get the media stream's object URL for adding to a video element.
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.getURL
     * @return {string}
     */
    var getURL = that.publicize('getURL', function () {
        //return webkitURL.createObjectURL(stream);
    });

    /**
     * Get the stream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.getStream
     * @return {MediaStream}
     */
    var getStream = that.publicize('getStream', function () {
        return stream;
    });

    return that;
}; // End webrtc.MediaStream
