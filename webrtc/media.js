/**
 * Create a new Call.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.Call
 * @constructor
 * @augments webrtc.EventEmitter
 * @classdesc WebRTC Call including getContactMedia, path and codec negotation, and
 * call state.
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

    if (!that.initiator) {
        that.initiator = false;
    }

    var pc = null;
    var savedOffer = null;
    var receivedAnswer = false;
    var receivedBye = false;
    var candidateSendingQueue = [];
    var candidateReceivingQueue = [];
    var mediaStreams = [];
    var clientObj = webrtc.getClient(client);
    var localVideoElements = params.localVideoElements || [];
    var remoteVideoElements = params.remoteVideoElements || [];
    var signalingChannel = clientObj.getSignalingChannel();
    var remoteEndpoint = params.remoteEndpoint;
    var signalInitiate = params.signalInitiate;
    var signalAccept = params.signalAccept;
    var signalTerminate = params.signalTerminate;
    var signalReport = params.signalReport;
    var signalCandidate = params.signalCandidate;
    var callSettings = clientObj.getCallSettings();
    var options = {
        optional: [
            { DtlsSrtpKeyAgreement: true },
            { RtpDataChannels: false }
        ]
    };

    if (params.callSettings && params.callSettings.constraints) {
        callSettings.constraints = params.callSettings.constraints;
    }

    if (params.callSettings && params.callSettings.servers) {
        callSettings.servers = params.callSettings.servers;
    }

    /*if (callSettings.servers.iceServers.length === 0) {
        callSettings.servers.iceServers.push(createIceServer('stun:stun.l.google.com:19302'));
    }*/

    var report = {
        'startCallCount' : 0,
        'startCount' : 0,
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

    /**
     * Start the process of obtaining media.
     * @memberof! webrtc.Call
     * @method webrtc.Call.start
     */
    var start = that.publicize('start', function () {
        if (!that.username) {
            throw new Error("Can't use a Call without username.");
        }
        report.startCount += 1;
        log.debug("I am " + (that.initiator ? '' : 'not ') + "the initiator.");
        requestMedia();
    });

    /**
     * Start the process of network and media negotiation. Called by the initiator only.
     * @memberof! webrtc.Call
     * @method webrtc.Call.startCall
     */
    var startCall = function () {
        log.trace('startCall');
        report.startCallCount += 1;
        log.info('creating offer');
        pc.createOffer(saveOfferAndSend, function (p) {
            log.error('createOffer failed');
        }, null);
    };

    /**
     * Save the local stream. Kick off SDP creation.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onReceiveUserMedia
     * @private
     */
    var onReceiveUserMedia = function (stream, oneConstraints, index) {
        var mediaStream = null;
        var videoElement = null;

        that.state = 'media flowing';
        log.debug('User gave permission to use media.');
        log.trace(onReceiveUserMedia);
        log.trace(stream);

        if (pc === null) {
            log.error("Peer connection is null!");
            return;
        }

        mediaStreams.push(webrtc.MediaStream({
            'stream': stream,
            'isLocal': true
        }));

        stream.id = clientObj.user.getID() + index;
        pc.addStream(stream);

        for (var i = 0; (i < localVideoElements.length && videoElement === null); i += 1) {
            if (localVideoElements[i].tagName === 'VIDEO' && !localVideoElements[i].used) {
                videoElement = localVideoElements[i];
            }
        }

        if (videoElement === null) {
            videoElement = document.createElement('video');
        }

        // We won't want our local video outputting audio.
        videoElement.muted = true;
        videoElement.autoplay = true;
        attachMediaStream(videoElement, stream);
        setTimeout(function () {
            videoElement.play();
        }, 100);
        that.fire('stream:local:received', videoElement);
        videoElement.used = true;

        if (mediaStreams.length === 1) {
            if (that.initiator) {
                that.fire('call:initiate');
                startCall();
            } else {
                acceptCall();
            }
        }
    };

    /**
     * Create the RTCPeerConnection and add handlers. Process any offer we have already received.
     * @memberof! webrtc.Call
     * @method webrtc.Call.requestMedia
     * @todo Find out when we can stop deleting TURN servers
     * @private
     */
    var requestMedia = function () {
        var now = new Date();
        var toDelete = [];
        var url = '';

        report.callStarted = now.getTime();
        log.trace(requestMedia);

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
            toDelete.sort(function (a, b) { return b - a; });
            toDelete.forEach(function (value, index) {
                callSettings.servers.iceServers.splice(index);
            });
            pc = new RTCPeerConnection(callSettings.servers, options);
        }

        pc.onaddstream = onRemoteStreamAdded;
        pc.onremovestream = onRemoteStreamRemoved;
        pc.onicecandidate = onIceCandidate;
        pc.onnegotiationneeded = onNegotiationNeeded;
        /*pc.oniceconnectionstatechange = function (p) {
            log.trace('oniceconnectionstatechange');
            log.trace(p);
        };*/
        pc.onstatechange = onStateChange;
        pc.onicechange = onIceChange;

        if (savedOffer) {
            processOffer(savedOffer);
            savedOffer = null;
        }

        callSettings.constraints.forOwn(function (oneConstraints, index) {
            try {
                log.debug("Running getUserMedia with constraints");
                log.debug(oneConstraints);
                getUserMedia(oneConstraints, function (p) {
                    onReceiveUserMedia(p, oneConstraints, index);
                }, function (p) {
                    onUserMediaError(p, oneConstraints, index);
                });
            } catch (e) {
                log.error("Couldn't get user media: " + e.message);
            }
        });
    };

    /**
     * Handle any error that comes up during the process of getting user media.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onUserMediaError
     * @private
     */
    var onUserMediaError = function (p, oneConstraints, index) {
        log.trace('onUserMediaError');
        if (p.code === 1) {
            log.warn("Permission denied.");
            report.callStoppedReason = 'Permission denied.';
        } else {
            log.warn(p);
            report.callStoppedReason = p.code;
        }
        stopMedia(!that.initiator);
    };

    /**
     * Process the initial offer received from the remote side if we are not the initiator.
     * @memberof! webrtc.Call
     * @method webrtc.Call.acceptCall
     * @private
     */
    var acceptCall = function () {
        log.trace('acceptCall');
        if (savedOffer) {
            processOffer(savedOffer);
            savedOffer = null;
        } else {
            log.error("Can't process offer--no SDP!");
            stopMedia(true);
        }
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
        that.state = 'media flowing';
        var mediaStream = null;
        var videoElement = null;

        log.trace('received remote media');

        for (var i = 0; (i < remoteVideoElements.length && videoElement === null); i += 1) {
            if (remoteVideoElements[i].tagName === 'VIDEO' && !remoteVideoElements[i].used) {
                videoElement = remoteVideoElements[i];
            }
        }

        if (videoElement === null) {
            videoElement = document.createElement('video');
        }

        videoElement.autoplay = true;
        attachMediaStream(videoElement, evt.stream);
        setTimeout(function () {
            videoElement.play();
        }, 100);
        that.fire('stream:remote:received', videoElement);
        videoElement.used = true;

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
        log.trace('iceState is ' + p.currentTarget.iceState);
        log.trace('readyState is ' + p.currentTarget.readyState);
    };

    /**
     * Listen for ICE change.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onIceChange
     * @private
     */
    var onIceChange = function (p) {
        log.trace('pc event: ice changed');
        log.trace(p);
    };

    /**
     * Process a local ICE Candidate
     * @memberof! webrtc.Call
     * @method webrtc.Call.onIceCandidate
     * @private
     */
    var onIceCandidate = function (oCan) {
        if (!oCan.candidate) {
            return;
        }
        log.debug("original browser-generated candidate object");
        log.debug(oCan.candidate);
        if (that.initiator && !receivedAnswer) {
            candidateSendingQueue.push(oCan.candidate);
        } else if (!that.initiator) {
            report.candidatesSent.push(oCan.candidate);
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
        for (var i = 0; i <= candidateSendingQueue.length; i += 1) {
            can = candidateSendingQueue[i];
            signalCandidate(can);
        }
        candidateSendingQueue = [];
        for (var i = 0; i <= candidateReceivingQueue.length; i += 1) {
            can = candidateReceivingQueue[i];
            processCandidate(can);
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
        log.debug('setting and sending initiate');
        log.debug(oSession);
        report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function (p) {
            signalInitiate(oSession);
        }, function (p) {
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
        log.debug('setting and sending accept');
        log.debug(oSession);
        report.sdpsSent.push(oSession);
        pc.setLocalDescription(oSession, function (p) {
            signalAccept(oSession);
        }, function (p) {
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
        stopMedia(false);
    };

    /**
     * Tear down the call, release user media.  Send a bye signal to the remote party if
     * sendSignal is not false and we have not received a bye signal from the remote party.
     * @memberof! webrtc.Call
     * @method webrtc.Call.stopMedia
     * @param {boolean} sendSignal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     * @todo TODO: Make it so the dev doesn't have to know when to send a bye.
     */
    var stopMedia = that.publicize('stopMedia', function (sendSignal) {
        that.state = 'ended';
        clientObj.updateTurnCredentials();
        if (pc === null) {
            return;
        }
        log.debug('hanging up');

        sendSignal = (typeof sendSignal === 'boolean' ? sendSignal : true);
        if (!receivedBye && sendSignal) {
            log.info('sending bye');
            signalTerminate();
        }

        report.callStopped = new Date().getTime();
        signalReport(report);

        that.fire('hangup', sendSignal);
        that.ignore();
        signalingChannel.ignore('received:offer', onOffer);
        signalingChannel.ignore('received:answer', onAnswer);
        signalingChannel.ignore('received:candidate', processCandidate);
        signalingChannel.ignore('received:bye', onBye);

        mediaStreams.forOwn(function (stream) {
            stream.stop();
        });

        if (pc) {
            pc.close();
        }

        mediaStreams = [];
        pc = null;
    });


    /**
     * Tell the browser about the offer we received.
     * @memberof! webrtc.Call
     * @method webrtc.Call.processOffer
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @private
     */
    var processOffer = function (oSession) {
        oSession.type = 'offer';
        log.trace('processOffer');
        log.trace(oSession);
        try {
            pc.setRemoteDescription(new RTCSessionDescription(oSession), function () {
                log.debug('set remote desc of offer succeeded');
                pc.createAnswer(saveAnswerAndSend, function (p) {
                    log.error("Error creating SDP answer.");
                    report.callStoppedReason = 'Error creating SDP answer.';
                    log.error(p);
                });
                that.savedOffer = null;
            }, function (p) {
                log.error('set remote desc of offer failed');
                report.callStoppedReason = 'setLocalDescr failed at offer.';
                log.error(oSession);
                log.error(p);
                that.stopMedia();
            });
        } catch (e) {
            log.error("error processing offer: " + e.message);
        }
    };

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
            return false;
        }

        inProgress = pc.readyState in ['new', 'active'];
        log.info('readyState is ' + pc.readyState + '. Call is ' +
            (inProgress ? '' : 'not ') + 'in progress.');

        return inProgress;
    });

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onOffer
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @private
     */
    var onOffer = function (oSession) {
        that.state = 'setup';
        log.debug('got offer');
        log.debug(oSession);

        savedOffer = oSession;
        if (!that.initiator) {
            report.sdpsReceived.push(oSession);
            report.lastSDPString = oSession.sdp;
        } else {
            log.warn('Got initiate in precall state.');
            log.trace("rejecting call.");
            signalTerminate();
        }
    };

    /**
     * Save the answer and tell the browser about it.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onAnswer
     * @param {RTCSessionDescription} oSession The remote SDP.
     * @private
     */
    var onAnswer = function (oSession) {
        that.state = 'setup';
        log.debug('remote side sdp is');
        log.debug(oSession);

        savedOffer = oSession;
        receivedAnswer = true;
        report.sdpsReceived.push(oSession);
        report.lastSDPString = oSession.sdp;

        pc.setRemoteDescription(new RTCSessionDescription(oSession), processQueues, function (p) {
            log.error('set remote desc of answer failed');
            report.callStoppedReason = 'setRemoteDescription failed at answer.';
            log.error(oSession);
            that.stopMedia();
        });
    };

    /**
     * Save the candidate. If we initiated the call, place the candidate into the queue so
     * we can process them after we receive the answer.
     * @memberof! webrtc.Call
     * @method webrtc.Call.processCandidate
     * @param {RTCIceCandidate} oCan The ICE candidate.
     * @private
     */
    var processCandidate = function (oCan) {
        if (!oCan || oCan.candidate === null) {
            log.info("End of candidates.");
            return;
        }
        if (!oCan.hasOwnProperty('sdpMLineIndex') || !oCan.candidate) {
            log.warn("processCandidate got wrong format!");
            log.warn(oCan);
        }
        if (that.initiator && !receivedAnswer) {
            candidateReceivingQueue.push(oCan);
            log.debug('Queueing a candidate.');
            return;
        }
        try {
            pc.addIceCandidate(new RTCIceCandidate(oCan));
        } catch (e) {
            log.error("Couldn't add ICE candidate: " + e.message);
            log.error(oCan);
        }
        log.debug('Got a remote candidate.');
        log.debug(oCan);
        report.candidatesReceived.push(oCan);
    };

    /**
     * Get the state of the Call
     * @memberof! webrtc.Call
     * @method webrtc.Call.getState
     * @returns {string}
     */
    var getState = that.publicize('getState', function () {
        return pc ? pc.readyState : "before";
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

        mediaStreams.forOwn(function (stream) {
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

        mediaStreams.forOwn(function (stream) {
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
     * @fires webrtc.Call#video:muted
     */
    var muteVideo = that.publicize('muteVideo', function () {
        log.trace('muting video');

        mediaStreams.forOwn(function (stream) {
            stream.muteVideo();
        });
        that.fire('video:muted');
    });

    /**
     * Unmute video. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.unmuteVideo
     * @fires webrtc.Call#video:unmuted
     */
    var unmuteVideo = that.publicize('unmuteVideo', function () {
        log.trace('unmuting video');

        mediaStreams.forOwn(function (stream) {
            stream.unmuteVideo();
        });
        that.fire('video:unmuted');
    });

    /**
     * Mute audio. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.muteAudio
     * @fires webrtc.Call#audio:muted
     */
    var muteAudio = that.publicize('muteAudio', function () {
        log.trace('muting audio');

        mediaStreams.forOwn(function (stream) {
            stream.muteAudio();
        });
        that.fire('audio:muted');
    });

    /**
     * Unmute audio. TODO: How should this behave?
     * @memberof! webrtc.Call
     * @method webrtc.Call.unmuteAudio
     * @fires webrtc.Call#audio:unmuted
     */
    var unmuteAudio = that.publicize('unmuteAudio', function () {
        log.trace('unmuting audio');

        mediaStreams.forOwn(function (stream) {
            stream.unmuteAudio();
        });
        that.fire('audio:unmuted');
    });

    /**
     * Set receivedBye to true and stop media.
     * @memberof! webrtc.Call
     * @method webrtc.Call.onBye
     * @private
     */
    var onBye = function () {
        receivedBye = true;
        stopMedia();
    };

    signalingChannel.listen('received:offer', onOffer);
    signalingChannel.listen('received:answer', onAnswer);
    signalingChannel.listen('received:candidate', processCandidate);
    signalingChannel.listen('received:bye', onBye);

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
     * @fires webrtc.MediaStream#audio:muted
     */
    var muteAudio = that.publicize('muteAudio', function () {
        stream.audioTracks[0].enabled = false;
        that.fire('audio:muted');
    });

    /**
     * Mute the video on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.muteVideo
     * @fires webrtc.MediaStream#video:muted
     */
    var muteVideo = that.publicize('muteVideo', function () {
        stream.videoTracks[0].enabled = false;
        that.fire('video:muted');
    });

    /**
     * Unmute the audio on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.unmuteAudio
     * @fires webrtc.MediaStream#audio:unmuted
     */
    var unmuteAudio = that.publicize('unmuteAudio', function () {
        stream.audioTracks[0].enabled = true;
        that.fire('audio:unmuted');
    });

    /**
     * Unmute the video on this MediaStream
     * @memberof! webrtc.MediaStream
     * @method webrtc.MediaStream.unmuteVideo
     * @fires webrtc.MediaStream#video:unmuted
     */
    var unmuteVideo = that.publicize('unmuteVideo', function () {
        stream.videoTracks[0].enabled = true;
        that.fire('video:unmuted');
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

    return that;
}; // End webrtc.MediaStream
