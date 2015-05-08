/* global sinon: true */
"use strict";

var testHelper = require('../test-helper');

var expect = chai.expect;
var respoke = testHelper.respoke;

describe("LocalMedia.start", function () {
    var _actualSinon = sinon;
    var assert = chai.assert;

    beforeEach(function () {
        sinon = sinon.sandbox.create();
    });

    afterEach(function () {
        // blow away the stream cache
        respoke.streams = [];

        sinon.restore();
        sinon = _actualSinon;
    });

    it("rejects the promise if called on a temporary instance", function () {
        return respoke.LocalMedia({ temporary: true }).start().then(function () {
            assert.fail('should not resolve');
        }, function (err) {
            expect(err.message).to.contain('Temporary');
        });
    });

    describe("if userMedia is not received within 500ms", function () {

        it("fires 'requesting-media' event", function (done) {
            var constructorParams = { constraints: { audio: false, video: true } };
            var localMedia = respoke.LocalMedia(constructorParams);
            sinon.stub(window, 'getUserMedia');
            localMedia.start().catch(done);

            localMedia.listen('requesting-media', function () {
                done();
            });
        });
    });

    describe("if the LocalMedia is not for a screen share", function () {

        it("calls window.getUserMedia with constraints passed to the constructor", function () {
            var constructorParams = { constraints: { audio: false, video: true } };
            var fakeStream = { addEventListener: function () {} };
            sinon.stub(window, 'attachMediaStream');
            sinon.stub(window, 'getUserMedia', function (constraints, successCallback) {
                setTimeout(function () {
                    successCallback(fakeStream);
                });
            });

            return respoke.LocalMedia(constructorParams).start().then(function () {
                expect(window.getUserMedia.calledOnce).to.equal(true);
                var getUserMediaArgs = window.getUserMedia.firstCall.args[0];
                expect(getUserMediaArgs).to.be.an('object');
                expect(getUserMediaArgs).to.deep.equal(constructorParams.constraints);
            });
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
                var chooseDesktopMediaResult = { sourceId: 'foo' };
                var fakeStream = { addEventListener: function () {} };
                sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                sinon.stub(window, 'attachMediaStream');
                sinon.stub(window, 'getUserMedia', function (constraints, successCallback) {
                    setTimeout(function () {
                        successCallback(fakeStream);
                    });
                });

                return respoke.LocalMedia(constructorParams).start().then(function () {
                    expect(respoke.chooseDesktopMedia.calledOnce).to.equal(true);
                });
            });

            it("rejects the promise if respoke.chooseDesktopMedia does not return a valid sourceId", function () {
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

                return respoke.LocalMedia(constructorParams).start().then(function () {
                    assert.fail('should not resolve promise');
                }, function (err) {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal('Error trying to get screensharing source: no source');
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

                respoke.LocalMedia(constructorParams).start().catch(done);
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

                it("rejects the promise with an error", function () {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };

                    return respoke.LocalMedia(constructorParams).start().then(function () {
                        assert.fail('should not resolve');
                    }, function (err) {
                        expect(err).to.be.an.instanceof(Error);
                        expect(err.message).to.contain('implemented');
                    });
                });

                it("does not fire a 'requesting-media' event on the localMedia instance", function () {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mandatory: { chromeMediaSource: 'desktop' }
                            }
                        }
                    };
                    var fakeRequestingMediaHandler = sinon.stub();
                    var localMedia = respoke.LocalMedia(constructorParams);
                    localMedia.once('requesting-media', fakeRequestingMediaHandler);

                    return localMedia.start().catch(function () {
                        expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                    });
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
                    var chooseDesktopMediaResult = { sourceId: 'foo' };
                    var fakeStream = { addEventListener: function () {} };
                    sinon.stub(respoke, 'chooseDesktopMedia').yields(chooseDesktopMediaResult);
                    sinon.stub(window, 'attachMediaStream');
                    sinon.stub(window, 'getUserMedia', function (constraints, successCallback) {
                        setTimeout(function () {
                            successCallback(fakeStream);
                        });
                    });

                    return respoke.LocalMedia(constructorParams).start().then(function () {
                        expect(respoke.chooseDesktopMedia.calledOnce).to.equal(true);
                    });
                });

                it("rejects the promise if respoke.chooseDesktopMedia does not return a valid sourceId", function () {
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

                    return respoke.LocalMedia(constructorParams).start().then(function () {
                        assert.fail('should not resolve');
                    }, function (err) {
                        expect(err).to.be.an.instanceof(Error);
                        expect(err.message).to.equal('Error trying to get screensharing source: no source');
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

                    respoke.LocalMedia(constructorParams).start().catch(done);
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

                it("rejects the promise", function () {
                    var constructorParams = {
                        constraints: {
                            audio: false,
                            video: {
                                mediaSource: 'screen'
                            }
                        }
                    };

                    return respoke.LocalMedia(constructorParams).start().then(function () {
                        assert.fail('should not resolve');
                    }, function (err) {
                        expect(err).to.be.an.instanceof(Error);
                        expect(err.message).to.contain('implemented');
                    });
                });

                it("does not fire a 'requesting-media' event on the localMedia instance", function () {
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

                    return localMedia.start().catch(function () {
                        expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                    });
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

                    sinon.stub(window, 'getUserMedia', function (constraints) {
                        expect(constraints).to.be.an('object');
                        expect(constraints.audio).to.equal(constructorParams.constraints.audio);
                        expect(constraints.video).to.deep.equal(constructorParams.constraints.video);
                        done();
                    });

                    respoke.LocalMedia(constructorParams).start().catch(done);
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

            it("rejects the promise", function () {
                var constructorParams = {
                    constraints: {
                        audio: false,
                        video: {
                            mediaSource: 'screen'
                        }
                    }
                };

                return respoke.LocalMedia(constructorParams).start().then(function () {
                    assert.fail('should not resolve');
                }, function (err) {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal('Screen sharing not implemented on this platform yet.');
                });
            });

            it("does not fire a 'requesting-media' event on the localMedia instance", function () {
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
                return localMedia.start().catch(function () {
                    expect(fakeRequestingMediaHandler.calledOnce).to.equal(false);
                });
            });
        });
    });
});
