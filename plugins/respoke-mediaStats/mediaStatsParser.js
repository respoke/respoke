/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Tim Panton <tpanton@digium.com>
 */

var mediaStatsReport = require('./mediaStatsReport');

/**
 * A handler for WebRTC statistics. This class takes an `onStats` callback which it calls every `interval` seconds
 * with the latest live statistics.
 * @author Tim Panton <tpanton@digium.com>
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.MediaStatsParser
 * @constructor
 * @augments respoke.Class
 * @param {RTCPeerConnection} peerConnection
 */

module.exports = function (params) {
    "use strict";
    params = params || {};
    var that = respoke.Class(params);
    /**
     * @memberof! respoke.MediaStatsParser
     * @name className
     * @type {string}
     */
    that.className = 'respoke.MediaStatsParser';
    /**
     * @memberof! respoke.MediaStatsParser
     * @private
     * @name oldStats
     * @type {boolean}
     */
    var oldStats = false;
    /**
     * @memberof! respoke.MediaStatsParser
     * @private
     * @name pc
     * @type RTCPeerConnection
     */
    var pc = params.peerConnection;
    delete params.peerConnection;
    /**
     * @memberof! respoke.MediaStatsParser
     * @private
     * @name timer
     * @type {number}
     * @desc The timer for calling the onStats callback; the output of setInterval.
     */
    var timer = 0;
    /**
     * @memberof! respoke.MediaStatsParser
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
     * @memberof! respoke.MediaStatsParser
     * @private
     * @name interestingStats
     * @type {object}
     */
    var interestingStats = {
        cons: {
            type: "googCandidatePair",
            match: {key: "googActiveConnection", value: "true"},
            keys: [
                "googWritable", "googReadable", "googTransportType", "googLocalCandidateType",
                "googRemoteCandidateType", "googRemoteAddress", "googLocalAddress", "googRtt", "googChannelId"
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
     * @memberof! respoke.MediaStatsParser
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
     * @memberof! respoke.MediaStatsParser
     * @method respoke.MediaStatsParser.startsWith
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
     * @memberof! respoke.MediaStatsParser
     * @method respoke.MediaStatsParser.initStats
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
        Object.keys(sdp).forEach(function eachKey(side) {
            var rsdp = sdp[side];
            // filet the sdp
            var lines = rsdp.split("\r\n");
            var mediaType = null;

            Object.keys(lines).forEach(function lineNum(lineIndex) {
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
            timer = setInterval(function statsTimerHandler() {
                that.getStats().done(params.onStats, function errorHandler(err) {
                    log.error("error in getStats", err.message, err.stack);
                });
            }, statsInterval);
        } else {
            log.warn("Not starting stats, no onStats callback provided.");
        }
    }

    /**
     * Get one snapshot of stats from the call's PeerConnection.
     * @memberof! respoke.MediaStatsParser
     * @method respoke.MediaStatsParser.getStats
     * @param {object} [params]
     * @param {respoke.MediaStatsParser.statsHandler} [params.onSuccess] - Success handler for this
     * invocation of this method only.
     * @param {respoke.Client.errorHandler} [params.onError] - Error handler for this invocation of this
     * method only.
     * @returns {Promise<object>|undefined}
     */
    that.getStats = function (params) {
        params = params || {};
        var deferred = Q.defer();
        var retVal = respoke.handlePromise(deferred.promise, params.onSuccess, params.onError);
        var args = [];

        if (!pc.getStats) {
            deferred.reject(new Error("no peer connection getStats()"));
            return retVal;
        }

        if (navigator.mozGetUserMedia) {
            args.push(null);
        }

        args.push(function successHandler(stats) {
            deferred.resolve(mediaStatsReport(buildStats(stats)));
        });
        args.push(function errorHandler(err) {
            log.error(err);
            deferred.reject(new Error("Can't get stats."));
        });
        pc.getStats.apply(pc, args);
        return retVal;
    };

    /**
     * Stop fetching and processing of call stats.
     * @memberof! respoke.MediaStatsParser
     * @method respoke.MediaStatsParser.stopStats
     */
    that.stopStats = function () {
        clearInterval(timer);
    };

    /**
     * Receive raw stats and parse them.
     * @memberof! respoke.MediaStatsParser
     * @method respoke.MediaStatsParser.buildStats
     * @param {object} rawStats
     * @private
     */
    function buildStats(rawStats) {
        // extract and repackage 'interesting' stats using the rules above
        var stats = rawStats; // might need to re-instate some sort of wrapper here
        var results = stats.result();

        var allStats = {
            state: {
                iceGatheringState: pc.icegatheringState,
                iceConnectionState: pc.iceConnectionState
            }
        };

        Object.keys(interestingStats).forEach(function eachStatType(statType) {
            var eachStat = {};
            var rule = interestingStats[statType];
            var report = results.filter(function eachResult(result) {
                var typeMatch = (result.type === rule.type);
                var keyMatch = (result.stat(rule.match.key) === rule.match.value);
                return (typeMatch && keyMatch);
            });

            if (report.length > 0) {
                if (report[0].timestamp) {
                    allStats.timestamp = report[0].timestamp;
                    allStats.periodLength = allStats.timestamp - oldStats.timestamp;
                }
                rule.keys.forEach(function eachKey(key) {
                    var testInt = parseInt(report[0].stat(key), 10);
                    if (!isNaN(testInt)) {
                        eachStat[key] = testInt;
                    } else {
                        eachStat[key] = report[0].stat(key);
                    }

                    if (deltas[key] && oldStats && oldStats[statType] &&
                        [null, undefined].indexOf(oldStats[statType][key]) === -1) {
                        eachStat["period" + key.charAt(0).toUpperCase() + key.slice(1)] =
                            (eachStat[key] - oldStats[statType][key]);
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
}; // End respoke.MediaStatsParser

/**
 * Success handler for methods that generate stats.
 * @callback respoke.MediaStatsParser.statsHandler
 * @param {respoke.MediaStats}
 */
