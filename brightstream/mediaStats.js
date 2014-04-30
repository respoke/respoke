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
 * @class brightstream.MediaStatsParser
 * @constructor
 * @augments brightstream.Class
 * @param {RTCPeerConnection} peerConnection
 */
/*global brightstream: false */
brightstream.MediaStatsParser = function (params) {
    "use strict";
    params = params || {};
    var that = brightstream.Class(params);
    /**
     * @memberof! brightstream.MediaStatsParser
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.MediaStatsParser';
    /**
     * @memberof! brightstream.MediaStatsParser
     * @private
     * @name oldStats
     * @type {boolean}
     */
    var oldStats = false;
    /**
     * @memberof! brightstream.MediaStatsParser
     * @private
     * @name pc
     * @type RTCPeerConnection
     */
    var pc = params.peerConnection;
    delete params.peerConnection;
    /**
     * @memberof! brightstream.MediaStatsParser
     * @private
     * @name timer
     * @type {number}
     * @desc The timer for calling the onStats callback; the output of setInterval.
     */
    var timer = 0;
    /**
     * @memberof! brightstream.MediaStatsParser
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
     * @memberof! brightstream.MediaStatsParser
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
     * @memberof! brightstream.MediaStatsParser
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
     * @memberof! brightstream.MediaStatsParser
     * @method brightstream.MediaStatsParser.startsWith
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
     * @memberof! brightstream.MediaStatsParser
     * @method brightstream.MediaStatsParser.initStats
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
                that.getStats().done(function successHandler(report) {
                    params.onStats(brightstream.MediaStats(report));
                }, function errorHandler(err) {
                    log.error("error in getStats", err);
                });
            }, statsInterval);
        } else {
            log.warn("Not starting stats, no onStats callback provided.");
        }
    }

    /**
     * Get one snapshot of stats from the call's PeerConnection.
     * @memberof! brightstream.MediaStatsParser
     * @method brightstream.MediaStatsParser.getStats
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

        args.push(function successHandler(stats) {
            deferred.resolve(buildStats(stats));
        });
        args.push(function errorHandler(err) {
            log.error(err);
            deferred.reject(new Error("Can't get stats."));
        });
        pc.getStats.apply(pc, args);
        return deferred.promise;
    };

    /**
     * Stop fetching and processing of call stats.
     * @memberof! brightstream.MediaStatsParser
     * @method brightstream.MediaStatsParser.stopStats
     */
    that.stopStats = function () {
        clearInterval(timer);
    };

    /**
     * Receive raw stats and parse them.
     * @memberof! brightstream.MediaStatsParser
     * @method brightstream.MediaStatsParser.buildStats
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
                    if (testInt || testInt === 0) {
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
}; // End brightstream.MediaStatsParser

/**
 * A report containing statistical information about the flow of media.
 * with the latest live statistics.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class brightstream.MediaStats
 * @constructor
 * @param {object} params
 */
brightstream.MediaStats = function (params) {
    "use strict";
    params = JSON.parse(JSON.stringify(params || {}));
    /**
     * Information about the connection.
     * @memberof! brightstream.MediaStats
     * @type {object}
     * @name connection
     * @property {string} channelId - A string which identifies this media stream (which may contain several
     * media stream tracks) to the browser.
     * @property {boolean} foundIncomingNetworkPaths - Whether or not the ICE hole-punching process has found
     * a suitable network path from the remote party to this client.
     * @property {boolean} foundOutgoingNetworkPaths - Whether or not the ICE hole-punching process has found
     * a suitable network path from this client to the remote party.
     * @property {string} localHost - The local IP and port number of the media connection.
     * @property {string} remoteHost - The remote IP and port number of the media connection.
     * @property {string} localMediaPath - The type of network path the local media is taking to the remote
     * party, one of "local", "srflx", "prflx", "relay".
     * @property {string} remoteMediaPath - The type of network path the local media is taking to the remote
     * party, one of "local", "srflx", "prflx", "relay".
     * @property {string} roundTripTime - How long it takes media packets to traverse the network path.
     * @property {string} transport - Whether the media is flowing via UDP or TCP
     */
    /**
     * Information about the local audio stream track.
     * @memberof! brightstream.MediaStats
     * @type {object}
     * @name localaudio
     * @property {string} audioInputLevel - Microphone volume.
     * @property {string} codec - Audio codec in use.
     * @property {string} totalBytesSent - Total number of bytes sent since media first began flowing.
     * @property {string} periodBytesSent - Number of bytes sent since the last stats event.
     * @property {string} totalPacketsSent - Total number of packets sent since media first began flowing.
     * @property {string} periodPacketsSent - Number of packets sent since the last stats event.
     * @property {string} transportId - The identifer of the media stream to which this media stream track belongs.
     */
    /**
     * Information about the local video stream track.
     * @memberof! brightstream.MediaStats
     * @type {object}
     * @name localvideo
     * @property {string} codec - Video codec in use.
     * @property {string} totalBytesSent - Total number of bytes sent since media first began flowing.
     * @property {string} periodBytesSent - Number of bytes sent since the last stats event.
     * @property {string} totalPacketsSent - Total number of packets sent since media first began flowing.
     * @property {string} periodPacketsSent - Number of packets sent since the last stats event.
     * @property {string} transportId - The identifer of the media stream to which this media stream track belongs.
     */
    /**
     * Information about the remote audio stream track.
     * @memberof! brightstream.MediaStats
     * @type {object}
     * @name remoteaudio
     * @property {string} audioOutputLevel
     * @property {string} totalBytesReceived - Total number of bytes received since media first began flowing.
     * @property {string} periodBytesReceived - Number of bytes received since the last stats event.
     * @property {string} packetsLost - Total number of packets lost.
     * @property {string} totalPacketsReceived - Total number of packets received since media first began flowing.
     * @property {string} periodPacketsReceived - Number of packets received since the last stats event.
     * @property {string} transportId - The identifer of the media stream to which this media stream track
     * belongs.
     */
    /**
     * Information about the remote video stream track.
     * @memberof! brightstream.MediaStats
     * @type {object}
     * @name remotevideo
     * @property {string} totalBytesReceived - Total number of bytes received since media first began flowing.
     * @property {string} periodBytesReceived - Number of bytes received since the last stats event.
     * @property {string} packetsLost - Total number of packets lost.
     * @property {string} totalPacketsReceived - Total number of packets received since media first began flowing.
     * @property {string} periodPacketsReceived - Number of packets received since the last stats event.
     * @property {string} transportId - The identifer of the media stream to which this media stream track belongs.
     */
    /**
     * Information about connection state.
     * @memberof! brightstream.MediaStats
     * @type {object}
     * @name state
     * @property {string} iceConnectionState - Indicates where we are in terms of ICE network negotiation -- "hole
     * punching."
     * @property {string} iceGatheringState - Indicates whether we have started or finished gathering ICE
     * candidates from the browser.
     */
    /**
     * The date and time at which this stats snapshot was taken.
     * @memberof! brightstream.MediaStats
     * @name timestamp
     * @type {date}
     */
    /**
     * The time that has passed since the last stats snapshot was taken.
     * @memberof! brightstream.MediaStats
     * @name periodLength
     * @type {number}
     */
    /**
     * These aliases define what things should be renamed before report is sent.
     * @memberof! brightstream.MediaStats
     * @private
     * @name aliases
     * @type {object}
     */
    var aliases = {
        cons: {
            newname: 'connection',
            members: {
                googChannelId: 'channelId',
                googLocalAddress: 'localHost',
                googRemoteAddress: 'remoteHost',
                googLocalCandidateType: 'localMediaPath',
                googRemoteCandidateType: 'remoteMediaPath',
                googReadable: 'foundIncomingNetworkPaths',
                googRtt: 'roundTripTime',
                googTransportType: 'transport',
                googWritable: 'foundOutgoingNetworkPaths'
            }
        },
        localaudio: {
            members: {
                googCodecName: 'codec',
                bytesSent: 'totalBytesSent',
                packetsSent: 'totalPacketsSent'
            }
        },
        localvideo: {
            members: {
                googCodecName: 'codec',
                bytesSent: 'totalBytesSent',
                packetsSent: 'totalPacketsSent'
            }
        },
        remoteaudio: {
            members: {
                googCodecName: 'codec',
                bytesReceived: 'totalBytesReceived',
                packetsReceived: 'totalPacketsReceived'
            }
        },
        remotevideo: {
            members: {
                googCodecName: 'codec',
                bytesReceived: 'totalBytesReceived',
                packetsReceived: 'totalPacketsReceived'
            }
        }
    };

    /*
     * Rename report attributes to have more readable, understandable names.
     * @memberof! brightstream.MediaStats
     * @method brightstream.MediaStats.format
     * @param {object} report
     * @param {object} aliases
     * @returns {object}
     * @private
     */
    function format(report, aliases) {
        Object.keys(aliases).forEach(function eachAttr(oldName) {
            var name;
            if (typeof aliases[oldName] === 'string') {
                report[aliases[oldName]] = report[oldName];
                delete report[oldName];
            } else if (typeof aliases[oldName] === 'object') {
                name = oldName;
                if (aliases[oldName].newname) {
                    report[aliases[oldName].newname] = report[oldName];
                    name = aliases[oldName].newname;
                    delete report[oldName];
                }
                if (aliases[oldName].members) {
                    format(report[name], aliases[oldName].members);
                }
            }
        });

        if (report.connection) {
            report.connection.foundIncomingNetworkPaths = ('true' === report.connection.foundIncomingNetworkPaths);
            report.connection.foundOutgoingNetworkPaths = ('true' === report.connection.foundOutgoingNetworkPaths);
        }
        return report;
    }
    return format(params, aliases);
}; // End brightstream.MediaStats
