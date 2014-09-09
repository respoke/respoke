var expect = chai.expect;

// Call a function only if there's a error or on the $num attempt
function doneCountBuilder(num, done) {
   return (function () {
        var called = false;
        var count = 0;
        if (!num || num < 0) {
            throw new Error('First argument must be a positive integer.');
        }

        return function (err) {
            if (called === true) {
                return;
            }

            count += 1;
            if (count === num || err) {
                called = true;
                done(err);
            }
        };
    })();
};

describe("doneCountBuilder", function () {
    var builderSpy;
    var doneOnce;

    beforeEach(function () {
        builderSpy = sinon.spy();
        doneOnce = doneCountBuilder(4, builderSpy);
    });

    describe("when it's called a fewer number of times as $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 2; i += 1) {
                doneOnce();
            }
        });

        it("doesn't call the function", function () {
            expect(builderSpy.called).to.equal(false);
            expect(builderSpy.callCount).to.equal(0);
        });
    });

    describe("when it's called the same number of times as $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 4; i += 1) {
                doneOnce();
            }
        });

        it("calls the function only once", function () {
            expect(builderSpy.called).to.equal(true);
            expect(builderSpy.callCount).to.equal(1);
        });
    });

    describe("when it's called a greater number of times than $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 12; i += 1) {
                doneOnce();
            }
        });

        it("calls the function only once", function () {
            expect(builderSpy.called).to.equal(true);
            expect(builderSpy.callCount).to.equal(1);
        });
    });
});

