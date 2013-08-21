/**
 * Create a new MediaSession.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.MediaSession
 * @constructor
 * @augments webrtc.EventThrower
 * @classdesc WebRTC MediaSession including getContactMedia, path and codec negotation, and
 * call state.
 * @param {object} params Object whose properties will be used to initialize this object and set
 * properties on the class.
 * @returns {webrtc.MediaSession}
 * @property {boolean} initiator Indicate whether this MediaSession belongs to the Endpoint
 * that initiated the WebRTC session.
 * @property {webrtc.MediaStream[]} mediaStreams List of streams currently accessible by the
 * MediaSession. TODO implement
 */
/*global webrtc: false */
webrtc.MediaSession = function (params) {
	"use strict";
	params = params || {};
	var that = webrtc.EventThrower(params);
	that.className = 'webrtc.MediaSession';

	if (!that.initiator) {
		that.initiator = false;
	}

	var pc = null;
	var savedOffer = null;
	var receivedAnswer = false;
	var receivedBye = false;
	var candidateSendingQueue = [];
	var candidateReceivingQueue = [];
	var signalingChannel = mercury.getSignalingChannel();
	var mediaStreams = [];
	var remoteEndpoint = params.remoteEndpoint;
	var signalInitiate = params.signalInitiate;
	var signalAccept = params.signalAccept;
	var signalTerminate = params.signalTerminate;
	var signalReport = params.signalReport;
	var signalCandidate = params.signalCandidate;
	var constraints = {
		'video' : { mandatory: { minWidth: 640, minHeight: 480 } },
		'audio' : true,
		'optional': [],
		'mandatory': {}
	};
	/*var constraints2 = {
		'video' : { mandatory: { maxWidth: 320, maxHeight: 240 } },
		'audio' : false,
		'optional': [],
		'mandatory': {}
	};*/
	var servers = {
		'iceServers' : [
			/* Can only have one server listed here as of yet. */
			//{ 'url': 'stun:stun.l.google.com:19302' },
			{ 'url': 'turn:toto@174.129.201.5:3478', 'credential': 'password'}
		]
	};
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.start
	 */
	var start = that.publicize('start', function () {
		if (!that.username) {
			throw new Error("Can't use a MediaSession without username.");
		}
		report.startCount += 1;
		console.log("calling requestMedia from start.");
		requestMedia();
	});

	/**
	 * Start the process of network and media negotiation. Called by the initiator only.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.startCall
	 */
	var startCall = function () {
		console.log('startCall');
		report.startCallCount += 1;
		console.log('creating offer');
		pc.createOffer(saveOfferAndSend, function (p) {
			console.log('createOffer failed');
			console.log(p);
		}, null);
	};

	/**
	 * Save the local stream. Kick off SDP creation.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onReceiveUserMedia
	 * @private
	 */
	var onReceiveUserMedia = function (stream) {
		console.log('User gave permission to use media.');
		console.log(stream);
		if (!pc === null) {
			console.log("Peer connection is null!");
			return;
		}
		pc.addStream(stream);
		var mediaStream = webrtc.MediaStream({
			'stream': stream,
			'isLocal': true
		});
		that.fire('stream:local:received', mediaStream.getURL());
		mediaStreams.push(mediaStream);
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.requestMedia
	 * @todo Find out when we can stop deleting TURN servers
	 * @private
	 */
	var requestMedia = function () {
		var now = new Date();
		var toDelete = [];
		report.callStarted = now.getTime();
		try {
			pc = new webkitRTCPeerConnection(servers, null);
		} catch (e) {
			/* TURN is not supported, delete them from the array.
			 * TODO: Find out when we can remove this workaround
			 */
			for (var i in servers.iceServers) {
				if (servers.iceServers.hasOwnProperty(i)) {
					if (servers.iceServers[i].url.toLowerCase().indexOf('turn') > -1) {
						toDelete.push(i);
					}
				}
			}
			toDelete.sort(function (a, b) { return b - a; });
			toDelete.each(function (index) {
				servers.iceServers.splice(index);
			});
			pc = new webkitRTCPeerConnection(servers, null);
		}
		pc.onaddstream = onRemoteStreamAdded;
		pc.onremovestream = onRemoteStreamRemoved;
		pc.onicecandidate = onIceCandidate;
		pc.oniceconnectionstatechange = function (p) {
			console.log('oniceconnectionstatechange');
			console.log(p);
		};
		pc.onstatechange = onStateChange;
		pc.onicechange = onIceChange;
		if (savedOffer) {
			processOffer(savedOffer);
			savedOffer = null;
		}
		try {
			navigator.webkitGetUserMedia(constraints, onReceiveUserMedia, onUserMediaError);
			//navigator.webkitGetUserMedia(constraints2, onReceiveUserMedia, onUserMediaError);
		} catch (e) {
			console.log("Couldn't get user media.");
			console.log(e);
		}
	};

	/**
	 * Handle any error that comes up during the process of getting user media.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onUserMediaError
	 * @private
	 */
	var onUserMediaError = function (p) {
		console.log('onUserMediaError');
		if (p.code === 1) {
			console.log("Permission denied.");
			report.callStoppedReason = 'Permission denied.';
		} else {
			console.log(p);
			report.callStoppedReason = p.code;
		}
		stopMedia(!that.initiator);
	};

	/**
	 * Process the initial offer received from the remote side if we are not the initiator.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.acceptCall
	 * @private
	 */
	var acceptCall = function () {
		if (savedOffer) {
			processOffer(savedOffer);
			savedOffer = null;
		} else {
			console.log("Can't process offer--no SDP!");
			stopMedia(true);
		}
	};

	/**
	 * Listen for the remote side to remove media in the middle of the call.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onRemoteStreamRemoved
	 * @private
	 */
	var onRemoteStreamRemoved = function (evt) {
		console.log('pc event: remote stream removed');
	};

	/**
	 * Listen for the remote side to add additional media in the middle of the call.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onRemoteStreamAdded
	 * @private
	 */
	var onRemoteStreamAdded = function (evt) {
		console.log('received remote media');
		var mediaStream = webrtc.MediaStream({
			'stream': evt.stream,
			'isLocal': false
		});
		that.fire('stream:remote:received', mediaStream.getURL());
		mediaStreams.push(mediaStream);
	};

	/**
	 * Listen for RTCPeerConnection state change.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onStateChange
	 * @private
	 */
	var onStateChange = function (p, a) {
		console.log('iceState is ' + p.currentTarget.iceState);
		console.log('readyState is ' + p.currentTarget.readyState);
	};

	/**
	 * Listen for ICE change.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onIceChange
	 * @private
	 */
	var onIceChange = function (p) {
		console.log('pc event: ice changed');
		console.log(p);
	};

	/**
	 * Process a local ICE Candidate
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onIceCandidate
	 * @private
	 */
	var onIceCandidate = function (oCan) {
		if (oCan.candidate === null) {
			return;
		}
		//console.log("original browser-generated candidate object");
		//console.log(oCan.candidate);
		if (that.initiator && !receivedAnswer) {
			candidateSendingQueue.push(oCan.candidate);
		} else if (!that.initiator) {
			report.candidatesSent.push(oCan.candidate);
			signalCandidate(oCan.candidate);
		}
	};

	/**
	 * Process any ICE candidates that we received either from the browser or the other side while
	 * we were trying to set up our RTCPeerConnection to handle them.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.processQueues
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
			console.log("Calling processCandidate in processQueues");
			console.log(can);
			processCandidate(can);
		}
		candidateReceivingQueue = [];
	};

	/**
	 * Save an SDP we've gotten from the browser which will be an offer and send it to the other
	 * side.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.saveOfferAndSend
	 * @param {RTCSessionDescription} oSession
	 * @private
	 */
	var saveOfferAndSend = function (oSession) {
		oSession.type = 'offer';
		console.log('setting and sending initiate');
		console.log(oSession);
		report.sdpsSent.push(oSession);
		pc.setLocalDescription(oSession, function (p) {
			signalInitiate(oSession);
		}, function (p) {
			console.log('setLocalDescription failed');
			console.log(p);
		});
	};

	/**
	 * Save our SDP we've gotten from the browser which will be an answer and send it to the
	 * other side.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.saveAnswerAndSend
	 * @param {RTCSessionDescription} oSession
	 * @private
	 */
	var saveAnswerAndSend = function (oSession) {
		oSession.type = 'answer';
		console.log('setting and sending accept');
		console.log(oSession);
		report.sdpsSent.push(oSession);
		pc.setLocalDescription(oSession, function (p) {
			signalAccept(oSession);
		}, function (p) {
			console.log('setLocalDescription failed');
			console.log(p);
		});
	};

	/**
	 * Handle shutting the session down if the other side hangs up.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onRemoteHangup
	 * @private
	 */
	var onRemoteHangup = function () {
		if (pc && pc.readyState !== 'active') {
			report.callStoppedReason = report.byeReasonReceived ||
				'Remote side did not confirm media.';
		} else {
			report.callStoppedReason = 'Remote side hung up.';
		}
		console.log('Callee busy or or call rejected:' + report.callStoppedReason);
		stopMedia(false);
	};

	/**
	 * Tear down the call, release user media.  Send a bye signal to the remote party if
	 * sendSignal is not false and we have not received a bye signal from the remote party.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.stopMedia
	 * @param {boolean} sendSignal Optional flag to indicate whether to send or suppress sending
	 * a hangup signal to the remote side.
	 * @todo TODO: Make it so the dev doesn't have to know when to send a bye.
	 */
	var stopMedia = that.publicize('stopMedia', function (sendSignal) {
		if (pc === null) {
			return;
		}
		console.log('hanging up');

		sendSignal = (typeof sendSignal === 'boolean' ? sendSignal : true);
		if (!receivedBye && sendSignal) {
			console.log('sending bye');
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.processOffer
	 * @param {RTCSessionDescription} oSession The remote SDP.
	 * @private
	 */
	var processOffer = function (oSession) {
		oSession.type = 'offer';
		console.log('processOffer');
		console.log(oSession);
		try {
			pc.setRemoteDescription(new RTCSessionDescription(oSession), function () {
				console.log('set remote desc of offer succeeded');
				pc.createAnswer(saveAnswerAndSend, function (p) {
					console.log("Error creating SDP answer.");
					report.callStoppedReason = 'Error creating SDP answer.';
					console.log(p);
				});
				that.savedOffer = null;
			}, function (p) {
				console.log('set remote desc of offer failed');
				report.callStoppedReason = 'setLocalDescr failed at offer.';
				console.log(oSession);
				console.log(p);
				that.stopMedia();
			});
		} catch (e) { console.log("e: " + e.message); }
	};

	/**
	 * Indicate whether a call is being setup or is in progress.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.isActive
	 * @param {RTCSessionDescription} oSession The remote SDP.
	 * @returns {boolean}
	 */
	var isActive = that.publicize('isActive', function () {
		var inProgress = false;
		if (!pc || receivedBye === true) {
			return false;
		}
		inProgress = pc.readyState in ['new', 'active'];
		console.log('readyState is ' + pc.readyState + '. Call is ' +
			(inProgress ? '' : 'not ') + ' in progress.');
		return inProgress;
	});

	/**
	 * Save the offer so we can tell the browser about it after the PeerConnection is ready.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onOffer
	 * @param {RTCSessionDescription} oSession The remote SDP.
	 * @private
	 */
	var onOffer = function (oSession) {
		console.log('got offer');
		console.log(oSession);
		savedOffer = oSession;
		if (!that.initiator) {
			report.sdpsReceived.push(oSession);
			report.lastSDPString = oSession.sdp;
		} else {
			console.log('Got initiate in precall state.');
			console.log(pc);
			signalTerminate();
		}
	};

	/**
	 * Save the answer and tell the browser about it.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onAnswer
	 * @param {RTCSessionDescription} oSession The remote SDP.
	 * @private
	 */
	var onAnswer = function (oSession) {
		console.log('remote side sdp is');
		console.log(oSession);
		savedOffer = oSession;
		receivedAnswer = true;
		report.sdpsReceived.push(oSession);
		report.lastSDPString = oSession.sdp;
		pc.setRemoteDescription(new RTCSessionDescription(oSession), processQueues, function (p) {
			console.log('set remote desc of answer failed');
			report.callStoppedReason = 'setRemoteDescription failed at answer.';
			console.log(oSession);
			that.stopMedia();
		});
	};

	/**
	 * Save the candidate. If we initiated the call, place the candidate into the queue so
	 * we can process them after we receive the answer.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.processCandidate
	 * @param {RTCIceCandidate} oSession The remote SDP.
	 * @private
	 */
	var processCandidate = function (oCan) {
		if (!oCan || oCan.candidate === null) {
			return;
		}
		if (!oCan.hasOwnProperty('sdpMLineIndex') || !oCan.candidate) {
			console.log("processCandidate got wrong format!");
			console.log(oCan);
		}
		if (that.initiator && !receivedAnswer) {
			candidateReceivingQueue.push(oCan);
			console.log('adding to queue');
			return;
		}
		try {
			pc.addIceCandidate(new RTCIceCandidate(oCan));
		} catch (e) {
			console.log('err in processCandidate: ' + e.message);
			console.log(oCan);
		}
		report.candidatesReceived.push(oCan);
	};

	/**
	 * Get the state of the MediaSession
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.getState
	 * @returns {string}
	 */
	var getState = that.publicize('getState', function () {
		return pc ? pc.readyState : "before";
	});

	/**
	 * Indicate whether the logged-in User initated the MediaSession.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.isInitiator
	 * @returns {boolean}
	 */
	var isInitiator = that.publicize('isInitiator', function () {
		return that.initiator;
	});

	/**
	 * Return all MediaStreams
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.getStreams
	 * @returns {webrtc.MediaStream[]}
	 */
	var getStreams = that.publicize('getStreams', function () {
		return mediaStreams;
	});

	/**
	 * Return all local MediaStreams
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.getLocalStreams
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.getRemoteStreams
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.toggleVideo
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.toggleAudio
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
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.muteVideo
	 * @fires webrtc.MediaSession#video:muted
	 */
	var muteVideo = that.publicize('muteVideo', function () {
		mediaStreams.forOwn(function (stream) {
			stream.muteVideo();
		});
		that.fire('video:muted');
	});

	/**
	 * Unmute video. TODO: How should this behave?
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.unmuteVideo
	 * @fires webrtc.MediaSession#video:unmuted
	 */
	var unmuteVideo = that.publicize('unmuteVideo', function () {
		mediaStreams.forOwn(function (stream) {
			stream.unmuteVideo();
		});
		that.fire('video:unmuted');
	});

	/**
	 * Mute audio. TODO: How should this behave?
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.muteAudio
	 * @fires webrtc.MediaSession#audio:muted
	 */
	var muteAudio = that.publicize('muteAudio', function () {
		mediaStreams.forOwn(function (stream) {
			stream.muteAudio();
		});
		that.fire('audio:muted');
	});

	/**
	 * Unmute audio. TODO: How should this behave?
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.unmuteAudio
	 * @fires webrtc.MediaSession#audio:unmuted
	 */
	var unmuteAudio = that.publicize('unmuteAudio', function () {
		mediaStreams.forOwn(function (stream) {
			stream.unmuteAudio();
		});
		that.fire('audio:unmuted');
	});

	/**
	 * Set receivedBye to true and stop media.
	 * @memberof! webrtc.MediaSession
	 * @method webrtc.MediaSession.onBye
	 * @private
	 */
	var onBye = function () {
		receivedBye = true;
		stopMedia();
	}
	signalingChannel.listen('received:offer', onOffer);
	signalingChannel.listen('received:answer', onAnswer);
	signalingChannel.listen('received:candidate', processCandidate);
	signalingChannel.listen('received:bye', onBye);

	return that;
}; // End webrtc.MediaSession

/**
 * Create a new MediaStream.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class webrtc.MediaStream
 * @constructor
 * @augments webrtc.EventThrower
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
	var that = webrtc.EventThrower(params);
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
		return webkitURL.createObjectURL(stream);
	});

	return that;
}; // End webrtc.MediaStream
