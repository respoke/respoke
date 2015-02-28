
var expect = chai.expect;

describe("The respoke namespace", function() {
    it("contains all the library's classes.", function() {
        expect(typeof respoke).to.equal('object');
        expect(typeof respoke.Call).to.equal('function');
        expect(typeof respoke.Class).to.equal('function');
        expect(typeof respoke.Client).to.equal('function');
        expect(typeof respoke.Connection).to.equal('function');
        expect(typeof respoke.DirectConnection).to.equal('function');
        expect(typeof respoke.Endpoint).to.equal('function');
        expect(typeof respoke.EventEmitter).to.equal('function');
        expect(typeof respoke.Group).to.equal('function');
        expect(typeof respoke.LocalMedia).to.equal('function');
        expect(typeof respoke.MediaStats).to.equal('function');
        expect(typeof respoke.MediaStatsParser).to.equal('function');
        expect(typeof respoke.PeerConnection).to.equal('function');
        expect(typeof respoke.Presentable).to.equal('function');
        expect(typeof respoke.SignalingChannel).to.equal('function');
        expect(typeof respoke.SignalingMessage).to.equal('function');
        expect(typeof respoke.TextMessage).to.equal('function');

        //capability flags
        expect(typeof respoke.hasUserMedia).to.equal('function');
        expect(typeof respoke.hasRTCPeerConnection).to.equal('function');
        expect(typeof respoke.hasWebsocket).to.equal('function');
        expect(typeof respoke.needsChromeExtension).to.equal('boolean');
        expect(typeof respoke.hasChromeExtension).to.equal('boolean');
        expect(typeof respoke.chooseDesktopMedia).to.equal('function');
    });

    describe("the 'once' method", function () {
        var initialFunction;
        var onceFunction;

        beforeEach(function () {
            initialFunction = sinon.spy();
            onceFunction = respoke.once(initialFunction);
        });

        it("returns function", function () {
            expect(typeof onceFunction).to.equal('function');
        });

        describe("which", function () {
            it("is only executed once", function () {
                onceFunction();
                onceFunction();
                onceFunction();
                onceFunction();
                expect(initialFunction.callCount).to.equal(1);
            });

            it("calls its input function with the right arguments", function () {
                onceFunction('test');
                expect(initialFunction.calledWith('test')).to.equal(true);
            });
        });
    });

    describe("the sdp-parsing method", function () {
        var sdpWithOnlyAudio = "v=0\n" +
"o=- 5677669584985122483 2 IN IP4 127.0.0.1\n" +
"s=-\n" +
"t=0 0\n" +
"a=group:BUNDLE audio video\n" +
"a=msid-semantic: WMS DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"m=audio 1 RTP/SAVPF 111 103 104 0 8 106 105 13 126\n" +
"c=IN IP4 0.0.0.0\n" +
"a=rtcp:1 IN IP4 0.0.0.0\n" +
"a=ice-ufrag:K3+NLFZbAS2qphtU\n" +
"a=ice-pwd:AOuCQA4Zbycx12fVt7YrOnCh\n" +
"a=ice-options:google-ice\n" +
"a=fingerprint:sha-256 10:24:0B:10:43:7D:66:9A:0C:D0:5D:E7:1C:0B:C6:C5:D2:AC:5D:E0:6D:92:82:31:F8:93:5C:62:28:33:DB:1F\n" +
"a=setup:actpass\n" +
"a=mid:audio\n" +
"a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\n" +
"a=sendrecv\n" +
"a=rtcp-mux\n" +
"a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:OiFMCOT47NqfgEHak4DIaHkbIdbrR04m4avdzAa7\n" +
"a=rtpmap:111 opus/48000/2\n" +
"a=fmtp:111 minptime=10\n" +
"a=rtpmap:103 ISAC/16000\n" +
"a=rtpmap:104 ISAC/32000\n" +
"a=rtpmap:0 PCMU/8000\n" +
"a=rtpmap:8 PCMA/8000\n" +
"a=rtpmap:106 CN/32000\n" +
"a=rtpmap:105 CN/16000\n" +
"a=rtpmap:13 CN/8000\n" +
"a=rtpmap:126 telephone-event/8000\n" +
"a=maxptime:60\n" +
"a=ssrc:3362315790 cname:ZsVU8VM2guLJx/x9\n" +
"a=ssrc:3362315790 msid:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN 45b48641-f1ee-4b3f-979d-e5b1d4190cff\n" +
"a=ssrc:3362315790 mslabel:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"a=ssrc:3362315790 label:45b48641-f1ee-4b3f-979d-e5b1d4190cff\n";

        var sdpWithBoth = "v=0\n" +
"o=- 5677669584985122483 2 IN IP4 127.0.0.1\n" +
"s=-\n" +
"t=0 0\n" +
"a=group:BUNDLE audio video\n" +
"a=msid-semantic: WMS DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"m=audio 1 RTP/SAVPF 111 103 104 0 8 106 105 13 126\n" +
"c=IN IP4 0.0.0.0\n" +
"a=rtcp:1 IN IP4 0.0.0.0\n" +
"a=ice-ufrag:K3+NLFZbAS2qphtU\n" +
"a=ice-pwd:AOuCQA4Zbycx12fVt7YrOnCh\n" +
"a=ice-options:google-ice\n" +
"a=fingerprint:sha-256 10:24:0B:10:43:7D:66:9A:0C:D0:5D:E7:1C:0B:C6:C5:D2:AC:5D:E0:6D:92:82:31:F8:93:5C:62:28:33:DB:1F\n" +
"a=setup:actpass\n" +
"a=mid:audio\n" +
"a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\n" +
"a=sendrecv\n" +
"a=rtcp-mux\n" +
"a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:OiFMCOT47NqfgEHak4DIaHkbIdbrR04m4avdzAa7\n" +
"a=rtpmap:111 opus/48000/2\n" +
"a=fmtp:111 minptime=10\n" +
"a=rtpmap:103 ISAC/16000\n" +
"a=rtpmap:104 ISAC/32000\n" +
"a=rtpmap:0 PCMU/8000\n" +
"a=rtpmap:8 PCMA/8000\n" +
"a=rtpmap:106 CN/32000\n" +
"a=rtpmap:105 CN/16000\n" +
"a=rtpmap:13 CN/8000\n" +
"a=rtpmap:126 telephone-event/8000\n" +
"a=maxptime:60\n" +
"a=ssrc:3362315790 cname:ZsVU8VM2guLJx/x9\n" +
"a=ssrc:3362315790 msid:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN 45b48641-f1ee-4b3f-979d-e5b1d4190cff\n" +
"a=ssrc:3362315790 mslabel:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"a=ssrc:3362315790 label:45b48641-f1ee-4b3f-979d-e5b1d4190cff\n" +
"m=video 1 RTP/SAVPF 100 116 117\n" +
"c=IN IP4 0.0.0.0\n" +
"a=rtcp:1 IN IP4 0.0.0.0\n" +
"a=ice-ufrag:K3+NLFZbAS2qphtU\n" +
"a=ice-pwd:AOuCQA4Zbycx12fVt7YrOnCh\n" +
"a=ice-options:google-ice\n" +
"a=fingerprint:sha-256 10:24:0B:10:43:7D:66:9A:0C:D0:5D:E7:1C:0B:C6:C5:D2:AC:5D:E0:6D:92:82:31:F8:93:5C:62:28:33:DB:1F\n" +
"a=setup:actpass\n" +
"a=mid:video\n" +
"a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\n" +
"a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\n" +
"a=sendrecv\n" +
"a=rtcp-mux\n" +
"a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:OiFMCOT47NqfgEHak4DIaHkbIdbrR04m4avdzAa7\n" +
"a=rtpmap:100 VP8/90000\n" +
"a=rtcp-fb:100 ccm fir\n" +
"a=rtcp-fb:100 nack\n" +
"a=rtcp-fb:100 nack pli\n" +
"a=rtcp-fb:100 goog-remb\n" +
"a=rtpmap:116 red/90000\n" +
"a=rtpmap:117 ulpfec/90000\n" +
"a=ssrc:2087637946 cname:ZsVU8VM2guLJx/x9\n" +
"a=ssrc:2087637946 msid:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN d5d04cca-9ea8-49ab-a940-f6b6383bb4d7\n" +
"a=ssrc:2087637946 mslabel:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"a=ssrc:2087637946 label:d5d04cca-9ea8-49ab-a940-f6b6383bb4d7";
        var sdpWithOnlyVideo = "v=0\n" +
"o=- 5677669584985122483 2 IN IP4 127.0.0.1\n" +
"s=-\n" +
"t=0 0\n" +
"a=group:BUNDLE audio video\n" +
"a=msid-semantic: WMS DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"m=video 1 RTP/SAVPF 100 116 117\n" +
"c=IN IP4 0.0.0.0\n" +
"a=rtcp:1 IN IP4 0.0.0.0\n" +
"a=ice-ufrag:K3+NLFZbAS2qphtU\n" +
"a=ice-pwd:AOuCQA4Zbycx12fVt7YrOnCh\n" +
"a=ice-options:google-ice\n" +
"a=fingerprint:sha-256 10:24:0B:10:43:7D:66:9A:0C:D0:5D:E7:1C:0B:C6:C5:D2:AC:5D:E0:6D:92:82:31:F8:93:5C:62:28:33:DB:1F\n" +
"a=setup:actpass\n" +
"a=mid:video\n" +
"a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\n" +
"a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\n" +
"a=sendrecv\n" +
"a=rtcp-mux\n" +
"a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:OiFMCOT47NqfgEHak4DIaHkbIdbrR04m4avdzAa7\n" +
"a=rtpmap:100 VP8/90000\n" +
"a=rtcp-fb:100 ccm fir\n" +
"a=rtcp-fb:100 nack\n" +
"a=rtcp-fb:100 nack pli\n" +
"a=rtcp-fb:100 goog-remb\n" +
"a=rtpmap:116 red/90000\n" +
"a=rtpmap:117 ulpfec/90000\n" +
"a=ssrc:2087637946 cname:ZsVU8VM2guLJx/x9\n" +
"a=ssrc:2087637946 msid:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN d5d04cca-9ea8-49ab-a940-f6b6383bb4d7\n" +
"a=ssrc:2087637946 mslabel:DvlCYPRkRx93VZdfw2ECuIXkWgFVD1o0RvMN\n" +
"a=ssrc:2087637946 label:d5d04cca-9ea8-49ab-a940-f6b6383bb4d7";

        var sdpWithOnlyDataChannel = "v=0\n" +
"o=- 2785540270768578609 2 IN IP4 127.0.0.1\n" +
"s=-\n" +
"t=0 0\n" +
"a=msid-semantic: WMS\n" +
"m=application 1 DTLS/SCTP 5000\n" +
"c=IN IP4 0.0.0.0\n" +
"a=ice-ufrag:YPDNhjrxiJKcuR/F\n" +
"a=ice-pwd:+q/zuV7eeznoIHjN1m/cfI2B\n" +
"a=ice-options:google-ice\n" +
"a=fingerprint:sha-256 10:24:0B:10:43:7D:66:9A:0C:D0:5D:E7:1C:0B:C6:C5:D2:AC:5D:E0:6D:92:82:31:F8:93:5C:62:28:33:DB:1F\n" +
"a=setup:actpass\n" +
"a=mid:data\n" +
"a=sctpmap:5000 webrtc-datachannel 1024";

        describe("sdpHasAudio", function () {
            it("correctly interprets an SDP with only audio", function () {
                expect(respoke.sdpHasAudio(sdpWithOnlyAudio)).to.equal(true);
            });

            it("correctly interprets an SDP with only video", function () {
                expect(respoke.sdpHasAudio(sdpWithOnlyVideo)).to.equal(false);
            });

            it("correctly interprets an SDP with both", function () {
                expect(respoke.sdpHasAudio(sdpWithBoth)).to.equal(true);
            });

            it("correctly interprets an SDP with only data channel", function () {
                expect(respoke.sdpHasAudio(sdpWithOnlyDataChannel)).to.equal(false);
            });
        });

        describe("sdpHasVideo", function () {
            it("correctly interprets an SDP with only audio", function () {
                expect(respoke.sdpHasVideo(sdpWithOnlyAudio)).to.equal(false);
            });

            it("correctly interprets an SDP with only video", function () {
                expect(respoke.sdpHasVideo(sdpWithOnlyVideo)).to.equal(true);
            });

            it("correctly interprets an SDP with both", function () {
                expect(respoke.sdpHasVideo(sdpWithBoth)).to.equal(true);
            });

            it("correctly interprets an SDP with only data channel", function () {
                expect(respoke.sdpHasAudio(sdpWithOnlyDataChannel)).to.equal(false);
            });
        });

        describe("sdpHasDataChannel", function () {
            it("correctly interprets an SDP with only audio", function () {
                expect(respoke.sdpHasDataChannel(sdpWithOnlyAudio)).to.equal(false);
            });

            it("correctly interprets an SDP with only video", function () {
                expect(respoke.sdpHasDataChannel(sdpWithOnlyVideo)).to.equal(false);
            });

            it("correctly interprets an SDP with both", function () {
                expect(respoke.sdpHasDataChannel(sdpWithBoth)).to.equal(false);
            });

            it("correctly interprets an SDP with only data channel", function () {
                expect(respoke.sdpHasDataChannel(sdpWithOnlyDataChannel)).to.equal(true);
            });
        });
    });

    describe("the constraints-parsing method", function () {
        var constraintsOnlyAudio1 = {
            audio: true,
            video: false
        };
        var constraintsOnlyVideo1 = {
            audio: false,
            video: true
        };
        var constraintsBoth1 = {
            audio: true,
            video: true
        };
        var constraintsOnlyVideo2 = {
            audio: false,
            video: {
                mandatory: {
                    maxWidth: 320,
                    maxHeight: 180
                }
            }
        };
        var constraintsBoth2 = {
            audio: true,
            video: {
                mandatory: {
                    maxWidth: 320,
                    maxHeight: 180
                }
            }
        };

        describe("constraintsHasAudio", function () {
            it("correctly interprets a constraints with only audio by booleans", function () {
                expect(respoke.constraintsHasAudio(constraintsOnlyAudio1)).to.equal(true);
            });

            it("correctly interprets a constraints with only video by booleans", function () {
                expect(respoke.constraintsHasAudio(constraintsOnlyVideo1)).to.equal(false);
            });

            it("correctly interprets a constraints with both by booleans", function () {
                expect(respoke.constraintsHasAudio(constraintsBoth1)).to.equal(true);
            });

            it("correctly interprets a constraints with only video by an object", function () {
                expect(respoke.constraintsHasAudio(constraintsOnlyVideo2)).to.equal(false);
            });

            it("correctly interprets a constraints with both by an object", function () {
                expect(respoke.constraintsHasAudio(constraintsBoth2)).to.equal(true);
            });
        });

        describe("constraintsHasVideo", function () {
            it("correctly interprets a constraints with only audio by booleans", function () {
                expect(respoke.constraintsHasVideo(constraintsOnlyAudio1)).to.equal(false);
            });

            it("correctly interprets a constraints with only video by booleans", function () {
                expect(respoke.constraintsHasVideo(constraintsOnlyVideo1)).to.equal(true);
            });

            it("correctly interprets a constraints with both by booleans", function () {
                expect(respoke.constraintsHasVideo(constraintsBoth1)).to.equal(true);
            });

            it("correctly interprets a constraints with only video by an object", function () {
                expect(respoke.constraintsHasVideo(constraintsOnlyVideo2)).to.equal(true);
            });

            it("correctly interprets a constraints with both by an object", function () {
                expect(respoke.constraintsHasVideo(constraintsBoth2)).to.equal(true);
            });
        });
    });

    describe("the isEqual method", function () {
        var aBool = true;
        var aString = "test";
        var aNumber = 5;
        var anArray = [aBool, aString, aNumber];
        var anObject = {
            aBool: aBool,
            aString: aString,
            aNumber: aNumber,
            anArray: anArray
        };

        it("should return true for the same object", function () {
            expect(respoke.isEqual(anObject, anObject)).to.be.true;
        });

        it("should return true for equal objects", function () {
            var testObject = {
                anArray: anArray,
                aNumber: aNumber,
                aString: aString,
                aBool: aBool
            }
            expect(respoke.isEqual(anObject, testObject)).to.be.true;
            expect(respoke.isEqual(testObject, anObject)).to.be.true;
        });

        it("should return true for equal objects with nesting", function () {
            var testObject1 = {
                aNumber: aNumber,
                anArray: anArray,
                anObject: anObject,
                aString: aString,
                aBool: aBool
            };
            var testObject2 = {
                aNumber: aNumber,
                anObject: anObject,
                aString: aString,
                anArray: anArray,
                aBool: aBool
            };
            expect(respoke.isEqual(testObject1, testObject2)).to.be.true;
            expect(respoke.isEqual(testObject2, testObject1)).to.be.true;
        });

        it("should return true for the same array", function () {
            expect(respoke.isEqual(anArray, anArray));
        });

        it("should return true for equal arrays", function () {
            var testArray = [aBool, aString, aNumber];
            expect(respoke.isEqual(anArray, testArray)).to.be.true;
            expect(respoke.isEqual(testArray, anArray)).to.be.true;
        });

        it("should return false for unequal objects", function () {
            var testObject = {
                aBoolTwo: aBool,
                aStringTwo: aString,
                aNumberTwo: aNumber,
                anArrayTwo: anArray
            }
            expect(respoke.isEqual(anObject, testObject)).to.be.false;
            expect(respoke.isEqual(testObject, anObject)).to.be.false;
        });

        it("should return false for unequal objects with nesting", function () {
            var testObject1 = {
                anArray: anArray,
                anObject: anObject,
                aString: aString,
                aBool: aBool
            };
            var testObject2 = {
                anObject: {
                    aBool: false,
                    aString: aString,
                    aNumber: aNumber,
                    anArray: anArray
                },
                aString: aString,
                anArray: anArray,
                aBool: aBool
            };

            expect(respoke.isEqual(testObject1, testObject2)).to.be.false;
            expect(respoke.isEqual(testObject2, testObject1)).to.be.false;
        });

        it("should return false for a populated object and an empty object", function () {
            expect(respoke.isEqual(anObject, {})).to.be.false;
            expect(respoke.isEqual({}, anObject)).to.be.false;
        });

        it("should return false for a populated array and an empty array", function () {
            expect(respoke.isEqual(anArray, [])).to.be.false;
            expect(respoke.isEqual([], anArray)).to.be.false;
        });

        it("should return false for arrays with different lengths", function () {
            var testArray = [aBool, aNumber];
            expect(respoke.isEqual(anArray, testArray)).to.be.false;
            expect(respoke.isEqual(testArray, anArray)).to.be.false;
        });

        it("should return false for unequal arrays with the same length", function () {
            var testArray = [aNumber, aString, aBool];
            expect(respoke.isEqual(anArray, testArray));
            expect(respoke.isEqual(testArray, anArray));
        });

        it("should return true for the same boolean values", function () {
            expect(respoke.isEqual(true, true)).to.be.true;
        });

        it("should return true for the same object", function () {
            expect(respoke.isEqual('test', 'test')).to.be.true;
        });

        it("should return true for the same number values", function () {
            expect(respoke.isEqual(5, 5)).to.be.true;
        });

        it("should return false for different boolean values", function () {
            expect(respoke.isEqual(true, false)).to.be.false;
            expect(respoke.isEqual(false, true)).to.be.false;
        });

        it("should return false for different number values", function () {
            expect(respoke.isEqual(5, 6)).to.be.false;
            expect(respoke.isEqual(6, 5)).to.be.false;
        });

        it("should return false for different string values", function () {
            expect(respoke.isEqual('test', 'no test')).to.be.false;
            expect(respoke.isEqual('no test', 'test')).to.be.false;
        });
    });
});
