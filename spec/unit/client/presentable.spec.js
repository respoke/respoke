var expect = chai.expect;

describe("A webrtc.Presentable ", function () {
    var presentable = webrtc.Presentable({
        "name": "Mickey Mouse",
        "id": "JH5K34J5K34J3453K4J53K45",
        "gloveColor": "white"
    });

    /*
    * Inheritance
    */
    it("extends webrtc.Class.", function () {
        expect(typeof presentable.getClass).to.equal('function');
    });

    it("extends webrtc.EventEmitter.", function () {
        expect(typeof presentable.listen).to.equal('function');
        expect(typeof presentable.ignore).to.equal('function');
        expect(typeof presentable.fire).to.equal('function');
    });

    /*
    * Make sure there is a className attribute and getClass method on every instance.
    */
    it("has the correct class name.", function () {
        expect(presentable.className).to.be.ok;
        expect(presentable.getClass()).to.equal('webrtc.Presentable');
    });

    /*
    * Native methods
    */
    it("contains some important methods.", function () {
        expect(typeof presentable.getID).to.equal('function');
        expect(typeof presentable.getUsername).to.equal('function');
        expect(typeof presentable.getPresence).to.equal('function');
        expect(typeof presentable.setPresence).to.equal('function');
        expect(typeof presentable.callInProgress).to.equal('function');
    });

    /*
    * Presence
    */
    it("can set and get presence and fires the correct event.", function () {
        var newPresence = 'xa';

        sinon.spy(presentable, "fire");

        try {
            presentable.setPresence(newPresence);

            expect(presentable.getPresence()).to.equal(newPresence);
            expect(presentable.fire.calledWith('presence')).to.equal(true);
        } finally {
            presentable.fire.restore();
        }
    });

    /*
    * Constructor
    */
    it("saves unexpected developer-specified parameters.", function () {
        expect(presentable.gloveColor).to.equal('white');
    });

    it("doesn't expose the signaling channel", function () {
        expect(presentable.signalingChannel).to.not.exist;
        expect(presentable.getSignalingChannel).to.not.exist;
    });
});
