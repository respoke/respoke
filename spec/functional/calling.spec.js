"use strict";

var expect = chai.expect;

describe("Respoke calling", function () {
    this.timeout(30000);
    respoke.useFakeMedia = true;

    var testEnv;
    var call;
    var followerClient = {};
    var followeeClient = {};
    var groupId = respoke.makeGUID();
    var groupRole = {
        name: 'fixturerole',
        groups: {
            "*": {
                create: true,
                publish: true,
                subscribe: true,
                unsubscribe: true,
                getsubscribers: true
            }
        }
    };
    var testFixture = fixture("Calling Functional test", {
        roleParams: groupRole
    });

    var followerEndpoint;
    var followeeEndpoint;
    var followerGroup;
    var followeeGroup;
    var followerToken;
    var followeeToken;
    var appId;
    var roleId;

    beforeEach(function (done) {
        respoke.Q.nfcall(testFixture.beforeTest).then(function (env) {
            testEnv = env;

            return respoke.Q.nfcall(testFixture.createApp, testEnv.httpClient, {}, groupRole);
        }).then(function (params) {
            // create 2 tokens
            roleId = params.role.id;
            appId = params.app.id;
            return [respoke.Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            }), respoke.Q.nfcall(testFixture.createToken, testEnv.httpClient, {
                roleId: roleId,
                appId: appId
            })];
        }).spread(function (token1, token2) {
            followerToken = token1;
            followeeToken = token2;

            followerClient = respoke.createClient();
            followeeClient = respoke.createClient();

            return respoke.Q.all([followerClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followeeClient.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).done(function () {
            expect(followerClient.endpointId).not.to.be.undefined;
            expect(followerClient.endpointId).to.equal(followerToken.endpointId);
            expect(followeeClient.endpointId).not.to.be.undefined;
            expect(followeeClient.endpointId).to.equal(followeeToken.endpointId);
            followerEndpoint = followeeClient.getEndpoint({id: followerClient.endpointId});
            followeeEndpoint = followerClient.getEndpoint({id: followeeClient.endpointId});
            done();
        }, done);
    });

    describe("when placing a call", function () {
        function callListener(evt) {
            if (evt.call.caller !== true) {
                evt.call.answer();
            }
        }

        describe("with call listener specified", function () {
            var stream;
            var localElement;
            var remoteElement;

            beforeEach(function (done) {
                followeeClient.listen('call', callListener);
                var doneOnce = doneOnceBuilder(done);

                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        localElement = evt.element;
                        stream = evt.stream;
                    },
                    onConnect: function (evt) {
                        remoteElement = evt.element;
                        doneOnce();
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });

            });

            it("succeeds and sets up outgoingMedia", function () {
                expect(stream).to.be.ok;
                expect(localElement).to.be.ok;
                expect(remoteElement).to.be.ok;
                expect(call.outgoingMediaStreams.length).to.equal(1);
                expect(call.incomingMediaStreams.length).to.equal(1);
                expect(call.outgoingMedia).to.be.ok;
                expect(call.outgoingMedia.className).to.equal('respoke.LocalMedia');
                expect(call.incomingMedia).to.be.ok;
                expect(call.incomingMedia.className).to.equal('respoke.RemoteMedia');
                expect(call.outgoingMedia.hasVideo()).to.equal(true);
                expect(call.outgoingMedia.hasAudio()).to.equal(true);
                expect(call.incomingMedia.hasVideo()).to.equal(true);
                expect(call.incomingMedia.hasAudio()).to.equal(true);
                expect(call.hasMedia()).to.equal(true);
                expect(call.hasAudio).to.equal(true);
                expect(call.hasVideo).to.equal(true);
            });
        });

        describe("when passing in our own video element", function () {
            var local;
            var remote;

            beforeEach(function () {
                local = document.createElement("VIDEO");
                local.id = "my-local-video-element";
                remote = document.createElement("VIDEO");
                remote.id = "my-remote-video-element";
                followeeClient.listen('call', callListener);
                expect(local.src).not.to.be.ok;
                expect(remote.src).not.to.be.ok;
            });

            it("uses my video elements and doesn't create new ones", function (done) {
                var doneOnce = doneOnceBuilder(done);

                call = followeeEndpoint.startCall({
                    videoLocalElement: local,
                    videoRemoteElement: remote,
                    onLocalMedia: function (evt) {
                        try {
                            expect(evt.stream).to.be.ok;
                            expect(evt.element).to.be.ok;
                            expect(evt.element.id).to.equal("my-local-video-element");

                            try {
                                expect(evt.element.src).to.be.ok;
                            } catch (f) {
                                try {
                                    expect(evt.element.mozSrcObject).to.be.ok;
                                } catch (g) {
                                    throw f;
                                }
                            }
                        } catch (e) {
                            doneOnce(e);
                        }
                    },
                    onConnect: function (evt) {
                        try {
                            expect(evt.stream).to.be.ok;
                            expect(evt.element).to.be.ok;
                            expect(evt.element.id).to.equal("my-remote-video-element");
                            expect(call.caller).to.equal(call.initiator);

                            try {
                                expect(evt.element.src).to.be.ok;
                            } catch (f) {
                                try {
                                    expect(evt.element.mozSrcObject).to.be.ok;
                                } catch (g) {
                                    throw f;
                                }
                            }

                            doneOnce();
                        } catch (e) {
                            doneOnce(e);
                        }
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });
        });

        describe("ICE candidates when forceTurn is disabled", function () {
            var followerICE = [];
            var followeeICE = [];

            beforeEach(function (done) {
                var doneOnce = doneOnceBuilder(done);
                followeeClient.listen('call', function (evt) {
                    if (evt.call.caller !== true) {
                        evt.call.answer({
                            forceTurn: false
                        });
                    }

                    evt.call.listen('signal-icecandidates', function (evt) {
                        followeeICE = followeeICE.concat(evt.signal.iceCandidates);
                    });
                });

                call = followeeEndpoint.startCall({
                    onConnect: function (evt) {
                        setTimeout(doneOnce, 200);
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call hung up automatically."));
                    }
                });
                call.listen('signal-icecandidates', function (evt) {
                    followerICE = followerICE.concat(evt.signal.iceCandidates);
                });
            });

            it("are received by both sides", function () {
                if (navigator.userAgent.toLowerCase().indexOf('firefox') === -1) {
                    // No trickle-ICE in Firefox.
                    expect(followerICE.length).to.be.above(1);
                    expect(followeeICE.length).to.be.above(1);
                }
            });
        });

        describe("ICE candidates when forceTurn is enabled", function () {
            var followerICE = [];
            var followeeICE = [];

            beforeEach(function (done) {
                var doneOnce = doneOnceBuilder(done);
                followeeClient.listen('call', function (evt) {
                    if (evt.call.caller !== true) {
                        evt.call.answer({
                            forceTurn: true
                        });
                    }

                    evt.call.listen('signal-icecandidates', function (evt) {
                        followeeICE = followeeICE.concat(evt.signal.iceCandidates);
                    });
                });

                call = followeeEndpoint.startCall({
                    forceTurn: true,
                    onConnect: function (evt) {
                        setTimeout(doneOnce, 200);
                    }
                });
                call.listen('signal-icecandidates', function (evt) {
                    followerICE = followerICE.concat(evt.signal.iceCandidates);
                });
            });

            it("no candidates are received", function () {
                expect(followerICE.length).to.equal(0);
                expect(followeeICE.length).to.equal(0);
            });
        });

        describe("without a call listener specified", function () {
            it("gets hung up automatically", function (done) {
                call = followeeEndpoint.startCall({
                    onHangup: function (evt) {
                        done();
                    }
                });
            });
        });

        describe("with only audio", function () {
            beforeEach(function () {
                followeeClient.listen('call', callListener);
            });

            describe("by constraints", function () {
                it("caller and callee send and receive the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video: false,
                            audio: true,
                            optional: [],
                            mandatory: {}
                        },
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                                expect(call.outgoingMediaStreams.length).to.equal(1);
                                expect(call.outgoingMedia.hasVideo()).to.equal(false);
                                expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                expect(call.outgoingMediaStreams.hasVideo()).to.equal(false);
                                expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                                expect(call.incomingMediaStreams.length).to.equal(1);
                                expect(call.incomingMedia.hasVideo()).to.equal(false);
                                expect(call.incomingMedia.hasAudio()).to.equal(true);
                                expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                                expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                expect(call.hasMedia()).to.equal(true);
                                expect(call.hasAudio).to.equal(true);
                                expect(call.hasVideo).to.equal(false);
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });

            describe("by the Endpoint.startAudioCall method", function () {
                it("caller and callee send and receive the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startAudioCall({
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                                expect(call.outgoingMediaStreams.length).to.equal(1);
                                expect(call.outgoingMedia.hasVideo()).to.equal(false);
                                expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                expect(call.outgoingMediaStreams.hasVideo()).to.equal(false);
                                expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                                expect(call.incomingMediaStreams.length).to.equal(1);
                                expect(call.incomingMedia.hasVideo()).to.equal(false);
                                expect(call.incomingMedia.hasAudio()).to.equal(true);
                                expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                                expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                expect(call.hasMedia()).to.equal(true);
                                expect(call.hasAudio).to.equal(true);
                                expect(call.hasVideo).to.equal(false);
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });
        });

        describe("with only video", function () {
            beforeEach(function () {
                followeeClient.listen('call', callListener);
            });

            describe("by constraints", function () {
                it("caller and callee send and receive the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video: true,
                            audio: false,
                            optional: [],
                            mandatory: {}
                        },
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.empty;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.outgoingMediaStreams.length).to.equal(1);
                                expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                expect(call.outgoingMedia.hasAudio()).to.equal(false);
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.empty;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.incomingMediaStreams.length).to.equal(1);
                                expect(call.incomingMedia.hasVideo()).to.equal(true);
                                expect(call.incomingMedia.hasAudio()).to.equal(false);
                                expect(call.hasMedia()).to.equal(true);
                                expect(call.hasAudio).to.equal(false);
                                expect(call.hasVideo).to.equal(true);
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });
        });

        describe("with video and audio", function () {
            beforeEach(function () {
                followeeClient.listen('call', callListener);
            });

            describe("by constraints", function () {
                it("caller and callee send and receive the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video: true,
                            audio: true,
                            optional: [],
                            mandatory: {}
                        },
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.outgoingMediaStreams.length).to.equal(1);
                                expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                expect(call.outgoingMediaStreams.hasVideo()).to.equal(true);
                                expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.incomingMediaStreams.length).to.equal(1);
                                expect(call.incomingMedia.hasVideo()).to.equal(true);
                                expect(call.incomingMedia.hasAudio()).to.equal(true);
                                expect(call.incomingMediaStreams.hasVideo()).to.equal(true);
                                expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                expect(call.hasMedia()).to.equal(true);
                                expect(call.hasAudio).to.equal(true);
                                expect(call.hasVideo).to.equal(true);
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });

            describe("by the Endpoint.startVideoCall method", function () {
                it("caller and callee send and receive the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startVideoCall({
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.outgoingMediaStreams.length).to.equal(1);
                                expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                expect(call.outgoingMediaStreams.hasVideo()).to.equal(true);
                                expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.incomingMediaStreams.length).to.equal(1);
                                expect(call.incomingMedia.hasVideo()).to.equal(true);
                                expect(call.incomingMedia.hasAudio()).to.equal(true);
                                expect(call.incomingMediaStreams.hasVideo()).to.equal(true);
                                expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                expect(call.hasMedia()).to.equal(true);
                                expect(call.hasAudio).to.equal(true);
                                expect(call.hasVideo).to.equal(true);
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });
        });

        describe("with one-way media", function () {
            describe("originating from caller", function () {
                describe("with constraints as well as receiveOnly flag", function () {
                    var noMediaCallListener = function (evt) {
                        if (evt.call.caller !== true) {
                            evt.call.answer({
                                receiveOnly: true,
                                constraints: {
                                    audio: false,
                                    video: false
                                }
                            });
                        }
                    };

                    beforeEach(function () {
                        followeeClient.listen('call', noMediaCallListener);
                    });

                    afterEach(function () {
                        followeeClient.ignore('call', noMediaCallListener);
                    });

                    it("caller and callee send and receive the right things", function (done) {
                        var doneOnce = doneOnceBuilder(done);

                        call = followeeEndpoint.startCall({
                            constraints: {
                                video: true,
                                audio: true,
                                optional: [],
                                mandatory: {}
                            },
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.element).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                    expect(call.outgoingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onConnect: function (evt) {
                                try {
                                    expect(evt.element).to.be.undefined;
                                    expect(call.incomingMedia).to.equal(undefined);
                                    expect(call.incomingMediaStreams.length).to.equal(0);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(false);
                                    expect(call.hasMedia()).to.equal(true);
                                    expect(call.hasAudio).to.equal(false);
                                    expect(call.hasVideo).to.equal(false);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up"));
                            }
                        });
                    });
                });

                describe("with only the receiveOnly flag", function () {
                    var noMediaCallListener = function (evt) {
                        if (evt.call.caller !== true) {
                            evt.call.answer({
                                receiveOnly: true
                            });
                        }
                    };

                    beforeEach(function () {
                        followeeClient.listen('call', noMediaCallListener);
                    });

                    afterEach(function () {
                        followeeClient.ignore('call', noMediaCallListener);
                    });

                    it("caller and callee send and receive the right things", function (done) {
                        var doneOnce = doneOnceBuilder(done);

                        call = followeeEndpoint.startCall({
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.element).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onConnect: function (evt) {
                                try {
                                    expect(evt.element).to.be.undefined;
                                    expect(call.incomingMediaStreams.length).to.equal(0);
                                    expect(call.incomingMedia).to.equal(undefined);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(false);
                                    expect(call.hasMedia()).to.equal(true);
                                    expect(call.hasAudio).to.equal(false);
                                    expect(call.hasVideo).to.equal(false);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up"));
                            }
                        });
                    });
                });
            });
        });

        describe("originating from the callee", function () {
            var callListener = function (evt) {
                if (evt.call.caller !== true) {
                    evt.call.answer({
                        constraints: {
                            audio: true,
                            video: true
                        }
                    });
                }
            };

            describe("with constraints as well as receiveOnly flag", function () {
                beforeEach(function () {
                    followeeClient.listen('call', callListener);
                });

                afterEach(function () {
                    followeeClient.ignore('call', callListener);
                });

                it("caller and callee send and receive the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        receiveOnly: true,
                        constraints: {
                            video: false,
                            audio: false,
                            optional: [],
                            mandatory: {}
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                expect(call.incomingMediaStreams.length).to.equal(1);
                                expect(call.incomingMedia.hasVideo()).to.equal(true);
                                expect(call.incomingMedia.hasAudio()).to.equal(true);
                                expect(call.hasMedia()).to.equal(true);
                                expect(call.hasAudio).to.equal(true);
                                expect(call.hasVideo).to.equal(true);
                                expect(call.outgoingMediaStreams.length).to.equal(0);
                                expect(call.outgoingMedia).to.equal(undefined);
                                expect(call.outgoingMedia).to.equal(undefined);
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });
        });

        xdescribe("screen sharing", function () {
            it("sends only video and no audio", function (done) {
                var doneOnce = doneOnceBuilder(done);

                call = followeeEndpoint.startScreenShare({
                    onLocalMedia: function (evt) {
                        try {
                            expect(evt.stream).to.be.ok;
                            expect(evt.element).to.be.ok;
                            expect(evt.stream.getAudioTracks()).to.be.ok;
                            expect(evt.stream.getVideoTracks()).to.be.empty;
                            expect(call.outgoingMediaStreams.length).to.equal(1);
                            expect(call.outgoingMedia.hasVideo()).to.equal(true);
                            expect(call.outgoingMedia.hasAudio()).to.equal(false);
                        } catch (e) {
                            doneOnce(e);
                        }
                    },
                    onConnect: function (evt) {
                        doneOnce();
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });

            it("receives nothing", function (done) {
                var doneOnce = doneOnceBuilder(done);

                call = followeeEndpoint.startVideoCall({
                    onConnect: function (evt) {
                        try {
                            expect(call.incomingMediaStreams.length).to.equal(0);
                            expect(call.incomingMedia).to.equal(undefined);
                            expect(call.incomingMedia).to.equal(undefined);
                            expect(call.hasMedia()).to.equal(true);
                            expect(call.hasAudio).to.equal(false);
                            expect(call.hasVideo).to.equal(false);
                            doneOnce();
                        } catch (e) {
                            doneOnce(e);
                        }
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });
        });

        describe("when previewLocalMedia is specified", function () {
            beforeEach(function () {
                followeeClient.listen('call', callListener);
            });

            it("Call.approve is not called automatically", function (done) {
                var doneOnce = doneOnceBuilder(done);

                call = followeeEndpoint.startCall({
                    onApprove: function (evt) {
                        doneOnce(new Error("Approve was called immediately!"));
                    },
                    previewLocalMedia: function (element, call) {
                        call.ignore('approve');
                        doneOnce();
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });

            describe("when Call.approve is called", function () {
                beforeEach(function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        previewLocalMedia: function (element, call) {
                            doneOnce();
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });

                it("succeeds", function (done) {
                    call.listen('local-stream-received', function (evt) {
                        done();
                    });
                    call.listen('requesting-media', function (evt) {
                        call.approve();
                    });
                });
            });

            // Can't actually test this because we are using the fake gUM UI flag which doesn't give any time
            // between asking for media and receiving it. The library has a 500ms delay between asking for media and
            // firing requesting-media so that the UI doesn't flash a request to click the button when no
            // additional permissions are needed. Maybe we can test this another way in the future.
            xdescribe("the onRequestingMedia callback", function () {
                it("gets called before onLocalMedia", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        onRequestingMedia: function (evt) {
                            doneOnce();
                        },
                        onLocalMedia: function (evt) {
                            doneOnce(new Error("onLocalMedia got called first."));
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });

                it("gets called before onAllow", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    call = followeeEndpoint.startCall({
                        onRequestingMedia: function (evt) {
                            doneOnce();
                        },
                        onAllow: function (evt) {
                            doneOnce(new Error("onAllow got called first."));
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up"));
                        }
                    });
                });
            });
        });

        describe("the onLocalMedia callback", function () {
            beforeEach(function () {
                followeeClient.listen('call', callListener);
            });

            it("gets called before onApprove and onConnect", function (done) {
                var doneOnce = doneOnceBuilder(done);

                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        doneOnce();
                    },
                    onApprove: function (evt) {
                        doneOnce(new Error("onApprove got called first."));
                    },
                    onConnect: function (evt) {
                        doneOnce(new Error("onConnect got called first."));
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up"));
                    }
                });
            });
        });

        describe("the hangup method", function () {
            beforeEach(function () {
                followeeClient.listen('call', callListener);
                call = followeeEndpoint.startCall({
                    constraints: {
                        video: true,
                        audio: true,
                        optional: [],
                        mandatory: {}
                    }
                });
            });

            afterEach(function () {
                followeeClient.ignore('call', callListener);
            });

            it("causes the hangup event to fire & the call not to be active", function (done) {
                call.listen('hangup', function (evt) {
                    try {
                        expect(call.isActive()).to.be.false;
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
                call.hangup();
            });
        });

        describe("call debugs", function () {
            var original;
            var iSpy;

            describe('default behavior', function () {

                beforeEach(function () {
                    original = respoke.Call;
                    respoke.Call = function (params) {
                        iSpy = sinon.spy(params, 'signalReport');
                        return original.call(this, params);
                    };

                    followeeClient.listen('call', callListener);
                    call = followeeEndpoint.startCall();
                });

                afterEach(function () {
                    followeeClient.ignore('call', callListener);
                    respoke.Call = original;
                });

                it("is call debugs enabled and signalReport gets called", function (done) {
                    call.listen('hangup', function (evt) {
                        try {
                            expect(call.enableCallDebugReport).to.equal(true);
                            expect(iSpy.calledOnce).to.equal(true);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
                    call.hangup();
                });

                // This is really hard to test because of scope. Likely the best way to test this is to
                // fire an event after sending the call debug report to the API.
                xit("sends call debugs");
            });

            describe('when disabling call debugs', function () {
                var follower_nodebug;
                var followeeEndpoint_nodebug;

                beforeEach(function (done) {
                    original = respoke.Call;
                    respoke.Call = function (params) {
                        iSpy = sinon.spy(params, 'signalReport');
                        return original.call(this, params);
                    };

                    follower_nodebug = respoke.createClient({
                        enableCallDebugReport: false
                    });

                    follower_nodebug.connect({
                        appId: Object.keys(testEnv.allApps)[0],
                        baseURL: respokeTestConfig.baseURL,
                        token: followerToken.tokenId,
                        onConnect: function () {
                            followeeEndpoint_nodebug = follower_nodebug.getEndpoint({id: followeeClient.endpointId});
                            followeeClient.listen('call', callListener);
                            call = followeeEndpoint_nodebug.startCall();
                            done();
                        }
                    });

                });

                afterEach(function () {
                    followeeClient.ignore('call', callListener);
                    respoke.Call = original;
                });

                it("the flag is set to false and signalReport does not get called", function (done) {
                    call.listen('hangup', function (evt) {
                        try {
                            expect(iSpy.called).to.equal(false);
                            expect(call.enableCallDebugReport).to.equal(false);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
                    call.hangup();
                });

                // This is really hard to test because of scope. Likely the best way to test this is to
                // fire an event after sending the call debug report to the API.
                xit("does not send call debugs");
            });
        });

        describe("muting", function () {
            var localStream;
            var remoteStream;
            var muteSpy1 = sinon.spy();
            var muteSpy2 = sinon.spy();

            beforeEach(function (done) {
                followeeClient.listen('call', callListener);
                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        localStream = evt.stream;
                        call.outgoingMedia.listen('mute', muteSpy2);
                    },
                    onConnect: function (evt) {
                        remoteStream = evt.stream;
                        done();
                    },
                    onMute: muteSpy1
                });
            });

            describe("local", function () {
                describe("video", function () {
                    beforeEach(function () {
                        call.muteVideo();
                    });

                    afterEach(function () {
                        call.unmuteVideo();
                    });

                    it("disables the video stream", function () {
                        var videoTracks = localStream.getVideoTracks();
                        expect(videoTracks.length).to.equal(1);
                        expect(videoTracks[0].enabled).to.equal(false);
                    });

                    it("causes the mute events to fire", function () {
                        expect(muteSpy1.called).to.be.ok;
                        expect(muteSpy2.called).to.be.ok;
                    });
                });

                describe("audio", function () {
                    beforeEach(function () {
                        call.muteAudio();
                    });

                    afterEach(function () {
                        call.unmuteAudio();
                    });

                    it("disables the audio stream", function () {
                        var audioTracks = localStream.getAudioTracks();
                        expect(audioTracks.length).to.equal(1);
                        expect(audioTracks[0].enabled).to.equal(false);
                    });

                    it("causes the mute events to fire", function () {
                        expect(muteSpy1.called).to.be.ok;
                        expect(muteSpy2.called).to.be.ok;
                    });
                });
            });

            describe("remote", function () {
                describe("video", function () {
                    beforeEach(function () {
                        call.incomingMedia.muteVideo();
                    });

                    afterEach(function () {
                        call.incomingMedia.unmuteVideo();
                    });

                    it("disables the video stream", function () {
                        var videoTracks = remoteStream.getVideoTracks();
                        expect(videoTracks.length).to.equal(1);
                        expect(videoTracks[0].enabled).to.equal(false);
                    });

                    it("causes the mute event to fire", function () {
                        expect(muteSpy1.called).to.be.ok;
                    });
                });

                describe("audio", function () {
                    beforeEach(function () {
                        expect(call.incomingMediaStreams).to.be.ok;
                        expect(call.incomingMediaStreams.length).to.be.ok;
                        call.incomingMedia.muteAudio();
                    });

                    afterEach(function () {
                        call.incomingMedia.unmuteAudio();
                    });

                    it("disables the audio stream", function () {
                        var audioTracks = remoteStream.getAudioTracks();
                        expect(audioTracks.length).to.equal(1);
                        expect(audioTracks[0].enabled).to.equal(false);
                    });

                    it("causes the mute event to fire", function () {
                        expect(muteSpy1.called).to.be.ok;
                    });
                });
            });
        });
    });

    describe("placing two calls to the same endpoint with no overlapping media constraints", function () {
        function callListener(evt) {
            if (evt.call.caller !== true) {
                evt.call.answer();
            }
        }

        var call2;

        beforeEach(function (done) {
            followeeClient.listen('call', callListener);
            call = followeeEndpoint.startCall({
                constraints: {
                    video: false,
                    audio: true,
                    optional: [],
                    mandatory: {}
                },
                onConnect: function (evt) {
                    done();
                }
            });
        });

        afterEach(function (done) {
            followeeClient.ignore('call', callListener);
            call2.listen('hangup', function (evt) {
                done();
            });
            call2.hangup();
        });

        it("causes two calls to be set up correctly", function (done) {
            var doneOnce = doneOnceBuilder(done);

            call2 = followeeEndpoint.startCall({
                constraints: {
                    video: true,
                    audio: false,
                    optional: [],
                    mandatory: {}
                },
                onConnect: function (evt) {
                    try {
                        expect(evt.stream).to.be.ok;
                        expect(evt.element).to.be.ok;
                        expect(evt.stream.getAudioTracks()).to.be.empty;
                        expect(evt.stream.getVideoTracks()).to.be.ok;
                        // call is sending only audio
                        expect(call.outgoingMediaStreams.length).to.equal(1);
                        expect(call.outgoingMediaStreams.hasVideo()).to.equal(false);
                        expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                        expect(call.outgoingMedia.hasVideo()).to.equal(false);
                        expect(call.outgoingMedia.hasAudio()).to.equal(true);
                        // call is receiving only audio
                        expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                        expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                        expect(call.incomingMedia.hasVideo()).to.equal(false);
                        expect(call.incomingMedia.hasAudio()).to.equal(true);
                        expect(call.hasAudio).to.equal(true);
                        expect(call.hasVideo).to.equal(false);
                        expect(call.hasMedia()).to.equal(true);
                        // call2 is sending only video
                        expect(call2.outgoingMediaStreams.length).to.equal(1);
                        expect(call2.outgoingMediaStreams.hasVideo()).to.equal(true);
                        expect(call2.outgoingMediaStreams.hasAudio()).to.equal(false);
                        expect(call2.outgoingMedia.hasVideo()).to.equal(true);
                        expect(call2.outgoingMedia.hasAudio()).to.equal(false);
                        // call2 is receiving only video
                        expect(call2.incomingMediaStreams.hasVideo()).to.equal(true);
                        expect(call2.incomingMediaStreams.hasAudio()).to.equal(false);
                        expect(call2.incomingMedia.hasVideo()).to.equal(true);
                        expect(call2.incomingMedia.hasAudio()).to.equal(false);
                        expect(call2.hasVideo).to.equal(true);
                        expect(call2.hasAudio).to.equal(false);
                        expect(call2.hasMedia()).to.equal(true);
                    } catch (e) {
                        doneOnce(e);
                    }
                },
                onLocalMedia: function (evt) {
                    try {
                        expect(evt.element).to.be.ok;
                        expect(evt.element).to.be.ok;
                        expect(evt.stream.getAudioTracks()).to.be.empty;
                        expect(evt.stream.getVideoTracks()).to.be.ok;
                        doneOnce();
                    } catch (e) {
                        doneOnce(e);
                    }
                },
                onHangup: function (evt) {
                    doneOnce(new Error("Call got hung up"));
                }
            });
        });
    });

    describe("when receiving a call", function () {
        describe("with call listener specified", function () {
            beforeEach(function () {
                followeeEndpoint.startCall();
            });

            it("succeeds", function (done) {
                followeeClient.listen('call', function (evt) {
                    call = evt.call;
                    done();
                });
            });
        });

        describe("with only audio", function () {
            describe("by constraints in answer()", function () {
                var constraints = {
                    video : false,
                    audio : true,
                    optional: [],
                    mandatory: {
                        offerToReceiveVideo: true
                    }
                };

                beforeEach(function () {
                    followeeEndpoint.startCall();
                });

                it("callee and caller receive all the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    followeeClient.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.incomingMedia).to.be.ok;
                                    expect(call.incomingMedia.hasVideo()).to.equal(true);
                                    expect(call.incomingMedia.hasAudio()).to.equal(true);
                                    expect(call.incomingMediaStreams.length).to.equal(1);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                    expect(call.hasVideo).to.equal(true);
                                    expect(call.hasAudio).to.equal(true);
                                    expect(call.hasMedia()).to.equal(true);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onLocalMedia: function (evt) {
                                try {
                                    expect(call.caller).to.equal(call.initiator);
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    expect(call.outgoingMedia).to.be.ok;
                                    expect(call.outgoingMedia.hasVideo()).to.equal(false);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMediaStreams.hasVideo()).to.equal(false);
                                    expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up on."));
                            }
                        });
                    });
                });
            });

            describe("by leaning on caller's SDP", function () {
                beforeEach(function () {
                    followeeEndpoint.startAudioCall();
                });

                it("callee and caller receive all the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    followeeClient.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    expect(call.outgoingMedia).to.be.ok;
                                    expect(call.outgoingMedia.hasVideo()).to.equal(false);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMediaStreams.hasVideo()).to.equal(false);
                                    expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    expect(call.incomingMedia).to.be.ok;
                                    expect(call.incomingMedia.hasVideo()).to.equal(false);
                                    expect(call.incomingMedia.hasAudio()).to.equal(true);
                                    expect(call.incomingMediaStreams.length).to.equal(1);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                    expect(call.hasVideo).to.equal(false);
                                    expect(call.hasAudio).to.equal(true);
                                    expect(call.hasMedia()).to.equal(true);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up on."));
                            }
                        });
                    });
                });
            });
        });

        describe("with only video", function () {
            var constraints = {
                video: true,
                audio: false,
                optional: [],
                mandatory: {
                    offerToReceiveAudio: true
                }
            };

            describe("by constraints", function () {
                beforeEach(function () {
                    followeeEndpoint.startCall();
                });

                it("callee and caller receive all the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    followeeClient.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.empty;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.outgoingMedia).to.be.ok;
                                    expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(false);
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.outgoingMediaStreams.hasAudio()).to.equal(false);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.incomingMedia).to.be.ok;
                                    expect(call.incomingMedia.hasVideo()).to.equal(true);
                                    expect(call.incomingMedia.hasAudio()).to.equal(true);
                                    expect(call.incomingMediaStreams.length).to.equal(1);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                    expect(call.hasVideo).to.equal(true);
                                    expect(call.hasAudio).to.equal(true);
                                    expect(call.hasMedia()).to.equal(true);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up on."));
                            }
                        });
                    });
                });
            });

            describe("by leaning on caller's SDP", function () {
                beforeEach(function () {
                    followeeEndpoint.startCall({
                        constraints: constraints
                    });
                });

                it("callee and caller receive all the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    followeeClient.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.empty;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.outgoingMedia).to.be.ok;
                                    expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(false);
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.outgoingMediaStreams.hasAudio()).to.equal(false);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.empty;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(call.incomingMedia).to.be.ok;
                                    expect(call.incomingMedia.hasVideo()).to.equal(true);
                                    expect(call.incomingMedia.hasAudio()).to.equal(false);
                                    expect(call.incomingMediaStreams.length).to.equal(1);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(false);
                                    expect(call.hasVideo).to.equal(true);
                                    expect(call.hasAudio).to.equal(false);
                                    expect(call.hasMedia()).to.equal(true);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up on."));
                            }
                        });
                    });
                });
            });
        });

        describe("with asymmetric media", function () {
            var constraints = {
                video: true,
                audio: true,
                optional: [],
                mandatory: {}
            };

            describe("by constraints", function () {
                beforeEach(function () {
                    followeeEndpoint.startAudioCall();
                });

                it("callee and caller receive all the right things", function (done) {
                    var doneOnce = doneOnceBuilder(done);

                    followeeClient.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(call.outgoingMedia).to.be.ok;
                                    expect(call.outgoingMedia.hasVideo()).to.equal(true);
                                    expect(call.outgoingMedia.hasAudio()).to.equal(true);
                                    expect(call.outgoingMediaStreams.length).to.equal(1);
                                    expect(call.outgoingMediaStreams.hasVideo()).to.equal(true);
                                    expect(call.outgoingMediaStreams.hasAudio()).to.equal(true);
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    expect(call.incomingMedia).to.be.ok;
                                    expect(call.incomingMedia.hasVideo()).to.equal(false);
                                    expect(call.incomingMedia.hasAudio()).to.equal(true);
                                    expect(call.incomingMediaStreams.length).to.equal(1);
                                    expect(call.incomingMediaStreams.hasVideo()).to.equal(false);
                                    expect(call.incomingMediaStreams.hasAudio()).to.equal(true);
                                    expect(call.hasVideo).to.equal(false);
                                    expect(call.hasAudio).to.equal(true);
                                    expect(call.hasMedia()).to.equal(true);
                                    doneOnce();
                                } catch (e) {
                                    doneOnce(e);
                                }
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up on."));
                            }
                        });
                    });
                });
            });
        });

        describe("when passing in our own video element", function () {
            var local;
            var remote;
            var listener;
            var localElement;
            var remoteElement;
            var call;

            beforeEach(function (done) {
                var doneOnce = doneOnceBuilder(done);

                listener = function (evt) {
                    if (!evt.call.caller) {
                        evt.call.answer({
                            videoLocalElement: local,
                            videoRemoteElement: remote,
                            onLocalMedia: function (evt) {
                                localElement = evt.element;
                            },
                            onConnect: function (evt) {
                                remoteElement = evt.element;
                                doneOnce();
                            },
                            onHangup: function (evt) {
                                doneOnce(new Error("Call got hung up"));
                            }
                        });
                    }
                };

                local = document.createElement("VIDEO");
                local.id = "my-local-video-element";
                remote = document.createElement("VIDEO");
                remote.id = "my-remote-video-element";
                followeeClient.listen('call', listener);

                call = followeeEndpoint.startCall();
            });

            afterEach(function () {
                followeeClient.ignore('call', listener);
            });

            it("uses my video elements and doesn't create new ones", function () {
                expect(localElement).to.be.ok;
                expect(localElement.id).to.equal("my-local-video-element");
                expect(remoteElement).to.be.ok;
                expect(remoteElement.id).to.equal("my-remote-video-element");
            });
        });
    });

    afterEach(function (done) {
        var promises = [];

        [followerClient, followeeClient].forEach(function (client) {
            if (client && client.calls) {
                for (var i = client.calls.length - 1; i >= 0; i -= 1) {
                    client.calls[i].hangup();
                }
                promises.push(client.disconnect());
            }
        });

        respoke.Q.all(promises).fin(function () {
            testFixture.afterTest(done);
        }).done();
    });
});
