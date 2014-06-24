/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Tim Panton <tpanton@digium.com>
 */

var parser = require('./parser');

/**
 * A report containing statistical information about the flow of media.
 * with the latest live statistics.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class respoke.MediaStats
 * @constructor
 * @param {object} params
 */
module.exports = function (params) {
    "use strict";
    params = JSON.parse(JSON.stringify(params || {}));
    /**
     * Information about the connection.
     * @memberof! respoke.MediaStats
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
     * @memberof! respoke.MediaStats
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
     * @memberof! respoke.MediaStats
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
     * @memberof! respoke.MediaStats
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
     * @memberof! respoke.MediaStats
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
     * @memberof! respoke.MediaStats
     * @type {object}
     * @name state
     * @property {string} iceConnectionState - Indicates where we are in terms of ICE network negotiation -- "hole
     * punching."
     * @property {string} iceGatheringState - Indicates whether we have started or finished gathering ICE
     * candidates from the browser.
     */
    /**
     * The date and time at which this stats snapshot was taken.
     * @memberof! respoke.MediaStats
     * @name timestamp
     * @type {date}
     */
    /**
     * The time that has passed since the last stats snapshot was taken.
     * @memberof! respoke.MediaStats
     * @name periodLength
     * @type {number}
     */
    /**
     * These aliases define what things should be renamed before report is sent.
     * @memberof! respoke.MediaStats
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

    /**
     * Rename report attributes to have more readable, understandable names.
     * @memberof! respoke.MediaStats
     * @method respoke.MediaStats.format
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
}; // End respoke.MediaStats
