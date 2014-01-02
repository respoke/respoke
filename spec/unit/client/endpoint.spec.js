var expect = chai.expect;

var client = webrtc.Client();

describe("A webrtc.AbstractEndpoint ", function () {
    var endpoint = webrtc.AbstractEndpoint({
        "client": client.getID(),
        "name": "Mickey Mouse",
        "id": "JH5K34J5K34J3453K4J53K45",
        "gloveColor": "white"
    });

    /*
     * Inheritance
     */
    it("extends webrtc.Class.", function () {
        expect(typeof endpoint.getClass).to.equal('function');
    });

    it("extends webrtc.EventEmitter.", function () {
        expect(typeof endpoint.listen).to.equal('function');
        expect(typeof endpoint.ignore).to.equal('function');
        expect(typeof endpoint.fire).to.equal('function');
    });

    it("extends webrtc.AbstractPresentable.", function () {
        expect(typeof endpoint.getID).to.equal('function');
        expect(typeof endpoint.getName).to.equal('function');
        expect(typeof endpoint.getPresence).to.equal('function');
        expect(typeof endpoint.setPresence).to.equal('function');
        expect(typeof endpoint.canSendAudio).to.equal('function');
        expect(typeof endpoint.canSendVideo).to.equal('function');
        expect(typeof endpoint.callInProgress).to.equal('function');
    });

    /*
     * Make sure there is a className attribute and getClass method on every instance.
     */
    it("has the correct class name.", function () {
        expect(endpoint.className).to.be.ok;
        expect(endpoint.getClass()).to.equal('webrtc.AbstractEndpoint');
    });

    /*
     * Native methods
     */
    it("contains some important methods.", function () {
        expect(typeof endpoint.startCall).to.equal('function');
        expect(typeof endpoint.stopCall).to.equal('function');
        expect(typeof endpoint.sendMessage).to.equal('function');
    });

    /*
     * Presence
     */
    it("can set and get presence and fires the correct event.", function () {
        var newPresence = 'xa';

        sinon.spy(endpoint, "fire");
        try {
            endpoint.setPresence(newPresence);

            expect(endpoint.getPresence()).to.equal(newPresence);
            expect(endpoint.fire.calledWith('presence')).to.equal(true);
        } finally {
            endpoint.fire.restore();
        }
    });

    /*
     * Constructor
     */
    it("saves unexpected developer-specified parameters.", function () {
        expect(endpoint.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(endpoint.signalingChannel).to.not.exist;
        expect(endpoint.getSignalingChannel).to.not.exist;
    });
});
