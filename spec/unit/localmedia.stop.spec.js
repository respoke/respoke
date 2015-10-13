/* global respoke: false, sinon: true */
describe("LocalMedia.stop", function () {
    'use strict';
    var expect = chai.expect;
    var assert = chai.assert;
    var _actualSinon = sinon;

    beforeEach(function () {
        sinon = sinon.sandbox.create();
    });

    afterEach(function () {
        // blow away the stream cache
        respoke.streams = [];

        sinon.restore();
        sinon = _actualSinon;
    });

    describe("when called and there is not currently a stream", function () {

        it("does not fire a 'stop' event", function (done) {
            var constructorParams = { constraints: { audio: true, video: true } };
            var localMedia = respoke.LocalMedia(constructorParams);
            localMedia.listen('stop', function () {
                assert.fail('should not fire the stop event');
            });

            localMedia.stop();
            setTimeout(done, 200);
        });
    });

    describe("when called on an instance with an existing stream", function () {

        describe("but the number of peer connections for the stream is > 1", function () {

            it("decrements the number of peer connections for the stream", function () {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                var fakeStream = { numPc: 2, getTracks: function () { return []; } };
                localMedia.stream = fakeStream;
                localMedia.stop();
                expect(fakeStream.numPc).to.equal(1);
            });

            it("fires a 'stop' event", function (done) {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                localMedia.stream = { numPc: 2, getTracks: function () { return []; } };
                localMedia.listen('stop', function () {
                    done();
                });
                localMedia.stop();
            });

            it("sets the stream for the instance to null", function () {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                localMedia.stream = { numPc: 2, getTracks: function () { return []; } };
                localMedia.stop();
                expect(localMedia.stream).to.equal(null);
            });
        });

        describe("and the number of peer connections for the stream is 1", function () {

            it("sets the number of peer connections for the stream to 0", function () {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                var fakeStream = { numPc: 1, getTracks: function () { return []; } };
                localMedia.stream = fakeStream;
                localMedia.stop();
                expect(fakeStream.numPc).to.equal(0);
            });

            it("fires a 'stop' event", function (done) {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                localMedia.stream = { numPc: 1, getTracks: function () { return []; } };
                localMedia.listen('stop', function () {
                    done();
                });
                localMedia.stop();
            });

            it("sets the stream for the instance to null", function () {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                localMedia.stream = { numPc: 1, getTracks: function () { return []; } };
                localMedia.stop();
                expect(localMedia.stream).to.equal(null);
            });

            it("calls 'stop' on all the tracks of the stream", function () {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                var fakeTracks = [
                    { stop: sinon.stub() }, { stop: sinon.stub() }, { stop: sinon.stub() }
                ];
                localMedia.stream = { numPc: 1, getTracks: function () { return fakeTracks; } };
                localMedia.stop();
                fakeTracks.forEach(function (track) {
                    expect(track.stop.calledOnce).to.equal(true);
                });
            });

            it("removes the stream from the global stream cache", function () {
                var constructorParams = { constraints: { audio: true, video: true } };
                var localMedia = respoke.LocalMedia(constructorParams);
                var fakeTracks = [
                    { stop: sinon.stub() }, { stop: sinon.stub() }, { stop: sinon.stub() }
                ];
                var fakeStream = {
                    numPc: 1,
                    getTracks: function () { return fakeTracks; },
                    constraints: constructorParams.constraints
                };
                localMedia.stream = fakeStream;
                respoke.streams.push(fakeStream);

                expect(respoke.streams.length).to.equal(1);
                expect(respoke.streams.indexOf(fakeStream)).to.not.equal(-1);

                localMedia.stop();

                expect(respoke.streams.indexOf(fakeStream)).to.equal(-1);
                expect(respoke.streams.length).to.equal(0);
            });
        });
    });
});
