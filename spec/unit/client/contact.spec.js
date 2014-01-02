var expect = chai.expect;

var client = webrtc.Client();

describe("A webrtc.AbstractContact", function () {
    var contact = webrtc.AbstractContact({
        "client": client.getID(),
        "name": "Mickey Mouse",
        "id": "JH5K34J5K34J3453K4J53K45",
        "gloveColor": "white"
    });

    /*
    * Inheritance
    */
    it("extends webrtc.Class.", function () {
        expect(typeof contact.getClass).to.equal('function');
    });

    it("extends webrtc.EventEmitter.", function () {
        expect(typeof contact.listen).to.equal('function');
        expect(typeof contact.ignore).to.equal('function');
        expect(typeof contact.fire).to.equal('function');
    });

    it("extends webrtc.AbstractPresentable.", function () {
        expect(typeof contact.getID).to.equal('function');
        expect(typeof contact.getName).to.equal('function');
        expect(typeof contact.getPresence).to.equal('function');
        expect(typeof contact.setPresence).to.equal('function');
        expect(typeof contact.canSendAudio).to.equal('function');
        expect(typeof contact.canSendVideo).to.equal('function');
        expect(typeof contact.callInProgress).to.equal('function');
    });

    it("extends webrtc.AbstractEndpoint.", function () {
        expect(typeof contact.startCall).to.equal('function');
        expect(typeof contact.stopCall).to.equal('function');
        expect(typeof contact.sendMessage).to.equal('function');
    });

    /*
    * Make sure there is a className attribute and getClass method on every instance.
    */
    it("has the correct class name.", function () {
        expect(contact.className).to.be.ok;
        expect(contact.getClass()).to.equal('webrtc.AbstractContact');
    });

    /*
    * Native methods
    */
    it("contains some important methods.", function () {
        expect(typeof contact.getMessages).to.equal('function');
    });

    /*
    * Presence
    */
    it("can set and get presence and fires the correct event.", function () {
        var newPresence = 'xa';

        sinon.spy(contact, "fire");
        try {
            contact.setPresence(newPresence);

            expect(contact.getPresence()).to.equal(newPresence);
            expect(contact.fire.calledWith('presence')).to.equal(true);
        } finally {
            contact.fire.restore();
        }

    });

    /*
    * Constructor
    */
    it("saves unexpected developer-specified parameters.", function () {
        expect(contact.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(contact.signalingChannel).to.not.exist;
        expect(contact.getSignalingChannel).to.not.exist;
    });
});
