describe.only("LocalMedia.start", function () {
    'use strict';

    /* global sinon: true */
    var _actualSinon = sinon;
    var expect = chai.expect;
    var assert = chai.assert;

    beforeEach(function () {
        sinon = sinon.sandbox.create();
    });

    afterEach(function () {
        sinon.restore();
        sinon = _actualSinon;
    });

    it("throws an error if called on a temporary instance", function (done) {
        respoke.LocalMedia({
            temporary: true
        }).start().done(function () {
            done(new Error("Calling start on a temporary localmedia should not succeed."));
        }, function (err) {
            expect(err.message).to.contain('Temporary');
            done();
        });
    });

    describe("if userMedia is not received within 500ms", function () {

        it("fires 'requesting-media' event", function (done) {
            sinon.stub(window, 'getUserMedia');

            var localMedia = respoke.LocalMedia({
                constraints: { audio: false, video: true }
            })
            localMedia.start().done(null, done);

            localMedia.listen('requesting-media', function (evt) {
                done();
            });
        });
    });

    describe("if the LocalMedia is not for a screen share", function () {

        it("calls window.getUserMedia with constraints passed to the constructor", function (done) {
            var constructorParams = { constraints: { audio: false, video: true } };
            var localMedia = respoke.LocalMedia(constructorParams);
            sinon.stub(window, 'getUserMedia');

            localMedia.start().done(null, done);

            setTimeout(function () {
                expect(window.getUserMedia.calledOnce).to.equal(true);
                var getUserMediaArgs = window.getUserMedia.firstCall.args[0];
                expect(getUserMediaArgs).to.be.an('object');
                expect(getUserMediaArgs).to.deep.equal(constructorParams.constraints);
                done();
            }, 750);
        });
    });

    describe("if the LocalMedia is for a screen share", function () {

        describe("and we're in node-webkit", function () {

            var previousIsNwjs;
            var previousNeedsChromeExtension;
            var previousNeedsFirefoxExtension;

            beforeEach(function () {
                previousIsNwjs = respoke.isNwjs;
                previousNeedsChromeExtension = respoke.needsChromeExtension;
                previousNeedsFirefoxExtension = respoke.needsFirefoxExtension;
                respoke.isNwjs = true;
                respoke.needsChromeExtension = false;
                respoke.needsFirefoxExtension = false;
            });

            afterEach(function () {
                respoke.isNwjs = previousIsNwjs;
                respoke.needsChromeExtension = previousNeedsChromeExtension;
                respoke.needsFirefoxExtension = previousNeedsFirefoxExtension;
            });

            it("calls respoke.chooseDesktopMedia", function (done) {
                var constructorParams = {
                    constraints: {
                        audio: false,
                        video: {
                            mandatory: { chromeMediaSource: 'desktop' }
                        }
                    }
                };
                var chooseDesktopMediaResult = { sourceId: 'foo' };
                var localMedia = respoke.LocalMedia(constructorParams);
                sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                sinon.stub(window, 'getUserMedia');

                localMedia.start().done(null, done);

                setTimeout(function () {
                    expect(respoke.chooseDesktopMedia.calledOnce).to.equal(true);
                    done();
                }, 750);
            });

            it("fires an error if respoke.chooseDesktopMedia does not return a valid sourceId", function (done) {
                var constructorParams = {
                    constraints: {
                        audio: false,
                        video: {
                            mandatory: { chromeMediaSource: 'desktop' }
                        }
                    }
                };
                var chooseDesktopMediaResult = { error: 'no source' };
                sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                sinon.stub(window, 'getUserMedia');

                respoke.LocalMedia(constructorParams).start().done(null, function (err) {
                    expect(err).to.be.an(Error);
                    expect(err.message).to.equal('Permission denied.');
                    done();
                });
            });

            it("calls window.getUserMedia with the sourceId from chooseDesktopMedia in the constraints", function (done) {
                var constructorParams = {
                    constraints: {
                        audio: false,
                        video: {
                            mandatory: { chromeMediaSource: 'desktop' }
                        }
                    }
                };
                var chooseDesktopMediaResult = { sourceId: 'foo' };
                sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                sinon.stub(window, 'getUserMedia', function (constraints) {
                    expect(constraints).to.be.an('object');
                    expect(constraints).to.have.deep.property(
                        'video.mandatory.chromeMediaSourceId',
                        chooseDesktopMediaResult.sourceId
                    );
                    done();
                });

                respoke.LocalMedia(constructorParams).start().done(null, done);
            });
        });

        describe("and we're in chrome", function () {

            var previousIsNwjs;
            var previousNeedsChromeExtension;
            var previousNeedsFirefoxExtension;

            beforeEach(function () {
                previousIsNwjs = respoke.isNwjs;
                previousNeedsChromeExtension = respoke.needsChromeExtension;
                previousNeedsFirefoxExtension = respoke.needsFirefoxExtension;
                respoke.isNwjs = false;
                respoke.needsChromeExtension = true;
                respoke.needsFirefoxExtension = false;
            });

            afterEach(function () {
                respoke.isNwjs = previousIsNwjs;
                respoke.needsChromeExtension = previousNeedsChromeExtension;
                respoke.needsFirefoxExtension = previousNeedsFirefoxExtension;
            });

            describe("but the extension is unavailable", function () {

                var previousHasChromeExtension;

                beforeEach(function () {
                    previousHasChromeExtension = respoke.hasChromeExtension;
                    respoke.hasChromeExtension = false;
                });

                afterEach(function () {
                    respoke.hasChromeExtension = previousHasChromeExtension;
                });

                it("fires an error event on the localMedia instance", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };

                    respoke.LocalMedia(constructorParams).start().done(null, function (err) {
                        expect(err).to.be.an(Error);
                        expect(err.message).to.contain('implemented');
                        done();
                    });
                });

                it("does not fire a 'requesting-media' event on the localMedia instance", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };
                    var localMedia = respoke.LocalMedia(constructorParams);
                    var fakeRequestingMediaHandler = sinon.stub();
                    localMedia.once('requesting-media', fakeRequestingMediaHandler);
                    localMedia.start().done(null, done);

                    setTimeout(function () {
                        try {
                            expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                        } catch (e) {
                            done(e);
                        }
                    }, 750);
                });
            });

            describe("and the extension is available", function () {

                var previousHasChromeExtension;

                beforeEach(function () {
                    previousHasChromeExtension = respoke.hasChromeExtension;
                    respoke.hasChromeExtension = true;
                });

                afterEach(function () {
                    respoke.hasChromeExtension = previousHasChromeExtension;
                });

                it("calls respoke.chooseDesktopMedia", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };
                    var chooseDesktopMediaResult = { };
                    sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                    sinon.stub(window, 'getUserMedia');

                    respoke.LocalMedia(constructorParams).start().done(null, done);

                    setTimeout(function () {
                        try {
                            expect(respoke.chooseDesktopMedia.calledOnce).to.equal(true);
                        } catch (e) {
                            done(e);
                        }
                    }, 750);
                });

                it("fires an error if respoke.chooseDesktopMedia does not return a valid sourceId", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };
                    var chooseDesktopMediaResult = { };
                    var localMedia = respoke.LocalMedia(constructorParams);
                    sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                    sinon.stub(window, 'getUserMedia');

                    localMedia.start().done(null, function (err) {
                        expect(err).to.be.an(Error);
                        expect(err.message).to.equal('Permission denied.');
                        done();
                    });
                });

                it("calls window.getUserMedia with the sourceId from chooseDesktopMedia in the constraints", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };
                    var chooseDesktopMediaResult = { sourceId: 'foo' };
                    sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                    sinon.stub(window, 'getUserMedia', function (constraints) {
                        expect(constraints).to.be.an('object');
                        expect(constraints).to.have.deep.property(
                            'video.mandatory.chromeMediaSourceId',
                            chooseDesktopMediaResult.sourceId
                        );
                        done();
                    });

                    respoke.LocalMedia(constructorParams).start().done(null, done);
                });
            });
        });

        describe("and we're in firefox", function () {

            var previousIsNwjs;
            var previousNeedsChromeExtension;
            var previousNeedsFirefoxExtension;

            beforeEach(function () {
                previousIsNwjs = respoke.isNwjs;
                previousNeedsChromeExtension = respoke.needsChromeExtension;
                previousNeedsFirefoxExtension = respoke.needsFirefoxExtension;
                respoke.isNwjs = false;
                respoke.needsChromeExtension = false;
                respoke.needsFirefoxExtension = true;
            });

            afterEach(function () {
                respoke.isNwjs = previousIsNwjs;
                respoke.needsChromeExtension = previousNeedsChromeExtension;
                respoke.needsFirefoxExtension = previousNeedsFirefoxExtension;
            });

            describe("but the extension is unavailable", function () {

                var previousHasFirefoxExtension;

                beforeEach(function () {
                    previousHasFirefoxExtension = respoke.hasFirefoxExtension;
                    respoke.hasFirefoxExtension = false;
                });

                afterEach(function () {
                    respoke.hasFirefoxExtension = previousHasFirefoxExtension;
                });

                it("rejects the promise", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mediaSource: 'screen'
                            }
                        }
                    };
                    respoke.LocalMedia(constructorParams).start().done(function () {
                        done(new Error("Not supposed to succeed"));
                    }, function (err) {
                        expect(err).to.be.an(Error);
                        expect(err.message).to.contain('implemented');
                        done();
                    });
                });

                it("does not fire a 'requesting-media' event on the localMedia instance", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mediaSource: 'screen'
                            }
                        }
                    };
                    var localMedia = respoke.LocalMedia(constructorParams);
                    var fakeRequestingMediaHandler = sinon.stub();
                    localMedia.once('requesting-media', fakeRequestingMediaHandler);
                    localMedia.start().done(function () {
                        expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                        done();
                    }, done);
                });
            });

            describe("and the extension is available", function () {

                var previousHasFirefoxExtension;

                beforeEach(function () {
                    previousHasFirefoxExtension = respoke.hasFirefoxExtension;
                    respoke.hasFirefoxExtension = true;
                });

                afterEach(function () {
                    respoke.hasFirefoxExtension = previousHasFirefoxExtension;
                });

                it("calls window.getUserMedia with the constraints passed to the constructor", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mediaSource: 'screen'
                            }
                        }
                    };
                    var localMedia = respoke.LocalMedia(constructorParams);
                    sinon.stub(window, 'getUserMedia', function (constraints) {
                        expect(constraints).to.be.an('object');
                        expect(constraints.audio).to.equal(constructorParams.constraints.audio);
                        expect(constraints.video).to.deep.equal(constructorParams.constraints.video);
                        done();
                    });

                    localMedia.start().done(null, done);
                });
            });
        });

        describe("but we're on an unsupported platform", function () {

            var previousIsNwjs;
            var previousNeedsChromeExtension;
            var previousNeedsFirefoxExtension;

            beforeEach(function () {
                previousIsNwjs = respoke.isNwjs;
                previousNeedsChromeExtension = respoke.needsChromeExtension;
                previousNeedsFirefoxExtension = respoke.needsFirefoxExtension;
                respoke.isNwjs = false;
                respoke.needsChromeExtension = false;
                respoke.needsFirefoxExtension = false;
            });

            afterEach(function () {
                respoke.isNwjs = previousIsNwjs;
                respoke.needsChromeExtension = previousNeedsChromeExtension;
                respoke.needsFirefoxExtension = previousNeedsFirefoxExtension;
            });

            it("fires an error event on the localMedia instance", function (done) {
                var constructorParams = {
                    constraints: {
                        audio: false,
                        video: {
                            mediaSource: 'screen'
                        }
                    }
                };
                respoke.LocalMedia(constructorParams).start().done(function () {
                    done(new Error("not supposed to succeed"));
                }, function (err) {
                    expect(err).to.be.an(Error);
                    expect(err.message).to.include.property('reason');
                    done();
                });
            });

            it("does not fire a 'requesting-media' event on the localMedia instance", function (done) {
                var constructorParams = {
                    constraints: {
                        audio: false,
                        video: {
                            mediaSource: 'screen'
                        }
                    }
                };
                var localMedia = respoke.LocalMedia(constructorParams);
                var fakeRequestingMediaHandler = sinon.stub();
                localMedia.once('requesting-media', fakeRequestingMediaHandler);
                localMedia.start().done(function () {
                    expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                    done();
                }, done);
            });
        });
    });
});
