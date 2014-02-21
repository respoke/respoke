/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Tim Panton <tpanton@digium.com>
 */

/**
 * Create a new set of stats.
 * @author Tim Panton <tpanton@digium.com>
 * @class brightstream.MediaStats
 * @constructor
 * @augments brightstream.EventEmitter
 * @classdesc WebRTC Call stats
 * @param {RTCPeerConnection} peerConnection
 */
/*global brightstream: false */
brightstream.MediaStats = function (params) {
    "use strict";
    params = params || {};
    var that = brightstream.EventEmitter(params);
    that.className = 'brightstream.MediaStats';
    var oldStats = false;
    var pc = params.peerConnection;
    var timer = 0;
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
     *
     */

    var interestingStats = {
        cons: {
            type: "googCandidatePair",
            match: {k: "googActiveConnection", v: "true"},
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
            match: {k: "ssrc", v: ""},
            keys: ["audioInputLevel", "packetsSent", "bytesSent", "transportId", "googCodecName"]
        },
        remoteaudio: {
            type: "ssrc",
            match: {k: "ssrc", v: ""},
            keys: ["audioOutputLevel", "packetsReceived", "packetsLost", "bytesReceived", "transportId"]
        },
        remotevideo: {
            type: "ssrc",
            match: {k: "ssrc", v: ""},
            keys: ["packetsReceived", "packetsLost", "bytesReceived", "transportId"]
        },
        localvideo: {
            type: "ssrc",
            match: {k: "ssrc", v: ""},
            keys: ["packetsSent", "bytesSent", "transportId", "googCodecName"]
        }
    };

    var deltas = {
        packetsSent: true,
        bytesSent: true,
        packetsReceived: true,
        bytesReceived: true
    };

    /**
     * Determine if a string starts with the given value.
     * @memberof! brightstream.Call
     * @method brightstream.Call.startsWith
     * @param {string} string
     * @param {string} value
     * @returns {boolean}
     * @private
     */
    var startsWith = function (string, value) {
        return (string && string.slice && (string.slice(0, value.length) === value));
    };

    /**
     * Parse the SDPs. Kick off continuous calling of getStats() every `interval` milliseconds.
     * @memberof! brightstream.Call
     * @method brightstream.Call.initStats
     * @private
     */
    var initStats = function () {
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
        Object.keys(sdp).forEach(function (wh) {
            var rsdp = sdp[wh];
            // filet the sdp
            var rlines = rsdp.split("\r\n");
            var m = null;

            Object.keys(rlines).forEach(function (ln) {
                var line = rlines[ln];
                var lbits = null;
                var ssrc = null;

                if (startsWith(line, "m=")) { // take a note of the sort of media we are looking at
                    m = line.substring(2, 7); // should be either 'audio' or 'video'
                } else if (startsWith(line, "a=ssrc:")) {
                    lbits = line.split(" ");
                    ssrc = lbits[0].substring("a=ssrc:".length);

                    if (interestingStats[wh + m]) {
                        // fill in the value of the respective 'match'
                        // build the name of the stat from parts
                        interestingStats[wh + m].match.v = ssrc;
                    }
                }
            });
        });

        if (params.onStats) {
            timer = setInterval(function () {
                that.getStats().done(function (report) {
                    params.onStats(report);
                }, function () {
                    log.error("error in getstats");
                });
            }, statsInterval);
        } else {
            log.warn("Not starting stats, no onStats callback provided.");
        }
    };

    /**
     * Get one snapshot of stats from the call's PeerConnection.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.getStats
     * @param {function} [onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [onError] - Error handler for this invocation of this method only.
     * @returns {Promise<object>}
     */
    var getStats = that.publicize('getStats', function (params) {
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
    });

    /**
     * Stop fetching and processing of call stats.
     * @memberof! brightstream.Call
     * @method brightstream.Call.stopStats
     */
    var stopStats = that.publicize('stopStats', function () {
        clearInterval(timer);
    });

    /**
     * Receive raw stats and parse them.
     * @memberof! brightstream.Call
     * @method brightstream.Call.buildStats
     * @param {object} rawStats
     * @private
     */
    var buildStats = function buildStats(rawStats) {
        // extract and repackage 'interesting' stats using the rules above
        var stats = rawStats; // might need to re-instate some sort of wrapper here
        var results = stats.result();

        var tstats = {
            state: {
                signalingState: pc.signalingState,
                iceGatheringState: pc.icegatheringState,
                iceConnectionState: pc.iceConnectionState
            }
        };

        Object.keys(interestingStats).forEach(function (s) {
            var sout = {};
            var rule = interestingStats[s];
            var report = results.filter(function (r) {
                var tt = (r.type === rule.type);
                var kt = (r.stat(rule.match.k) === rule.match.v);
                return (tt && kt);
            });

            if (report.length > 0) {
                sout.timestamp = report[0].timestamp;
                if (oldStats) {
                    sout.deltaT = sout.timestamp - oldStats[s].timestamp;
                }

                for (var nkey = 0; nkey < rule.keys.length; nkey += 1) {
                    var key = rule.keys[nkey];
                    sout[key] = report[0].stat(key);

                    if (deltas[key] && oldStats) {
                        sout["delta" + key] = (sout[key] - oldStats[s][key]);
                    }
                }
            }
            tstats[s] = sout;
        });
        oldStats = tstats;
        return tstats;
    };

    initStats();

    return that;
}; // End brightstream.MediaStats
