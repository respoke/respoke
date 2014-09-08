
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
    });

    describe("contains the 'once' method", function () {
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
});
