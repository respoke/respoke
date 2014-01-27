
var expect = chai.expect;

describe("The webrtc namespace", function() {
    it("contains all the library's classes.", function() {
        expect(typeof webrtc).to.equal('object');
        expect(typeof webrtc.Class).to.equal('function');
        expect(typeof webrtc.Contacts).to.equal('function');
        expect(typeof webrtc.EventEmitter).to.equal('function');
        expect(typeof webrtc.Call).to.equal('function');
        expect(typeof webrtc.MediaStream).to.equal('function');
        expect(typeof webrtc.Client).to.equal('function');
        expect(typeof webrtc.UserSession).to.equal('function');
        expect(typeof webrtc.TextMessage).to.equal('function');
        expect(typeof webrtc.Contact).to.equal('function');
        expect(typeof webrtc.IdentityProvider).to.equal('function');
        expect(typeof webrtc.PresenceMessage).to.equal('function');
        expect(typeof webrtc.Presentable).to.equal('function');
        expect(typeof webrtc.SignalingChannel).to.equal('function');
        expect(typeof webrtc.SignalingMessage).to.equal('function');
        expect(typeof webrtc.User).to.equal('function');
    });
});