describe("Respoke calling", function () {
    this.timeout(30000);

    var testEnv;
    var call;
    var follower = {};
    var followee = {};
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

            follower = respoke.createClient();
            followee = respoke.createClient();

            return respoke.Q.all([follower.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followerToken.tokenId
            }), followee.connect({
                appId: Object.keys(testEnv.allApps)[0],
                baseURL: respokeTestConfig.baseURL,
                token: followeeToken.tokenId
            })]);
        }).then(function () {
            expect(follower.endpointId).not.to.be.undefined;
            expect(follower.endpointId).to.equal(followerToken.endpointId);
            expect(followee.endpointId).not.to.be.undefined;
            expect(followee.endpointId).to.equal(followeeToken.endpointId);
        }).done(function () {
            followerEndpoint = followee.getEndpoint({id: follower.endpointId});
            followeeEndpoint = follower.getEndpoint({id: followee.endpointId});
            done();
        }, function (err) {
            expect(err).to.be.defined;
            expect(err.message).to.be.defined;
            done(err);
        });
    });

    describe("when placing a call", function () {
        function callListener(evt) {
            if (evt.call.caller !== true) {
                evt.call.answer();
            }
        }

        describe("with call listener specified", function () {
            var hangupReason;
            var remoteElement;
            var localElement;
            var stream;

            afterEach(function () {
                followee.ignore('call', callListener);
            });

            beforeEach(function (done) {
                done = doneCountBuilder(2, done);
                followee.listen('call', callListener);

                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        stream = evt.stream;
                        localElement = evt.element;
                        done();
                    },
                    onConnect: function (evt) {
                        remoteElement = evt.element;
                        done();
                    },
                    onHangup: function (evt) {
                        hangupReason = evt.reason;
                        done();
                    }
                });
            });

            it("succeeds", function () {
                expect(stream).to.be.ok;
                expect(localElement).to.be.ok;
                expect(remoteElement).to.be.ok;
                expect(hangupReason).to.equal(undefined);
            });
        });

        describe("without a call listener specified for callee", function () {
            var hangupReason;
            var remoteStream;
            var error;

            beforeEach(function (done) {
                var done = doneCountBuilder(1, done);

                window.thisCall = call = followeeEndpoint.startCall({
                    onHangup: function (evt) {
                        hangupReason = evt.reason;
                        done();
                    },
                    onConnect: function (evt) {
                        remoteStream = evt.stream;
                        done();
                    },
                    onError: function (evt) {
                        error = evt.reason;
                        done();
                    }
                });
            });

            it("fails", function () {
                expect(remoteStream).not.to.be.ok;
                expect(hangupReason).to.be.ok;
            });
        });

        describe("with only audio", function () {
            beforeEach(function () {
                followee.listen('call', callListener);
            });

            afterEach(function () {
                followee.ignore('call', callListener);
                call.hangup();
            });

            describe("by constraints", function () {
                it("only sends audio and not video", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video : false,
                            audio : true,
                            optional: [],
                            mandatory: {}
                        },
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });

                it("only receives audio and not video", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video : false,
                            audio : true,
                            optional: [],
                            mandatory: {}
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });
            });

            describe("by the Endpoint.startAudioCall method", function () {
                it("only sends audio and not video", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startAudioCall({
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });

                it("only receives audio and not video", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startAudioCall({
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.empty;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });
            });

            afterEach(function (done) {
                followee.ignore('call', callListener);
                call.hangup();
                done();
            });
        });

        describe("with only video", function () {
            beforeEach(function () {
                followee.listen('call', callListener);
            });

            afterEach(function () {
                followee.ignore('call', callListener);
            });

            describe("by constraints", function () {
                it("only sends video and not audio", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video : true,
                            audio : false,
                            optional: [],
                            mandatory: {}
                        },
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.empty;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });

                it("only receives video and not audio", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video : true,
                            audio : false,
                            optional: [],
                            mandatory: {}
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                expect(evt.stream).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.empty;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });
            });
        });

        describe("with video and audio", function () {
            beforeEach(function () {
                followee.listen('call', callListener);
            });

            afterEach(function () {
                followee.ignore('call', callListener);
            });

            describe("by constraints", function () {
                it("sends both video and audio", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video : true,
                            audio : true,
                            optional: [],
                            mandatory: {}
                        },
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });

                it("receives both video and audio", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        constraints: {
                            video : true,
                            audio : true,
                            optional: [],
                            mandatory: {}
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });
            });

            describe("by the Endpoint.startVideoCall method", function () {
                it("sends both video and audio", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startVideoCall({
                        onLocalMedia: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onConnect: function (evt) {
                            try {
                                expect(evt.element).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });

                it("receives both video and audio", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startVideoCall({
                        onConnect: function (evt) {
                            try {
                                expect(evt.stream).to.be.ok;
                                expect(evt.element).to.be.ok;
                                expect(evt.stream.getAudioTracks()).to.be.ok;
                                expect(evt.stream.getVideoTracks()).to.be.ok;
                                doneOnce();
                            } catch (e) {
                                doneOnce(e);
                            }
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });
            });

            afterEach(function (done) {
                followee.ignore('call', callListener);
                call.hangup();
                done();
            });
        });

        describe("when previewLocalMedia is specified", function () {
            beforeEach(function () {
                followee.listen('call', callListener);
            });

            afterEach(function (done) {
                followee.ignore('call', callListener);
                call.hangup();
                done();
            });

            it("Call.approve is not called automatically", function (done) {
                var doneOnce = doneCountBuilder(1, done);

                call = followeeEndpoint.startCall({
                    onApprove: function (evt) {
                        doneOnce(new Error("Approve was called immediately!"));
                    },
                    previewLocalMedia: function (element, call) {
                        call.ignore('approve');
                        doneOnce();
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up. " + evt.reason));
                    }
                });
            });

            describe("when Call.approve is called", function () {
                beforeEach(function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        previewLocalMedia: function (element, call) {
                            doneOnce();
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
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
            // between asking for media and receiving it. We have a 500ms delay between asking for media and
            // firing requesting-media so that the UI doesn't flash a request to click the button when no
            // additional permissions are needed. Maybe we can test this another way in the future.
            xdescribe("the onRequestingMedia callback", function () {
                it("gets called before onLocalMedia", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        onRequestingMedia: function (evt) {
                            doneOnce();
                        },
                        onLocalMedia: function (evt) {
                            doneOnce(new Error("onLocalMedia got called first."));
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });

                it("gets called before onAllow", function (done) {
                    var doneOnce = doneCountBuilder(1, done);

                    call = followeeEndpoint.startCall({
                        onRequestingMedia: function (evt) {
                            doneOnce();
                        },
                        onAllow: function (evt) {
                            doneOnce(new Error("onAllow got called first."));
                        },
                        onHangup: function (evt) {
                            doneOnce(new Error("Call got hung up. " + evt.reason));
                        }
                    });
                });
            });
        });

        // Can't test this because:
        //   1. We are on the same machine so hole-punching will always find a path, even without ICE!
        //   2. We don't have access to the peer connection, so we can't observe whether we get any relay candidates.
        xdescribe("when forceTurn is turned on", function () {
            beforeEach(function () {
                followee.listen('call', callListener);
            });

            afterEach(function () {
                followee.ignore('call', callListener);
            });

            it("fails because the test suite can't get TURN credentials", function (done) {
                var doneOnce = doneCountBuilder(1, done);

                call = followeeEndpoint.startCall({
                    forceTurn: true,
                    onHangup: function (evt) {
                        doneOnce();
                    },
                    onConnect: function (evt) {
                        doneOnce(new Error("This is impossible."));
                    }
                });
            });
        });

        describe("the onLocalMedia callback", function () {
            beforeEach(function () {
                followee.listen('call', callListener);
            });

            afterEach(function (done) {
                followee.ignore('call', callListener);
                call.hangup();
                done();
            });

            it("gets called before onApprove", function (done) {
                var doneOnce = doneCountBuilder(1, done);

                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        doneOnce();
                    },
                    onApprove: function (evt) {
                        doneOnce(new Error("onApprove got called first."));
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up. " + evt.reason));
                    }
                });
            });

            it("gets called before onConnect", function (done) {
                var doneOnce = doneCountBuilder(1, done);

                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        doneOnce();
                    },
                    onConnect: function (evt) {
                        doneOnce(new Error("onConnect got called first."));
                    },
                    onHangup: function (evt) {
                        doneOnce(new Error("Call got hung up. " + evt.reason));
                    }
                });
            });
        });

        describe("the hangup method", function () {

            beforeEach(function () {
                followee.listen('call', callListener);
                call = followeeEndpoint.startCall({ constraints: {
                    video: true,
                    audio: true,
                    optional: [],
                    mandatory: {}
                }});
            });

            afterEach(function () {
                followee.ignore('call', callListener);
            });

            it("causes the hangup event to fire", function (done) {
                call.listen('hangup', function (evt) {
                    done();
                });
                call.hangup();
            });

            it("causes the call not to be active", function (done) {
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

                    followee.listen('call', callListener);
                    call = followeeEndpoint.startCall({ constraints: {
                        video: true,
                        audio: true,
                        optional: [],
                        mandatory: {}
                    }});
                });

                afterEach(function () {
                    followee.ignore('call', callListener);
                    respoke.Call = original;
                });

                it("shows callDebugReportEnabled from signalingChannel as false", function (done) {
                    call.listen('hangup', function (evt) {
                        expect(iSpy.calledOnce).to.be.true;
                        expect(call.callDebugReportEnabled).to.be.true;
                        done();
                    });
                    call.hangup();
                });

                // This is really hard to test because of scope. Likely the best way to test this is to
                // fire an event after sending the call debug report to the API.
                it("sends call debugs");
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
                            followeeEndpoint_nodebug = follower_nodebug.getEndpoint({id: followee.endpointId});
                            followee.listen('call', callListener);
                            call = followeeEndpoint_nodebug.startCall({ constraints: {
                                video: true,
                                audio: true,
                                optional: [],
                                mandatory: {}
                            }});
                            done();
                        }
                    });

                });

                afterEach(function () {
                    followee.ignore('call', callListener);
                    respoke.Call = original;
                });

                it("shows callDebugReportEnabled from signalingChannel as false", function (done) {
                    call.listen('hangup', function (evt) {
                        expect(iSpy.called).to.be.true;
                        expect(call.callDebugReportEnabled).to.be.false;
                        // TODO
                        done();
                    });
                    call.hangup();
                });

                // This is really hard to test because of scope. Likely the best way to test this is to
                // fire an event after sending the call debug report to the API.
                xit("does not send call debugs");
            });
        });

        describe("muting", function () {
            var localMedia;
            var muteSpy = sinon.spy();

            beforeEach(function (done) {
                followee.listen('call', callListener);
                call = followeeEndpoint.startCall({
                    onLocalMedia: function (evt) {
                        localMedia = evt.stream;
                    },
                    onConnect: function (evt) {
                        done();
                    },
                    onMute: muteSpy
                });
            });

            afterEach(function (done) {
                followee.ignore('call', callListener);
                call.listen('hangup', function (evt) {
                    done();
                });
                call.hangup();
            });

            describe("video", function () {
                beforeEach(function () {
                    call.muteVideo();
                });

                it("disables the video stream", function () {
                    var videoTracks = localMedia.getVideoTracks();
                    expect(videoTracks.length).to.equal(1);
                    expect(videoTracks[0].enabled).to.equal(false);
                });

                it("causes the mute event to fire", function () {
                    expect(muteSpy.called).to.be.ok;
                });
            });

            describe("audio", function () {
                beforeEach(function () {
                    call.muteAudio();
                });

                // broke
                xit("disables the audio stream", function () {
                    var audioTracks = localMedia.getAudioTracks();
                    expect(audioTracks.length).to.equal(1);
                    expect(audioTracks[0].enabled).to.equal(false);
                });

                it("causes the mute event to fire", function () {
                    expect(muteSpy.called).to.be.ok;
                });
            });
        });
    });

    describe("when receiving a call", function () {
        describe("with call listener specified", function () {
            afterEach(function (done) {
                followee.ignore('call');
                call.hangup();
                done();
            });

            it("the call starts and call event gets fired", function (done) {
                followee.listen('call', function (evt) {
                    call = evt.call;
                    done();
                });
                followeeEndpoint.startCall();
            });
        });

        describe("with only audio", function () {
            afterEach(function (done) {
                followee.ignore('call');
                call.hangup();
                done();
            });

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

                // broke
                xit("only sends audio and not video", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            }
                        });
                    });
                });

                it("receives both audio and video", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            }
                        });
                    });
                });
            });

            describe("by leaning on caller's SDP", function () {
                beforeEach(function () {
                    followeeEndpoint.startAudioCall();
                });

                // broke
                xit("only sends audio and not video", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            }
                        });
                    });
                });

                // broke
                xit("only receives audio and not video", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.empty;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
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

                // broke
                xit("only sends video and not audio", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.empty;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            }
                        });
                    });
                });

                it("receives both audio and video", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
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

                // broke
                xit("only sends video and not audio", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onLocalMedia: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.empty;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            }
                        });
                    });
                });

                it("receives both audio and video", function (done) {
                    followee.listen('call', function (evt) {
                        call = evt.call;
                        call.answer({
                            constraints: constraints,
                            onConnect: function (evt) {
                                try {
                                    expect(evt.stream).to.be.ok;
                                    expect(evt.stream.getAudioTracks()).to.be.ok;
                                    expect(evt.stream.getVideoTracks()).to.be.ok;
                                    done();
                                } catch (e) {
                                    done(e);
                                }
                            }
                        });
                    });
                });
            });
        });
    });

    afterEach(function (done) {
        if (call) {
            call.hangup();
        }

        respoke.Q.all([follower.disconnect(), followee.disconnect()]).fin(function () {
            testFixture.afterTest(function (err) {
                if (err) {
                    done(new Error(JSON.stringify(err)));
                    return;
                }
                done();
            });
        }).done();
    });
});
