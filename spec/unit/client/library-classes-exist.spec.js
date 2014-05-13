
var expect = chai.expect;

describe("The brightstream namespace", function() {
    it("contains all the library's classes.", function() {
        expect(typeof brightstream).to.equal('object');
        expect(typeof brightstream.Call).to.equal('function');
        expect(typeof brightstream.Class).to.equal('function');
        expect(typeof brightstream.Client).to.equal('function');
        expect(typeof brightstream.Connection).to.equal('function');
        expect(typeof brightstream.DirectConnection).to.equal('function');
        expect(typeof brightstream.Endpoint).to.equal('function');
        expect(typeof brightstream.EventEmitter).to.equal('function');
        expect(typeof brightstream.Group).to.equal('function');
        expect(typeof brightstream.LocalMedia).to.equal('function');
        expect(typeof brightstream.MediaStats).to.equal('function');
        expect(typeof brightstream.MediaStatsParser).to.equal('function');
        expect(typeof brightstream.PeerConnection).to.equal('function');
        expect(typeof brightstream.Presentable).to.equal('function');
        expect(typeof brightstream.SignalingChannel).to.equal('function');
        expect(typeof brightstream.SignalingMessage).to.equal('function');
        expect(typeof brightstream.TextMessage).to.equal('function');

        //capability flags
        expect(typeof brightstream.hasUserMedia).to.equal('function');
        expect(typeof brightstream.hasRTCPeerConnection).to.equal('function');
        expect(typeof brightstream.hasWebsocket).to.equal('function');
    });
});
