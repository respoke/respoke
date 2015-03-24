/*!
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */

/* global respoke: true */
var log = require('loglevel');
var Q = require('q');
var respoke = require('./respoke');

/**
 * A conference call to one or more people with audio. Eventually this will handle video, too.
 * @class respoke.Conference
 * @constructor
 * @augments respoke.EventEmitter
 * @param {object} params
 * @param {string} params.conferenceId - The id that should be used to create the conference call or the ID
 * of the call to join.
 * @param {string} params.instanceId - client id
 * @param {string} params.key - The key that indicates an endpoint can join.
 * @param {boolean} params.open - whether endpoints can join this conference without a key.
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
 * @param {Array<RTCConstraints>} params.constraints - Array of WebRTC constraints.
 * @param {respoke.Conference.onJoin} [params.onJoin] - Callback for when a participant joins the conference.
 * @param {respoke.Conference.onLeave} [params.onLeave] - Callback for when a participant leaves the conference.
 * @param {respoke.Conference.onMessage} [params.onMessage] - Callback for when a message is sent to the conference.
 * @param {respoke.Conference.onMute} [params.onMute] - Callback for when local or remote media is muted or unmuted.
 * @param {respoke.Conference.onTopic} [params.onTopic] - Callback for the conference topic changes.
 * @param {respoke.Conference.onPresenter} [params.onPresenter] - Callback for when the presenter changes.
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
 * @param {HTMLVideoElement} params.videoLocalElement - Pass in an optional html video element to have local
 * video attached to it.
 * @param {HTMLVideoElement} params.videoRemoteElement - Pass in an optional html video element to have remote
 * video attached to it.
 * @returns {respoke.Conference}
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
    var instanceId = params.instanceId;
    var signalingChannel = params.signalingChannel;
    var that = respoke.EventEmitter({
        open: params.open,
        key: params.key,
        id: params.conferenceId
    });

    that.listen('join', params.onJoin);
    that.listen('leave', params.onLeave);
    that.listen('message', params.onMessage);
    that.listen('mute', params.onMute);
    that.listen('topic', params.onTopic);
    that.listen('presenter', params.onPresenter);
    delete params.onJoin;
    delete params.onLeave;
    delete params.onMessage;
    delete params.onMute;
    delete params.onTopic;
    delete params.onPresenter;

    params.caller = true;
    delete params.conferenceId;
    delete params.key;
    params.remoteEndpoint = that;
    that.call = respoke.Call(params);

    // Redirect a bunch of events.
    ['mute', 'hangup', 'connect'].forEach(function (eventName) {
        that.call.listen(eventName, function (evt) {
            evt.call = that.call; // target will be updated to point to this conference object.
            that.fire(eventName, evt);
        });
    });

    delete that.instanceId;

    /**
     * A name to identify this class
     * @memberof! respoke.Conference
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Conference';

    /**
     * @memberof! respoke.Conference
     * @name client
     * @type {respoke.Client}
     * @private
     */
    var client = respoke.getClient(instanceId);

    /**
     * Hang up on the conference call.
     * @memberof! respoke.Conference
     * @method respoke.Conference.hangup
     */
    that.hangup = that.call.hangup;

    /**
     * Mute local user's audio.
     * @memberof! respoke.Conference
     * @method respoke.Conference.muteAudio
     */
    that.muteAudio = that.call.muteAudio;

    return that;
};
