/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Tim Panton <tpanton@digium.com>
 */

/**
 * A handler for WebRTC statistics. This class takes an `onStats` callback which it calls every `interval` seconds
 * with the latest live statistics.
 * @author Tim Panton <tpanton@digium.com>
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.MediaStats
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {RTCPeerConnection} peerConnection
 */
/*global brightstream: false */
brightstream.MediaStats = function (params) {
    "use strict";
    params = params || {};
    var that = brightstream.EventEmitter(params);
    /**
     * @memberof! brightstream.MediaStats
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.MediaStats';
    /**
     * @memberof! brightstream.MediaStats
     * @private
     * @name oldStats
     * @type {boolean}
     */
    var oldStats = false;
    /**
     * @memberof! brightstream.MediaStats
     * @private
     * @name pc
     * @type RTCPeerConnection
     */
    var pc = params.peerConnection;
    /**
     * @memberof! brightstream.MediaStats
     * @private
     * @name timer
     * @type {number}
     * @desc The timer for calling the onStats callback; the output of setInterval.
     */
    var timer = 0;
    /**
     * @memberof! brightstream.MediaStats
     * @private
     * @name statsInterval
     * @type {number}
     * @desc The millisecond interval on which we call the onStats callback.
     */
    var statsInterval = params.interval || 5000;

    /*
     * The data you get out of getStats needs some pruning and a tidy up
     * so I define some things I think are 'interesting' and how to find them.
     *
     * getStats gives you an array of results each of which has a type.
     * Each result contains a list of keys and a dictionary of values that can
     * be retrieved by key. (no ,they aren't properties)
     *
     * The interesting stats object is a list of objects, each describing the
     * type of result that contains the stats, the names of the relevant stats
     * and a way to filter out the irrelevant results objects of the same type.
     *
     * An added complication is that the standards are in flux so google add
     * data in chrome (some of it useful) that isn;t in the draft standard.
     */

    /**
     * @memberof! brightstream.MediaStats
     * @private
     * @name interestingStats
     * @type {object}
     */
    var interestingStats = {
        cons: {
            type: "googCandidatePair",
            match: {key: "googActiveConnection", value: "true"},
            keys: [
                "googWritable", "googReadable",
                "googTransportType", "googLocalCandidateType",
                "googRemoteAddress", "googLocalAddress",
                "googRtt", "googChannelId"
            ]
        },
        // the next 4 property names _matter_ they have to finish with the value of an m= line
        // if you change them things won't work.
        localaudio: {
            type: "ssrc",
            match: {key: "ssrc", value: ""},
            keys: ["audioInputLevel", "packetsSent", "bytesSent", "transportId", "googCodecName"]
        },
        remoteaudio: {
            type: "ssrc",
            match: {key: "ssrc", value: ""},
            keys: ["audioOutputLevel", "packetsReceived", "packetsLost", "bytesReceived", "transportId"]
        },
        remotevideo: {
            type: "ssrc",
            match: {key: "ssrc", value: ""},
            keys: ["packetsReceived", "packetsLost", "bytesReceived", "transportId"]
        },
        localvideo: {
            type: "ssrc",
            match: {key: "ssrc", value: ""},
            keys: ["packetsSent", "bytesSent", "transportId", "googCodecName"]
        }
    };

    /**
     * @memberof! brightstream.MediaStats
     * @private
     * @name deltas
     * @type {object}
     */
    var deltas = {
        packetsSent: true,
        bytesSent: true,
        packetsReceived: true,
        bytesReceived: true
    };

    /**
     * Determine if a string starts with the given value.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.startsWith
     * @param {string} string
     * @param {string} value
     * @returns {boolean}
     * @private
     */
    function startsWith(string, value) {
        return (string && string.slice && (string.slice(0, value.length) === value));
    }

    /**
     * Parse the SDPs. Kick off continuous calling of getStats() every `interval` milliseconds.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.initStats
     * @private
     */
    function initStats() {
        var sdp = {};
        if (!pc || !pc.remoteDescription || !pc.remoteDescription.sdp ||
                !pc.localDescription || !pc.localDescription.sdp) {
            log.warn("missing info.");
            return;
        }

        sdp = {
            remote: pc.remoteDescription.sdp,
            local: pc.localDescription.sdp
        };

        /**
         * extract the ssrcs from the sdp, because it isn't anwhere else.
         * we will use them to map results to audio/video etc
         */
        Object.keys(sdp).forEach(function (side) {
            var rsdp = sdp[side];
            // filet the sdp
            var lines = rsdp.split("\r\n");
            var mediaType = null;

            Object.keys(lines).forEach(function (lineIndex) {
                var line = lines[lineIndex];
                var lbits = null;
                var ssrc = null;

                if (startsWith(line, "m=")) { // take a note of the sort of media we are looking at
                    mediaType = line.substring(2, 7); // should be either 'audio' or 'video'
                } else if (startsWith(line, "a=ssrc:")) {
                    lbits = line.split(" ");
                    ssrc = lbits[0].substring("a=ssrc:".length);

                    if (interestingStats[side + mediaType]) {
                        // fill in the value of the respective 'match'
                        // build the name of the stat from parts
                        interestingStats[side + mediaType].match.value = ssrc;
                    }
                }
            });
        });

        if (params.onStats) {
            timer = setInterval(function () {
                that.getStats().done(function (report) {
                    params.onStats(report);
                }, function () {
                    log.error("error in getStats");
                });
            }, statsInterval);
        } else {
            log.warn("Not starting stats, no onStats callback provided.");
        }
    }

    /**
     * Get one snapshot of stats from the call's PeerConnection.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.getStats
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @returns {Promise<object>}
     */
    that.getStats = function (params) {
        params = params || {};
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var args = [];

        if (!pc.getStats) {
            deferred.reject(new Error("no peer connection getStats()"));
            return;
        }

        if (navigator.mozGetUserMedia) {
            args.push(null);
        }

        args.push(function (stats) {
            deferred.resolve(buildStats(stats));
        });
        args.push(function (err) {
            log.error(err);
            deferred.reject(new Error("Can't get stats."));
        });
        pc.getStats.apply(pc, args);
        return deferred.promise;
    };

    /**
     * Stop fetching and processing of call stats.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.stopStats
     */
    that.stopStats = function () {
        clearInterval(timer);
    };

    /**
     * Receive raw stats and parse them.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.buildStats
     * @param {object} rawStats
     * @private
     */
    function buildStats(rawStats) {
        // extract and repackage 'interesting' stats using the rules above
        var stats = rawStats; // might need to re-instate some sort of wrapper here
        var results = stats.result();

        var allStats = {
            state: {
                signalingState: pc.signalingState,
                iceGatheringState: pc.icegatheringState,
                iceConnectionState: pc.iceConnectionState
            }
        };

        Object.keys(interestingStats).forEach(function (statType) {
            var eachStat = {};
            var rule = interestingStats[statType];
            var report = results.filter(function (result) {
                var typeMatch = (result.type === rule.type);
                var keyMatch = (result.stat(rule.match.key) === rule.match.value);
                return (typeMatch && keyMatch);
            });

            if (report.length > 0) {
                eachStat.timestamp = report[0].timestamp;
                if (oldStats) {
                    eachStat.deltaT = eachStat.timestamp - oldStats[statType].timestamp;
                }

                rule.keys.forEach(function (key) {
                    eachStat[key] = report[0].stat(key);

                    if (deltas[key] && oldStats) {
                        eachStat["delta" + key] = (eachStat[key] - oldStats[statType][key]);
                    }
                });
            }
            allStats[statType] = eachStat;
        });
        oldStats = allStats;
        return allStats;
    }

    initStats();

    return that;
}; // End brightstream.MediaStats
