/* global sinon: false */
describe("remoteMedia", function () {
    'use strict';
    var _actualSinon = sinon;

    beforeEach(function () {
        sinon = sinon.sandbox.create();
    });

    afterEach(function () {
        sinon.restore();
        sinon = _actualSinon;
    });

    describe("when temporary param is true", function () {

        it("does not attempt to attach the stream to the element", function () {
            var fakeVideoElement = {
                autoPlay: false,
                src: 'jello',
                play: sinon.stub()
            };

            var attachMediaStreamSpy = sinon.spy(window, 'attachMediaStream');

            respoke.RemoteMedia({
                temporary: true,
                element: fakeVideoElement
            });

            expect(attachMediaStreamSpy.called).to.equal(false);
        });

        it("does not set autoplay property of the element to true", function () {
            var fakeVideoElement = {
                autoPlay: false,
                src: 'jello',
                play: sinon.stub()
            };

            var remoteMedia = respoke.RemoteMedia({
                temporary: true,
                element: fakeVideoElement
            });

            expect(remoteMedia.element.autoplay).to.not.equal(true);
        });

        it("does not attempt to call play on the element", function (done) {
            var fakeVideoElement = {
                autoPlay: false,
                src: 'jello',
                play: sinon.stub()
            };

            var remoteMedia = respoke.RemoteMedia({
                temporary: true,
                element: fakeVideoElement
            });

            setTimeout(function () {
                // play is called async, so we have to do our check async
                expect(remoteMedia.element.play.called).to.equal(false);
                done();
            });
        });
    });

    describe("when temporary param is falsy", function () {

        var localMedia;

        beforeEach(function (done) {
            this.timeout(5000);
            localMedia = respoke.LocalMedia({
                constraints: { audio: false, video: true, fake: true }
            });

            localMedia.once('stream-received', function () {
                done();
            });

            localMedia.start();
        });

        afterEach(function () {
            localMedia.stop();
        });

        it("attaches the stream to the element", function () {
            var fakeVideoElement = {
                autoPlay: false,
                src: 'jello',
                play: sinon.stub()
            };

            var attachMediaStreamSpy = sinon.spy(window, 'attachMediaStream');

            respoke.RemoteMedia({
                element: fakeVideoElement,
                stream: localMedia.stream
            });

            expect(attachMediaStreamSpy.calledOnce).to.equal(true);
            expect(attachMediaStreamSpy.firstCall.args[0]).to.equal(fakeVideoElement);
            expect(attachMediaStreamSpy.firstCall.args[1]).to.equal(localMedia.stream);
        });

        it("sets the autoplay property of the element to true", function () {
            var fakeVideoElement = {
                autoPlay: false,
                src: 'jello',
                play: sinon.stub()
            };

            var remoteMedia = respoke.RemoteMedia({
                element: fakeVideoElement,
                stream: localMedia.stream
            });

            expect(remoteMedia.element.autoplay).to.equal(true);
        });

        it("calls play on the element", function (done) {
            var fakeVideoElement = {
                autoPlay: false,
                src: 'jello',
                play: sinon.stub()
            };

            var remoteMedia = respoke.RemoteMedia({
                element: fakeVideoElement,
                stream: localMedia.stream
            });

            setTimeout(function () {
                // play is called async, so we have to do our check async
                expect(remoteMedia.element.play.calledOnce).to.equal(true);
                done();
            });
        });
    });
});
