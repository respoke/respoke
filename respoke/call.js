/*
 * Copyright 2015, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

var Q = require('q');
var respoke = require('./respoke');
var log = respoke.log;

/**
 * A `respoke.Call` is Respoke's interface into a WebRTC call, including getUserMedia,
 * path and codec negotation, and call state.
 * There are several methods on an instance of `respoke.Client` which return a `respoke.Call`.
 *
 * ```
 * var jim = client.getEndpoint({ id: 'jim' });
 * var call = jim.startAudioCall();
 * ```
 *
 * @class respoke.Call
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.instanceId - client id
 * @param {boolean} params.caller - whether or not we initiated the call
 * @param {boolean} [params.receiveOnly] - whether or not we accept media
 * @param {boolean} [params.sendOnly] - whether or not we send media
 * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
 * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
 * relay servers. If it cannot flow through relay servers, the call will fail.
 * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
 * required to flow peer-to-peer. If it cannot, the call will fail.
 * @param {respoke.Endpoint} params.remoteEndpoint - The endpoint who is being called.
 * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint.
 * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
 * wants to perform an action between local media becoming available and calling approve().
 * @param {function} params.signalOffer - Signaling action from SignalingChannel.
 * @param {function} params.signalConnected - Signaling action from SignalingChannel.
 * @param {function} params.signalAnswer - Signaling action from SignalingChannel.
 * @param {function} params.signalHangup - Signaling action from SignalingChannel.
 * @param {function} params.signalReport - Signaling action from SignalingChannel.
 * @param {function} params.signalCandidate - Signaling action from SignalingChannel.
 * @param {Array<RTCConstraints>} params.constraints - Array of WebRTC constraints. This is ignored when
 * `params.outgoingMedia` is passed into the Call object.
 * @param {respoke.Call.onError} [params.onError] - Callback for errors that happen during call setup or
 * media renegotiation.
 * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
 * element with the local audio and/or video attached.
 * @param {respoke.Call.onConnect} [params.onConnect] - Callback for the remote video element.
 * @param {respoke.Call.onHangup} [params.onHangup] - Callback for when the call is ended, whether or not
 * it was ended in a graceful manner.
 * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
 * This callback will be called when media is muted or unmuted.
 * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
 * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
 * for the user to give permission to start getting audio or video.
 * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
 * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
 * the approval was automatic.
 * @param {respoke.Call.onAllow} [params.onAllow] - Callback for when the browser gives us access to the
 * user's media.  This event gets called even if the allow process is automatic, i. e., permission and media is
 * granted by the browser without asking the user to approve it.
 * @param {respoke.Call.onToneSent} [params.onToneSent] - Callback for when a DTMF tone gets sent from the client.
 * @param {respoke.Call.onToneSendingStarted} [params.onToneSendingStarted] - Callback for when DTMF tones
 * have started sending.
 * @param {HTMLVideoElement} params.videoLocalElement - Pass in an optional html video element to have local
 * video attached to it.
 * @param {HTMLVideoElement} params.videoRemoteElement - Pass in an optional html video element to have remote
 * @param {respoke.LocalMedia} params.outgoingMedia - Pass in an optional LocalMedia object to override the one that is
 * built automatically when establishing the call. When this is defined then any constraints passed to the
 * call are ignored since the media object already exists.
 * video attached to it.
 * @returns {respoke.Call}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Call
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    delete that.outgoingMedia;

    /**
     * A name to identify the type of object.
     * @memberof! respoke.Call
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Call';

    /**
     * Whether or not the client is the caller of the call.
     * @memberof! respoke.Call
     * @name caller
     * @type {boolean}
     */
    that.caller = !!that.caller;
    Object.defineProperty(that, "initiator", {
        configurable: true,
        enumerable: true,
        get: function () {
            log.warn("The call.initiator flag is deprecated. Please use call.caller instead.");
            return that.caller;
        },
        set: function () {
            // ignore
        }
    });

    if (!that.caller) {
        // Don't let Respoke.js pass any default constraints if we're accepting the call. We have no freaking clue
        // what kind of media we are expected to provide at this point.
        delete params.constraints;
        that.constraints = [];
    }

    /**
     * The call ID.
     * @memberof! respoke.Call
     * @name id
     * @type {string}
     */
    that.id = that.caller ? respoke.makeGUID() : that.id;

    // log the call id to the console for debugging purposes. Do not change this to `respoke.log`!
    console.log("[Respoke] Creating call. id='" + that.id + "'");

    if (!that.id) {
        throw new Error("Can't start a new call without a call id.");
    }

    /**
     * Promise used to trigger actions dependant upon having received media or a datachannel.
     * @memberof! respoke.Call
     * @name defMedia
     * @private
     * @type {Promise}
     */
    var defMedia = Q.defer();
    /**
     * Promise used to trigger notification of a request for renegotiating media. For the caller of the
     * renegotiation (which doesn't have to be the same as the caller of the call), this is resolved
     * or rejected as soon as the 'accept' or 'reject' signal is received. For the callee, it is
     * resolved or rejected only after the developer or user approves or rejects the modify.
     * @memberof! respoke.Call
     * @name defModify
     * @private
     * @type {Promise}
     */
    var defModify;
    /**
     * @memberof! respoke.Call
     * @name previewLocalMedia
     * @private
     * @type {respoke.Call.previewLocalMedia}
     */
    var previewLocalMedia = params.previewLocalMedia;
    /**
     * @memberof! respoke.Call
     * @name client
     * @private
     * @type {respoke.getClient}
     */
    var client = respoke.getClient(instanceId);
    /**
     * @memberof! respoke.Call
     * @name signalingChannel
     * @private
     * @type {respoke.signalingChannel}
     */
    var signalingChannel = params.signalingChannel;

    /**
     * Informational property. Whether call debugs were enabled on the client during creation.
     * Changing this value will do nothing.
     * @name enableCallDebugReport
     * @type {boolean}
     */
    that.enableCallDebugReport = params.signalingChannel.isSendingReport();

    /**
     * Informational property indicating if this call has fired the public 'connect' event
     * inside receiveRemoteMedia.
     * @name hasReceivedRemoteMedia
     * @type {boolean}
     * @private
     */
    var hasReceivedRemoteMedia = false;

    /**
     * @memberof! respoke.Call
     * @name pc
     * @private
     * @type {respoke.PeerConnection}
     */
    var pc = respoke.PeerConnection({
        instanceId: instanceId,
        state: respoke.CallState({
            instanceId: instanceId,
            caller: that.caller,
            needDirectConnection: params.needDirectConnection,
            sendOnly: params.sendOnly,
            receiveOnly: params.receiveOnly,
            // hasMedia is not defined yet.
            hasMedia: function () {
                return that.hasMedia();
            }
        }),
        forceTurn: !!params.forceTurn,
        call: that,
        pcOptions: {
            optional: [
                { DtlsSrtpKeyAgreement: true },
                { RtpDataChannels: false }
            ]
        },
        offerOptions: params.offerOptions || null,
        signalOffer: function (args) {
            if (!pc) {
                return;
            }

            params.signalOffer(args);
            pc.state.dispatch('sentOffer');
        },
        signalConnected: params.signalConnected,
        signalAnswer: params.signalAnswer,
        signalModify: params.signalModify,
        signalHangup: params.signalHangup,
        signalReport: params.signalReport,
        signalCandidate: params.signalCandidate
    });

    /**
     * Array of streams of local media that we are sending to the remote party.
     * @name outgoingMediaStreams
     * @type {Array<respoke.LocalMedia>}
     */
    that.outgoingMediaStreams = [];
    that.outgoingMediaStreams.hasAudio = function () {
        if (that.outgoingMediaStreams.length === 0) {
            return false;
        }

        return !that.outgoingMediaStreams.every(function (stream) {
            return stream.getAudioTracks().length === 0;
        });
    };

    that.outgoingMediaStreams.hasVideo = function () {
        if (that.outgoingMediaStreams.length === 0) {
            return false;
        }

        return !that.outgoingMediaStreams.every(function (stream) {
            return stream.getVideoTracks().length === 0;
        });
    };

    if (params.outgoingMedia) {
        that.outgoingMediaStreams.push(params.outgoingMedia);
    }

    /**
     * Local media that we are sending to the remote party. This will be undefined if we are sending no media.
     * This property is just the first item in the `outgoingMediaStreams` array. If multiple streams are present,
     * use that array to find the stream you need instead of relying on this property.
     * @name outgoingMedia
     * @type {respoke.LocalMedia}
     */
    Object.defineProperty(that, "outgoingMedia", {
        configurable: false,
        enumerable: true,
        get: function () {
            return that.outgoingMediaStreams[0];
        },
        set: function () {
            // ignore
        }
    });

    /**
     * Array of streams of remote media that we are receiving from the remote party.
     * @name incomingMediaStreams
     * @type {Array<respoke.RemoteMedia>}
     */
    that.incomingMediaStreams = [];
    that.incomingMediaStreams.hasAudio = function () {
        if (that.incomingMediaStreams.length === 0) {
            return false;
        }

        return !that.incomingMediaStreams.every(function (stream) {
            return stream.getAudioTracks().length === 0;
        });
    };

    that.incomingMediaStreams.hasVideo = function () {
        if (that.incomingMediaStreams.length === 0) {
            return false;
        }

        return !that.incomingMediaStreams.every(function (stream) {
            return stream.getVideoTracks().length === 0;
        });
    };

    /**
     * Remote media that we are receiving from the remote party.  This will be undefined if we
     * are receiving no media. This property is just the first item in the `incomingMediaStreams` array. If multiple
     * streams are present, use that array to find the stream you need instead of relying on this property.
     * @name incomingMedia
     * @type {respoke.RemoteMedia}
     */
    Object.defineProperty(that, "incomingMedia", {
        configurable: false,
        enumerable: true,
        get: function () {
            return that.incomingMediaStreams[0];
        },
        set: function () {
            // ignore
        }
    });

    /**
     * A flag indicating whether this call has audio or is expected to have audio coming in from the other side.
     *
     * @name hasAudio
     * @type {boolean}
     */
    Object.defineProperty(that, "hasAudio", {
        configurable: false,
        enumerable: true,
        get: that.incomingMediaStreams.hasAudio,
        set: function () {
            // ignore
        }
    });

    /**
     * A flag indicating whether this call has video or is expected to have video coming in from the other side.
     *
     * @name hasVideo
     * @type {boolean}
     */
    Object.defineProperty(that, "hasVideo", {
        configurable: false,
        enumerable: true,
        get: that.incomingMediaStreams.hasVideo,
        set: function () {
            // ignore
        }
    });

    delete params.signalingChannel;
    delete that.signalingChannel;

    /**
     * @memberof! respoke.Call
     * @name videoIsMuted
     * @private
     * @type {boolean}
     */
    var videoIsMuted = false;
    /**
     * @memberof! respoke.Call
     * @name audioIsMuted
     * @private
     * @type {boolean}
     */
    var audioIsMuted = false;
    /**
     * @memberof! respoke.Call
     * @name directConnection
     * @private
     * @type {respoke.DirectConnection}
     */
    var directConnection = null;

    /**
     * Register any event listeners passed in as callbacks, save other params to answer() and accept().
     * @memberof! respoke.Call
     * @method respoke.Call.saveParameters
     * @param {object} params
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {respoke.Call.onRemoteMedia} [params.onRemoteMedia] - Callback called every time a remote
     * stream is added to the call. Corresponds to 'remote-stream-received' event.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for the remote video element.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for when the call is ended, whether or not
     * it was ended in a graceful manner.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will fire even if
     * the approval was automatic.
     * @param {respoke.Call.onAllow} [params.onAllow] - Callback for when the browser gives us access to the
     * user's media.  This event gets fired even if the allow process is automatic, i. e., permission and media is
     * granted by the browser without asking the user to approve it.
     * @param {respoke.Call.onToneSent} [params.onToneSent] - Callback for when a DTMF tone gets sent from the client.
     * @param {Array<RTCConstraints>} [params.constraints]
     * @param {boolean} [params.forceTurn]
     * @param {boolean} [params.receiveOnly]
     * @param {boolean} [params.sendOnly]
     * @param {boolean} [params.needDirectConnection] - flag to enable skipping media & opening direct connection.
     * @param {HTMLVideoElement} params.videoLocalElement - Pass in an optional html video element to have local
     * video attached to it.
     * @param {HTMLVideoElement} params.videoRemoteElement - Pass in an optional html video element to have remote
     * video attached to it.
     * @private
     * @fires respoke.Call#stats
     */
    function saveParameters(params) {
        if (!pc) {
            /* This happens when the call is hung up automatically, for instance due to the lack of an onCall
             * handler. In this case, pc has been set to null in hangup. The call has already failed, and the
             * invocation of this function is an artifact of async code not being finished yet, so we can just
             * skip all of this setup.
             */
            return;
        }

        that.listen('local-stream-received', params.onLocalMedia);
        that.listen('remote-stream-received', params.onRemoteMedia);
        that.listen('connect', params.onConnect);
        that.listen('hangup', params.onHangup);
        that.listen('allow', params.onAllow);
        that.listen('answer', params.onAnswer);
        that.listen('approve', params.onApprove);
        that.listen('mute', params.onMute);
        that.listen('requesting-media', params.onRequestingMedia);
        that.listen('tone-sent', params.onToneSent);
        that.listen('tone-sending-started', params.onToneSendingStarted);
        that.listen('tone-sending-cancelled', params.onToneSendingCancelled);

        previewLocalMedia = typeof params.previewLocalMedia === 'function' ?
            params.previewLocalMedia : previewLocalMedia;

        pc.state.receiveOnly = typeof params.receiveOnly === 'boolean' ? params.receiveOnly : pc.state.receiveOnly;
        pc.state.sendOnly = typeof params.sendOnly === 'boolean' ? params.sendOnly : pc.state.sendOnly;
        pc.state.needDirectConnection = typeof params.needDirectConnection === 'boolean' ?
            params.needDirectConnection : pc.state.needDirectConnection;
        pc.disableTurn = typeof params.disableTurn === 'boolean' ? params.disableTurn : !!pc.disableTurn;
        pc.forceTurn = typeof params.forceTurn === 'boolean' ? params.forceTurn : !!pc.forceTurn;

        that.videoLocalElement = params.videoLocalElement ? params.videoLocalElement : that.videoLocalElement;
        that.videoRemoteElement = params.videoRemoteElement ? params.videoRemoteElement : that.videoRemoteElement;

        if (pc.state.receiveOnly) {
            that.outgoingMediaStreams.length = 0;
            that.constraints = [];
        } else if (params.constraints) {
            that.constraints = respoke.convertConstraints(params.constraints);
            updateOutgoingMediaEstimate({constraints: that.constraints[0], source: params.source});
        }

        if (pc.state.sendOnly) {
            that.incomingMediaStreams.length = 0;
        } else if (params.constraints && pc.state.caller === true && that.incomingMediaStreams.length === 0) {
            // TODO above condition is not good enough for media renegotiation.
            // Only the person who initiated this round of media negotiation needs to estimate remote
            // media based on what constraints local media is using.
            // Also don't try to guess what media they'll send back if we're sending more than one stream.
            that.constraints = respoke.convertConstraints(params.constraints);
            updateIncomingMediaEstimate({constraints: params.constraints[0]});
        }

        pc.listen('stats', function fireStats(evt) {
            /**
             * This event is fired every time statistical information about audio and/or video on a call
             * becomes available.
             * @event respoke.Call#stats
             * @type {respoke.Event}
             * @property {respoke.MediaStats} stats - an object with stats in it.
             * @property {respoke.Call} target
             * @property {string} name - the event name.
             */
            that.fire('stats', {stats: evt.stats});
        }, true);

        delete that.signalOffer;
        delete that.signalConnected;
        delete that.signalAnswer;
        delete that.signalHangup;
        delete that.signalReport;
        delete that.signalCandidate;
    }

    /**
     * Build respoke.LocalMedia after the call is answered.
     * @memberof! respoke.Call
     * @method respoke.Call.buildLocalMedia
     * @param {RTCConstraint} constraint
     * @private
     */
    function buildLocalMedia(constraint) {
        var localMedia;

        if (pc.state.receiveOnly) {
            return Q.reject(new Error("Shouldn't have requested local media when receiveOnly is true."));
        }

        if (constraint.className === 'respoke.LocalMedia') {
            localMedia = constraint;
        } else {
            localMedia = respoke.LocalMedia({
                hasScreenShare: respoke.constraintsHasScreenShare(constraint),
                constraints: constraint,
                source: params.source
            });
            that.outgoingMediaStreams.push(localMedia);
        }

        // use passed video element if localMedia constraints contain video
        if (respoke.constraintsHasVideo(localMedia.constraints)) {
            localMedia.element = that.videoLocalElement;
        }

        localMedia.listen('requesting-media', function waitAllowHandler(evt) {
            if (!pc) {
                return;
            }

            /**
             * The browser is asking for permission to access the User's media. This would be an ideal time
             * to modify the UI of the application so that the user notices the request for permissions
             * and approves it.
             * @event respoke.Call#requesting-media
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.Call} target
             */
            that.fire('requesting-media');
        }, true);

        localMedia.listen('allow', function allowHandler(evt) {
            if (!pc) {
                return;
            }

            /**
             * The user has approved the request for media. Any UI changes made to remind the user to click Allow
             * should be canceled now. This event is the same as the `onAllow` callback.  This event gets fired
             * even if the allow process is automatic, i. e., permission and media is granted by the browser
             * without asking the user to approve it.
             * @event respoke.Call#allow
             * @type {respoke.Event}
             * @property {string} name - the event name.
             * @property {respoke.Call} target
             */
            that.fire('allow');
            pc.state.dispatch('approve', {
                previewLocalMedia: previewLocalMedia
            });
        }, true);

        return localMedia.start().then(function () {
            streamReceivedHandler(localMedia);
        });
    }
    /**
     *
     * optionally inspect or manipulate the remoteSDP before 
     * it is applied
     * @memberof! respoke.Call
     * @method respoke.Call.remoteSDP
     * @param {SessionDescription} remoteSession
     * @public
     * @returns SessionDescription
     */
    that.remoteSDP = function(remoteSession){
	return remoteSession;
    };


    /**
     * Answer the call and start the process of obtaining media. This method is called automatically on the caller's
     * side. This method must be called on the callee's side to indicate that the endpoint does wish to accept the
     * call. The app will have a later opportunity, by passing a callback named previewLocalMedia, to approve or
     * reject the call based on whether audio and/or video is working and is working at an acceptable level.
     *
     *     client.listen('call', function (evt) {
     *         if (!evt.call.caller) {
     *             evt.call.answer();
     *         }
     *     });
     *
     * @memberof! respoke.Call
     * @method respoke.Call.answer
     * @fires respoke.Call#answer
     * @param {object} [params]
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached. Corresponds to 'local-stream-received' event.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback indicating that the call is connected.
     * This is fired once. Corresponds to 'connect' event.
     * @param {respoke.Call.onRemoteMedia} [params.onRemoteMedia] - Callback called every time a remote
     * stream is added to the call. Corresponds to 'remote-stream-received' event.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for when the call is ended, whether or not
     * it was ended in a graceful manner. Corresponds to 'hangup' event.
     * @param {respoke.Call.onMute} [params.onMute] - Callback for changing the mute state on any type of media.
     * This callback will be called when media is muted or unmuted.
     * @param {respoke.Call.onAnswer} [params.onAnswer] - Callback for when the callee answers the call.
     * @param {respoke.Call.onRequestingMedia} [params.onRequestingMedia] - Callback for when the app is waiting
     * for the user to give permission to start getting audio or video.
     * @param {respoke.Call.onApprove} [params.onApprove] - Callback for when the user approves local media. This
     * callback will be called whether or not the approval was based on user feedback. I. e., it will be called even if
     * the approval was automatic.
     * @param {respoke.Call.onAllow} [params.onAllow] - Callback for when the browser gives us access to the
     * user's media.  This event gets called even if the allow process is automatic, i. e., permission and media is
     * granted by the browser without asking the user to approve it.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {boolean} [params.receiveOnly] - Whether or not we accept media.
     * @param {boolean} [params.sendOnly] - Whether or not we send media.
     * @param {Array<RTCConstraints>} [params.constraints] - Pass in media constraints to specialize
     * the media requested from the user.
     * @param {HTMLVideoElement} [params.videoLocalElement] - Pass in an html video element to have local
     * video attached to it, instead of having a video element created.
     * @param {HTMLVideoElement} [params.videoRemoteElement] - Pass in an html video element to have remote
     * video attached to it, instead of having a video element created.
     */
    that.answer = function (params) {
        log.debug('Call.answer', params);
        params = params || {};

        saveParameters(params);

        pc.listen('stream-added', onRemoteStreamAdded, true);
        pc.listen('stream-removed', onRemoteStreamRemoved, true);

        pc.state.dispatch('answer', {
            previewLocalMedia: previewLocalMedia,
            approve: that.approve
        });

        /**
         * The call was answered.
         * @event respoke.Call#answer
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        that.fire('answer');
    };

    /**
     * Accept a request to modify the media on the call. This method should be called within the Call#modify
     * event listener, which gives the developer or website user a chance to see what changes are proposed and
     * to accept or reject them.
     *
     *     call.listen('modify', function (evt) {
     *         evt.call.accept();
     *     });
     *
     * @memberof! respoke.Call
     * @method respoke.Call.accept
     * @fires respoke.Call#accept
     * @private
     * @param {object} [params]
     * @param {respoke.Call.previewLocalMedia} [params.previewLocalMedia] - A function to call if the developer
     * wants to perform an action between local media becoming available and calling approve().
     * @param {respoke.Call.onLocalMedia} [params.onLocalMedia] - Callback for receiving an HTML5 Video
     * element with the local audio and/or video attached.
     * @param {respoke.Call.onConnect} [params.onConnect] - Callback for the developer to receive the
     * remote video element.
     * @param {respoke.Call.onHangup} [params.onHangup] - Callback for the developer to be notified about hangup.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {boolean} [params.receiveOnly] - Whether or not we accept media.
     * @param {boolean} [params.sendOnly] - Whether or not we send media.
     * @param {Array<RTCConstraints>} [params.constraints] - Information about the media for this call.
     */
    that.accept = that.answer;

    /**
     * Start the process of network and media negotiation. If the app passes in a callback named previewLocalMedia
     * in order to allow the logged-in person a chance to base their decision to continue the call on whether
     * audio and/or video is working correctly,
     * this method must be called on both sides in order to begin the call. If call.approve() is called, the call
     * will progress as expected. If call.reject() is called, the call will be aborted.
     *
     *     call.listen('local-stream-received', function (evt) {
     *         if (userLikesVideo()) {
     *             evt.call.approve();
     *         }
     *     });
     *
     * @memberof! respoke.Call
     * @method respoke.Call.approve
     * @fires respoke.Call#approve
     */
    that.approve = function () {
        log.debug('Call.approve');
        /**
         * Fired when the local media access is approved.
         * @event respoke.Call#approve
         * @type {respoke.Event}
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        that.fire('approve');
        pc.state.dispatch('approve', {
            previewLocalMedia: previewLocalMedia
        });

        if (defModify && defModify.promise.isPending()) {
            defModify.resolve(true);
            defModify = undefined;
        }
    };

    /**
     * Listen for the remote side to remove media in the middle of the call.
     * @memberof! respoke.Call
     * @method respoke.Call.onRemoteStreamRemoved
     * @private
     * @param {object}
     */
    function onRemoteStreamRemoved(evt) {
        log.debug('pc event: remote stream removed');
        pc.state.dispatch('removeRemoteMedia');
    }

    /**
     * Listen for the remote side to add additional media in the middle of the call.
     * @memberof! respoke.Call
     * @method respoke.Call.onRemoteStreamAdded
     * @private
     * @param {object}
     * @fires respoke.Call#connect
     */
    function onRemoteStreamAdded(evt) {
        var hasAudio = false;
        var hasVideo = false;
        var hasScreenShare = false;
        var remoteMedia;

        if (!pc) {
            return;
        }
        log.debug('received remote media', evt);

        // This is the first remote media we have received. The one we currently have is a guess. Rip it
        // out and replace it with reality.
        if (that.incomingMediaStreams.length === 1 && that.incomingMediaStreams[0].temporary === true) {
            // have to do it this way because assigning a blank array to that.incomingMediaStreams will
            // clobber the methods like hasAudio that we have added to the array.
            that.incomingMediaStreams.length = 0;
        }
        if (that.incomingMediaStreams.length) {
            while (that.incomingMediaStreams.length) {
                log.debug('onRemoteStreamAdded removing incoming stream', that.incomingMediaStreams[0]);
                that.incomingMediaStreams.shift().stop();
            }
        }
        hasAudio = evt.stream.getAudioTracks().length > 0;
        hasVideo = evt.stream.getVideoTracks().length > 0;
        // TODO this is not good enough long term.
        hasScreenShare = hasVideo && that.target === 'screenshare';

        remoteMedia = respoke.RemoteMedia({
            element: that.videoRemoteElement,
            stream: evt.stream,
            hasScreenShare: hasScreenShare,
            constraints: {
                audio: hasAudio,
                video: hasVideo
            }
        });
        that.incomingMediaStreams.push(remoteMedia);

        pc.state.dispatch('receiveRemoteMedia');

        if (!hasReceivedRemoteMedia) {
            hasReceivedRemoteMedia = true;
            /**
             * Indicates that either remote media stream has been added to the call or if no
             * media is expected, the other side is receiving our media. This will fire once,
             * when the remote media becomes available.
             * @event respoke.Call#connect
             * @type {respoke.Event}
             * @property {Element} element - The HTML5 Video element with the remote stream attached.
             * @property {respoke.RemoteMedia} stream - The incomingMedia property on the call.
             * @property {string} name - The event name.
             * @property {respoke.Call} target
             */
            that.fire('connect', {
                stream: remoteMedia.stream,
                element: remoteMedia.element
            });
        }

        /**
         * Fires every time a new remote media stream is added to the call.
         * @event respoke.Call#onRemoteMedia
         * @type {respoke.Event}
         * @property {Element} element - The HTML5 Video element with the remote stream attached.
         * @property {respoke.RemoteMedia} stream - The incomingMedia property on the call.
         * @property {string} name - The event name.
         * @property {respoke.Call} target
         */
        that.fire('remote-stream-received', {
            stream: remoteMedia.stream,
            element: remoteMedia.element
        });
    }

    /**
     * ## The plugin `respoke.MediaStats` must be loaded before using this method.
     *
     * Start the process of listening for a continuous stream of statistics about the flow of audio and/or video.
     * Since we have to wait for both the answer and offer to be available before starting
     * statistics, the library returns a promise for the stats object. The statistics object does not contain the
     * statistics; rather it contains methods of interacting with the actions of obtaining statistics. To obtain
     * the actual statistics one time, use stats.getStats(); use the onStats callback to obtain a continuous
     * stream of statistics every `interval` seconds.  Returns null if stats module is not loaded.
     *
     *     call.getStats({
     *         onStats: function (evt) {
     *             console.log('Stats', evt.stats);
     *         }
     *     }).done(function () {
     *         console.log('Stats started');
     *     }, function (err) {
     *         console.log('Call is already hung up.');
     *     });
     *
     * @memberof! respoke.Call
     * @method respoke.Call.getStats
     * @param {object} params
     * @param {number} [params.interval=5000] - How often in milliseconds to fetch statistics.
     * @param {respoke.MediaStatsParser.statsHandler} [params.onStats] - An optional callback to receive
     * the stats. If no callback is provided, the call's report will contain stats but the developer will not
     * receive them on the client-side.
     * @param {respoke.Call.statsSuccessHandler} [params.onSuccess] - Success handler for this invocation of
     * this method only.
     * @param {respoke.Call.errorHandler} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise<object>|null}
     */
    function getStats(params) {
        if (pc && pc.getStats) {
            that.listen('stats', params.onStats);
            return pc.getStats(params);
        }
        return null;
    }
    if (respoke.MediaStats) {
        that.getStats = getStats;
    }

    /**
     * Return local video element with the logged-in endpoint's audio and/or video streams attached to it.
     *
     *     var el = call.getLocalElement();
     *     container.append(el);
     *
     * @memberof! respoke.Call
     * @method respoke.Call.getLocalElement
     * @returns {Video} An HTML5 video element.
     */
    that.getLocalElement = function () {
        return that.outgoingMediaStreams[0] ? that.outgoingMediaStreams[0].element : undefined;
    };

    /**
     * Return remote video element with the remote endpoint's audio and/or video streams attached to it.
     *
     *     var el = call.getRemoteElement();
     *     container.append(el);
     *
     * @memberof! respoke.Call
     * @method respoke.Call.getRemoteElement
     * @returns {Video} An HTML5 video element.
     */
    that.getRemoteElement = function () {
        return that.incomingMediaStreams[0] ? that.incomingMediaStreams[0].element : undefined;
    };

    /**
     * Set up the local media.
     * @memberof! respoke.Call
     * @method respoke.Call.streamReceivedHandler
     * @param {respoke.LocalMedia} localMedia
     * @private
     */
    function streamReceivedHandler(localMedia) {
        if (!pc) {
            return;
        }

        pc.addLocalTracksFromStream(localMedia.stream);
        if (typeof previewLocalMedia === 'function' && localMedia.element) {
            previewLocalMedia(localMedia.element, that);
        }

        localMedia.listen('stop', function stopHandler(/* evt */) {
            // remove the media from the call's outgoing streams

            var idx = that.outgoingMediaStreams.indexOf(localMedia);
            if (idx > -1) {
                that.outgoingMediaStreams.splice(idx, 1);
            }

            // TODO: See about adding this back
            // if (!that.outgoingMediaStreams.length && !that.incomingMediaStreams.length) {
            //     that.hangup({ reason: 'last stream ended' });
            // }
        }, true);

        /**
         * Indicate that the call has received local media from the browser.
         * @event respoke.Call#local-stream-received
         * @type {respoke.Event}
         * @property {Element} element
         * @property {respoke.LocalMedia} stream
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        that.fire('local-stream-received', {
            element: localMedia.element,
            stream: localMedia
        });

        /**
         * This event indicates that local video has been unmuted.
         * @event respoke.Call#mute
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         * @property {string} type - Either "audio" or "video" to specify the type of stream whose muted state
         * has been changed.
         * @property {boolean} muted - Whether the stream is now muted. Will be set to false if mute was turned off.
         */
        localMedia.listen('mute', function (evt) {
            that.fire('mute', {
                type: evt.type,
                muted: evt.muted
            });
        }, true);
    }

    /**
     * Retrieve the constraints that describe the currently flowing outgoing media.
     * TODO: we can probably use that.constraints instead
     * @returns { audio, video }
     * @private
     */
    function getOutgoingConstraints() {
        return that.outgoingMediaStreams.reduce(function (constraints, localMedia) {
            if (localMedia.temporary) {
                return constraints;
            }
            localMedia.stream.getTracks().forEach(function (track) {
                if (track.kind === 'audio') {
                    constraints.audio = true;
                } else {
                    constraints.video = true;
                }
            });

            return constraints;
        }, { audio: false, video: false });
    }

    /**
     * Renegotiate the call to have media that matches the passed constraints.
     *
     * @param {object} params
     * @param {object|Array} params.constraints The constraints to renegotiate to
     * @returns {Promise}
     * @private
     */
    that.changeMedia = function changeMedia(params) {
        log.debug('Call.changeMedia', params);
        params = params || {};

        if (!params.constraints || !params.constraints.length) {
            return Q.reject(new Error('at least one set of constraints is required to change media'));
        }

        params.instanceId = instanceId;

        pc.startModify({
            constraints: params.constraints
        });

        defModify = Q.defer();
        defModify.promise.then(function modifyAccepted() {
            saveParameters(params);
        });

        return defModify.promise;
    };

    /**
     * Renegotiate the call to add video. If a video track is already present
     * on the call, no action will be taken and the promise will immediately resolve.
     *
     * @memberof! respoke.Call
     * @method respoke.Call.addVideo
     * @returns {Promise}
     * @private
     */
    that.addVideo = function () {
        log.debug('Call.addVideo');
        var outgoingConstraints = getOutgoingConstraints();

        if (outgoingConstraints.video) {
            log.debug('Call already contains an outgoing video track');
            return Q.resolve();
        }

        return that.changeMedia({
            constraints: [{
                audio: outgoingConstraints.audio,
                video: true
            }]
        });
    };

    /**
     * Renegotiate the call to remove video. If a video track is not already present
     * on the call, no action will be taken and the promise will immediately resolve.
     *
     * @memberof! respoke.Call
     * @method respoke.Call.addVideo
     * @returns {Promise}
     * @private
     */
    that.removeVideo = function () {
        log.debug('Call.removeVideo');
        var outgoingConstraints = getOutgoingConstraints();

        if (!outgoingConstraints.video) {
            log.debug('Call does not contain an outgoing video track');
            return Q.resolve();
        }

        return that.changeMedia({
            constraints: [{
                audio: outgoingConstraints.audio,
                video: false
            }]
        });
    };

    /**
     * Renegotiate the call to add audio. If an audio track is already present
     * on the call, no action will be taken and the promise will immediately resolve.
     *
     * @memberof! respoke.Call
     * @method respoke.Call.addVideo
     * @returns {Promise}
     * @private
     */
    that.addAudio = function () {
        log.debug('Call.addAudio');
        var outgoingConstraints = getOutgoingConstraints();

        if (outgoingConstraints.audio) {
            log.debug('Call already contains an outgoing audio track');
            return Q.resolve();
        }

        return that.changeMedia({
            constraints: [{
                audio: true,
                video: outgoingConstraints.video
            }]
        });
    };

    /**
     * Renegotiate the call to remove audio. If an audio track is not already present
     * on the call, no action will be taken and the promise will immediately resolve.
     *
     * @memberof! respoke.Call
     * @method respoke.Call.addVideo
     * @returns {Promise}
     * @private
     */
    that.removeAudio = function () {
        log.debug('Call.removeAudio');
        var outgoingConstraints = getOutgoingConstraints();

        if (!outgoingConstraints.audio) {
            log.debug('Call does not contain an outgoing audio track');
            return Q.resolve();
        }

        return that.changeMedia({
            constraints: [{
                audio: false,
                video: outgoingConstraints.video
            }]
        });
    };

    /**
     * Get the direct connection on this call, if it exists.
     *
     *     var dc = call.getDirectConnection();
     *     if (!dc) {
     *         console.log("No direct connection has been started.");
     *     } else {
     *         dc.sendMessage({message: 'hi'});
     *     }
     *
     * @memberof! respoke.Call
     * @method respoke.Call.getDirectConnection
     * @returns {respoke.DirectConnection}
     */
    that.getDirectConnection = function () {
        return directConnection || null;
    };

    /**
     * Remove a direct connection from the existing call. If there is no other media, this will hang up the call.
     * @memberof! respoke.Call
     * @method respoke.Call.removeDirectConnection
     * @private
     * @param {object} params
     * @arg {boolean} [params.skipModify] Do not restart media negotiation.
     */
    that.removeDirectConnection = function (params) {
        params = params || {};
        log.debug('Call.removeDirectConnection');

        if (directConnection) {
            directConnection.close({skipRemove: true});
        }

        if (!that.hasMedia()) {
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
        });
    };

    /**
     * Add a direct connection to the existing call.
     *
     *     call.addDirectConnection({
     *         onOpen: function (evt) {
     *             console.log("Direct connection open!");
     *         }
     *     });
     *
     * @memberof! respoke.Call
     * @method respoke.Call.addDirectConnection
     * @private
     * @param {object} params
     * @param {respoke.DirectConnection.onClose} [params.onClose] - Callback for the developer to be notified about
     * closing the connection.
     * @param {respoke.DirectConnection.onOpen} [params.onOpen] - Callback for the developer to be notified about
     * opening the connection.
     * @param {respoke.DirectConnection.onMessage} [params.onMessage] - Callback for the developer to be notified
     * about incoming messages. Not usually necessary to listen to this event if you are already listening to
     * respoke.Endpoint#message.
     * @param {respoke.Call.directConnectionSuccessHandler} [params.onSuccess]
     * @param {respoke.Client.errorHandler} [params.onError]
     * @returns {Promise<respoke.DirectConnection>}
     */
    that.addDirectConnection = function (params) {
        log.debug('Call.addDirectConnection');
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
     * @memberof! respoke.Call
     * @method respoke.Call.actuallyAddDirectConnection
     * @private
     * @param {object} params
     * @param {respoke.DirectConnection.onClose} [params.onClose] - Callback for the developer to be notified about
     * closing the connection.
     * @param {respoke.DirectConnection.onOpen} [params.onOpen] - Callback for the developer to be notified about
     * opening the connection.
     * @param {respoke.DirectConnection.onMessage} [params.onMessage] - Callback for the developer to be notified
     * about incoming messages. Not usually necessary to listen to this event if you are already listening to
     * respoke.Endpoint#message.
     * @param {respoke.Call.directConnectionSuccessHandler} [params.onSuccess]
     * @param {respoke.Client.errorHandler} [params.onError]
     * @returns {Promise<respoke.DirectConnection>}
     * @fires respoke.Client#direct-connection
     * @fires respoke.Call#direct-connection
     */
    function actuallyAddDirectConnection(params) {
        log.debug('Call.actuallyAddDirectConnection', params);
        params = params || {};
        defMedia.promise.then(params.onSuccess, params.onError);

        if (directConnection && directConnection.isActive()) {
            if (defMedia.promise.isPending()) {
                defMedia.resolve(directConnection);
            } else {
                log.warn("Not creating a new direct connection.");
            }
            return defMedia.promise;
        }

        params.instanceId = instanceId;
        params.pc = pc;
        params.call = that;

        directConnection = respoke.DirectConnection(params);

        directConnection.listen('close', function handleDirectConnectionClose() {
            if (!that.hasMedia()) {
                log.debug('Hanging up because there are no local streams.');
                that.hangup();
            } else {
                that.removeDirectConnection({skipModify: true});
            }
        }, true);

        directConnection.listen('accept', function handleDirectConnectionAccept() {
            if (pc.state.caller === false) {
                log.debug('Answering as a result of approval.');
            } else {
                defMedia.resolve(directConnection);
            }
        }, true);

        directConnection.listen('open', function handleDirectConnectionOpen() {
            pc.state.dispatch('receiveRemoteMedia');
        }, true);

        directConnection.listen('error', function handleDirectionConnectionError(err) {
            defMedia.reject(new Error(err));
        }, true);

        that.remoteEndpoint.directConnection = directConnection;

        /**
         * This event is fired when the local end of the directConnection is available. It still will not be
         * ready to send and receive messages until the 'open' event fires.
         * @event respoke.Call#direct-connection
         * @type {respoke.Event}
         * @property {respoke.DirectConnection} directConnection
         * @property {respoke.Endpoint} endpoint
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        that.fire('direct-connection', {
            directConnection: directConnection,
            endpoint: that.remoteEndpoint
        });

        /**
         * This event is fired when the logged-in endpoint is receiving a request to open a direct connection
         * to another endpoint.  If the user wishes to allow the direct connection, calling
         * evt.directConnection.accept() will allow the connection to be set up.
         * @event respoke.Client#direct-connection
         * @type {respoke.Event}
         * @property {respoke.DirectConnection} directConnection
         * @property {respoke.Endpoint} endpoint
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         * @private
         */
        client.fire('direct-connection', {
            directConnection: directConnection,
            endpoint: that.remoteEndpoint
        });

        if (pc.state.caller === true) {
            directConnection.accept();
        }

        return defMedia.promise;
    }

    /**
     * Close the direct connection.
     * @memberof! respoke.Call
     * @method respoke.Call.closeDirectConnection
     */
    that.closeDirectConnection = function () {
        if (directConnection) {
            directConnection.close();
            directConnection = null;
        }
    };

    /**
     * Tear down the call, release user media.  Send a hangup signal to the remote party if
     * signal is not false and we have not received a hangup signal from the remote party.
     * @memberof! respoke.Call
     * @method respoke.Call.hangup
     * @fires respoke.Call#hangup
     * @param {object} params
     * @arg {boolean} params.signal Optional flag to indicate whether to send or suppress sending
     * a hangup signal to the remote side.
     */
    that.hangup = respoke.callOnce(function hangup(params) {
        if (!pc) {
            return;
        }
        params = params || {};
        params.reason = params.reason || "hangup method called.";
        pc.state.dispatch('hangup', params);
    });

    /**
     * Tear down the call, release user media.  Send a hangup signal to the remote party if
     * signal is not false and we have not received a hangup signal from the remote party. This is an event
     * handler added to the state machine via `once`.
     * @memberof! respoke.Call
     * @method respoke.Call.hangup
     * @fires respoke.Call#hangup
     * @private
     */
    var doHangup = respoke.callOnce(function doHangup() {
        log.debug('hangup', that.caller);

        that.outgoingMediaStreams.forEach(function (localMediaInstance) {
            // only call stop on the localMediaInstance if it was constructed explicitly for the call
            if (localMediaInstance !== params.outgoingMedia) {
                localMediaInstance.stop();
            }
        });

        if (directConnection) {
            directConnection.close();
            directConnection = null;
        }

        if (pc) {
            pc.close({signal: (pc.state.receivedBye ? false : pc.state.signalBye)});
        }

        /**
         * This event is fired when the call has hung up.
         * @event respoke.Call#hangup
         * @type {respoke.Event}
         * @property {boolean} sentSignal - Whether or not we sent a 'hangup' signal to the other party.
         * @property {string} name - the event name.
         * @property {respoke.Call} target
         */
        that.fire('hangup', {
            reason: pc.state.hangupReason || "No reason specified."
        });

        pc.state.ignore();
        pc.ignore();
        that.ignore();
        pc = null;
    });

    /**
     * Expose hangup as reject for approve/reject workflow.
     * @memberof! respoke.Call
     * @method respoke.Call.reject
     * @param {object} params
     */
    that.reject = function () {
        if (!pc) {
            return;
        }
        pc.state.dispatch('reject', {reason: 'call.reject() called'});
    };

    /**
     * Indicate whether a call is being setup or is in progress.
     * @memberof! respoke.Call
     * @method respoke.Call.isActive
     * @returns {boolean}
     */
    that.isActive = function () {
        return !!(pc && pc.isActive() && (
            that.outgoingMediaStreams.length > 0 ||
            that.incomingMediaStreams.length > 0 ||
            (directConnection && directConnection.isActive())
        ));
    };

    /**
     * Set the estimated media status on incoming media.
     * @memberof! respoke.Call
     * @method respoke.Call.updateIncomingMediaEstimate
     * @param {object} params
     * @param {RTCSessionDescriptor} [params.sdp] - optional sdp to use to estimate media
     * @param {RTCConstraints} [params.constraints] - optional constraints to use to estimate media
     * @private
     */
    function updateIncomingMediaEstimate(params) {
        if (pc.state.sendOnly) {
            that.incomingMediaStreams.length = 0;
            return;
        }

        if (!params.sdp && !params.constraints) {
            throw new Error("Can't estimate incoming media without sdp or constraints");
        }

        if (that.incomingMediaStreams.length === 0) {
            that.incomingMediaStreams.push(respoke.RemoteMedia({
                hasScreenShare: (that.target === 'screenshare'),
                temporary: true
            }));
        }

        if (params.sdp) {
            if (that.incomingMediaStreams[0] && that.incomingMediaStreams[0].temporary) {
                that.incomingMediaStreams[0].setSDP(params.sdp);
            }
        }

        if (params.constraints) {
            if (that.incomingMediaStreams[0] && that.incomingMediaStreams[0].temporary) {
                that.incomingMediaStreams[0].setConstraints(params.constraints);
            }
        }
    }

    /**
     * Set the estimated media status on outgoing media. For this method, by the time we have constraints, we're
     * already calling getUserMedia so we will have exactly the right information. No need to use constraints
     * to estimate.
     * @memberof! respoke.Call
     * @method respoke.Call.updateOutgoingMediaEstimate
     * @param {object} params
     * @param {RTCSessionDescriptor} [params.sdp] - optional sdp to use to estimate media
     * @param {RTCConstraints} [params.constraints] - optional constraints to use to estimate media
     * @private
     */
    function updateOutgoingMediaEstimate(params) {
        if (pc.state.receiveOnly) {
            that.outgoingMediaStreams.length = 0;
            that.constraints = [];
            return;
        }

        if (!params.sdp && !params.constraints) {
            throw new Error("Can't estimate outgoing media without sdp or constraints");
        }

        if (that.outgoingMediaStreams.length === 0) {
            that.outgoingMediaStreams.push(respoke.LocalMedia({
                instanceId: instanceId,
                temporary: true,
                source: params.source
            }));
        }

        if (params.sdp) {
            if (that.outgoingMediaStreams[0] && that.outgoingMediaStreams[0].temporary) {
                that.outgoingMediaStreams[0].setSDP(params.sdp);
            }
        }

        if (params.constraints) {
            if (that.outgoingMediaStreams[0] && that.outgoingMediaStreams[0].temporary) {
                that.outgoingMediaStreams[0].setConstraints(params.constraints);
            }
        }
    }

    /**
     * Save the offer so we can tell the browser about it after the PeerConnection is ready.
     * Set the estimated media status on incoming and outgoing media.
     * @memberof! respoke.Call
     * @method respoke.Call.listenOffer
     * @param {object} evt
     * @param {object} evt.signal - The offer signal including the sdp
     * @private
     * @fires respoke.Call#modify
     */
    function listenOffer(evt) {
        log.debug('listenOffer', evt.signal);

        that.sessionId = evt.signal.sessionId;
        evt.signal.sessionDescription = that.remoteSDP(evt.signal.sessionDescription);
        pc.state.receiveOnly = respoke.sdpHasSendOnly(evt.signal.sessionDescription.sdp);
        pc.state.sendOnly = respoke.sdpHasReceiveOnly(evt.signal.sessionDescription.sdp);
        pc.state.once('connecting:entry', function () {
            if (!pc.state.caller) {
                pc.processOffer(evt.signal.sessionDescription);
            }
        });

        // Only do this if we're still trying to guess what media is coming in.
        // TODO not good enough for media renegotiation
        updateIncomingMediaEstimate({sdp: evt.signal.sessionDescription});

        /*
         * Always overwrite constraints for callee on every offer, since answer() and accept() will
         * always be called after parsing the SDP. However, if the caller isn't sending any media,
         * use audio & video as our estimate.
         * TODO not good enough for media renegotiation
         */

        // If sendOnly, we can't rely on the offer for media estimate. It doesn't have any media in it!
        if (pc.state.sendOnly) {
            updateOutgoingMediaEstimate({constraints: {
                audio: true,
                video: true
            }});
        } else {
            updateOutgoingMediaEstimate({sdp: evt.signal.sessionDescription});
        }

        if (that.outgoingMedia) {
            log.info("Default outgoingMedia constraints", that.outgoingMedia.constraints);
        }

        pc.state.dispatch('receiveOffer', {
            previewLocalMedia: previewLocalMedia,
            approve: that.approve
        });
    }

    /**
     * If video is muted, unmute. If not muted, mute.
     * @deprecated
     * @memberof! respoke.Call
     * @method respoke.Call.toggleVideo
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
     * @memberof! respoke.Call
     * @method respoke.Call.toggleAudio
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
     * Indicate whether the call has media of any type flowing in either direction.
     * @memberof! respoke.Call
     * @method respoke.Call.hasMedia
     * @returns {boolean}
     */
    that.hasMedia = function () {
        var local;
        var remote;

        if (!pc || !pc.getLocalStreams) {
            // PeerConnection.init() has not been called yet
            return false;
        }

        local = pc.getLocalStreams();
        remote = pc.getRemoteStreams();

        if (directConnection && directConnection.isActive()) {
            return true;
        }

        return (local.length > 0 || remote.length > 0);
    };

    /**
     * Mute all local video streams.
     * @memberof! respoke.Call
     * @method respoke.Call.muteVideo
     * @fires respoke.Call#mute
     */
    that.muteVideo = function () {
        if (videoIsMuted) {
            return;
        }
        that.outgoingMedia.muteVideo();
        videoIsMuted = true;
    };

    /**
     * Unmute all local video streams.
     * @memberof! respoke.Call
     * @method respoke.Call.unmuteVideo
     * @fires respoke.Call#mute
     */
    that.unmuteVideo = function () {
        if (!videoIsMuted) {
            return;
        }
        that.outgoingMedia.unmuteVideo();
        videoIsMuted = false;
    };

    /**
     * Mute all local audio streams.
     * @memberof! respoke.Call
     * @method respoke.Call.muteAudio
     * @fires respoke.Call#mute
     */
    that.muteAudio = function () {
        if (audioIsMuted) {
            return;
        }
        that.outgoingMedia.muteAudio();
        audioIsMuted = true;
    };

    /**
     * Unmute all local audio streams.
     * @memberof! respoke.Call
     * @method respoke.Call.unmuteAudio
     * @fires respoke.Call#mute
     */
    that.unmuteAudio = function () {
        if (!audioIsMuted) {
            return;
        }

        that.outgoingMedia.unmuteAudio();
        audioIsMuted = false;
    };

    /**
     * Send DTMF tones to the first audio track on the call. This allows interaction with a phone system expecting keys
     * to be pressed on a normal phone, such as when calling a company for customer support and having to "Press 1 for English".
     * @memberof! respoke.Call
     * @method respoke.Call.sendTones
     * @param {object} params
     * @param {string} params.tones - The tones to send. Can be any combination of the characters '0123456789ABCD#*', or
     *  a ',' (comma) to insert a 2 second pause before sending the next tone.
     * @param {number} [params.duration] - Optional number in milliseconds to indicate how long to play each tone. This
     *  value needs to be between 40 and 6000. Defaults to 100.
     * @param {number} [params.gap] - Optional number in mlliseconds to indicate the gap between playing the tones.
     *  This value needs to be larger than 30. Defaults to 70.
     * @param {respoke.Call.onSuccess} [params.onSuccess] - Callback called when all requested DTMF tones have been played.
     * @param {respoke.Call.onError} [params.onError] - Callback called when an error occurs while playing back the DTMF
     *  tones, or when the request has been cancelled.
     * @fires respoke.Call#tone-sent
     * @fires respoke.Call#tone-sending-complete
     * @returns {Promise}
     */
    that.sendTones = function (params) {
        return pc.sendTones(params);
    };

    /**
     * Cancels playback of all queued tones on the first audio track in a stream
     * @memberof! respoke.Call
     * @method respoke.Call.cancelTones
     * @param {respoke.Call.onSuccess} [params.onSuccess] - Callback called when all the outstanding DTMF tones that
     *  have not yet been played have been cancelled.
     * @param {respoke.Call.onError} [params.onError] - Callback called when an error occurs while attempting to cancel
     *  outstanding DTMF tones.
     * @fires respoke.Call#tone-sending-cancelled
     * @returns {Promise}
     */
    that.cancelTones = function (params) {
        return pc.cancelTones(params);
    };

    pc.state.once('terminated:entry', function (evt) {
        doHangup();
    }, true);

    /**
     * Set the estimated media status on incoming media.
     */
    that.listen('signal-answer', function handleAnswerSignal(evt) {
        log.debug('Call handleAnswerSignal', evt);

        that.hasDataChannel = respoke.sdpHasDataChannel(evt.signal.sessionDescription.sdp);
        updateIncomingMediaEstimate({sdp: evt.signal.sessionDescription});
    });

    that.listen('signal-offer', function handleOfferSignal(evt) {
        log.debug('Call handleOfferSignal', evt);

        if (pc.state.getState() === 'idle') {
            pc.state.once('preparing:entry', function () {
                listenOffer(evt);
            });
        } else {
            listenOffer(evt);
        }
    }, true);

    /**
     * Save the hangup reason and hang up.
     */
    that.listen('signal-hangup', function handleHangupSignal(evt) {
        log.debug('Call handleHangupSignal', evt);

        if (!pc) {
            return;
        }

        pc.report.callStoppedReason = evt.signal.reason || "Remote side hung up";
        pc.state.receivedBye = true;
        pc.state.dispatch('hangup', {signal: false, reason: pc.report.callStoppedReason});
    }, true);

    /**
     * Save the answer and tell the browser about it.
     */
    that.listen('signal-modify', function handleModifySignal(evt) {
        log.debug('Call handleModifySignal', evt);

        if (evt.signal.action === 'initiate') {
            defModify = Q.defer();
            pc.state.dispatch('modify', {receive: true});
        }
    }, true);

    /**
     * Ignore the modify.
     */
    pc.listen('modify-reject', function handlePeerConnectModifyReject(evt) {
        log.debug('Call handlePeerConnectModifyReject', evt);

        if (evt.signal.action !== 'initiate') {
            defMedia.reject(evt.err);
            defModify.reject(evt.err);
            defModify = undefined;
        }
    }, true);

    /**
     * Set up state and media for the modify.
     */
    pc.listen('modify-accept', function handlePeerConnectionModifyAccept(evt) {
        log.debug('Call handlePeerConnectionModifyAccept', evt);

        pc.state.dispatch('accept');

        if (evt.signal.action !== 'initiate') {
            defModify.resolve(); // resolved later for callee
            defModify = undefined;
            return;
        }

        // callee only from here down

        // init the directConnection if necessary. We don't need to do anything with
        // audio or video right now.
        if (evt.signal.directConnection === true) {
            actuallyAddDirectConnection().done(function successHandler(dc) {
                directConnection = dc;
                directConnection.accept();
            });
        } else if (evt.signal.directConnection === false) {
            if (directConnection) {
                that.removeDirectConnection({skipModify: true});
                defMedia.resolve(false);
            }
        }
        pc.state.needDirectConnection = typeof evt.signal.directConnection === 'boolean' ?
            evt.signal.directConnection : null;
        that.outgoingMedia.constraints = evt.signal.constraints || that.outgoingMedia.constraints;
    }, true);

    /**
     * Send received ice candidates to the peer connection for processing
     */
    that.listen('signal-icecandidates', function handleIceCandidatesSignal(evt) {
        log.debug('Call handleIceCandidatesSignal', evt);

        if (!pc || !evt.signal.iceCandidates || !evt.signal.iceCandidates.length) {
            return;
        }
        evt.signal.iceCandidates.forEach(function processCandidate(candidate) {
            if (!pc) {
                return;
            }
            pc.addRemoteCandidate({candidate: candidate});
        });
    }, true);

    that.listen('answer', function handleAnswer(evt) {
        log.debug('Call handleAnswer', evt);

        var mediaPromises = [];

        if (pc.state.receiveOnly || pc.state.needDirectConnection) {
            that.outgoingMediaStreams.length = 0;
            return;
        }

        /*
         * By the time we get to here, we could be in a couple of states.
         *
         * If receiveOnly is set to true, we could possibly have constraints (if the developer used the API wrong)
         * but we will not have any media in that.outgoingMediaStreams. We should unset that.constraints and skip
         * building any local media.
         *
         * If we have never received any constraints, and receiveOnly is NOT set to true, we will have an estimate
         * at that.outgoingMediaStreams[0] with temporary set to true. This estimate was set by parsing the SDP.
         *
         * If we have received one or more constraints, that.constraints array will contain the most recent set
         * AND we will have an estimate at that.outgoingMediaStreams[0] with temporary set to true. We must completely
         * rebuild that.outgoingMediaStreams from that.constraints.
         */
        if (pc.state.receiveOnly) {
            that.outgoingMediaStreams.length = 0;
            that.constraints = [];
            return;
        }

        if (that.constraints.length === 0) {
            // We didn't get told what to do by constraints; use our guess.
            that.outgoingMediaStreams[0].temporary = undefined;
        } else if (that.outgoingMediaStreams.length > 0 && that.outgoingMediaStreams[0].temporary) {
            // We got told what to do. Discard our guess. It's OK for that.outgoingMediaStreams to be empty now.
            that.outgoingMediaStreams.shift();
        }

        // If outgoingMedia is passed into the Call then there is no need to build the LocalMedia here
        if (params.outgoingMedia) {
            return;
        }

        if (that.constraints.length > 0) {
            if (pc.state.isModifying) {
                pc.removeLocalTracks();
            }
            that.outgoingMediaStreams.length = 0;
            that.constraints.forEach(function (constraint) {
                if (!respoke.constraintsHasAudio(constraint) && !respoke.constraintsHasVideo(constraint)) {
                    return;
                }
                mediaPromises.push(buildLocalMedia(constraint));
            });
        } else if (that.outgoingMediaStreams.length > 0) {
            that.outgoingMediaStreams.forEach(function (localMediaInstance) {
                mediaPromises.push(buildLocalMedia(localMediaInstance));
            });
        } else {
            throw new Error("I have no idea what type of media I am supposed to build.");
        }

        // These errors are handled elsewhere.
        Q.all(mediaPromises).done(function () {
            pc.state.dispatch('receiveLocalMedia');
        }, function (err) {
            pc.state.dispatch('reject', {reason: 'media stream error'});
            pc.report.callStoppedReason = err.message;
            /**
             * This event is fired on errors that occur during call setup or media negotiation.
             * @event respoke.Call#error
             * @type {respoke.Event}
             * @property {string} reason - A human readable description about the error.
             * @property {respoke.Call} target
             * @property {string} name - the event name.
             */
            that.fire('error', {
                reason: err.message
            });
        });
    }, true);

    if (pc.state.needDirectConnection !== true) {
        pc.state.once('preparing:entry', function () {
            /**
             * This event provides notification for when an incoming call is being received.  If the user wishes
             * to allow the call, the app should call evt.call.answer() to answer the call.
             * @event respoke.Client#call
             * @type {respoke.Event}
             * @property {respoke.Call} call
             * @property {respoke.Endpoint} endpoint
             * @property {string} name - the event name.
             * @property {respoke.Client} target
             */
            client.fire('call', {
                endpoint: that.remoteEndpoint,
                call: that
            });
        }, true);
    }

    pc.state.listen('idle:exit', function (evt) {
        saveParameters(params);
    });

    /**
     * Set up promises. If we're not the caller, we need to listen for approval AND
     * the remote SDP to come in before we can act on the call. Save parameters sent
     * in with the constructor, then delete them off the call. If this call was initiated
     * with a DirectConnection, set it up so answer() will be the approval mechanism.
     */
    pc.state.listen('preparing:entry', function (evt) {
        if (defModify !== undefined) {
            defMedia = Q.defer();
        }

        pc.init(); // instantiates RTCPeerConnection, can't call on modify
        if (defModify === undefined && pc.state.needDirectConnection === true) {
            actuallyAddDirectConnection(params);
        }

        if (params.outgoingMedia) {
            streamReceivedHandler(params.outgoingMedia);
            pc.state.dispatch('receiveLocalMedia');
        }

        if (pc.state.caller === true) {
            that.answer();
        }
    }, true);

    signalingChannel.getTurnCredentials().then(function (result) {
        if (!pc) {
            throw new Error("Already hung up.");
        }
        if (!result) {
            log.warn("Relay service not available.");
            pc.servers = {iceServers: []};
        } else {
            pc.servers = {iceServers: result};
        }
    }).fin(function () {
        if (!pc) {
            throw new Error("Already hung up.");
        }
        pc.state.dispatch('initiate', {
            caller: that.caller
        });
    }).done(null, function (err) {
        if (err.message !== "Already hung up.") {
            log.debug('Unexpected exception', err);
        }
    });

    return that;
}; // End respoke.Call

/**
 * Handle an error that resulted from a method call.
 * @callback respoke.Call.errorHandler
 * @param {Error} err
 */
/**
 * Handle the successful kick-off of stats on a call.
 * @callback respoke.Call.statsSuccessHandler
 * @param {respoke.MediaStatsParser} statsParser
 */
/**
 * Handle obtaining media successfully.
 * @callback respoke.Call.mediaSuccessHandler
 * @param {respoke.LocalMedia} localMedia
 */
/**
 * When on a call, receive local media when it becomes available. This is what you will need to provide if you want
 * to show the user their own video during a call. This callback is called every time
 * respoke.Call#local-stream-received is fired.
 * @callback respoke.Call.onLocalMedia Callback for receiving an HTML5 Video
 * element with the local audio and/or video attached.
 * @param {respoke.Event} evt
 * @param {Element} evt.element
 * @param {respoke.LocalMedia} - The outgoingMedia property on the call.
 * @param {string} evt.name - The event name.
 * @param {respoke.Call} evt.target
 */
/**
 * When on a call, receive remote media when it becomes available. This is what you will need to provide if you want
 * to show the user the other party's video during a call. This callback is called every time
 * respoke.Call#connect is fired.
 * @callback respoke.Call.onConnect
 * @param {respoke.Event} evt
 * @param {Element} evt.element - the HTML5 Video element with the new stream attached.
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * When a call is in setup or media renegotiation happens. This callback will be called every time
 * respoke.Call#error.
 * @callback respoke.Call.onError
 * @param {respoke.Event} evt
 * @param {boolean} evt.reason - A human-readable description of the error.
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * When on a call, receive notification the call has been hung up. This callback is called every time
 * respoke.Call#hangup is fired.
 * @callback respoke.Call.onHangup
 * @param {respoke.Event} evt
 * @param {boolean} evt.sentSignal - Whether or not we sent a 'hangup' signal to the other party.
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * Called when changing the mute state on any type of media. This callback will be called when media is muted or
 * unmuted. This callback is called every time respoke.Call#mute is fired.
 * @callback respoke.Call.onMute
 * @param {respoke.Event} evt
 * @param {respoke.Call} evt.target
 */
/**
 * Called when the callee answers the call. This callback is called every time respoke.Call#answer is fired.
 * @callback respoke.Call.onAnswer
 * @param {respoke.Event} evt
 * @param {respoke.Call} evt.target
 */
/**
 * Called when the user approves local media. This callback will be called whether or not the approval was based
 * on user feedback. I. e., it will be called even if the approval was automatic. This callback is called every time
 * respoke.Call#approve is fired.
 * @callback respoke.Call.onApprove
 * @param {respoke.Event} evt
 * @param {respoke.Call} evt.target
 */
/**
 * When setting up a call, receive notification that the browser has granted access to media.  This callback is
 * called every time respoke.Call#allow is fired.
 * @callback respoke.Call.onAllow
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * When setting up a call, receive notification that the app has asked the browser for permission to get audio or
 * video and is waiting on the browser to grant or reject permission. This callback will be called every time
 * respoke.Call#requesting-media is fired.
 * @callback respoke.Call.onRequestingMedia
 * @param {respoke.Event} evt
 * @param {string} evt.name - the event name.
 * @param {respoke.Call} evt.target
 */
/**
 * The use of stats requires an additional module to Respoke. When on a call, receive periodic statistical
 * information about the call, including the codec, lost packets, and bandwidth being consumed. This callback is
 * called every time respoke.Call#stats is fired.
 * @callback respoke.MediaStatsParser.statsHandler
 * @param {respoke.Event} evt
 * @param {respoke.MediaStats} evt.stats - an object with stats in it.
 * @param {respoke.Call} evt.target
 * @param {string} evt.name - the event name.
 */
/**
 * When on a call, receive local media when it becomes available. This is what you will need to provide if you want
 * to allow the user to preview and approve or reject their own video before a call. If this callback is provided,
 * Respoke will wait for call.answer() to be called before proceeding. If this callback is not provided,
 * Respoke will proceed without waiting for user input. This callback is called every time
 * respoke.Call#local-stream-received is fired.
 * @callback respoke.Call.previewLocalMedia
 * @param {object} element - the HTML5 Video element with the new stream attached.
 * @param {respoke.Call} call
 */
/**
 * Called when a tone is sent on an audio track. This callback is called every time respoke.Call#tone-sent is fired.
 * @callback respoke.Call.onToneSent
 * @param {respoke.Event} evt
 * @param {string} evt.tone
 * @param {number} evt.duration
 * @param {number} evt.gap
 */
/**
 * Called when the playback queue of tones has started.
 * This callback is called every time respoke.Call#tone-sending-started is fired.
 * @callback respoke.Call.onToneSendingStarted
 * @param {respoke.Event} evt
 * @param {object} evt.target
 */
/**
 * Receive the DirectConnection.
 * @callback respoke.Call.directConnectionSuccessHandler
 * @param {respoke.DirectConnection} directConnection
 */
