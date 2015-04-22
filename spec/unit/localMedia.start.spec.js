describe("LocalMedia.start", function () {
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

    it("throws an error if called on a temporary instance", function () {
        var localMedia = respoke.LocalMedia({
            temporary: true
        });

        expect(function () {
            localMedia.start();
        }).to.throw(Error);
    });

    describe("if userMedia is not received within 500ms", function () {

        it("fires 'requesting-media' event", function (done) {
            var localMedia = respoke.LocalMedia({
                constraints: { audio: false, video: true }
            });
            sinon.stub(window, 'getUserMedia');

            localMedia.once('requesting-media', function () {
                // should be called
                done();
            });

            localMedia.start();
        });
    });

    describe("if the LocalMedia is not for a screen share", function () {

        it("calls window.getUserMedia with constraints passed to the constructor", function () {
            var constructorParams = { constraints: { audio: false, video: true } };
            var localMedia = respoke.LocalMedia(constructorParams);
            sinon.stub(window, 'getUserMedia');

            localMedia.start();
            expect(window.getUserMedia.calledOnce).to.equal(true);
            var getUserMediaArgs = window.getUserMedia.firstCall.args[0];
            expect(getUserMediaArgs).to.be.an('object');
            expect(getUserMediaArgs).to.deep.equal(constructorParams.constraints);
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

            it("calls respoke.chooseDesktopMedia", function () {
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

                localMedia.start();
                expect(respoke.chooseDesktopMedia.calledOnce).to.equal(true);
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

                localMedia.once('error', function (evt) {
                    expect(evt).to.be.an('object');
                    expect(evt.error).to.equal('Permission denied.');
                    done();
                });

                localMedia.start();
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
                var localMedia = respoke.LocalMedia(constructorParams);
                sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                sinon.stub(window, 'getUserMedia', function (constraints) {
                    expect(constraints).to.be.an('object');
                    expect(constraints).to.have.deep.property(
                        'video.mandatory.chromeMediaSourceId',
                        chooseDesktopMediaResult.sourceId
                    );
                    done();
                });

                localMedia.start();
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
                    var localMedia = respoke.LocalMedia(constructorParams);
                    localMedia.once('error', function (evt) {
                        expect(evt).to.be.an('object');
                        expect(evt).to.include.property('reason');
                        done();
                    });
                    localMedia.start();
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
                    localMedia.start();

                    setTimeout(function () {
                        expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                        done();
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

                it("calls respoke.chooseDesktopMedia", function () {
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

                    localMedia.start();
                    expect(respoke.chooseDesktopMedia.calledOnce).to.equal(true);
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

                    localMedia.once('error', function (evt) {
                        expect(evt).to.be.an('object');
                        expect(evt.error).to.equal('Permission denied.');
                        done();
                    });

                    localMedia.start();
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
                    var localMedia = respoke.LocalMedia(constructorParams);
                    sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                    sinon.stub(window, 'getUserMedia', function (constraints) {
                        expect(constraints).to.be.an('object');
                        expect(constraints).to.have.deep.property(
                            'video.mandatory.chromeMediaSourceId',
                            chooseDesktopMediaResult.sourceId
                        );
                        done();
                    });

                    localMedia.start();
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

                it("fires an error event on the localMedia instance", function (done) {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mediaSource: 'screen'
                            }
                        }
                    };
                    var localMedia = respoke.LocalMedia(constructorParams);
                    localMedia.once('error', function (evt) {
                        expect(evt).to.be.an('object');
                        expect(evt).to.include.property('reason');
                        done();
                    });
                    localMedia.start();
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
                    localMedia.start();

                    setTimeout(function () {
                        expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                        done();
                    }, 750);
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

                it("calls window.getUserMedia with the constraints passed to the constructor", function () {
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

                    localMedia.start();
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
                var localMedia = respoke.LocalMedia(constructorParams);
                localMedia.once('error', function (evt) {
                    expect(evt).to.be.an('object');
                    expect(evt).to.include.property('reason');
                    done();
                });
                localMedia.start();
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
                localMedia.start();

                setTimeout(function () {
                    expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                    done();
                }, 750);
            });
        });
    });
});
