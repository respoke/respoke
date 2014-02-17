
var expect = chai.expect;

describe("The brightstream namespace", function() {
    it("contains all the library's classes.", function() {
        expect(typeof brightstream).to.equal('object');
        expect(typeof brightstream.Class).to.equal('function');
        expect(typeof brightstream.EventEmitter).to.equal('function');
        expect(typeof brightstream.Call).to.equal('function');
        expect(typeof brightstream.MediaStream).to.equal('function');
        expect(typeof brightstream.Client).to.equal('function');
        expect(typeof brightstream.UserSession).to.equal('function');
        expect(typeof brightstream.TextMessage).to.equal('function');
        expect(typeof brightstream.Endpoint).to.equal('function');
        expect(typeof brightstream.Group).to.equal('function');
        expect(typeof brightstream.PresenceMessage).to.equal('function');
        expect(typeof brightstream.Presentable).to.equal('function');
        expect(typeof brightstream.SignalingChannel).to.equal('function');
        expect(typeof brightstream.SignalingMessage).to.equal('function');
        expect(typeof brightstream.User).to.equal('function');
    });
});
