/* global sinon: true */
'use strict';

var testHelper = require('../test-helper');

var expect = chai.expect;
var assert = chai.assert;
var respoke = testHelper.respoke;

describe("RemoteMedia.stop", function () {
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
            var remoteMedia = respoke.RemoteMedia();
            remoteMedia.listen('stop', function () {
                assert.fail('should not fire the stop event');
            });

            remoteMedia.stop();
            setTimeout(done, 200);
        });
    });

    describe("when called on an instance with an existing stream", function () {

        describe("but the number of peer connections for the stream is > 1", function () {

            it("decrements the number of peer connections for the stream", function () {
                var remoteMedia = respoke.RemoteMedia();
                var fakeStream = { numPc: 2, getTracks: function () { return []; } };
                remoteMedia.stream = fakeStream;
                remoteMedia.stop();
                expect(fakeStream.numPc).to.equal(1);
            });

            it("fires a 'stop' event", function (done) {
                var remoteMedia = respoke.RemoteMedia();
                remoteMedia.stream = { numPc: 2, getTracks: function () { return []; } };
                remoteMedia.listen('stop', function () {
                    done();
                });
                remoteMedia.stop();
            });

            it("sets the stream for the instance to null", function () {
                var remoteMedia = respoke.RemoteMedia();
                remoteMedia.stream = { numPc: 2, getTracks: function () { return []; } };
                remoteMedia.stop();
                expect(remoteMedia.stream).to.equal(null);
            });
        });

        describe("and the number of peer connections for the stream is 1", function () {

            it("sets the number of peer connections for the stream to 0", function () {
                var remoteMedia = respoke.RemoteMedia();
                var fakeStream = { numPc: 1, getTracks: function () { return []; } };
                remoteMedia.stream = fakeStream;
                remoteMedia.stop();
                expect(fakeStream.numPc).to.equal(0);
            });

            it("fires a 'stop' event", function (done) {
                var remoteMedia = respoke.RemoteMedia();
                remoteMedia.stream = { numPc: 1, getTracks: function () { return []; } };
                remoteMedia.listen('stop', function () {
                    done();
                });
                remoteMedia.stop();
            });

            it("sets the stream for the instance to null", function () {
                var remoteMedia = respoke.RemoteMedia();
                remoteMedia.stream = { numPc: 1, getTracks: function () { return []; } };
                remoteMedia.stop();
                expect(remoteMedia.stream).to.equal(null);
            });

            it("calls 'stop' on all the tracks of the stream", function () {
                var remoteMedia = respoke.RemoteMedia();
                var fakeTracks = [
                    { stop: sinon.stub() }, { stop: sinon.stub() }, { stop: sinon.stub() }
                ];
                remoteMedia.stream = { numPc: 1, getTracks: function () { return fakeTracks; } };
                remoteMedia.stop();
                fakeTracks.forEach(function (track) {
                    expect(track.stop.calledOnce).to.equal(true);
                });
            });
        });
    });
});
